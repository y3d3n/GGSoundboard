<script setup lang="ts">
import { CircleCheck, TriangleAlert, Info, X } from 'lucide-vue-next'

const { toasts, dismiss } = useToasts()
</script>

<template>
  <div class="pointer-events-none fixed bottom-4 left-1/2 z-[60] flex w-full max-w-md -translate-x-1/2 flex-col items-center gap-2 px-4">
    <TransitionGroup
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="translate-y-2 opacity-0"
      leave-active-class="transition duration-150 ease-in"
      leave-to-class="opacity-0"
    >
      <div
        v-for="t in toasts"
        :key="t.id"
        class="pointer-events-auto flex max-w-full items-start gap-2.5 rounded-xl border border-white/[0.08] bg-ink-850/95 py-2.5 pl-3 pr-2 text-[12.5px] leading-snug text-ink-200 shadow-[0_12px_40px_-8px_rgba(0,0,0,0.7)] backdrop-blur-xl"
      >
        <CircleCheck v-if="t.kind === 'success'" :size="15" class="mt-px shrink-0 text-emerald-400" />
        <TriangleAlert v-else-if="t.kind === 'error'" :size="15" class="mt-px shrink-0 text-red-400" />
        <Info v-else :size="15" class="mt-px shrink-0 text-ink-400" />
        <span class="min-w-0 flex-1">{{ t.message }}</span>
        <button class="-my-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded text-ink-500 hover:text-ink-200" @click="dismiss(t.id)">
          <X :size="12" />
        </button>
      </div>
    </TransitionGroup>
  </div>
</template>
