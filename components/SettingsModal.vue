<script setup lang="ts">
import { TriangleAlert, FolderOpen } from 'lucide-vue-next'
import { formatCombo, isUnsafeGlobal } from '~/lib/hotkeys'
import type { Conflict } from '~/composables/useSoundboard'

const sb = useSoundboard()
const { ui } = useUi()
const s = computed(() => sb.state.settings)
const libraryPath = ref<string | null>(null)
const pending = ref<{ combo: string; role: 'ptt' | 'stopAll'; conflict: Conflict } | null>(null)

watch(
  () => ui.settingsOpen,
  async (open) => {
    pending.value = null
    if (open && sb.native) libraryPath.value = await sb.native.libraryPath()
  },
)

function record(role: 'ptt' | 'stopAll', combo: string | null) {
  const conflict = sb.assignHotkey(combo, { role })
  pending.value = conflict && combo ? { combo, role, conflict } : null
}
function steal() {
  if (!pending.value) return
  sb.assignHotkey(pending.value.combo, { role: pending.value.role }, true)
  pending.value = null
}
const conflictLabel = computed(() => {
  const c = pending.value?.conflict
  if (!c) return ''
  if (c.type === 'sound') return `the pad “${c.sound.name}”`
  return c.type === 'ptt' ? 'Push-to-talk' : 'Stop all'
})

const localOnly = computed(() => sb.state.sounds.filter((x) => x.hotkey && isUnsafeGlobal(x.hotkey)).length)
const failedNames = computed(() =>
  sb.state.globalFailed.map((id) => (id === '__stopAll' ? 'Stop all' : sb.state.sounds.find((x) => x.id === id)?.name ?? id)),
)
</script>

