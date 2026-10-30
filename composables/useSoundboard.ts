/**
 * Application store: glue between the UI, the audio engine, persistence and
 * hotkeys. A single module-level instance (the app is client-only).
 */
import { computed, reactive, shallowRef, watch } from 'vue'
import { AudioEngine, supportsSinkSelection, type Levels } from '~/engine/AudioEngine'
import { detectPlatform, findVirtualOutput, listDevices, virtualMicNameFor, type AudioDevice } from '~/engine/devices'
import { comboToAccelerator, DEFAULT_PAD_KEYS, isUnsafeGlobal } from '~/lib/hotkeys'
import { createStorage, type StorageBackend } from '~/lib/storage'
import { DEFAULT_SETTINGS, type Collection, type ConnectedDevice, type PersistedState, type Settings, type Sound } from '~/lib/types'
import { useToasts } from './useToasts'
import { useUi } from './useUi'

export interface PlayingInfo {
  progress: number
  loop: boolean
  voices: number
}

export type Conflict =
  | { type: 'sound'; sound: Sound }
  | { type: 'ptt' }
  | { type: 'stopAll' }

const AUDIO_EXT = /\.(mp3|wav|wave|ogg|oga|opus|m4a|aac|flac|webm|weba|mp4|caf|aif|aiff)$/i

const uid = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID().replace(/-/g, '').slice(0, 16)
    : Math.random().toString(36).slice(2, 10) + Date.now().toString(36)

const ZERO_LEVELS: Levels = {
  mic: { rms: 0, peak: 0 },
  sound: { rms: 0, peak: 0 },
  master: { rms: 0, peak: 0 },
  monitor: { rms: 0, peak: 0 },
}

// ───────────────────────── state ─────────────────────────

const engine = new AudioEngine()
let storage: StorageBackend | null = null
const buffers = new Map<string, AudioBuffer>()
const loading = new Map<string, Promise<AudioBuffer | null>>()

const state = reactive({
  ready: false,
  sounds: [] as Sound[],
  collections: [] as Collection[],
  settings: { ...DEFAULT_SETTINGS } as Settings,
  activeCollection: 'all' as string,
  search: '',
  inputs: [] as AudioDevice[],
  outputs: [] as AudioDevice[],
  labelsAvailable: false,
  engineState: 'closed' as AudioContextState | 'closed',
  micActive: false,
  micLabel: null as string | null,
  micError: null as string | null,
  pttHeld: false,
  globalRegistered: [] as string[],
  globalFailed: [] as string[],
  recordingHotkey: false,
  latencyMs: 0,
  sampleRate: 0,
  failedSounds: [] as string[],
  remoteRunning: false,
  remotePort: 4567,
  remoteIp: '',
  remoteUrl: '',
  remotePin: '4829',
  remoteQr: '',
  remoteDevices: [] as ConnectedDevice[],
})

const levels = shallowRef<Levels>(ZERO_LEVELS)
const playing = shallowRef<Record<string, PlayingInfo>>({})
const previewing = shallowRef<Record<string, PlayingInfo>>({})

const platform = detectPlatform()
const native = typeof window !== 'undefined' ? window.soundboardNative : undefined
const { push: toast } = useToasts()

// ───────────────────────── derived ─────────────────────────

const virtualDevice = computed(() => state.outputs.find((d) => d.deviceId === state.settings.virtualOutputId) ?? null)
const monitorDevice = computed(() => state.outputs.find((d) => d.deviceId === state.settings.monitorOutputId) ?? null)
const virtualDriverInstalled = computed(() => state.outputs.some((d) => d.isVirtual && !d.isDefault))
const virtualMicName = computed(() => virtualMicNameFor(virtualDevice.value?.label, platform))

const routingStatus = computed<'ok' | 'no-driver' | 'not-selected' | 'unsupported' | 'not-virtual'>(() => {
  if (!supportsSinkSelection()) return 'unsupported'
  if (!state.settings.virtualOutputId || !virtualDevice.value) return virtualDriverInstalled.value ? 'not-selected' : 'no-driver'
  if (!virtualDevice.value.isVirtual) return 'not-virtual'
  return 'ok'
})

