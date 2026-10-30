<script setup lang="ts">
/**
 * Click to record a key combination. Captures every non-modifier key
 * (including Esc/Space) so they can be bound; use the buttons to cancel/clear.
 */
import { eventToCombo } from '~/lib/hotkeys'

const props = defineProps<{ modelValue: string | null; placeholder?: string; allowClear?: boolean }>()
const emit = defineEmits<{ record: [string | null] }>()
const { state } = useSoundboard()
const recording = ref(false)
const root = ref<HTMLElement | null>(null)

function onKey(e: KeyboardEvent) {
  e.preventDefault()
  e.stopPropagation()
  const combo = eventToCombo(e)
  if (!combo) return // waiting for a non-modifier key
  stop()
  emit('record', combo)
}
function onPointer(e: PointerEvent) {
  if (root.value && !root.value.contains(e.target as Node)) stop()
}
function start() {
  recording.value = true
  state.recordingHotkey = true
  window.addEventListener('keydown', onKey, true)
  window.addEventListener('pointerdown', onPointer, true)
}
function stop() {
  recording.value = false
  state.recordingHotkey = false
  window.removeEventListener('keydown', onKey, true)
  window.removeEventListener('pointerdown', onPointer, true)
}
function clear() {
  stop()
  emit('record', null)
}
onBeforeUnmount(stop)
defineExpose({ start })
</script>

<template>
  <div ref="root" class="flex items-center gap-1.5">
    <button
      type="button"
      class="field flex min-w-[120px] items-center justify-between gap-2 text-left"
      :class="recording && '!border-accent/70 !bg-accent-soft'"
      @click="recording ? stop() : start()"
    >
      <span v-if="recording" class="flex items-center gap-2 text-ink-200">
        <span class="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
        Press keys…
      </span>
      <UiKbd v-else-if="props.modelValue" :combo="props.modelValue" />
      <span v-else class="text-ink-500">{{ placeholder ?? 'Click to set' }}</span>
    </button>
    <button v-if="recording" type="button" class="btn h-8 px-2 text-ink-400" @click="stop">Cancel</button>
    <button
      v-else-if="allowClear !== false && props.modelValue"
      type="button"
      class="btn h-8 px-2 text-ink-400"
      @click="clear"
    >
      Clear
    </button>
  </div>
</template>
