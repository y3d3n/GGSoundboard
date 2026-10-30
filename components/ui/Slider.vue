<script setup lang="ts">
const props = withDefaults(
  defineProps<{ modelValue: number; min?: number; max?: number; step?: number; disabled?: boolean; muted?: boolean }>(),
  { min: 0, max: 1, step: 0.01 },
)
const emit = defineEmits<{ 'update:modelValue': [number] }>()
const pct = computed(() => ((props.modelValue - props.min) / (props.max - props.min)) * 100)
function onInput(e: Event) {
  emit('update:modelValue', Number((e.target as HTMLInputElement).value))
}
</script>

<template>
  <input
    type="range"
    class="sb-range no-drag"
    :class="{ 'is-muted': muted }"
    :min="min"
    :max="max"
    :step="step"
    :value="modelValue"
    :disabled="disabled"
    :style="{ '--pct': pct + '%' }"
    @input="onInput"
    @keydown.stop
  >
</template>

<style scoped>
.sb-range {
  -webkit-appearance: none;
  appearance: none;
  width: 100%;
  height: 18px;
  background: transparent;
  cursor: pointer;
}
.sb-range:disabled {
  opacity: 0.4;
  cursor: default;
}
.sb-range::-webkit-slider-runnable-track {
  height: 4px;
  border-radius: 999px;
  background: linear-gradient(to right, #d4d4da var(--pct), rgba(255, 255, 255, 0.08) var(--pct));
}
.sb-range.is-muted::-webkit-slider-runnable-track {
  background: linear-gradient(to right, #4a4a54 var(--pct), rgba(255, 255, 255, 0.06) var(--pct));
}
.sb-range::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 14px;
  height: 14px;
  margin-top: -5px;
  border-radius: 50%;
  background: #ededf0;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.5), 0 0 0 0.5px rgba(0, 0, 0, 0.3);
  transition: transform 0.12s ease;
}
.sb-range:hover::-webkit-slider-thumb {
  transform: scale(1.12);
}
.sb-range:active::-webkit-slider-thumb {
  transform: scale(0.95);
}
.sb-range:focus-visible {
  outline: none;
}
.sb-range:focus-visible::-webkit-slider-thumb {
  box-shadow: 0 0 0 3px rgba(139, 147, 255, 0.5);
}
.sb-range::-moz-range-track {
  height: 4px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.08);
}
.sb-range::-moz-range-progress {
  height: 4px;
  border-radius: 999px;
  background: #d4d4da;
}
.sb-range::-moz-range-thumb {
  width: 14px;
  height: 14px;
  border: none;
  border-radius: 50%;
  background: #ededf0;
}
</style>
