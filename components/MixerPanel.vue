<script setup lang="ts">
import { Headphones, Mic, MicOff, RefreshCw, TriangleAlert, Volume2, VolumeX, CircleCheck, Radio, Info } from 'lucide-vue-next'

const sb = useSoundboard()
const { state, levels, routingStatus, virtualMicName } = sb
const { ui } = useUi()
const s = computed(() => state.settings)
const isMac = sb.platform === 'mac' && !!sb.native
const hasRightOverlay = !isMac && !!sb.native

const sortedOutputs = computed(() => {
  const list = state.outputs.filter((d) => !d.isDefault)
  const pool = list.length > 0 ? list : state.outputs
  return [...pool].sort((a, b) => {
    if (a.isVirtual && !b.isVirtual) return -1
    if (!a.isVirtual && b.isVirtual) return 1
    return a.label.localeCompare(b.label)
  })
})
const monitorOutputs = computed(() => {
  const list = state.outputs.filter((d) => !d.isDefault && !d.isVirtual)
  return list.length > 0 ? list : state.outputs.filter((d) => !d.isDefault)
})
// Virtual devices are excluded as mic inputs: BlackHole → mixer → BlackHole is a feedback loop.
const realInputs = computed(() => state.inputs.filter((d) => !d.isDefault && !d.isVirtual))

const pct = (v: number) => `${Math.round(v * 100)}%`
const cleanLabel = (l: string) => l.replace(/\s*\([0-9a-f]{4}:[0-9a-f]{4}\)\s*$/i, '')

const micGateOpen = computed(() => !s.value.micMuted && s.value.micPassthrough && (!s.value.pttEnabled || state.pttHeld))

function onVirtualChange(e: Event) {
  const id = (e.target as HTMLSelectElement).value || null
  s.value.virtualOutputId = id
  s.value.virtualOutputLabel = state.outputs.find((d) => d.deviceId === id)?.label ?? null
}
function onMonitorChange(e: Event) {
  s.value.monitorOutputId = (e.target as HTMLSelectElement).value || null
}
function onMicChange(e: Event) {
  const v = (e.target as HTMLSelectElement).value
  s.value.micDeviceId = v === 'default' || !v ? null : v
}
const refreshing = ref(false)
async function refresh() {
  refreshing.value = true
  await sb.refreshDevices()
  if (!state.micActive) await sb.startMic()
  setTimeout(() => (refreshing.value = false), 400)
}
</script>

