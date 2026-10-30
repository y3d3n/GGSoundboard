/**
 * Framework-agnostic audio engine.
 *
 * Signal flow (two independent AudioContexts, each bound to its own output device):
 *
 *   VIRTUAL chain  (sink = BlackHole / VB-CABLE  →  Discord, Zoom, Meet, games…)
 *     Physical mic → micVolume → micGate (mute · passthrough · push-to-talk) ─┐
 *                                                                            ├→ mixBus → master → limiter → sink
 *     Sound voices → voiceGain → soundBus (volume · mute) ───────────────────┘
 *
 *   MONITOR chain  (sink = your headphones, so you hear the sounds yourself)
 *     Sound voices → voiceGain → soundBus → master(monitor volume) → limiter → sink
 *     (optional) mic → "hear myself" gain ─────────────────────────┘
 *
 * The microphone is NEVER routed to the monitor chain unless "hear myself" is
 * explicitly enabled, and the virtual chain falls back to a silent sink when no
 * virtual device is selected — both prevent acoustic feedback loops.
 *
 * Nothing in this file depends on Vue/Nuxt so it can be reused by another UI or
 * moved into a dedicated audio process.
 */

export type ChainKind = 'virtual' | 'monitor'

export interface Level {
  rms: number
  peak: number
}

export interface Levels {
  mic: Level
  sound: Level
  master: Level
  monitor: Level
}

export interface MicOptions {
  deviceId: string | null
  echoCancellation: boolean
  noiseSuppression: boolean
  autoGainControl: boolean
}

export interface MixState {
  micVolume: number
  soundVolume: number
  masterVolume: number
  micMuted: boolean
  soundMuted: boolean
  micPassthrough: boolean
  pttEnabled: boolean
  pttActive: boolean
  monitorEnabled: boolean
  monitorVolume: number
  hearMyself: boolean
}

export interface PlayOptions {
  volume: number
  loop: boolean
  /** 'both' = virtual mic + monitor, 'monitor' = local preview only */
  target: 'both' | 'monitor'
}

export interface ActiveVoice {
  voiceId: number
  soundId: string
  progress: number
  loop: boolean
  preview: boolean
}

type EngineEvent = 'voices' | 'state' | 'error'
type Listener = (payload?: unknown) => void

const SMOOTH = 0.015 // seconds, time-constant for click-free gain changes

/** Sink value accepted by AudioContext.setSinkId */
type SinkValue = string | { type: 'none' }

interface ChainNodes {
  ctx: AudioContext
  micSource: MediaStreamAudioSourceNode | null
  micVolume: GainNode
  micGate: GainNode
  soundBus: GainNode
  mixBus: GainNode
  master: GainNode
  limiter: DynamicsCompressorNode
  micAnalyser: AnalyserNode
  soundAnalyser: AnalyserNode
  masterAnalyser: AnalyserNode
  sink: SinkValue
}

interface Voice {
  id: number
  soundId: string
  preview: boolean
  loop: boolean
  duration: number
  startedAt: number // performance.now() ms
  nodes: { src: AudioBufferSourceNode; gain: GainNode; chain: ChainKind }[]
  ended: number
}

export function supportsSinkSelection(): boolean {
  return typeof AudioContext !== 'undefined' && 'setSinkId' in AudioContext.prototype
}

export class AudioEngine {
  private chains: Record<ChainKind, ChainNodes> | null = null
  private micStream: MediaStream | null = null
  private voices = new Map<number, Voice>()
  private nextVoiceId = 1
  private listeners = new Map<EngineEvent, Set<Listener>>()
  private scratch = new Float32Array(2048)
  private mix: MixState = {
    micVolume: 1,
    soundVolume: 0.8,
    masterVolume: 1,
    micMuted: false,
    soundMuted: false,
    micPassthrough: true,
    pttEnabled: false,
    pttActive: false,
    monitorEnabled: true,
    monitorVolume: 0.8,
    hearMyself: false,
  }

  micError: string | null = null

  // ───────────────────────── lifecycle ─────────────────────────

  get started() {
    return this.chains !== null
  }

  /** Must be called once; ideally from a user gesture (autoplay policy). */
  async start(sinks: { virtual: string | null; monitor: string | null }) {
    if (this.chains) return
    const virtual = this.createChain()
    const monitor = this.createChain()
    this.chains = { virtual, monitor }
    for (const c of [virtual, monitor]) {
      c.ctx.addEventListener('statechange', () => this.emit('state'))
    }
    await Promise.allSettled([
      this.setSink('virtual', sinks.virtual),
      this.setSink('monitor', sinks.monitor),
    ])
    this.applyMix()
    await this.resume()
  }

