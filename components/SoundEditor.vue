<script setup lang="ts">
import { Play, Headphones, Square, Trash2, TriangleAlert, Check } from 'lucide-vue-next'
import { PAD_ICONS } from '~/lib/icons'
import { COLOR_PRESETS, resolveColorHex, getContrastTextColor } from '~/lib/colors'
import { formatCombo } from '~/lib/hotkeys'
import type { Conflict } from '~/composables/useSoundboard'

const sb = useSoundboard()
const { ui, askConfirm } = useUi()
const sound = computed(() => sb.state.sounds.find((s) => s.id === ui.editingSoundId) ?? null)
const pending = ref<{ combo: string; conflict: Conflict } | null>(null)

watch(
  () => ui.editingSoundId,
  (id) => {
    pending.value = null
    if (id) {
      nextTick(() => {
        const input = document.getElementById('sound-name') as HTMLInputElement | null
        input?.focus()
        input?.select()
      })
    }
  },
)

const iconNames = Object.keys(PAD_ICONS)

function onRecord(combo: string | null) {
  if (!sound.value) return
  const conflict = sb.assignHotkey(combo, { soundId: sound.value.id })
  pending.value = conflict && combo ? { combo, conflict } : null
}
function steal() {
  if (!sound.value || !pending.value) return
  sb.assignHotkey(pending.value.combo, { soundId: sound.value.id }, true)
  pending.value = null
}
const conflictLabel = computed(() => {
  const c = pending.value?.conflict
  if (!c) return ''
  if (c.type === 'sound') return `“${c.sound.name}”`
  if (c.type === 'ptt') return 'Push-to-talk'
  return 'Stop all sounds'
})

function close() {
  ui.editingSoundId = null
}
function remove() {
  const s = sound.value
  if (!s) return
  askConfirm('Delete sound', `“${s.name}” will be permanently removed from your library.`, 'Delete', () => {
    void sb.deleteSound(s.id)
    close()
  })
}
const isPlaying = computed(() => !!sound.value && !!sb.playing.value[sound.value.id])
const isPreviewing = computed(() => !!sound.value && !!sb.previewing.value[sound.value.id])

function fmtSize(b: number) {
  return b > 1e6 ? `${(b / 1e6).toFixed(1)} MB` : `${Math.round(b / 1e3)} KB`
}
</script>

