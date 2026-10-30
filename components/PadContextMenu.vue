<script setup lang="ts">
import { Play, Headphones, Pencil, Repeat, Trash2, Square } from 'lucide-vue-next'
import { COLOR_PRESETS } from '~/lib/colors'

const sb = useSoundboard()
const { ui, askConfirm } = useUi()
const menu = ref<HTMLElement | null>(null)
const pos = ref({ x: 0, y: 0 })

const sound = computed(() => (ui.contextMenu ? sb.state.sounds.find((s) => s.id === ui.contextMenu!.soundId) ?? null : null))
const isPlaying = computed(() => !!sound.value && !!sb.playing.value[sound.value.id])

watch(
  () => ui.contextMenu,
  async (m) => {
    if (!m) return
    pos.value = { x: m.x, y: m.y }
    await nextTick()
    const r = menu.value?.getBoundingClientRect()
    if (r) {
      pos.value = {
        x: Math.min(m.x, window.innerWidth - r.width - 8),
        y: Math.min(m.y, window.innerHeight - r.height - 8),
      }
    }
  },
)

function run(fn: () => void) {
  fn()
  ui.contextMenu = null
}
function close() {
  ui.contextMenu = null
}
function remove() {
  const s = sound.value
  if (!s) return
  askConfirm('Delete sound', `“${s.name}” will be permanently removed from your library.`, 'Delete', () => void sb.deleteSound(s.id))
}
</script>

<template>
  <Teleport to="body">
    <div v-if="sound" class="fixed inset-0 z-40" @mousedown="close" @contextmenu.prevent="close">
      <div
        ref="menu"
        class="fixed min-w-[200px] animate-pop-in rounded-xl border border-white/[0.08] bg-ink-850/95 p-1 shadow-[0_16px_48px_-8px_rgba(0,0,0,0.7)] backdrop-blur-xl"
        :style="{ left: pos.x + 'px', top: pos.y + 'px' }"
        @mousedown.stop
      >
        <p class="truncate px-2.5 pb-1 pt-1.5 text-[11px] font-medium text-ink-500">{{ sound.name }}</p>
        <button class="ctx" @click="run(() => (isPlaying ? sb.stopSound(sound!.id) : sb.triggerSound(sound!.id)))">
          <Square v-if="isPlaying" :size="13" /><Play v-else :size="14" />
          {{ isPlaying ? 'Stop' : 'Play' }}
          <UiKbd class="ml-auto" :combo="sound.hotkey" dim />
        </button>
        <button class="ctx" @click="run(() => sb.previewSound(sound!.id))"><Headphones :size="14" /> Preview (only you)</button>
        <button class="ctx" @click="run(() => sb.updateSound(sound!.id, { loop: !sound!.loop }))">
          <Repeat :size="14" /> {{ sound.loop ? 'Disable loop' : 'Enable loop' }}
        </button>
        <button class="ctx" @click="run(() => (ui.editingSoundId = sound!.id))"><Pencil :size="14" /> Edit…</button>
        <div class="mx-2 my-1 h-px bg-white/[0.06]" />
        <!-- Quick color swatch -->
        <div class="px-2.5 py-1">
          <p class="mb-1 text-2xs uppercase tracking-wider text-ink-500">Color</p>
          <div class="flex items-center gap-1.5">
            <button
              class="flex h-4 w-4 items-center justify-center rounded-full border border-white/20 text-[9px] text-ink-400 transition-transform hover:scale-125"
              title="None"
              @click="run(() => sb.updateSound(sound!.id, { color: null }))"
            >
              ×
            </button>
            <button
              v-for="p in COLOR_PRESETS"
              :key="p.id"
              class="h-4 w-4 rounded-full transition-transform hover:scale-125"
              :style="{ backgroundColor: p.hex }"
              :title="p.label"
              @click="run(() => sb.updateSound(sound!.id, { color: p.id }))"
            />
          </div>
        </div>
        <div class="mx-2 my-1 h-px bg-white/[0.06]" />
        <button class="ctx !text-red-300 hover:!bg-red-500/10" @click="run(remove)"><Trash2 :size="14" /> Delete</button>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.ctx {
  @apply flex h-8 w-full items-center gap-2.5 rounded-lg px-2.5 text-left text-[12.5px] text-ink-200 transition-colors hover:bg-white/[0.07] hover:text-ink-100;
}
</style>
