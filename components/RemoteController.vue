<script setup lang="ts">
import { io, type Socket } from 'socket.io-client'
import {
  Square, Search, Wifi, WifiOff, LogOut, Radio, Volume2, Repeat, Check, Shield, AlertTriangle
} from 'lucide-vue-next'
import { computePadTheme, resolveColorHex } from '~/lib/colors'
import type { RemoteSound, RemoteCollection } from '~/lib/types'

interface PlayingVoice {
  progress: number
  loop: boolean
  voices: number
}

// ── State ──
const socket = ref<Socket | null>(null)
const connectionStatus = ref<'connecting' | 'unpaired' | 'connected' | 'disconnected'>('connecting')
const authError = ref<string | null>(null)

// Pairing data
const deviceId = ref('')
const deviceName = ref('')
const pinInput = ref('')

// Soundboard data synced from desktop
const sounds = ref<RemoteSound[]>([])
const collections = ref<RemoteCollection[]>([])
const activeCollection = ref('all')
const searchQuery = ref('')
const playingState = ref<Record<string, PlayingVoice>>({})

// Filtered sounds
const visibleSounds = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  return sounds.value.filter((s) => {
    if (activeCollection.value !== 'all' && s.collectionId !== activeCollection.value) return false
    if (q && !s.name.toLowerCase().includes(q)) return false
    return true
  })
})

const anyPlaying = computed(() => Object.keys(playingState.value).length > 0)
const playingCount = computed(() => Object.keys(playingState.value).length)

// Category sound counts
const collectionCounts = computed(() => {
  const map: Record<string, number> = { all: sounds.value.length }
  for (const s of sounds.value) {
    if (s.collectionId) map[s.collectionId] = (map[s.collectionId] || 0) + 1
  }
  return map
})

function detectDeviceName() {
  if (typeof navigator === 'undefined') return 'Remote Controller'
  const ua = navigator.userAgent
  if (/iPad/i.test(ua)) return 'iPad'
  if (/iPhone/i.test(ua)) return 'iPhone'
  if (/Android/i.test(ua)) return 'Android Tablet'
  if (/Mac/i.test(ua)) return 'Mac Controller'
  if (/Win/i.test(ua)) return 'Windows Controller'
  return 'Mobile Controller'
}

// ── Socket initialization ──
function initSocket() {
  if (typeof window === 'undefined') return

  // Connect to the host running this app
  const serverUrl = window.location.origin
  socket.value = io(serverUrl, {
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
  })

  socket.value.on('connect', () => {
    connectionStatus.value = 'connecting'
    authError.value = null

    // Attempt auto-authentication with saved token
    const savedToken = localStorage.getItem('sb_remote_token')
    socket.value?.emit('device:auth', {
      token: savedToken || undefined,
      deviceId: deviceId.value,
      deviceName: deviceName.value,
    })
  })

  socket.value.on('disconnect', () => {
    connectionStatus.value = 'disconnected'
  })

  socket.value.on('device:auth:success', (data: { token: string; deviceId: string; deviceName: string }) => {
    connectionStatus.value = 'connected'
    authError.value = null
    if (data.token) localStorage.setItem('sb_remote_token', data.token)
    if (data.deviceId) localStorage.setItem('sb_remote_device_id', data.deviceId)
    if (data.deviceName) localStorage.setItem('sb_remote_device_name', data.deviceName)
  })

  socket.value.on('device:auth:error', (data: { message: string }) => {
    connectionStatus.value = 'unpaired'
    authError.value = data.message || 'Authentication failed'
    localStorage.removeItem('sb_remote_token')
  })

  socket.value.on('device:revoked', () => {
    connectionStatus.value = 'unpaired'
    authError.value = 'Access revoked by desktop'
    localStorage.removeItem('sb_remote_token')
  })

  socket.value.on('soundboard:sync', (data: { sounds: RemoteSound[]; collections: RemoteCollection[] }) => {
    sounds.value = data.sounds || []
    collections.value = data.collections || []
  })

  socket.value.on('sound:playing', (data: { playing: Record<string, PlayingVoice> }) => {
    playingState.value = data.playing || {}
  })

  socket.value.on('server:shutdown', () => {
    connectionStatus.value = 'disconnected'
    authError.value = 'Desktop soundboard shut down'
  })
}

