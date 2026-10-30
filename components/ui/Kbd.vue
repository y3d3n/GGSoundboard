<script setup lang="ts">
import { formatCombo } from '~/lib/hotkeys'

const props = defineProps<{
  combo: string | null | undefined
  dim?: boolean
  theme?: { bg?: string; text?: string; border?: string }
}>()
const parts = computed(() => formatCombo(props.combo))
</script>

<template>
  <span v-if="parts.length" class="inline-flex items-center gap-[3px]" :class="dim && 'opacity-60'">
    <kbd
      v-for="(p, i) in parts"
      :key="i"
      class="kbd"
      :style="theme ? { backgroundColor: theme.bg, color: theme.text, borderColor: theme.border } : {}"
    >
      {{ p }}
    </kbd>
  </span>
</template>