  /** Resume suspended contexts (browser autoplay restrictions). */
  async resume() {
    if (!this.chains) return
    await Promise.allSettled(
      Object.values(this.chains).map((c) => (c.ctx.state === 'suspended' ? c.ctx.resume() : undefined)),
    )
    this.emit('state')
  }

  get contextState(): AudioContextState | 'closed' {
    if (!this.chains) return 'closed'
    const states = Object.values(this.chains).map((c) => c.ctx.state)
    if (states.includes('suspended')) return 'suspended'
    return states[0] ?? 'closed'
  }

  /** Base + output latency of the virtual chain, in ms. */
  get latencyMs(): number {
    if (!this.chains) return 0
    const ctx = this.chains.virtual.ctx
    return Math.round(((ctx.baseLatency || 0) + ((ctx as any).outputLatency || 0)) * 1000)
  }

  get sampleRate(): number {
    return this.chains?.virtual.ctx.sampleRate ?? 0
  }

  async dispose() {
    this.stopAll(true)
    this.stopMic()
    if (this.chains) {
      const chains = Object.values(this.chains)
      this.chains = null
      await Promise.allSettled(chains.map((c) => c.ctx.close()))
    }
    this.listeners.clear()
  }

  private createChain(): ChainNodes {
    const ctx = new AudioContext({ latencyHint: 'interactive' })
    const g = () => ctx.createGain()
    const analyser = () => {
      const a = ctx.createAnalyser()
      a.fftSize = 2048
      a.smoothingTimeConstant = 0
      return a
    }
    const micVolume = g()
    const micGate = g()
    const soundBus = g()
    const mixBus = g()
    const master = g()
    const limiter = ctx.createDynamicsCompressor()
    // Brick-wall-ish limiter: keeps the sum of many simultaneous sounds + voice
    // from clipping the output device.
    limiter.threshold.value = -3
    limiter.knee.value = 0
    limiter.ratio.value = 20
    limiter.attack.value = 0.002
    limiter.release.value = 0.12
    const micAnalyser = analyser()
    const soundAnalyser = analyser()
    const masterAnalyser = analyser()

    micVolume.connect(micAnalyser)
    micVolume.connect(micGate).connect(mixBus)
    soundBus.connect(soundAnalyser)
    soundBus.connect(mixBus)
    mixBus.connect(master).connect(limiter)
    limiter.connect(masterAnalyser)
    limiter.connect(ctx.destination)

    micGate.gain.value = 0
    return {
      ctx, micSource: null, micVolume, micGate, soundBus, mixBus, master, limiter,
      micAnalyser, soundAnalyser, masterAnalyser, sink: { type: 'none' },
    }
  }

  // ───────────────────────── output devices ─────────────────────────

  /**
   * Route a chain to an output device. `null` → silent sink for the virtual
   * chain (prevents mic→speaker feedback) and the system default for monitor.
   */
  async setSink(kind: ChainKind, deviceId: string | null) {
    const chain = this.chains?.[kind]
    if (!chain) return
    const target: SinkValue =
      deviceId == null || deviceId === ''
        ? kind === 'virtual'
          ? { type: 'none' }
          : ''
        : deviceId
    if (!supportsSinkSelection()) {
      if (kind === 'virtual') {
        // Without setSinkId we cannot target BlackHole — keep the virtual chain silent.
        await chain.ctx.suspend().catch(() => {})
        this.emitError('This browser cannot select audio output devices. Use the desktop app (Electron) or Chrome 110+.')
      }
      return
    }
    try {
      await (chain.ctx as any).setSinkId(target)
      chain.sink = target
    } catch (err) {
      // Device vanished / permission issue → fall back safely.
      const fallback: SinkValue = kind === 'virtual' ? { type: 'none' } : ''
      try {
        await (chain.ctx as any).setSinkId(fallback)
      } catch { /* ignore */ }
      chain.sink = fallback
      this.emitError(`Could not open ${kind === 'virtual' ? 'virtual' : 'monitor'} output device: ${(err as Error).message}`)
      throw err
    } finally {
      this.emit('state')
    }
  }

  // ───────────────────────── microphone ─────────────────────────

