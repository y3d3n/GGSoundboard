<script setup lang="ts">
defineProps<{ modelValue: boolean; disabled?: boolean; size?: 'sm' | 'md' }>()
defineEmits<{ 'update:modelValue': [boolean] }>()
</script>

<template>
  <button
    type="button"
    role="switch"
    :aria-checked="modelValue"
    :disabled="disabled"
    class="no-drag relative inline-flex shrink-0 items-center rounded-full transition-colors duration-200 disabled:opacity-40"
    :class="[
      size === 'sm' ? 'h-[16px] w-[28px]' : 'h-[20px] w-[34px]',
      modelValue ? 'bg-accent' : 'bg-white/[0.12]',
    ]"
    @click="$emit('update:modelValue', !modelValue)"
  >
    <span
      class="inline-block rounded-full bg-white shadow-[0_1px_2px_rgba(0,0,0,0.4)] transition-transform duration-200 ease-[cubic-bezier(0.3,0.9,0.3,1)]"
      :class="[
        size === 'sm' ? 'h-[12px] w-[12px]' : 'h-[16px] w-[16px]',
        modelValue ? (size === 'sm' ? 'translate-x-[14px]' : 'translate-x-[16px]') : 'translate-x-[2px]',
      ]"
    />
  </button>
</template>
