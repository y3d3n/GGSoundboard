<script setup lang="ts">
import { toDb, type Level } from '~/engine/AudioEngine'

const props = defineProps<{ level: Level; muted?: boolean; segments?: number }>()

const FLOOR = -60
const norm = (db: number) => Math.max(0, Math.min(1, (db - FLOOR) / -FLOOR))

const hold = ref(0)
let holdAt = 0
const rmsPos = computed(() => norm(toDb(props.level.rms, FLOOR) + 3)) // +3dB: rms→perceived
const peakPos = computed(() => norm(toDb(props.level.peak, FLOOR)))

watch(peakPos, (p) => {
  const now = performance.now()
  if (p >= hold.value) {
    hold.value = p
    holdAt = now
  } else if (now - holdAt > 900) {
    hold.value = Math.max(p, hold.value - 0.02)
  }
})

const clipping = computed(() => props.level.peak >= 0.99)
const color = computed(() => {
  if (props.muted) return 'bg-ink-500'
  if (clipping.value) return 'bg-red-400'
  if (peakPos.value > 0.85) return 'bg-amber-300'
  return 'bg-emerald-400/90'
})
</script>

<template>
  <div class="relative h-[5px] w-full overflow-hidden rounded-full bg-white/[0.06]">
    <div
      class="absolute inset-y-0 left-0 rounded-full transition-[width] duration-75 ease-linear"
      :class="color"
      :style="{ width: `${rmsPos * 100}%` }"
    />
    <div
      v-if="hold > 0.02"
      class="absolute inset-y-0 w-[2px] rounded-full"
      :class="muted ? 'bg-ink-400' : clipping ? 'bg-red-300' : 'bg-ink-100/80'"
      :style="{ left: `calc(${hold * 100}% - 2px)` }"
    />
  </div>
</template>
