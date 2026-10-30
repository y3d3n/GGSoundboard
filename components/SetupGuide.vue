<script setup lang="ts">
import { Check, Copy, ExternalLink } from 'lucide-vue-next'

const sb = useSoundboard()
const { ui } = useUi()
const { state, routingStatus, virtualDriverInstalled, virtualMicName } = sb
const isWin = sb.platform === 'windows'
const driverName = isWin ? 'VB-CABLE' : 'BlackHole'
const driverUrl = isWin ? 'https://vb-audio.com/Cable/' : 'https://existential.audio/blackhole/'
const brewCmd = 'brew install blackhole-2ch'
const copied = ref(false)

function open(url: string) {
  if (sb.native) void sb.native.openExternal(url)
  else window.open(url, '_blank', 'noopener')
}
async function copy() {
  await navigator.clipboard.writeText(brewCmd)
  copied.value = true
  setTimeout(() => (copied.value = false), 1500)
}
function close() {
  ui.setupOpen = false
  state.settings.onboarded = true
}

const steps = computed(() => [
  { done: virtualDriverInstalled.value, title: `Install ${driverName}` },
  { done: routingStatus.value === 'ok', title: 'Route the mix to the virtual device' },
  { done: state.micActive, title: 'Connect your microphone' },
  { done: false, title: `Select the virtual mic in Discord` },
])
</script>

<template>
  <UiModal :open="ui.setupOpen" title="Virtual microphone setup" width="max-w-[560px]" @close="close">
    <div class="space-y-1 p-5">
      <p class="mb-4 text-[12.5px] leading-relaxed text-ink-400">
        GGSoundboard mixes your microphone and sound effects, then plays the mix into a virtual audio cable.
        Apps like Discord, Zoom, Meet and games read the other end of that cable as a microphone.
      </p>

      <ol class="space-y-4">
        <li v-for="(step, i) in steps" :key="i" class="flex gap-3">
          <span
            class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold"
            :class="step.done ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300' : 'border-white/[0.1] text-ink-400'"
          >
            <Check v-if="step.done" :size="12" :stroke-width="3" />
            <template v-else>{{ i + 1 }}</template>
          </span>
          <div class="min-w-0 flex-1 pt-0.5 text-[12.5px] leading-relaxed text-ink-400">
            <p class="mb-1 font-medium text-ink-100">{{ step.title }}</p>

            <template v-if="i === 0">
              <template v-if="!isWin">
                <p>Free, open-source virtual audio driver for macOS. Install with Homebrew:</p>
                <div class="mt-2 flex items-center gap-2">
                  <code class="flex-1 rounded-md bg-white/[0.04] px-2.5 py-1.5 font-mono text-[11.5px] text-ink-200">{{ brewCmd }}</code>
                  <button class="btn-outline h-7 px-2" @click="copy">
                    <Check v-if="copied" :size="13" /><Copy v-else :size="13" />
                  </button>
                </div>
                <p class="mt-2">…or download the installer: <button class="inline-flex items-center gap-1 text-accent hover:underline" @click="open(driverUrl)">existential.audio/blackhole <ExternalLink :size="11" /></button></p>
              </template>
              <template v-else>
                <p>
                  Download VB-CABLE, extract it and run <span class="font-mono text-ink-300">VBCABLE_Setup_x64.exe</span> as administrator, then reboot.
                  <button class="inline-flex items-center gap-1 text-accent hover:underline" @click="open(driverUrl)">vb-audio.com/Cable <ExternalLink :size="11" /></button>
                </p>
              </template>
              <p class="mt-2 text-ink-500">Devices are detected automatically after installation.</p>
            </template>

            <template v-else-if="i === 1">
              <p>
                In the Mixer, set <span class="text-ink-200">Virtual output</span> to
                <span class="text-ink-200">{{ isWin ? 'CABLE Input (VB-Audio Virtual Cable)' : 'BlackHole 2ch' }}</span>.
                Choose your headphones as <span class="text-ink-200">Monitor</span> so you hear the sounds too.
              </p>
              <p class="mt-1.5 text-ink-500">Don’t set the virtual cable as your system’s default output.</p>
            </template>

            <template v-else-if="i === 2">
              <p>Pick your physical microphone under <span class="text-ink-200">Microphone input</span> and allow access when prompted.</p>
              <p v-if="state.micError" class="mt-1.5 text-red-300">{{ state.micError }}</p>
              <button v-if="sb.native && state.micError" class="mt-1.5 text-accent hover:underline" @click="sb.native!.openSoundSettings()">Open system sound settings</button>
            </template>

            <template v-else>
              <p>
                Discord → User Settings → Voice &amp; Video → <span class="text-ink-200">Input Device</span> →
                <span class="text-ink-200">{{ virtualMicName }}</span>.
                Do the same in Zoom, Google Meet (microphone selector) or your game’s voice settings.
              </p>
              <p class="mt-1.5 text-ink-500">
                Tip: in Discord, turn off “Automatically determine input sensitivity” (or lower it) so quiet sound effects aren’t gated,
                and consider disabling Krisp noise suppression, which can filter out music.
              </p>
            </template>
          </div>
        </li>
      </ol>
    </div>
    <template #footer>
      <button class="btn-outline mr-auto" @click="sb.refreshDevices()">Re-check devices</button>
      <button class="btn-primary" @click="close">Done</button>
    </template>
  </UiModal>
</template>