const visibleSounds = computed(() => {
  const q = state.search.trim().toLowerCase()
  return state.sounds.filter((s) => {
    if (state.activeCollection !== 'all' && s.collectionId !== state.activeCollection) return false
    if (q && !s.name.toLowerCase().includes(q)) return false
    return true
  })
})

// ───────────────────────── init ─────────────────────────

let initialized = false
let rafId = 0

async function init() {
  if (initialized) return
  initialized = true
  storage = createStorage()

  try {
    const saved = await storage.loadState()
    if (saved) {
      state.sounds = (saved.sounds ?? []).map((s) => ({ ...s }))
      state.collections = saved.collections ?? []
      state.settings = { ...DEFAULT_SETTINGS, ...(saved.settings ?? {}) }
    }
  } catch (err) {
    toast(`Could not load saved library: ${(err as Error).message}`, 'error')
  }

  engine.on('error', (msg) => toast(String(msg), 'error'))
  engine.on('state', syncEngineState)
  engine.on('voices', () => { /* progress is polled in the rAF loop */ })

  navigator.mediaDevices?.addEventListener?.('devicechange', () => void refreshDevices())

  await refreshDevices()
  await engine.start({ virtual: null, monitor: null })
  engine.setMix(mixFromSettings())
  await routeOutputs()
  await startMic()
  syncEngineState()

  state.ready = true
  installWatchers()
  startLoop()
  void preloadAll()
}

function syncEngineState() {
  state.engineState = engine.contextState
  state.micActive = engine.micActive
  state.micLabel = engine.micLabel
  state.micError = engine.micError
  state.latencyMs = engine.latencyMs
  state.sampleRate = engine.sampleRate
}

function mixFromSettings() {
  const s = state.settings
  return {
    micVolume: s.micVolume,
    soundVolume: s.soundVolume,
    masterVolume: s.masterVolume,
    micMuted: s.micMuted,
    soundMuted: s.soundMuted,
    micPassthrough: s.micPassthrough,
    pttEnabled: s.pttEnabled,
    pttActive: state.pttHeld,
    monitorEnabled: s.monitorEnabled,
    monitorVolume: s.monitorVolume,
    hearMyself: s.hearMyself,
  }
}

function startLoop() {
  let frame = 0
  const tick = () => {
    rafId = requestAnimationFrame(tick)
    levels.value = engine.getLevels()
    // Progress at ~30fps is plenty.
    if (frame++ % 2) return
    const p: Record<string, PlayingInfo> = {}
    const pv: Record<string, PlayingInfo> = {}
    for (const v of engine.getActiveVoices()) {
      const target = v.preview ? pv : p
      const cur = target[v.soundId]
      if (!cur) target[v.soundId] = { progress: v.progress, loop: v.loop, voices: 1 }
      else {
        cur.voices++
        cur.progress = Math.min(cur.progress, v.progress) // newest voice
      }
    }
    if (!shallowEqualPlaying(p, playing.value)) playing.value = p
    if (!shallowEqualPlaying(pv, previewing.value)) previewing.value = pv

    // Stream playing progress to connected remote controllers
    if (frame % 4 === 0 && native && state.remoteRunning) {
      native.broadcastRemotePlaying(p).catch(() => {})
    }
  }
  rafId = requestAnimationFrame(tick)
}

function shallowEqualPlaying(a: Record<string, PlayingInfo>, b: Record<string, PlayingInfo>) {
  const ka = Object.keys(a)
  if (ka.length !== Object.keys(b).length) return false
  if (ka.length === 0) return true
  return false // progress changes every frame while anything plays
}

// ───────────────────────── devices / routing ─────────────────────────