// ── Controller Actions (Trigger & Stop Only) ──

function onPinInput() {
  pinInput.value = String(pinInput.value || '').replace(/\D/g, '').slice(0, 6)
  if (pinInput.value.length === 4) {
    submitPairing()
  }
}

function submitPairing() {
  const cleanPin = String(pinInput.value || '').trim()
  if (!cleanPin) return
  authError.value = null
  connectionStatus.value = 'connecting'

  socket.value?.emit('device:auth', {
    pin: cleanPin,
    deviceId: deviceId.value,
    deviceName: String(deviceName.value || '').trim() || detectDeviceName(),
  })
}

function playSound(soundId: string) {
  if (connectionStatus.value !== 'connected') return
  try {
    navigator.vibrate?.(25)
  } catch {
    // ignore
  }
  socket.value?.emit('sound:play', { soundId })
}

function stopSound(soundId: string, event?: Event) {
  event?.stopPropagation()
  if (connectionStatus.value !== 'connected') return
  try {
    navigator.vibrate?.(20)
  } catch {
    // ignore
  }
  socket.value?.emit('sound:stop', { soundId })
}

function stopAll() {
  if (connectionStatus.value !== 'connected') return
  try {
    navigator.vibrate?.([30, 50, 30])
  } catch {
    // ignore
  }
  socket.value?.emit('sound:stop-all')
}

function adjustVolume(soundId: string, volume: number) {
  socket.value?.emit('sound:volume', { soundId, volume })
}

function disconnectDevice() {
  socket.value?.emit('device:disconnect')
  localStorage.removeItem('sb_remote_token')
  connectionStatus.value = 'unpaired'
  pinInput.value = ''
}

function fmtDuration(sec: number) {
  if (!isFinite(sec)) return ''
  if (sec < 10) return sec.toFixed(1) + 's'
  const m = Math.floor(sec / 60)
  const s = Math.round(sec % 60)
  return m ? `${m}:${String(s).padStart(2, '0')}` : `${s}s`
}

onMounted(() => {
  deviceId.value = localStorage.getItem('sb_remote_device_id') || Math.random().toString(36).substring(2, 12)
  localStorage.setItem('sb_remote_device_id', deviceId.value)
  deviceName.value = localStorage.getItem('sb_remote_device_name') || detectDeviceName()

  initSocket()
})

onBeforeUnmount(() => {
  socket.value?.disconnect()
})
</script>

