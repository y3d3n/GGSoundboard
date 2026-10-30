<script setup lang="ts">
import {
  Volume2,
  Mic,
  Cpu,
  Layers,
  Radio,
  FolderOpen,
  CheckCircle2,
  AlertCircle,
  BookOpen,
  Settings,
  Smartphone,
  Sparkles,
} from 'lucide-vue-next'

const sb = useSoundboard()
const { ui } = useUi()
const { state, routingStatus, virtualDriverInstalled, virtualMicName } = sb

const isWin = sb.platform === 'windows'
const driverName = isWin ? 'VB-CABLE' : 'BlackHole 2ch'

const totalDuration = computed(() => {
  const sec = state.sounds.reduce((acc, s) => acc + (s.duration || 0), 0)
  if (sec < 60) return `${Math.round(sec)}s`
  const min = Math.floor(sec / 60)
  const remSec = Math.round(sec % 60)
  return `${min}m ${remSec}s`
})

function openSetup() {
  ui.aboutOpen = false
  ui.setupOpen = true
}

function openSettings() {
  ui.aboutOpen = false
  ui.settingsOpen = true
}

function openRemote() {
  ui.aboutOpen = false
  ui.remoteOpen = true
}

function revealLibrary() {
  if (sb.native) void sb.native.revealLibrary()
}
</script>

