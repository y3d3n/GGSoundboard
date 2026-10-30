<script setup lang="ts">
import { Search, Upload, Square, PanelRight, Plus, AudioLines } from 'lucide-vue-next'

const sb = useSoundboard()
const { state, visibleSounds, playing, previewing } = sb
const fileInput = ref<HTMLInputElement | null>(null)

const title = computed(() =>
  state.activeCollection === 'all' ? 'All sounds' : state.collections.find((c) => c.id === state.activeCollection)?.name ?? 'Sounds',
)
const anyPlaying = computed(() => Object.keys(playing.value).length > 0 || Object.keys(previewing.value).length > 0)
const minWidth = computed(() => ({ sm: 140, md: 172, lg: 210 })[state.settings.padSize])

function pick() {
  fileInput.value?.click()
}
function onFiles(e: Event) {
  const input = e.target as HTMLInputElement
  if (input.files?.length) void sb.importFiles(input.files)
  input.value = ''
}
defineExpose({ pick })
</script>

<template>
  <main class="flex min-w-0 flex-1 flex-col">
    <!-- Toolbar -->
    <header class="drag flex h-[52px] shrink-0 items-center gap-3 border-b border-white/[0.06] px-5">
      <h1 class="min-w-0 truncate text-[13.5px] font-semibold tracking-tight text-ink-100">{{ title }}</h1>
      <span class="font-mono text-[11px] tabular-nums text-ink-500">{{ visibleSounds.length }}</span>

      <div class="no-drag relative ml-auto w-[240px]">
        <Search :size="14" class="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-500" />
        <input id="sound-search" v-model="state.search" class="field h-[30px] pl-8 pr-12" placeholder="Search sounds" @keydown.esc="state.search = ''">
        <span class="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2"><UiKbd :combo="sb.platform === 'mac' ? 'Meta+KeyK' : 'Ctrl+KeyK'" dim /></span>
      </div>

      <div class="no-drag flex h-[30px] items-center rounded-lg border border-white/[0.08] bg-white/[0.03] p-0.5">
        <button
          v-for="sz in (['sm', 'md', 'lg'] as const)"
          :key="sz"
          class="h-full rounded-md px-2 text-[11px] font-medium uppercase transition-colors"
          :class="state.settings.padSize === sz ? 'bg-white/[0.09] text-ink-100' : 'text-ink-500 hover:text-ink-200'"
          :title="`Pad size: ${sz}`"
          @click="state.settings.padSize = sz"
        >
          {{ sz }}
        </button>
      </div>

      <button class="btn-outline h-[30px]" :disabled="!anyPlaying" title="Stop all sounds" @click="sb.stopAll()">
        <Square :size="12" fill="currentColor" />
        Stop
        <UiKbd :combo="state.settings.stopAllKey" dim />
      </button>
      <button class="btn-primary h-[30px]" @click="pick">
        <Upload :size="14" /> Import
      </button>
      <button
        class="icon-btn h-[30px] w-[30px]"
        :class="state.settings.mixerOpen && 'bg-white/[0.06] text-ink-100'"
        title="Toggle mixer"
        @click="state.settings.mixerOpen = !state.settings.mixerOpen"
      >
        <PanelRight :size="15" />
      </button>
      <input ref="fileInput" type="file" class="hidden" multiple accept="audio/*,.mp3,.wav,.ogg,.oga,.opus,.m4a,.aac,.flac,.webm" @change="onFiles">
    </header>

    <!-- Grid -->
    <div class="flex-1 overflow-y-auto p-5">
      <div
        v-if="visibleSounds.length"
        class="grid gap-2.5"
        :style="{ gridTemplateColumns: `repeat(auto-fill, minmax(${minWidth}px, 1fr))` }"
      >
        <SoundPad
          v-for="s in visibleSounds"
          :key="s.id"
          :sound="s"
          :playing="playing[s.id]"
          :previewing="previewing[s.id]"
          :size="state.settings.padSize"
        />
        <button
          class="flex flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-white/[0.08] text-[12px] text-ink-500 transition-colors hover:border-white/[0.16] hover:text-ink-300"
          :class="state.settings.padSize === 'sm' ? 'h-[88px]' : state.settings.padSize === 'lg' ? 'h-[148px]' : 'h-[116px]'"
          @click="pick"
        >
          <Plus :size="16" />
          Add sound
        </button>
      </div>

      <div v-else-if="state.search" class="flex h-full flex-col items-center justify-center text-center text-ink-500">
        <p class="text-[13px]">No sounds match “{{ state.search }}”</p>
      </div>

      <div v-else class="flex h-full items-center justify-center">
        <div class="flex w-full max-w-md flex-col items-center rounded-2xl border border-dashed border-white/[0.1] px-8 py-12 text-center transition-colors hover:border-white/[0.16] hover:bg-white/[0.015]">
          <span class="mb-4 flex h-11 w-11 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.04] text-ink-300">
            <AudioLines :size="20" />
          </span>
          <p class="text-[14px] font-medium text-ink-100">Drop audio files here</p>
          <p class="mt-1.5 text-[12.5px] leading-relaxed text-ink-400">
            MP3, WAV, OGG, M4A, FLAC and more. Pads get <span class="text-ink-300">F1–F12</span> automatically.
          </p>
          <div class="mt-5 flex items-center gap-2.5">
            <button class="btn-primary" @click="pick">
              <Upload :size="14" /> Choose files
            </button>
            <button class="btn-outline" @click="sb.loadStarterSounds">
              Load starter sounds
            </button>
          </div>
        </div>
      </div>
    </div>
  </main>
</template>