<template>
  <div class="flex h-screen w-full flex-col bg-ink-950 font-sans text-ink-100 select-none overflow-hidden">
    <!-- ── PAIRING SCREEN (UNPAIRED / AUTH ERROR) ── -->
    <div
      v-if="connectionStatus === 'unpaired' || (connectionStatus === 'connecting' && !sounds.length)"
      class="flex flex-1 flex-col items-center justify-center p-6 text-center"
    >
      <div class="w-full max-w-sm rounded-2xl border border-white/[0.08] bg-ink-900/90 p-7 shadow-2xl backdrop-blur-xl">
        <div class="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.04] text-accent">
          <Radio :size="28" />
        </div>

        <h1 class="text-xl font-bold tracking-tight text-ink-100">Remote Controller</h1>
        <p class="mt-1 text-xs text-ink-400">Pair this device with your desktop GGSoundboard</p>

        <!-- Device Name Input -->
        <div class="mt-6 text-left">
          <label class="label">Device Name</label>
          <input
            v-model="deviceName"
            class="field h-10 px-3 text-[14px]"
            placeholder="e.g. My Phone, iPad"
            maxlength="30"
          >
        </div>

        <!-- PIN Input -->
        <div class="mt-4 text-left">
          <label class="label">4-Digit Pairing PIN</label>
          <input
            v-model="pinInput"
            type="text"
            inputmode="numeric"
            pattern="[0-9]*"
            autocomplete="one-time-code"
            class="field h-12 text-center font-mono text-2xl font-bold tracking-[0.4em] text-ink-100 placeholder:tracking-normal placeholder:text-ink-600 focus:border-accent"
            placeholder="PIN"
            maxlength="6"
            @input="onPinInput"
            @keydown.enter="submitPairing"
          >
          <p class="mt-1.5 text-center text-[11px] text-ink-500">
            Check the PIN shown in the desktop app's Remote Controller menu.
          </p>
        </div>

        <!-- Error Feedback -->
        <p v-if="authError" class="mt-3 flex items-center justify-center gap-1.5 text-xs text-red-300">
          <AlertTriangle :size="13" class="shrink-0" />
          {{ authError }}
        </p>

        <!-- Connect Button -->
        <button
          class="btn-primary mt-6 h-11 w-full justify-center text-[14px] font-semibold tracking-wide"
          :disabled="!String(pinInput || '').trim() || connectionStatus === 'connecting'"
          @click="submitPairing"
        >
          {{ connectionStatus === 'connecting' ? 'Connecting…' : 'Connect & Pair' }}
        </button>

        <!-- Security Note -->
        <div class="mt-5 flex items-center justify-center gap-1.5 text-[11px] text-ink-500">
          <Shield :size="12" class="text-accent" />
          <span>Controller-only access. Cannot modify sounds.</span>
        </div>
      </div>
    </div>

    <!-- ── CONNECTED CONTROLLER INTERFACE ── -->
    <div v-else class="flex flex-1 flex-col overflow-hidden">
      <!-- Top Navigation Header -->
      <header class="flex h-14 shrink-0 items-center justify-between border-b border-white/[0.08] bg-ink-900/80 px-4 backdrop-blur-md">
        <div class="flex items-center gap-2.5">
          <span
            class="h-2 w-2 rounded-full"
            :class="connectionStatus === 'connected' ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]' : 'bg-amber-400 animate-pulse'"
          />
          <div>
            <p class="text-[13px] font-semibold text-ink-100 flex items-center gap-1.5">
              <span>GGSoundboard</span>
              <span class="rounded bg-white/[0.06] px-1.5 py-0.5 text-[10px] font-medium text-ink-400">Controller</span>
            </p>
            <p class="text-[10.5px] text-ink-500 truncate max-w-[140px] sm:max-w-[200px]">{{ deviceName }}</p>
          </div>
        </div>

        <div class="flex items-center gap-2">
          <!-- Big Stop All Emergency Button -->
          <button
            class="btn h-9 gap-1.5 rounded-xl border border-red-500/30 bg-red-500/15 px-3.5 text-[12px] font-semibold text-red-300 transition-transform active:scale-95"
            :disabled="!anyPlaying"
            @click="stopAll"
          >
            <Square :size="12" fill="currentColor" />
            <span>STOP ALL</span>
          </button>

          <!-- Disconnect Button -->
          <button
            class="icon-btn h-9 w-9 text-ink-400 hover:text-ink-100"
            title="Disconnect"
            @click="disconnectDevice"
          >
            <LogOut :size="16" />
          </button>
        </div>
      </header>

      <!-- Disconnected Banner -->
      <div
        v-if="connectionStatus === 'disconnected'"
        class="flex items-center justify-center gap-2 bg-amber-500/15 px-4 py-2 text-xs font-medium text-amber-300 border-b border-amber-500/20"
      >
        <WifiOff :size="14" />
        <span>Reconnecting to desktop GGSoundboard…</span>
      </div>

      <!-- Search & Category Filters -->
      <div class="shrink-0 space-y-2 border-b border-white/[0.06] bg-ink-900/40 p-3">
        <!-- Search bar -->
        <div class="relative">
          <Search :size="14" class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-500" />
          <input
            v-model="searchQuery"
            class="field h-9 w-full rounded-xl pl-8 pr-8 text-[13px]"
            placeholder="Search sounds…"
          >
          <button
            v-if="searchQuery"
            class="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-ink-500 hover:text-ink-200"
            @click="searchQuery = ''"
          >
            ✕
          </button>
        </div>

        <!-- Categories horizontal pills -->
        <div v-if="collections.length" class="flex gap-1.5 overflow-x-auto pb-0.5 no-scrollbar">
          <button
            class="h-7 shrink-0 rounded-lg px-2.5 text-[12px] font-medium transition-colors"
            :class="activeCollection === 'all' ? 'bg-white/[0.1] text-ink-100 font-semibold' : 'text-ink-400 hover:bg-white/[0.04] hover:text-ink-200'"
            @click="activeCollection = 'all'"
          >
            All ({{ collectionCounts.all }})
          </button>
          <button
            v-for="c in collections"
            :key="c.id"
            class="flex items-center gap-1.5 h-7 shrink-0 rounded-lg px-2.5 text-[12px] font-medium transition-colors"
            :class="activeCollection === c.id ? 'bg-white/[0.1] text-ink-100 font-semibold' : 'text-ink-400 hover:bg-white/[0.04] hover:text-ink-200'"
            :style="activeCollection === c.id && c.color ? { backgroundColor: `${resolveColorHex(c.color)}22` } : undefined"
            @click="activeCollection = c.id"
          >
            <span
              v-if="c.color"
              class="h-1.5 w-1.5 rounded-full shrink-0"
              :style="{ backgroundColor: resolveColorHex(c.color) || '#8b93ff' }"
            />
            <PadIcon
              v-if="c.icon"
              :name="c.icon"
              :size="12"
              class="shrink-0"
              :style="c.color ? { color: resolveColorHex(c.color) || undefined } : undefined"
              :class="!c.color && 'text-accent'"
            />
            <span>{{ c.name }} ({{ collectionCounts[c.id] || 0 }})</span>
          </button>
        </div>
      </div>

      <!-- ── RESPONSIVE SOUNDBOARD GRID ── -->
      <main class="flex-1 overflow-y-auto p-3 sm:p-4">
        <div
          v-if="visibleSounds.length"
          class="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5"
        >
          <div
            v-for="sound in visibleSounds"
            :key="sound.id"
            class="group relative flex h-[104px] cursor-pointer flex-col justify-between overflow-hidden rounded-xl border p-3 text-left transition-[transform,box-shadow,filter] active:scale-[0.96]"
            :style="(() => {
              const theme = computePadTheme(sound.color)
              const isPlaying = !!playingState[sound.id]
              if (theme) {
                return {
                  backgroundColor: theme.bg,
                  borderColor: isPlaying ? theme.playingBorderColor : theme.borderColor,
                  boxShadow: isPlaying ? `0 0 20px -2px ${theme.pulseGlow}` : '0 2px 8px rgba(0,0,0,0.25)',
                  filter: isPlaying ? 'brightness(1.12)' : 'none',
                }
              }
              return {
                backgroundColor: isPlaying ? 'rgba(139,147,255,0.14)' : 'rgba(255,255,255,0.03)',
                borderColor: isPlaying ? 'rgba(139,147,255,0.5)' : 'rgba(255,255,255,0.08)',
              }
            })()"
            @click="playingState[sound.id] ? stopSound(sound.id) : playSound(sound.id)"
          >
            <!-- Top Row: Icon/EQ + Shortcut Reference -->
            <div class="flex items-start justify-between gap-1.5">
              <div
                class="flex h-5 items-center gap-1.5"
                :style="(() => {
                  const theme = computePadTheme(sound.color)
                  return theme ? { color: theme.iconColor } : {}
                })()"
                :class="playingState[sound.id] && !sound.color && 'text-accent'"
              >
                <!-- Playing Animated EQ Bars -->
                <span v-if="playingState[sound.id]" class="flex h-3.5 items-end gap-[2px]">
                  <span
                    v-for="i in 4"
                    :key="i"
                    class="w-[2.5px] origin-bottom animate-eq rounded-full bg-current"
                    :style="{ height: '100%', animationDelay: `${i * -0.17}s`, animationDuration: `${0.7 + i * 0.13}s` }"
                  />
                </span>
                <PadIcon v-else :name="sound.icon" :size="16" />
              </div>

              <!-- Stop icon or shortcut badge -->
              <div class="flex items-center gap-1">
                <button
                  v-if="playingState[sound.id]"
                  class="flex h-5 w-5 items-center justify-center rounded-md bg-black/20 text-current hover:bg-black/30"
                  title="Stop"
                  @click.stop="stopSound(sound.id, $event)"
                >
                  <Square :size="10" fill="currentColor" />
                </button>
                <UiKbd
                  v-else-if="sound.hotkey"
                  :combo="sound.hotkey"
                  :theme="computePadTheme(sound.color)?.kbd"
                />
              </div>
            </div>

            <!-- Sound Name -->
            <div class="min-w-0">
              <p
                class="line-clamp-2 text-[13px] font-semibold leading-[1.25] tracking-tight"
                :style="(() => {
                  const theme = computePadTheme(sound.color)
                  return {
                    color: theme ? theme.textColor : '#ededf0',
                    textShadow: theme && !theme.isLight ? '0 1px 2px rgba(0,0,0,0.3)' : undefined,
                  }
                })()"
              >
                {{ sound.name }}
              </p>
              <div
                class="mt-1 flex items-center gap-1 text-[10.5px]"
                :style="(() => {
                  const theme = computePadTheme(sound.color)
                  return { color: theme ? theme.subTextColor : '#71717c' }
                })()"
              >
                <span class="font-mono tabular-nums">{{ fmtDuration(sound.duration) }}</span>
                <Repeat v-if="sound.loop" :size="10" />
              </div>
            </div>

            <!-- Progress Bar at bottom of pad -->
            <div
              v-if="playingState[sound.id]"
              class="absolute inset-x-0 bottom-0 h-[3px] bg-black/20"
            >
              <div
                class="h-full transition-[width] duration-75"
                :style="(() => {
                  const theme = computePadTheme(sound.color)
                  return {
                    width: `${(playingState[sound.id]?.progress || 0) * 100}%`,
                    backgroundColor: theme ? theme.progressBg : '#8b93ff',
                  }
                })()"
              />
            </div>
          </div>
        </div>

        <!-- Empty search results -->
        <div v-else-if="searchQuery" class="flex h-64 flex-col items-center justify-center text-center text-ink-500">
          <p class="text-[13px]">No sounds match “{{ searchQuery }}”</p>
          <button class="mt-2 text-xs text-accent hover:underline" @click="searchQuery = ''">Clear search</button>
        </div>

        <!-- No sounds in soundboard -->
        <div v-else class="flex h-64 flex-col items-center justify-center text-center text-ink-500">
          <Radio :size="24" class="mb-2 text-ink-600" />
          <p class="text-[13px] font-medium text-ink-300">Desktop GGSoundboard is empty</p>
          <p class="mt-1 text-xs text-ink-500">Import audio files on your desktop to control them here.</p>
        </div>
      </main>

      <!-- Bottom Floating Bar when sounds are playing -->
      <footer
        v-if="anyPlaying"
        class="flex h-12 shrink-0 items-center justify-between border-t border-white/[0.08] bg-ink-900/90 px-4 backdrop-blur-md"
      >
        <div class="flex items-center gap-2 text-xs text-ink-300">
          <span class="flex h-2 w-2 rounded-full bg-accent animate-ping" />
          <span>{{ playingCount }} sound{{ playingCount > 1 ? 's' : '' }} active on desktop</span>
        </div>
        <button
          class="btn-danger h-8 gap-1.5 px-3 text-[12px] font-semibold"
          @click="stopAll"
        >
          <Square :size="11" fill="currentColor" /> Stop All
        </button>
      </footer>
    </div>
  </div>
</template>

<style scoped>
/* Hide scrollbar for category tabs */
.no-scrollbar::-webkit-scrollbar {
  display: none;
}
.no-scrollbar {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
</style>