<template>
  <UiModal :open="!!sound" title="Edit sound" width="max-w-[460px]" @close="close">
    <div v-if="sound" class="space-y-5 p-5">
      <div>
        <label class="label" for="sound-name">Name</label>
        <input id="sound-name" v-model="sound.name" class="field" maxlength="60" @keydown.enter="close">
      </div>

      <div>
        <label class="label">Icon</label>
        <div class="grid grid-cols-11 gap-1">
          <button
            class="flex aspect-square items-center justify-center rounded-lg border text-[10px] text-ink-500 transition-colors"
            :class="!sound.icon ? 'border-accent/60 bg-accent-soft text-ink-200' : 'border-white/[0.06] hover:bg-white/[0.05]'"
            title="No icon"
            @click="sound.icon = null"
          >
            —
          </button>
          <button
            v-for="name in iconNames"
            :key="name"
            class="flex aspect-square items-center justify-center rounded-lg border transition-colors"
            :class="sound.icon === name ? 'border-accent/60 bg-accent-soft text-ink-100' : 'border-white/[0.06] text-ink-400 hover:bg-white/[0.05] hover:text-ink-200'"
            :title="name"
            @click="sound.icon = name"
          >
            <PadIcon :name="name" :size="14" />
          </button>
        </div>
      </div>

      <div>
        <div class="mb-1.5 flex items-center justify-between">
          <label class="label mb-0">Color Accent</label>
          <span v-if="sound.color" class="font-mono text-2xs uppercase text-ink-400">
            {{ resolveColorHex(sound.color) }}
          </span>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <button
            class="flex h-7 w-7 items-center justify-center rounded-lg border text-xs text-ink-500 transition-colors"
            :class="!sound.color ? 'border-accent/60 bg-accent-soft text-ink-200 font-semibold' : 'border-white/[0.08] hover:bg-white/[0.05]'"
            title="Default (No color)"
            @click="sound.color = null"
          >
            —
          </button>
          <button
            v-for="preset in COLOR_PRESETS"
            :key="preset.id"
            class="relative flex h-7 w-7 items-center justify-center rounded-lg border transition-transform hover:scale-105 active:scale-95"
            :class="sound.color === preset.id || sound.color === preset.hex ? 'border-white ring-2 ring-white/20' : 'border-transparent'"
            :title="preset.label"
            :style="{ backgroundColor: preset.hex }"
            @click="sound.color = preset.id"
          >
            <Check
              v-if="sound.color === preset.id || sound.color === preset.hex"
              :size="13"
              :class="getContrastTextColor(preset.hex) === 'black' ? 'text-black' : 'text-white'"
              stroke-width="3"
            />
          </button>
          <div class="ml-auto flex items-center gap-1.5">
            <label class="cursor-pointer" title="Custom color picker">
              <input
                type="color"
                class="sr-only"
                :value="resolveColorHex(sound.color) || '#8b93ff'"
                @input="(e) => (sound!.color = (e.target as HTMLInputElement).value)"
              >
              <span class="btn-outline h-7 px-2 text-2xs text-ink-300 hover:text-ink-100">
                Custom
              </span>
            </label>
          </div>
        </div>
      </div>

      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="label">Shortcut</label>
          <UiHotkeyRecorder :model-value="sound.hotkey" placeholder="None" @record="onRecord" />
        </div>
        <div>
          <label class="label">Collection</label>
          <select v-model="sound.collectionId" class="select">
            <option :value="null">None</option>
            <option v-for="c in sb.state.collections" :key="c.id" :value="c.id">{{ c.name }}</option>
          </select>
        </div>
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
            <button class="btn-outline h-7 px-2.5 text-[12px]" @click="steal">Reassign here</button>
            <button class="btn h-7 px-2.5 text-[12px]" @click="pending = null">Keep current</button>
          </div>
        </div>
      </div>

      <div>
        <div class="mb-1.5 flex items-center justify-between">
          <label class="label mb-0">Volume</label>
          <span class="font-mono text-[11px] tabular-nums text-ink-400">{{ Math.round(sound.volume * 100) }}%</span>
        </div>
        <UiSlider :model-value="sound.volume" :max="1.5" @update:model-value="(v: number) => sb.updateSound(sound!.id, { volume: v })" />
      </div>

      <div class="flex items-center justify-between">
        <div>
          <p class="text-[13px] text-ink-200">Loop</p>
          <p class="text-[11.5px] text-ink-500">Repeat until triggered again or stopped</p>
        </div>
        <UiToggle :model-value="sound.loop" @update:model-value="(v: boolean) => sb.updateSound(sound!.id, { loop: v })" />
      </div>

      <div class="flex items-center gap-2">
        <button class="btn-outline flex-1 justify-center" @click="sb.previewSound(sound.id)">
          <Square v-if="isPreviewing" :size="12" fill="currentColor" />
          <Headphones v-else :size="14" />
          {{ isPreviewing ? 'Stop preview' : 'Preview (only you)' }}
        </button>
        <button class="btn-outline flex-1 justify-center" @click="isPlaying ? sb.stopSound(sound.id) : sb.triggerSound(sound.id)">
          <Square v-if="isPlaying" :size="12" fill="currentColor" />
          <Play v-else :size="14" />
          {{ isPlaying ? 'Stop' : 'Play to mic' }}
        </button>
      </div>

      <p class="truncate text-[11px] text-ink-500" :title="sound.originalName">
        {{ sound.originalName }} · {{ fmtSize(sound.size) }} · {{ sound.duration.toFixed(2) }}s
      </p>
    </div>

    <template #footer>
      <button class="btn mr-auto text-red-300 hover:bg-red-500/10 hover:text-red-200" @click="remove">
        <Trash2 :size="14" /> Delete
      </button>
      <button class="btn-primary" @click="close">Done</button>
    </template>
  </UiModal>
</template>
