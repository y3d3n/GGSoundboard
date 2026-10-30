<script setup lang="ts">
import { Upload, Power } from 'lucide-vue-next'

const sb = useSoundboard()
const { state } = sb
const { ui } = useUi()
useKeyboard()

const isRemoteMode = ref(
  typeof window !== 'undefined' &&
  (window.location.pathname === '/remote' ||
   window.location.pathname.startsWith('/remote/') ||
   window.location.search.includes('remote=1') ||
   window.location.search.includes('mode=remote') ||
   window.location.hash.startsWith('#/remote') ||
   (window.location.port === '4567' || window.location.port === '4568' || window.location.port === '4569'))
)

// ── Drag & drop import (files only; internal pad drags are ignored) ──
const dragDepth = ref(0)
const isFileDrag = (e: DragEvent) => !!e.dataTransfer?.types.includes('Files')
function onDragEnter(e: DragEvent) {
  if (isRemoteMode.value || !isFileDrag(e)) return
  e.preventDefault()
  dragDepth.value++
}
function onDragLeave(e: DragEvent) {
  if (isRemoteMode.value || !isFileDrag(e)) return
  dragDepth.value = Math.max(0, dragDepth.value - 1)
}
function onDragOver(e: DragEvent) {
  if (isRemoteMode.value || !isFileDrag(e)) return
  e.preventDefault()
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'
}
function onDrop(e: DragEvent) {
  if (isRemoteMode.value || !isFileDrag(e)) return
  e.preventDefault()
  dragDepth.value = 0
  if (e.dataTransfer?.files.length) void sb.importFiles(e.dataTransfer.files)
}

onMounted(async () => {
  if (!isRemoteMode.value) {
    await sb.init()
    if (!state.settings.onboarded && sb.routingStatus.value !== 'ok') ui.setupOpen = true
    if (sb.native?.onMenuAction) {
      sb.native.onMenuAction((action: string) => {
        if (action === 'about') ui.aboutOpen = true
        else if (action === 'settings') ui.settingsOpen = true
        else if (action === 'setup') ui.setupOpen = true
        else if (action === 'remote') ui.remoteOpen = true
      })
    }
  }
})
</script>

<template>
  <!-- Remote Controller Mode for mobile phones, tablets & secondary computers -->
  <RemoteController v-if="isRemoteMode" />

  <!-- Full Desktop Soundboard & Audio Engine Host -->
  <div
    v-else
    class="flex h-full w-full overflow-hidden"
    @dragenter="onDragEnter"
    @dragleave="onDragLeave"
    @dragover="onDragOver"
    @drop="onDrop"
  >
    <AppSidebar />
    <BoardView />
    <Transition
      enter-active-class="transition-[margin,opacity] duration-200 ease-out"
      enter-from-class="-mr-[320px] opacity-0"
      leave-active-class="transition-[margin,opacity] duration-150 ease-in"
      leave-to-class="-mr-[320px] opacity-0"
    >
      <MixerPanel v-if="state.settings.mixerOpen" />
    </Transition>

    <!-- Loading -->
    <div v-if="!state.ready" class="fixed inset-0 z-40 flex items-center justify-center bg-ink-950">
      <div class="flex items-center gap-2 text-[12.5px] text-ink-500">
        <span class="h-1.5 w-1.5 animate-pulse rounded-full bg-ink-400" /> Starting audio engine…
      </div>
    </div>

    <!-- Autoplay gate (browsers only; Electron starts audio immediately) -->
    <div
      v-else-if="state.engineState === 'suspended'"
      class="fixed inset-0 z-40 flex items-center justify-center bg-ink-950/80 backdrop-blur-sm"
      @click="sb.resumeAudio()"
    >
      <button class="flex flex-col items-center gap-3 rounded-2xl border border-white/[0.08] bg-ink-900 px-10 py-8 text-center">
        <span class="flex h-11 w-11 items-center justify-center rounded-full bg-ink-100 text-ink-950"><Power :size="18" /></span>
        <span class="text-[14px] font-medium text-ink-100">Enable audio</span>
        <span class="text-[12px] text-ink-400">Your browser requires a click before audio can start.</span>
      </button>
    </div>

    <!-- Drop overlay -->
    <Transition enter-active-class="transition duration-100" enter-from-class="opacity-0" leave-active-class="transition duration-100" leave-to-class="opacity-0">
      <div v-if="dragDepth > 0" class="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-ink-950/75 backdrop-blur-sm">
        <div class="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-white/25 px-16 py-12">
          <Upload :size="22" class="text-ink-200" />
          <p class="text-[14px] font-medium text-ink-100">Drop to import</p>
          <p class="text-[12px] text-ink-400">
            into {{ state.activeCollection === 'all' ? 'your library' : state.collections.find((c) => c.id === state.activeCollection)?.name }}
          </p>
        </div>
      </div>
    </Transition>

    <SoundEditor />
    <SettingsModal />
    <SetupGuide />
    <RemoteModal />
    <AboutModal />
    <ConfirmDialog />
    <PadContextMenu />
    <ToastStack />
  </div>
</template>