<template>
  <UiModal :open="ui.aboutOpen" title="About GGSoundboard" width="max-w-[540px]" @close="ui.aboutOpen = false">
    <div class="space-y-6 p-6">
      <!-- App Header / Hero -->
      <div class="flex items-start gap-4">
        <div class="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-gradient-to-br from-accent/20 via-white/[0.04] to-transparent shadow-lg shadow-accent/5">
          <Volume2 :size="28" class="text-accent" />
          <span class="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 ring-2 ring-ink-900" title="Audio engine ready">
            <span class="h-1.5 w-1.5 rounded-full bg-white" />
          </span>
        </div>
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-2">
            <h1 class="text-[17px] font-semibold tracking-tight text-ink-100">GGSoundboard</h1>
            <span class="rounded-full border border-white/10 bg-white/[0.06] px-2 py-0.5 font-mono text-[11px] font-medium text-ink-300">
              v1.0.1
            </span>
            <span v-if="sb.native" class="rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-medium text-accent">
              Desktop Native
            </span>
            <span v-else class="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-300">
              Web Mode
            </span>
          </div>
          <p class="mt-1 text-[12.5px] leading-relaxed text-ink-400">
            Low-latency local soundboard and virtual microphone mixer. Stream sound effects directly into Discord, Zoom, OBS, and games without physical loopback cables.
          </p>
        </div>
      </div>

      <!-- Engine & System Status Grid -->
      <div class="grid grid-cols-2 gap-2.5">
        <div class="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
          <div class="flex items-center gap-2 text-ink-400">
            <Cpu :size="14" />
            <span class="text-[11px] font-medium uppercase tracking-wider text-ink-400">Audio Engine</span>
          </div>
          <p class="mt-1.5 text-[13px] font-medium text-ink-200">Web Audio API</p>
          <p class="text-[11.5px] text-ink-500">Low latency AudioBuffer</p>
        </div>

        <div class="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
          <div class="flex items-center gap-2 text-ink-400">
            <Radio :size="14" />
            <span class="text-[11px] font-medium uppercase tracking-wider text-ink-400">Virtual Driver</span>
          </div>
          <div class="mt-1.5 flex items-center gap-1.5">
            <CheckCircle2 v-if="virtualDriverInstalled" :size="13" class="text-emerald-400" />
            <AlertCircle v-else :size="13" class="text-amber-400" />
            <span class="truncate text-[13px] font-medium text-ink-200">{{ driverName }}</span>
          </div>
          <p class="text-[11.5px]" :class="virtualDriverInstalled ? 'text-emerald-400/80' : 'text-amber-400/80'">
            {{ virtualDriverInstalled ? 'Installed & ready' : 'Not detected' }}
          </p>
        </div>

        <div class="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
          <div class="flex items-center gap-2 text-ink-400">
            <Layers :size="14" />
            <span class="text-[11px] font-medium uppercase tracking-wider text-ink-400">Sound Library</span>
          </div>
          <p class="mt-1.5 text-[13px] font-medium text-ink-200">
            {{ state.sounds.length }} {{ state.sounds.length === 1 ? 'sound' : 'sounds' }}
          </p>
          <p class="text-[11.5px] text-ink-500">
            {{ totalDuration }} in {{ state.collections.length }} {{ state.collections.length === 1 ? 'collection' : 'collections' }}
          </p>
        </div>

        <div class="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
          <div class="flex items-center gap-2 text-ink-400">
            <Smartphone :size="14" />
            <span class="text-[11px] font-medium uppercase tracking-wider text-ink-400">Remote Companion</span>
          </div>
          <p class="mt-1.5 text-[13px] font-medium text-ink-200">
            {{ state.remoteRunning ? 'Controller Active' : 'Offline' }}
          </p>
          <p class="text-[11.5px] text-ink-500">
            {{ state.remoteDevices.length }} {{ state.remoteDevices.length === 1 ? 'device' : 'devices' }} connected
          </p>
        </div>
      </div>

      <!-- Feature Highlights -->
      <div class="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3.5 space-y-2">
        <h4 class="text-[11px] font-semibold uppercase tracking-wider text-ink-400 flex items-center gap-1.5">
          <Sparkles :size="12" class="text-accent" /> Highlights
        </h4>
        <ul class="space-y-1.5 text-[12px] text-ink-300">
          <li class="flex items-center gap-2">
            <span class="h-1 w-1 rounded-full bg-accent" />
            <span><strong class="font-medium text-ink-100">Dual-bus mixing:</strong> Hear sounds on headphones while routing to your virtual mic.</span>
          </li>
          <li class="flex items-center gap-2">
            <span class="h-1 w-1 rounded-full bg-accent" />
            <span><strong class="font-medium text-ink-100">Global shortcuts:</strong> Trigger sounds anywhere, even inside games or full-screen apps.</span>
          </li>
          <li class="flex items-center gap-2">
            <span class="h-1 w-1 rounded-full bg-accent" />
            <span><strong class="font-medium text-ink-100">Controller-only remote:</strong> Secure PIN-paired phone/tablet triggers without streaming audio.</span>
          </li>
          <li class="flex items-center gap-2">
            <span class="h-1 w-1 rounded-full bg-accent" />
            <span><strong class="font-medium text-ink-100">Smart pad colors:</strong> Full background coloring with WCAG-compliant automatic text contrast.</span>
          </li>
        </ul>
      </div>

      <!-- Developer Info -->
      <div class="rounded-xl border border-white/[0.08] bg-gradient-to-r from-accent/10 via-white/[0.03] to-transparent p-3.5 flex items-center justify-between gap-3.5">
        <div class="flex items-center gap-3 min-w-0">
          <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/15 border border-accent/25 text-accent font-semibold text-[13px] tracking-wide shadow-sm">
            YS
          </div>
          <div class="min-w-0">
            <div class="flex items-center gap-2">
              <span class="text-[13px] font-semibold text-ink-100">Yeden Sherpa</span>
              <span class="rounded-full bg-accent/15 border border-accent/30 px-2 py-0.5 text-[10px] font-medium text-accent">
                Developer & Creator
              </span>
            </div>
            <p class="text-[11.5px] text-ink-400 mt-0.5 leading-snug">
              Developed and architected GGSoundboard — built with Nuxt 3, Web Audio API, and Electron.
            </p>
          </div>
        </div>
      </div>

      <!-- Quick Actions -->
      <div class="flex flex-wrap items-center gap-2 pt-1 border-t border-white/[0.06]">
        <button class="btn-outline text-[12px] h-8 px-3 gap-1.5" @click="openSetup">
          <BookOpen :size="13" /> Setup guide
        </button>
        <button class="btn-outline text-[12px] h-8 px-3 gap-1.5" @click="openSettings">
          <Settings :size="13" /> Settings
        </button>
        <button class="btn-outline text-[12px] h-8 px-3 gap-1.5" @click="openRemote">
          <Smartphone :size="13" /> Remote Control
        </button>
        <button v-if="sb.native" class="btn-outline text-[12px] h-8 px-3 gap-1.5 ml-auto text-ink-300 hover:text-ink-100" @click="revealLibrary">
          <FolderOpen :size="13" /> Sound folder
        </button>
      </div>

      <!-- Footer Info -->
      <div class="flex items-center justify-between text-[11px] text-ink-500 pt-2 border-t border-white/[0.04]">
        <span>Developed by <strong class="text-ink-300 font-medium">Yeden Sherpa</strong> &bull; MIT License</span>
        <span>Nuxt 3 &bull; Vue 3 &bull; Electron</span>
      </div>
    </div>
  </UiModal>
</template>