async function refreshDevices() {
  try {
    const { inputs, outputs, labelsAvailable } = await listDevices()
    state.inputs = inputs
    state.outputs = outputs
    state.labelsAvailable = labelsAvailable
  } catch (err) {
    toast(`Could not list audio devices: ${(err as Error).message}`, 'error')
    return
  }
  const s = state.settings
  // Device ids can change between OS sessions → re-match by label.
  if (s.virtualOutputId && !state.outputs.some((d) => d.deviceId === s.virtualOutputId) && s.virtualOutputLabel) {
    const byLabel = state.outputs.find((d) => d.label === s.virtualOutputLabel)
    if (byLabel) s.virtualOutputId = byLabel.deviceId
  }
  // Auto-pick BlackHole / VB-CABLE the first time it shows up.
  if (!s.virtualOutputId && state.labelsAvailable) {
    const v = findVirtualOutput(state.outputs)
    if (v) {
      s.virtualOutputId = v.deviceId
      s.virtualOutputLabel = v.label
      if (state.ready) toast(`Virtual device detected: ${v.label}`, 'success')
    }
  }
  if (s.micDeviceId && state.labelsAvailable && !state.inputs.some((d) => d.deviceId === s.micDeviceId)) {
    // Selected mic unplugged — startMic falls back to default.
    if (state.ready) toast('Selected microphone disconnected — using system default', 'info')
  }
  if (state.ready) await routeOutputs()
}

let routed: { virtual: string | null; monitor: string | null } = { virtual: '__init', monitor: '__init' }

async function routeOutputs() {
  if (!engine.started) return
  const s = state.settings
  const virtual = s.virtualOutputId && state.outputs.some((d) => d.deviceId === s.virtualOutputId) ? s.virtualOutputId : null
  let monitor = s.monitorOutputId && state.outputs.some((d) => d.deviceId === s.monitorOutputId) ? s.monitorOutputId : null
  // Never send the monitor mix into the virtual device too.
  if (monitor && monitor === virtual) monitor = null
  if (routed.virtual !== virtual) {
    if (routed.virtual && routed.virtual !== '__init' && !virtual && s.virtualOutputId) toast('Virtual audio device disconnected', 'error')
    routed.virtual = virtual
    await engine.setSink('virtual', virtual).catch(() => {})
  }
  if (routed.monitor !== monitor) {
    routed.monitor = monitor
    await engine.setSink('monitor', monitor).catch(() => {})
  }
  syncEngineState()
}

async function startMic() {
  const s = state.settings
  try {
    await engine.startMic({
      deviceId: s.micDeviceId,
      echoCancellation: s.echoCancellation,
      noiseSuppression: s.noiseSuppression,
      autoGainControl: s.autoGainControl,
    })
    if (!state.labelsAvailable) await refreshDevices() // labels appear after permission
  } catch (err) {
    toast((err as Error).message, 'error', 7000)
  }
  syncEngineState()
}

async function resumeAudio() {
  await engine.resume()
  syncEngineState()
}

// ───────────────────────── watchers / persistence ─────────────────────────

let saveTimer: ReturnType<typeof setTimeout> | null = null
function schedulePersist() {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(persistNow, 300)
}
async function persistNow() {
  saveTimer = null
  if (!storage) return
  const data: PersistedState = {
    version: 1,
    sounds: state.sounds,
    collections: state.collections,
    settings: state.settings,
  }
  try {
    await storage.saveState(JSON.parse(JSON.stringify(data)))
  } catch (err) {
    toast(`Could not save settings: ${(err as Error).message}`, 'error')
  }
}

