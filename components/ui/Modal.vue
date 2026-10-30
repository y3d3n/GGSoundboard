<script setup lang="ts">
import { X } from 'lucide-vue-next'

withDefaults(defineProps<{ open: boolean; title?: string; width?: string }>(), { width: 'max-w-md' })
const emit = defineEmits<{ close: [] }>()
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-150 ease-out"
      enter-from-class="opacity-0"
      leave-active-class="transition duration-100 ease-in"
      leave-to-class="opacity-0"
    >
      <div
        v-if="open"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6 backdrop-blur-[2px]"
        @mousedown.self="emit('close')"
      >
        <div
          class="w-full animate-pop-in overflow-hidden rounded-2xl border border-white/[0.08] bg-ink-900 shadow-[0_24px_80px_-12px_rgba(0,0,0,0.8)]"
          :class="width"
          role="dialog"
          aria-modal="true"
        >
          <header v-if="title" class="flex h-12 items-center justify-between border-b border-white/[0.06] pl-5 pr-3">
            <h2 class="text-[13.5px] font-semibold text-ink-100">{{ title }}</h2>
            <button class="icon-btn h-7 w-7" aria-label="Close" @click="emit('close')">
              <X :size="15" />
            </button>
          </header>
          <div class="max-h-[75vh] overflow-y-auto">
            <slot />
          </div>
          <footer v-if="$slots.footer" class="flex items-center justify-end gap-2 border-t border-white/[0.06] bg-white/[0.01] px-4 py-3">
            <slot name="footer" />
          </footer>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