  async startMic(opts: MicOptions): Promise<void> {
    if (!this.chains) throw new Error('Engine not started')
    this.stopMic()
    this.micError = null
    const audio: MediaTrackConstraints = {
      echoCancellation: opts.echoCancellation,
      noiseSuppression: opts.noiseSuppression,
      autoGainControl: opts.autoGainControl,
      channelCount: { ideal: 1 },
      sampleRate: { ideal: this.chains.virtual.ctx.sampleRate },
      ...(opts.deviceId ? { deviceId: { exact: opts.deviceId } } : {}),
    }
    try {
      this.micStream = await navigator.mediaDevices.getUserMedia({ audio, video: false })
    } catch (err) {
      const e = err as DOMException
      if (opts.deviceId && (e.name === 'OverconstrainedError' || e.name === 'NotFoundError')) {
        // Saved device unplugged → fall back to default mic.
        return this.startMic({ ...opts, deviceId: null })
      }
      this.micError = describeMediaError(e)
      this.emit('state')
      throw new Error(this.micError)
    }
    for (const kind of ['virtual', 'monitor'] as ChainKind[]) {
      const chain = this.chains[kind]
      chain.micSource = chain.ctx.createMediaStreamSource(this.micStream)
      chain.micSource.connect(chain.micVolume)
    }
    this.micStream.getAudioTracks().forEach((t) =>
      t.addEventListener('ended', () => {
        this.micError = 'Microphone disconnected'
        this.emit('state')
        this.emitError('Microphone disconnected')
      }),
    )
    this.applyMix()
    this.emit('state')
  }

  stopMic() {
    if (this.chains) {
      for (const c of Object.values(this.chains)) {
        c.micSource?.disconnect()
        c.micSource = null
      }
    }
    this.micStream?.getTracks().forEach((t) => t.stop())
    this.micStream = null
    this.emit('state')
  }

  get micActive() {
    return !!this.micStream && this.micStream.getAudioTracks().some((t) => t.readyState === 'live')
  }

  get micLabel(): string | null {
    return this.micStream?.getAudioTracks()[0]?.label ?? null
  }

  get micDeviceId(): string | null {
    return this.micStream?.getAudioTracks()[0]?.getSettings().deviceId ?? null
  }

  // ───────────────────────── mixing ─────────────────────────

  setMix(partial: Partial<MixState>) {
    Object.assign(this.mix, partial)
    this.applyMix()
  }

  getMix(): Readonly<MixState> {
    return this.mix
  }

  private applyMix() {
    if (!this.chains) return
    const m = this.mix
    const micOpen = !m.micMuted && m.micPassthrough && (!m.pttEnabled || m.pttActive)
    const soundGain = m.soundMuted ? 0 : m.soundVolume
    const v = this.chains.virtual
    const mon = this.chains.monitor
    ramp(v, v.micVolume.gain, m.micVolume)
    ramp(v, v.micGate.gain, micOpen ? 1 : 0)
    ramp(v, v.soundBus.gain, soundGain)
    ramp(v, v.master.gain, m.masterVolume)

    ramp(mon, mon.micVolume.gain, m.micVolume)
    ramp(mon, mon.micGate.gain, m.hearMyself && micOpen ? 1 : 0)
    ramp(mon, mon.soundBus.gain, soundGain)
    ramp(mon, mon.master.gain, m.monitorEnabled ? m.monitorVolume : 0)
  }

  // ───────────────────────── playback ─────────────────────────

  /** Decode raw file bytes into an AudioBuffer usable by both chains. */
  async decode(data: ArrayBuffer): Promise<AudioBuffer> {
    // decodeAudioData detaches the buffer, so hand it a copy.
    const ctx = this.chains?.virtual.ctx ?? new OfflineAudioContext(2, 1, 48000)
    return await ctx.decodeAudioData(data.slice(0))
  }

  play(soundId: string, buffer: AudioBuffer, opts: PlayOptions): number {
    if (!this.chains) throw new Error('Engine not started')
    void this.resume()
    const id = this.nextVoiceId++
    const voice: Voice = {
      id,
      soundId,
      preview: opts.target === 'monitor',
      loop: opts.loop,
      duration: buffer.duration,
      startedAt: performance.now(),
      nodes: [],
      ended: 0,
    }
    const kinds: ChainKind[] = opts.target === 'both' ? ['virtual', 'monitor'] : ['monitor']
    for (const kind of kinds) {
      const chain = this.chains[kind]
      const src = chain.ctx.createBufferSource()
      src.buffer = buffer
      src.loop = opts.loop
      const gain = chain.ctx.createGain()
      gain.gain.value = opts.volume
      src.connect(gain).connect(chain.soundBus)
      src.onended = () => {
        src.disconnect()
        gain.disconnect()
        voice.ended++
        if (voice.ended >= voice.nodes.length && this.voices.delete(id)) this.emit('voices')
      }
      src.start()
      voice.nodes.push({ src, gain, chain: kind })
    }
    this.voices.set(id, voice)
    this.emit('voices')
    return id
  }