<template>
  <aside class="flex h-full w-[320px] shrink-0 flex-col border-l border-white/[0.06] bg-ink-900/60">
    <header
      class="drag flex h-[52px] shrink-0 items-center justify-between pl-5"
      :class="hasRightOverlay ? 'pr-[144px]' : 'pr-3'"
    >
      <h2 class="text-[13px] font-semibold tracking-tight text-ink-100">Mixer</h2>
      <button class="no-drag icon-btn h-7 w-7" title="Refresh devices" @click="refresh">
        <RefreshCw :size="14" :class="refreshing && 'animate-spin'" />
      </button>
    </header>

    <div class="flex-1 space-y-5 overflow-y-auto px-4 pb-5">
      <!-- Routing status -->
      <div
        class="rounded-xl border p-3"
        :class="routingStatus === 'ok' ? 'border-emerald-400/15 bg-emerald-400/[0.04]' : 'border-amber-300/15 bg-amber-300/[0.04]'"
      >
        <div class="flex items-start gap-2.5">
          <CircleCheck v-if="routingStatus === 'ok'" :size="15" class="mt-px shrink-0 text-emerald-400" />
          <TriangleAlert v-else :size="15" class="mt-px shrink-0 text-amber-300" />
          <div class="min-w-0 text-[12px] leading-[1.45]">
            <template v-if="routingStatus === 'ok'">
              <p class="font-medium text-ink-100">Virtual microphone live</p>
              <p class="mt-0.5 text-ink-400">
                In Discord, choose <span class="text-ink-200">{{ virtualMicName }}</span> as your input device.
              </p>
            </template>
            <template v-else-if="routingStatus === 'no-driver'">
              <p class="font-medium text-ink-100">No virtual audio driver found</p>
              <p class="mt-0.5 text-ink-400">
                Install {{ sb.platform === 'windows' ? 'VB-CABLE' : 'BlackHole' }} to expose the mix as a microphone.
              </p>
            </template>
            <template v-else-if="routingStatus === 'not-selected'">
              <p class="font-medium text-ink-100">Choose a virtual output</p>
              <p class="mt-0.5 text-ink-400">A virtual driver is installed — select it below.</p>
            </template>
            <template v-else-if="routingStatus === 'not-virtual'">
              <p class="font-medium text-ink-100">Output is not a virtual device</p>
              <p class="mt-0.5 text-ink-400">Your voice will play through this device — this may cause feedback.</p>
            </template>
            <template v-else>
              <p class="font-medium text-ink-100">Output routing unsupported</p>
              <p class="mt-0.5 text-ink-400">Run the desktop app (Electron) or Chrome 110+.</p>
            </template>
            <button
              v-if="routingStatus !== 'ok'"
              class="mt-2 text-[11.5px] font-medium text-accent hover:underline"
              @click="ui.setupOpen = true"
            >
              Open setup guide →
            </button>
          </div>
        </div>
      </div>

      <!-- Devices -->
      <section class="space-y-3">
        <div>
          <label class="label">Microphone input</label>
          <select class="select" :value="s.micDeviceId ?? 'default'" @change="onMicChange">
            <option value="default">System default</option>
            <option v-for="d in realInputs" :key="d.deviceId" :value="d.deviceId">
              {{ cleanLabel(d.label) }}
            </option>
          </select>
          <p v-if="state.micError" class="mt-1.5 flex items-start gap-1.5 text-[11.5px] leading-snug text-red-300">
            <MicOff :size="12" class="mt-0.5 shrink-0" />
            <span>{{ state.micError }} <button class="underline" @click="sb.startMic()">Retry</button></span>
          </p>
        </div>
        <div>
          <label class="label">Virtual output <span class="normal-case tracking-normal text-ink-500">→ Discord / Zoom</span></label>
          <select class="select" :value="s.virtualOutputId ?? ''" @change="onVirtualChange">
            <option value="">None (silent)</option>
            <option v-for="d in sortedOutputs" :key="d.deviceId" :value="d.deviceId">
              {{ cleanLabel(d.label) }}{{ d.isVirtual ? '  · virtual' : '' }}
            </option>
          </select>
        </div>
        <div>
          <label class="label">Monitor <span class="normal-case tracking-normal text-ink-500">→ your headphones</span></label>
          <select class="select" :value="s.monitorOutputId ?? ''" @change="onMonitorChange">
            <option value="">System default</option>
            <option v-for="d in monitorOutputs" :key="d.deviceId" :value="d.deviceId">{{ cleanLabel(d.label) }}</option>
          </select>
        </div>
      </section>

      <div class="h-px bg-white/[0.06]" />

      <!-- Microphone channel -->
      <section class="space-y-2.5">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <button
              class="icon-btn h-7 w-7"
              :class="s.micMuted && '!bg-red-500/15 !text-red-300'"
              :title="s.micMuted ? 'Unmute microphone' : 'Mute microphone'"
              @click="s.micMuted = !s.micMuted"
            >
              <MicOff v-if="s.micMuted" :size="14" />
              <Mic v-else :size="14" />
            </button>
            <span class="text-[12.5px] font-medium text-ink-200">Microphone</span>
            <span
              v-if="s.pttEnabled"
              class="rounded-md px-1.5 py-0.5 text-2xs font-medium transition-colors"
              :class="state.pttHeld ? 'bg-emerald-400/15 text-emerald-300' : 'bg-white/[0.05] text-ink-400'"
            >
              {{ state.pttHeld ? 'TALKING' : 'PTT' }}
            </span>
          </div>
          <span class="font-mono text-[11px] tabular-nums text-ink-400">{{ pct(s.micVolume) }}</span>
        </div>
        <UiSlider v-model="s.micVolume" :max="2" :muted="s.micMuted" />
        <LevelMeter :level="levels.mic" :muted="!micGateOpen" />
        <div class="flex items-center justify-between pt-1 text-[12px] text-ink-300">
          <span class="flex items-center gap-1.5">
            Passthrough to virtual mic
            <span class="cursor-help text-ink-500" title="Sends your voice into the virtual microphone together with the sounds. Turn off to send sound effects only.">
              <Info :size="12" />
            </span>
          </span>
          <UiToggle v-model="s.micPassthrough" size="sm" />
        </div>
        <div class="flex items-center justify-between text-[12px] text-ink-300">
          <span class="flex items-center gap-1.5">
            Push-to-talk
            <UiKbd v-if="s.pttEnabled" :combo="s.pttKey" dim />
          </span>
          <UiToggle v-model="s.pttEnabled" size="sm" />
        </div>
      </section>

      <div class="h-px bg-white/[0.06]" />

      <!-- Soundboard channel -->
      <section class="space-y-2.5">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <button
              class="icon-btn h-7 w-7"
              :class="s.soundMuted && '!bg-red-500/15 !text-red-300'"
              :title="s.soundMuted ? 'Unmute soundboard' : 'Mute soundboard'"
              @click="s.soundMuted = !s.soundMuted"
            >
              <VolumeX v-if="s.soundMuted" :size="14" />
              <Volume2 v-else :size="14" />
            </button>
            <span class="text-[12.5px] font-medium text-ink-200">Soundboard</span>
          </div>
          <span class="font-mono text-[11px] tabular-nums text-ink-400">{{ pct(s.soundVolume) }}</span>
        </div>
        <UiSlider v-model="s.soundVolume" :muted="s.soundMuted" />
        <LevelMeter :level="levels.sound" :muted="s.soundMuted" />
      </section>

      <div class="h-px bg-white/[0.06]" />

      <!-- Master -->
      <section class="space-y-2.5">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <span class="inline-flex h-7 w-7 items-center justify-center text-ink-300"><Radio :size="14" /></span>
            <span class="text-[12.5px] font-medium text-ink-200">Master</span>
            <span class="text-2xs text-ink-500">virtual mic out</span>
          </div>
          <span class="font-mono text-[11px] tabular-nums text-ink-400">{{ pct(s.masterVolume) }}</span>
        </div>
        <UiSlider v-model="s.masterVolume" />
        <LevelMeter :level="levels.master" :muted="routingStatus !== 'ok' && routingStatus !== 'not-virtual'" />
      </section>

      <div class="h-px bg-white/[0.06]" />

      <!-- Monitor -->
      <section class="space-y-2.5">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <button
              class="icon-btn h-7 w-7"
              :class="!s.monitorEnabled && '!bg-red-500/15 !text-red-300'"
              :title="s.monitorEnabled ? 'Disable monitor' : 'Enable monitor'"
              @click="s.monitorEnabled = !s.monitorEnabled"
            >
              <Headphones :size="14" />
            </button>
            <span class="text-[12.5px] font-medium text-ink-200">Monitor</span>
          </div>
          <span class="font-mono text-[11px] tabular-nums text-ink-400">{{ pct(s.monitorVolume) }}</span>
        </div>
        <UiSlider v-model="s.monitorVolume" :muted="!s.monitorEnabled" />
        <LevelMeter :level="levels.monitor" :muted="!s.monitorEnabled" />
        <div class="flex items-center justify-between pt-1 text-[12px] text-ink-300">
          <span class="flex items-center gap-1.5">
            Hear myself
            <span class="cursor-help text-ink-500" title="Plays your microphone in your monitor output. Use headphones only — on speakers this causes feedback.">
              <Info :size="12" />
            </span>
          </span>
          <UiToggle v-model="s.hearMyself" size="sm" />
        </div>
        <p v-if="s.hearMyself" class="text-[11px] leading-snug text-amber-300/80">Use headphones to avoid feedback.</p>
      </section>
    </div>

    <!-- Status footer -->
    <footer class="shrink-0 space-y-1 border-t border-white/[0.06] px-5 py-3 text-[11px] text-ink-500">
      <div class="flex items-center justify-between">
        <span class="flex items-center gap-1.5">
          <span
            class="h-1.5 w-1.5 rounded-full"
            :class="state.engineState === 'running' ? 'bg-emerald-400' : state.engineState === 'suspended' ? 'bg-amber-300' : 'bg-ink-500'"
          />
          Engine {{ state.engineState }}
        </span>
        <span class="font-mono tabular-nums">{{ (state.sampleRate / 1000).toFixed(1) }} kHz · {{ state.latencyMs }} ms</span>
      </div>
      <div class="flex items-center gap-1.5 truncate">
        <span class="h-1.5 w-1.5 shrink-0 rounded-full" :class="state.micActive ? 'bg-emerald-400' : 'bg-red-400'" />
        <span class="truncate">{{ state.micActive ? cleanLabel(state.micLabel ?? 'Microphone') : 'Microphone offline' }}</span>
      </div>
    </footer>
  </aside>
</template>