function installWatchers() {
  watch(() => [state.sounds, state.collections, state.settings], schedulePersist, { deep: true })

  watch(
    () => mixFromSettings(),
    (m) => engine.setMix(m),
    { deep: true },
  )
  watch(
    () => [state.settings.virtualOutputId, state.settings.monitorOutputId],
    () => {
      const v = virtualDevice.value
      state.settings.virtualOutputLabel = v?.label ?? state.settings.virtualOutputLabel
      void routeOutputs()
    },
  )
  watch(
    () => [state.settings.micDeviceId, state.settings.echoCancellation, state.settings.noiseSuppression, state.settings.autoGainControl],
    () => void startMic(),
  )
  watch(
    () => [state.settings.globalHotkeys, state.settings.stopAllKey, state.sounds.map((s) => s.hotkey).join('|')],
    () => void syncGlobalHotkeys(),
    { immediate: true },
  )

  if (native) {
    native.onHotkey((id) => {
      if (id === '__stopAll') stopAll()
      else void triggerSound(id)
    })

    // Listen for authorized playback commands from remote controllers
    native.onRemoteCommand((cmd) => {
      if (cmd.type === 'sound:play' && cmd.soundId) {
        void triggerSound(cmd.soundId)
      } else if (cmd.type === 'sound:stop' && cmd.soundId) {
        stopSound(cmd.soundId)
      } else if (cmd.type === 'sound:stop-all') {
        stopAll()
      } else if (cmd.type === 'sound:volume' && cmd.soundId && typeof cmd.volume === 'number') {
        updateSound(cmd.soundId, { volume: cmd.volume })
      }
    })

    // Listen for device pairing and connection updates
    native.onRemoteDevices((devices) => {
      state.remoteDevices = devices
    })

    if (state.settings.remoteEnabled) {
      void startRemoteServer()
    }
  }

  watch(() => [state.sounds, state.collections], () => syncRemoteSoundboard(), { deep: true })

  window.addEventListener('beforeunload', () => {
    if (saveTimer) void persistNow()
    cancelAnimationFrame(rafId)
    void engine.dispose()
  })
}

// ───────────────────────── global hotkeys ─────────────────────────

async function syncGlobalHotkeys() {
  if (!native) return
  const list: { id: string; accelerator: string }[] = []
  if (state.settings.globalHotkeys) {
    for (const s of state.sounds) {
      if (!s.hotkey || isUnsafeGlobal(s.hotkey)) continue
      const acc = comboToAccelerator(s.hotkey)
      if (acc) list.push({ id: s.id, accelerator: acc })
    }
    const stop = state.settings.stopAllKey
    if (stop && !isUnsafeGlobal(stop)) {
      const acc = comboToAccelerator(stop)
      if (acc) list.push({ id: '__stopAll', accelerator: acc })
    }
  }
  try {
    const res = await native.registerHotkeys(list)
    state.globalRegistered = res.registered
    state.globalFailed = res.failed
  } catch {
    state.globalRegistered = []
  }
}

/** True if the combo is currently handled by a global shortcut (avoid double-firing). */
function isGloballyHandled(combo: string) {
  if (!native || !state.settings.globalHotkeys) return false
  if (combo === state.settings.stopAllKey) return state.globalRegistered.includes('__stopAll')
  const s = state.sounds.find((x) => x.hotkey === combo)
  return !!s && state.globalRegistered.includes(s.id)
}

// ───────────────────────── remote controller server ─────────────────────────

async function syncRemoteStatus() {
  if (!native) return
  try {
    const status = await native.getRemoteServerStatus()
    state.remoteRunning = status.running
    state.remotePort = status.port
    state.remoteIp = status.ip
    state.remoteUrl = status.url
    state.remotePin = status.pin
    state.remoteQr = (status as any).qrDataUrl || ''
    state.remoteDevices = status.devices || []
  } catch {
    // ignore
  }
}

async function startRemoteServer() {
  if (!native) return
  try {
    const status = await native.startRemoteServer({
      port: state.settings.remotePort,
      pin: state.settings.remotePin,
    })
    state.remoteRunning = status.running
    state.remotePort = status.port
    state.remoteIp = status.ip
    state.remoteUrl = status.url
    state.remotePin = status.pin
    state.remoteQr = (status as any).qrDataUrl || ''
    state.remoteDevices = status.devices || []
    syncRemoteSoundboard()
  } catch (err) {
    toast(`Could not start remote controller server: ${(err as Error).message}`, 'error')
  }
}

async function stopRemoteServer() {
  if (!native) return
  await native.stopRemoteServer()
  state.remoteRunning = false
  state.remoteDevices = []
}