  /** Live-update the volume of every voice playing a given sound. */
  setSoundVolume(soundId: string, volume: number) {
    for (const v of this.voices.values()) {
      if (v.soundId !== soundId) continue
      for (const n of v.nodes) {
        const chain = this.chains?.[n.chain]
        if (chain) ramp(chain, n.gain.gain, volume)
      }
    }
  }

  setSoundLoop(soundId: string, loop: boolean) {
    for (const v of this.voices.values()) {
      if (v.soundId !== soundId) continue
      v.loop = loop
      for (const n of v.nodes) n.src.loop = loop
    }
  }

  stopVoice(id: number, fade = true) {
    const v = this.voices.get(id)
    if (!v || !this.chains) return
    this.voices.delete(id)
    for (const n of v.nodes) {
      const ctx = this.chains[n.chain].ctx
      const t = ctx.currentTime
      try {
        if (fade) {
          n.gain.gain.cancelScheduledValues(t)
          n.gain.gain.setValueAtTime(n.gain.gain.value, t)
          n.gain.gain.linearRampToValueAtTime(0, t + 0.04)
          n.src.stop(t + 0.045)
        } else {
          n.src.stop()
        }
      } catch { /* already stopped */ }
    }
    this.emit('voices')
  }

  stopSound(soundId: string, opts: { preview?: boolean } = {}) {
    for (const v of [...this.voices.values()]) {
      if (v.soundId === soundId && (opts.preview === undefined || v.preview === opts.preview)) this.stopVoice(v.id)
    }
  }

  stopAll(immediate = false) {
    for (const id of [...this.voices.keys()]) this.stopVoice(id, !immediate)
  }

  isPlaying(soundId: string, preview = false) {
    for (const v of this.voices.values()) if (v.soundId === soundId && v.preview === preview) return true
    return false
  }

  getActiveVoices(): ActiveVoice[] {
    const now = performance.now()
    return [...this.voices.values()].map((v) => {
      const elapsed = (now - v.startedAt) / 1000
      const progress = v.duration > 0 ? (v.loop ? (elapsed % v.duration) / v.duration : Math.min(1, elapsed / v.duration)) : 0
      return { voiceId: v.id, soundId: v.soundId, progress, loop: v.loop, preview: v.preview }
    })
  }

  // ───────────────────────── metering ─────────────────────────

  getLevels(): Levels {
    const zero = { rms: 0, peak: 0 }
    if (!this.chains) return { mic: zero, sound: zero, master: zero, monitor: zero }
    return {
      mic: this.measure(this.chains.virtual.micAnalyser),
      sound: this.measure(this.chains.virtual.soundAnalyser),
      master: this.measure(this.chains.virtual.masterAnalyser),
      monitor: this.measure(this.chains.monitor.masterAnalyser),
    }
  }

  private measure(a: AnalyserNode): Level {
    const buf = this.scratch.length === a.fftSize ? this.scratch : (this.scratch = new Float32Array(a.fftSize))
    a.getFloatTimeDomainData(buf)
    let sum = 0
    let peak = 0
    for (let i = 0; i < buf.length; i++) {
      const s = buf[i]!
      sum += s * s
      const abs = s < 0 ? -s : s
      if (abs > peak) peak = abs
    }
    return { rms: Math.sqrt(sum / buf.length), peak }
  }

  // ───────────────────────── events ─────────────────────────

  on(event: EngineEvent, fn: Listener) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set())
    this.listeners.get(event)!.add(fn)
    return () => this.listeners.get(event)?.delete(fn)
  }

  private emit(event: EngineEvent, payload?: unknown) {
    this.listeners.get(event)?.forEach((fn) => fn(payload))
  }

  private emitError(message: string) {
    this.emit('error', message)
  }
}

function ramp(chain: ChainNodes, param: AudioParam, value: number) {
  const t = chain.ctx.currentTime
  param.cancelScheduledValues(t)
  param.setTargetAtTime(value, t, SMOOTH)
}

export function describeMediaError(e: DOMException | Error): string {
  switch (e.name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return 'Microphone permission denied. Allow microphone access in System Settings → Privacy & Security → Microphone (or your browser site settings).'
    case 'NotFoundError':
      return 'No microphone found. Connect a microphone and try again.'
    case 'NotReadableError':
      return 'The microphone is in use by another application or could not be opened.'
    case 'OverconstrainedError':
      return 'The selected microphone is unavailable.'
    default:
      return e.message || 'Could not access the microphone.'
  }
}

/** Linear amplitude → dBFS (clamped). */
export function toDb(x: number, floor = -60) {
  if (x <= 0) return floor
  return Math.max(floor, 20 * Math.log10(x))
}