<template>
  <UiModal :open="ui.settingsOpen" title="Settings" width="max-w-[520px]" @close="ui.settingsOpen = false">
    <div class="divide-y divide-white/[0.06]">
      <!-- Shortcuts -->
      <section class="space-y-4 p-5">
        <h3 class="label mb-0">Shortcuts</h3>

        <div class="flex items-center justify-between gap-4">
          <div>
            <p class="text-[13px] text-ink-200">Push-to-talk</p>
            <p class="text-[11.5px] text-ink-500">Microphone is only sent while the key is held</p>
          </div>
          <div class="flex items-center gap-3">
            <UiHotkeyRecorder :model-value="s.pttKey" :allow-clear="false" @record="(c) => record('ptt', c)" />
            <UiToggle v-model="s.pttEnabled" />
          </div>
        </div>

        <div class="flex items-center justify-between gap-4">
          <div>
            <p class="text-[13px] text-ink-200">Stop all sounds</p>
            <p class="text-[11.5px] text-ink-500">Immediately fades out every playing pad</p>
          </div>
          <UiHotkeyRecorder :model-value="s.stopAllKey" @record="(c) => record('stopAll', c)" />
        </div>

        <div
          v-if="pending"
          class="flex items-start gap-2.5 rounded-lg border border-amber-300/20 bg-amber-300/[0.05] p-3 text-[12px] leading-snug"
        >
          <TriangleAlert :size="14" class="mt-px shrink-0 text-amber-300" />
          <div class="flex-1">
            <p class="text-ink-200">
              <span class="font-mono">{{ formatCombo(pending.combo).join(' ') }}</span> is already used by {{ conflictLabel }}.
            </p>
            <div class="mt-2 flex gap-2">
              <button class="btn-outline h-7 px-2.5 text-[12px]" @click="steal">Reassign</button>
              <button class="btn h-7 px-2.5 text-[12px]" @click="pending = null">Cancel</button>
            </div>
          </div>
        </div>

        <div class="flex items-center justify-between gap-4">
          <div>
            <p class="text-[13px] text-ink-200">Global hotkeys</p>
            <p class="text-[11.5px] leading-snug text-ink-500">
              Trigger pads while Discord or a game is focused. Applies to F-keys, numpad and modifier combos.
            </p>
          </div>
          <UiToggle v-model="s.globalHotkeys" :disabled="!sb.native" />
        </div>
        <p v-if="!sb.native" class="text-[11.5px] text-ink-500">Global hotkeys require the desktop app.</p>
        <p v-else-if="s.globalHotkeys && localOnly" class="text-[11.5px] text-ink-500">
          {{ localOnly }} pad shortcut{{ localOnly > 1 ? 's use' : ' uses' }} a plain key and only work{{ localOnly > 1 ? '' : 's' }} while this window is focused.
        </p>
        <p v-if="s.globalHotkeys && failedNames.length" class="text-[11.5px] text-amber-300/90">
          Could not register globally (in use by another app): {{ failedNames.join(', ') }}
        </p>
        <p v-if="sb.platform === 'mac'" class="text-[11.5px] leading-snug text-ink-500">
          Tip: on Mac keyboards F-keys may require holding <span class="kbd">fn</span>, or enable “Use F1, F2, etc. keys as standard function keys” in System Settings → Keyboard.
        </p>
      </section>

      <!-- Playback Behavior -->
      <section class="space-y-3.5 p-5">
        <h3 class="label mb-0">Playback Behavior</h3>
        <div class="flex items-center justify-between gap-4">
          <div>
            <p class="text-[13px] text-ink-200">Exclusive playback</p>
            <p class="text-[11.5px] leading-snug text-ink-500">
              Automatically stop previously playing audio before starting a new sound.
            </p>
          </div>
          <UiToggle v-model="s.exclusivePlayback" />
        </div>
      </section>

      <!-- Mic processing -->
      <section class="space-y-3.5 p-5">
        <h3 class="label mb-0">Microphone processing</h3>
        <div class="flex items-center justify-between">
          <div>
            <p class="text-[13px] text-ink-200">Noise suppression</p>
            <p class="text-[11.5px] text-ink-500">Reduce background noise</p>
          </div>
          <UiToggle v-model="s.noiseSuppression" />
        </div>
        <div class="flex items-center justify-between">
          <div>
            <p class="text-[13px] text-ink-200">Echo cancellation</p>
            <p class="text-[11.5px] text-ink-500">Helps if you use speakers instead of headphones</p>
          </div>
          <UiToggle v-model="s.echoCancellation" />
        </div>
        <div class="flex items-center justify-between">
          <div>
            <p class="text-[13px] text-ink-200">Automatic gain control</p>
            <p class="text-[11.5px] text-ink-500">Let the system adjust mic level</p>
          </div>
          <UiToggle v-model="s.autoGainControl" />
        </div>
        <p class="text-[11.5px] leading-snug text-ink-500">
          Discord applies its own processing too — consider disabling duplicates there for the virtual device.
        </p>
      </section>

      <!-- Storage -->
      <section class="space-y-2 p-5">
        <h3 class="label mb-0">Library</h3>
        <template v-if="sb.native">
          <div class="flex items-center gap-2">
            <code class="min-w-0 flex-1 truncate rounded-md bg-white/[0.04] px-2 py-1.5 font-mono text-[11px] text-ink-300" :title="libraryPath ?? ''">{{ libraryPath }}</code>
            <button class="btn-outline h-7 px-2.5 text-[12px]" @click="sb.native!.revealLibrary()"><FolderOpen :size="13" /> Reveal</button>
          </div>
          <p class="text-[11.5px] text-ink-500">Sounds and settings are stored locally on this computer.</p>
        </template>
        <p v-else class="text-[11.5px] text-ink-500">Running in a browser — sounds and settings are stored in this browser’s IndexedDB.</p>
      </section>
    </div>
    <template #footer>
      <button class="btn-primary" @click="ui.settingsOpen = false">Done</button>
    </template>
  </UiModal>
</template>