async function toggleRemoteServer(enabled?: boolean) {
  const target = enabled !== undefined ? enabled : !state.settings.remoteEnabled
  state.settings.remoteEnabled = target
  if (target) {
    await startRemoteServer()
    toast('Remote controller server enabled', 'success')
  } else {
    await stopRemoteServer()
    toast('Remote controller server stopped', 'info')
  }
}

async function regenerateRemotePin() {
  const pin = String(Math.floor(1000 + Math.random() * 9000))
  state.settings.remotePin = pin
  state.remotePin = pin
  if (native) {
    await native.setRemotePin(pin)
    await syncRemoteStatus()
  }
  toast(`New pairing PIN: ${pin}`, 'info')
}

async function revokeRemoteDevice(deviceId: string) {
  if (!native) return
  await native.revokeRemoteDevice(deviceId)
  state.remoteDevices = state.remoteDevices.filter((d) => d.id !== deviceId)
  toast('Device access revoked', 'info')
}

function syncRemoteSoundboard() {
  if (!native || !state.remoteRunning) return
  const data = {
    sounds: state.sounds.map((s) => ({
      id: s.id,
      name: s.name,
      icon: s.icon,
      color: s.color || null,
      hotkey: s.hotkey,
      volume: s.volume,
      loop: s.loop,
      duration: s.duration,
      collectionId: s.collectionId,
    })),
    collections: state.collections.map((c) => ({
      id: c.id,
      name: c.name,
      icon: c.icon || null,
      color: c.color || null,
    })),
  }
  native.syncRemoteSoundboard(data).catch(() => {})
}

// ───────────────────────── sounds ─────────────────────────

async function getBuffer(sound: Sound): Promise<AudioBuffer | null> {
  const cached = buffers.get(sound.id)
  if (cached) return cached
  const pending = loading.get(sound.id)
  if (pending) return pending
  const p = (async () => {
    try {
      const data = await storage!.readFile(sound.file)
      const buf = await engine.decode(data)
      buffers.set(sound.id, buf)
      state.failedSounds = state.failedSounds.filter((id) => id !== sound.id)
      return buf
    } catch (err) {
      if (!state.failedSounds.includes(sound.id)) state.failedSounds.push(sound.id)
      toast(`Could not load “${sound.name}”: ${(err as Error).message}`, 'error')
      return null
    } finally {
      loading.delete(sound.id)
    }
  })()
  loading.set(sound.id, p)
  return p
}

async function preloadAll() {
  for (const s of state.sounds) await getBuffer(s)
}

async function triggerSound(id: string) {
  const sound = state.sounds.find((s) => s.id === id)
  if (!sound) return
  if (!engine.started) return
  if (sound.loop && engine.isPlaying(id)) {
    engine.stopSound(id, { preview: false })
    return
  }
  const buf = await getBuffer(sound)
  if (!buf) return

  // Stop previous audio before playing the new sound
  if (state.settings.exclusivePlayback !== false) {
    engine.stopAll(false)
  } else {
    engine.stopSound(id, { preview: false })
  }

  engine.play(id, buf, { volume: sound.volume, loop: sound.loop, target: 'both' })
}

async function previewSound(id: string) {
  const sound = state.sounds.find((s) => s.id === id)
  if (!sound || !engine.started) return
  if (engine.isPlaying(id, true)) {
    engine.stopSound(id, { preview: true })
    return
  }
  const buf = await getBuffer(sound)
  if (!buf) return

  // Stop previous audio before playing new preview
  if (state.settings.exclusivePlayback !== false) {
    engine.stopAll(false)
  } else {
    engine.stopSound(id, { preview: true })
  }

  engine.play(id, buf, { volume: sound.volume, loop: false, target: 'monitor' })
}

function stopSound(id: string) {
  engine.stopSound(id)
}

function stopAll() {
  engine.stopAll()
}

function nextFreeHotkey(): string | null {
  const used = new Set([...state.sounds.map((s) => s.hotkey), state.settings.pttKey, state.settings.stopAllKey])
  return DEFAULT_PAD_KEYS.find((k) => !used.has(k)) ?? null
}

