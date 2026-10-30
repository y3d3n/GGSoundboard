<script setup lang="ts">
import { PAD_ICONS, type PadIconName } from '~/lib/icons'

const props = withDefaults(defineProps<{ name: string | null; size?: number }>(), { size: 16 })
const comp = computed(() => (props.name ? PAD_ICONS[props.name as PadIconName] ?? null : null))
</script>

<template>
  <component :is="comp" v-if="comp" :size="size" :stroke-width="1.75" />
</template>
