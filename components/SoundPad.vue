<script setup lang="ts">
import { Ellipsis, Repeat, Headphones, TriangleAlert } from 'lucide-vue-next'
import type { Sound } from '~/lib/types'
import type { PlayingInfo } from '~/composables/useSoundboard'
import { computePadTheme } from '~/lib/colors'

const props = defineProps<{ sound: Sound; playing?: PlayingInfo; previewing?: PlayingInfo; size: 'sm' | 'md' | 'lg' }>()
const sb = useSoundboard()
const { ui } = useUi()

const pulse = ref(0)
watch(
  () => !!props.playing,
  (now, before) => { if (now && !before) pulse.value++ },
)
const failed = computed(() => sb.state.failedSounds.includes(props.sound.id))
const theme = computed(() => computePadTheme(props.sound.color))

const padStyle = computed(() => {
  if (!theme.value) return {}
  const t = theme.value
  if (props.playing) {
    return {
      backgroundColor: t.bg,
      borderColor: t.playingBorderColor,
      boxShadow: `0 0 28px -2px ${t.pulseGlow}, inset 0 0 0 1.5px ${t.playingBorderColor}`,
      filter: 'brightness(1.12)',
    }
  }
  return {
    backgroundColor: t.bg,
    borderColor: t.borderColor,
    boxShadow: '0 2px 10px rgba(0, 0, 0, 0.3)',
  }
})

function fmt(sec: number) {
  if (!isFinite(sec)) return ''
  if (sec < 10) return sec.toFixed(1) + 's'
  const m = Math.floor(sec / 60)
  const s = Math.round(sec % 60)
  return m ? `${m}:${String(s).padStart(2, '0')}` : `${s}s`
}

function onClick() {
  void sb.triggerSound(props.sound.id)
}
function onContext(e: MouseEvent) {
  ui.contextMenu = { x: e.clientX, y: e.clientY, soundId: props.sound.id }
}
function edit(e: MouseEvent) {
  e.stopPropagation()
  ui.editingSoundId = props.sound.id
}

// Drag to reorder
const dragOver = ref(false)
function onDragStart(e: DragEvent) {
  e.dataTransfer?.setData('application/x-sound-id', props.sound.id)
  if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move'
}
function onDragOver(e: DragEvent) {
  if (e.dataTransfer?.types.includes('application/x-sound-id')) {
    e.preventDefault()
    dragOver.value = true
  }
}
function onDrop(e: DragEvent) {
  dragOver.value = false
  const id = e.dataTransfer?.getData('application/x-sound-id')
  if (id) {
    e.preventDefault()
    e.stopPropagation()
    sb.moveSound(id, props.sound.id)
  }
}
</script>

<template>
  <div
    role="button"
    tabindex="0"
    draggable="true"
    class="group relative flex cursor-pointer flex-col justify-between overflow-hidden rounded-xl border p-3 text-left outline-none transition-[background-color,border-color,transform,box-shadow,filter] duration-150 active:scale-[0.97]"
    :class="[
      size === 'sm' ? 'h-[88px]' : size === 'lg' ? 'h-[148px]' : 'h-[116px]',
      playing && !theme
        ? 'border-accent/45 bg-accent/[0.08]'
        : !theme && 'border-white/[0.06] bg-white/[0.025] hover:border-white/[0.1] hover:bg-white/[0.045]',
      dragOver && '!border-white/30',
      'focus-visible:border-accent/60',
    ]"
    :style="padStyle"
    @click="onClick"
    @keydown.enter.prevent="onClick"
    @contextmenu.prevent="onContext"
    @dragstart="onDragStart"
    @dragover="onDragOver"
    @dragleave="dragOver = false"
    @drop="onDrop"
  >
    <!-- trigger pulse -->
    <span
      :key="pulse"
      class="pointer-events-none absolute inset-0 rounded-xl"
      :class="pulse && 'animate-pad-pulse'"
      :style="theme ? { boxShadow: pulse ? `0 0 0 12px ${theme.pulseGlow}` : undefined } : undefined"
    />

    <div class="flex items-start justify-between gap-2">
      <div
        class="flex h-5 items-center gap-1.5"
        :style="theme ? { color: theme.iconColor } : {}"
        :class="playing && !theme && '!text-accent'"
      >
        <span v-if="playing" class="flex h-3.5 items-end gap-[2px]">
          <span
            v-for="i in 4"
            :key="i"
            class="w-[2.5px] origin-bottom animate-eq rounded-full bg-current"
            :style="{ height: '100%', animationDelay: `${i * -0.17}s`, animationDuration: `${0.7 + i * 0.13}s` }"
          />
        </span>
        <TriangleAlert v-else-if="failed" :size="15" class="text-amber-300" />
        <PadIcon v-else :name="sound.icon" :size="size === 'sm' ? 15 : 17" />
      </div>
      <div class="flex items-center gap-1">
        <button
          class="-my-1 flex h-6 w-6 items-center justify-center rounded-md opacity-0 transition-opacity group-hover:opacity-100"
          :class="theme ? (theme.isLight ? 'text-black/60 hover:bg-black/10 hover:text-black' : 'text-white/70 hover:bg-white/15 hover:text-white') : 'text-ink-400 hover:bg-white/[0.08] hover:text-ink-100'"
          title="Edit"
          @click="edit"
        >
          <Ellipsis :size="14" />
        </button>
        <UiKbd :combo="sound.hotkey" :theme="theme?.kbd" />
      </div>
    </div>

    <div class="min-w-0">
      <p
        class="line-clamp-2 font-medium leading-[1.3] tracking-[-0.005em]"
        :class="!theme && 'text-ink-100'"
        :style="{
          fontSize: size === 'sm' ? '12.5px' : '13.5px',
          color: theme ? theme.textColor : undefined,
          textShadow: theme && !theme.isLight ? '0 1px 2px rgba(0,0,0,0.3)' : undefined,
        }"
      >
        {{ sound.name }}
      </p>
      <div
        v-if="size !== 'sm'"
        class="mt-1 flex items-center gap-1.5 text-[11px]"
        :class="!theme && 'text-ink-500'"
        :style="{ color: theme ? theme.subTextColor : undefined }"
      >
        <span class="font-mono tabular-nums">{{ fmt(sound.duration) }}</span>
        <Repeat v-if="sound.loop" :size="11" />
        <span v-if="Math.round(sound.volume * 100) !== 100" class="font-mono tabular-nums">· {{ Math.round(sound.volume * 100) }}%</span>
        <Headphones v-if="previewing" :size="11" />
      </div>
    </div>

    <!-- progress -->
    <div
      v-if="playing || previewing"
      class="absolute inset-x-0 bottom-0 h-[3px]"
      :class="!theme && 'bg-white/[0.06]'"
      :style="{ backgroundColor: theme ? (theme.isLight ? 'rgba(0,0,0,0.15)' : 'rgba(255,255,255,0.2)') : undefined }"
    >
      <div
        class="h-full transition-[width] duration-75"
        :class="!theme && (playing ? 'bg-accent' : 'bg-ink-300/60')"
        :style="{
          width: `${((playing ?? previewing)!.progress) * 100}%`,
          backgroundColor: theme ? theme.progressBg : undefined,
        }"
      />
    </div>
  </div>
</template>