function isAudioFile(f: File) {
  return f.type.startsWith('audio/') || AUDIO_EXT.test(f.name) || (f.type === 'video/webm' || f.type === 'video/mp4')
}

async function importFiles(files: File[] | FileList, options: { autoEdit?: boolean } = { autoEdit: true }) {
  const list = [...files]
  const audio = list.filter(isAudioFile)
  const skipped = list.length - audio.length
  if (!storage) return []
  const collectionId = state.activeCollection === 'all' ? null : state.activeCollection
  let imported = 0
  const newlyImported: Sound[] = []
  for (const f of audio) {
    try {
      const data = await f.arrayBuffer()
      const buf = await engine.decode(data) // validates the format
      const id = uid()
      const ext = (f.name.match(/\.([a-z0-9]{1,5})$/i)?.[1] ?? f.type.split('/')[1] ?? 'audio').toLowerCase().replace(/[^a-z0-9]/g, '')
      const file = `${id}.${ext}`
      await storage.saveFile(file, data)
      buffers.set(id, buf)
      const soundItem: Sound = {
        id,
        name: f.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim().slice(0, 60) || 'Untitled',
        file,
        originalName: f.name,
        mime: f.type,
        size: f.size,
        duration: buf.duration,
        volume: 1,
        loop: false,
        hotkey: nextFreeHotkey(),
        icon: null,
        color: null,
        collectionId,
        createdAt: Date.now(),
      }
      state.sounds.push(soundItem)
      newlyImported.push(soundItem)
      imported++
    } catch (err) {
      toast(`“${f.name}” is not a supported audio file`, 'error')
    }
  }
  if (imported) {
    toast(`Imported ${imported} sound${imported > 1 ? 's' : ''}`, 'success', 2500)
    if (options.autoEdit !== false && newlyImported.length > 0) {
      const { ui } = useUi()
      ui.editingSoundId = newlyImported[0].id
    }
  }
  if (skipped) toast(`Skipped ${skipped} non-audio file${skipped > 1 ? 's' : ''}`, 'info')
  return newlyImported
}

function updateSound(id: string, patch: Partial<Sound>) {
  const s = state.sounds.find((x) => x.id === id)
  if (!s) return
  Object.assign(s, patch)
  if (patch.volume !== undefined) engine.setSoundVolume(id, patch.volume)
  if (patch.loop !== undefined) engine.setSoundLoop(id, patch.loop)
}

async function deleteSound(id: string) {
  const i = state.sounds.findIndex((s) => s.id === id)
  if (i < 0) return
  const [s] = state.sounds.splice(i, 1)
  engine.stopSound(id)
  buffers.delete(id)
  try {
    await storage?.deleteFile(s!.file)
  } catch { /* file already gone */ }
}

function moveSound(id: string, toIndexOfId: string) {
  const from = state.sounds.findIndex((s) => s.id === id)
  const to = state.sounds.findIndex((s) => s.id === toIndexOfId)
  if (from < 0 || to < 0 || from === to) return
  const [s] = state.sounds.splice(from, 1)
  state.sounds.splice(to, 0, s!)
}

// ───────────────────────── hotkey conflicts ─────────────────────────

function findConflict(combo: string, owner: { soundId?: string; role?: 'ptt' | 'stopAll' }): Conflict | null {
  if (owner.role !== 'ptt' && state.settings.pttEnabled && state.settings.pttKey === combo) return { type: 'ptt' }
  if (owner.role !== 'stopAll' && state.settings.stopAllKey === combo) return { type: 'stopAll' }
  const s = state.sounds.find((x) => x.hotkey === combo && x.id !== owner.soundId)
  return s ? { type: 'sound', sound: s } : null
}

/** Assign a hotkey, optionally stealing it from whatever currently owns it. */
function assignHotkey(combo: string | null, owner: { soundId?: string; role?: 'ptt' | 'stopAll' }, steal = false) {
  if (combo) {
    const c = findConflict(combo, owner)
    if (c && !steal) return c
    if (c?.type === 'sound') c.sound.hotkey = null
    if (c?.type === 'ptt') state.settings.pttKey = ''
    if (c?.type === 'stopAll') state.settings.stopAllKey = ''
  }
  if (owner.soundId) updateSound(owner.soundId, { hotkey: combo })
  else if (owner.role === 'ptt') state.settings.pttKey = combo ?? ''
  else if (owner.role === 'stopAll') state.settings.stopAllKey = combo ?? ''
  return null
}

// ───────────────────────── collections ─────────────────────────

function createCollection(name: string, icon?: string | null, color?: string | null) {
  const c: Collection = { id: uid(), name: name.trim() || 'Untitled', icon: icon || null, color: color || null }
  state.collections.push(c)
  return c
}
function renameCollection(id: string, name: string) {
  const c = state.collections.find((x) => x.id === id)
  if (c && name.trim()) c.name = name.trim()
}
function updateCollection(id: string, patch: Partial<Omit<Collection, 'id'>>) {
  const c = state.collections.find((x) => x.id === id)
  if (c) Object.assign(c, patch)
}
function deleteCollection(id: string) {
  state.collections = state.collections.filter((c) => c.id !== id)
  for (const s of state.sounds) if (s.collectionId === id) s.collectionId = null
  if (state.activeCollection === id) state.activeCollection = 'all'
}

// ───────────────────────── push-to-talk ─────────────────────────

function setPtt(active: boolean) {
  if (state.pttHeld === active) return
  state.pttHeld = active
  engine.setMix({ pttActive: active })
}

async function loadStarterSounds() {
  const starters = [
    { name: 'Air Horn', path: '/starter/airhorn.wav', icon: 'siren', color: 'rose' },
    { name: 'Ba-Dum-Tss', path: '/starter/badumtss.wav', icon: 'drum', color: 'amber' },
    { name: 'Level Up', path: '/starter/levelup.wav', icon: 'trophy', color: 'emerald' },
    { name: 'Laser Zap', path: '/starter/laser.wav', icon: 'zap', color: 'cyan' },
    { name: 'Game Over', path: '/starter/gameover.wav', icon: 'skull', color: 'purple' },
    { name: 'Notification Chime', path: '/starter/chime.wav', icon: 'bell', color: 'indigo' },
  ]
  let count = 0
  for (const item of starters) {
    try {
      const res = await fetch(item.path)
      if (!res.ok) continue
      const data = await res.arrayBuffer()
      const buf = await engine.decode(data)
      const id = uid()
      const file = `${id}.wav`
      await storage?.saveFile(file, data)
      buffers.set(id, buf)
      state.sounds.push({
        id,
        name: item.name,
        file,
        originalName: `${item.name.toLowerCase().replace(/\s+/g, '-')}.wav`,
        mime: 'audio/wav',
        size: data.byteLength,
        duration: buf.duration,
        volume: 1,
        loop: false,
        hotkey: nextFreeHotkey(),
        icon: item.icon,
        color: item.color,
        collectionId: null,
        createdAt: Date.now(),
      })
      count++
    } catch {
      // ignore
    }
  }
  if (count) toast(`Added ${count} starter sounds`, 'success')
}

export function useSoundboard() {
  return {
    state,
    levels,
    playing,
    previewing,
    platform,
    native,
    storageKind: () => storage?.kind ?? 'indexeddb',
    virtualDevice,
    monitorDevice,
    virtualDriverInstalled,
    virtualMicName,
    routingStatus,
    visibleSounds,
    init,
    resumeAudio,
    refreshDevices,
    startMic,
    triggerSound,
    previewSound,
    stopSound,
    stopAll,
    importFiles,
    loadStarterSounds,
    updateSound,
    deleteSound,
    moveSound,
    findConflict,
    assignHotkey,
    isGloballyHandled,
    createCollection,
    renameCollection,
    updateCollection,
    deleteCollection,
    setPtt,
    syncRemoteStatus,
    startRemoteServer,
    stopRemoteServer,
    toggleRemoteServer,
    regenerateRemotePin,
    revokeRemoteDevice,
    syncRemoteSoundboard,
  }
}
