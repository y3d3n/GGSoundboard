<script setup lang="ts">
import {
  LayoutGrid,
  Folder,
  Plus,
  Settings,
  Pencil,
  Trash2,
  BookOpen,
  Smartphone,
  Info,
  PanelLeftClose,
  Palette,
  Check,
  X,
} from 'lucide-vue-next'
import { PAD_ICONS } from '~/lib/icons'
import { COLOR_PRESETS, resolveColorHex, getContrastTextColor } from '~/lib/colors'

const sb = useSoundboard()
const { state } = sb
const { ui, askConfirm } = useUi()
const isMac = sb.platform === 'mac' && !!sb.native

const iconNames = Object.keys(PAD_ICONS)
const adding = ref(false)
const newName = ref('')
const newIcon = ref<string | null>(null)
const newColor = ref<string | null>(null)
const renamingId = ref<string | null>(null)
const renameValue = ref('')
const dropTarget = ref<string | null>(null)

// Popover state for choosing collection icon & color
const activePickerCollectionId = ref<string | null>(null)
const pickerPos = ref<{ top: number; left: number } | null>(null)

const currentCollection = computed(() => {
  if (activePickerCollectionId.value === '__new__') {
    return { icon: newIcon.value, color: newColor.value }
  }
  return state.collections.find((c) => c.id === activePickerCollectionId.value) ?? null
})
const currentCollectionIcon = computed(() => currentCollection.value?.icon ?? null)
const currentCollectionColor = computed(() => currentCollection.value?.color ?? null)

function openIconPicker(id: string, event: MouseEvent) {
  event.stopPropagation()
  if (activePickerCollectionId.value === id) {
    closeIconPicker()
    return
  }
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
  const estimatedHeight = 250
  const top = rect.bottom + 6 + estimatedHeight > window.innerHeight
    ? Math.max(10, rect.top - estimatedHeight - 6)
    : rect.bottom + 6

  pickerPos.value = {
    top,
    left: Math.min(rect.left, window.innerWidth - 290),
  }
  activePickerCollectionId.value = id
}

function openNewIconPicker(event: MouseEvent) {
  openIconPicker('__new__', event)
}

function closeIconPicker() {
  activePickerCollectionId.value = null
  pickerPos.value = null
}

function selectIcon(id: string, icon: string | null) {
  if (id === '__new__') {
    newIcon.value = icon
  } else {
    sb.updateCollection(id, { icon })
  }
}

function selectColor(id: string, color: string | null) {
  if (id === '__new__') {
    newColor.value = color
  } else {
    sb.updateCollection(id, { color })
  }
}

const counts = computed(() => {
  const c: Record<string, number> = { all: state.sounds.length }
  for (const s of state.sounds) if (s.collectionId) c[s.collectionId] = (c[s.collectionId] ?? 0) + 1
  return c
})

function startAdd() {
  adding.value = true
  newName.value = ''
  newIcon.value = null
  newColor.value = null
  nextTick(() => document.getElementById('new-collection')?.focus())
}
function commitAdd() {
  if (!adding.value) return
  adding.value = false
  const name = newName.value.trim()
  const icon = newIcon.value
  const color = newColor.value
  newName.value = ''
  newIcon.value = null
  newColor.value = null
  if (name) {
    const c = sb.createCollection(name, icon, color)
    state.activeCollection = c.id
  }
}
function startRename(id: string, name: string) {
  renamingId.value = id
  renameValue.value = name
  nextTick(() => document.getElementById(`rename-${id}`)?.focus())
}
function commitRename() {
  if (!renamingId.value) return
  const id = renamingId.value
  const name = renameValue.value.trim()
  renamingId.value = null
  renameValue.value = ''
  if (id && name) sb.renameCollection(id, name)
}
function remove(id: string, name: string) {
  askConfirm('Delete collection', `“${name}” will be removed. Its sounds stay in your library.`, 'Delete', () => sb.deleteCollection(id))
}

// Drop a pad onto a collection to move it there.
function onDragOver(e: DragEvent, id: string) {
  if (e.dataTransfer?.types.includes('application/x-sound-id')) {
    e.preventDefault()
    dropTarget.value = id
  }
}
function onDrop(e: DragEvent, id: string) {
  dropTarget.value = null
  const soundId = e.dataTransfer?.getData('application/x-sound-id')
  if (soundId) {
    e.preventDefault()
    e.stopPropagation()
    sb.updateSound(soundId, { collectionId: id === 'all' ? null : id })
  }
}
</script>

<template>
  <nav class="flex h-full w-[220px] shrink-0 flex-col border-r border-white/[0.06] bg-ink-900/60 select-none">
    <div class="drag flex h-[52px] shrink-0 items-center justify-between pr-2" :class="isMac ? 'pl-[84px]' : 'pl-4'">
      <span class="text-[13px] font-semibold tracking-tight text-ink-100">GGSoundboard</span>
      <button
        type="button"
        class="no-drag icon-btn h-7 w-7 text-ink-400 hover:text-ink-100"
        title="Hide sidebar (⌘B)"
        @click="state.settings.sidebarOpen = false"
      >
        <PanelLeftClose :size="15" />
      </button>
    </div>

    <div class="flex-1 overflow-y-auto px-2.5 pb-3">
      <p class="label mt-2 px-2">Library</p>
      <button
        class="flex h-8 w-full items-center gap-2.5 rounded-lg px-2 text-[13px] transition-colors"
        :class="[
          state.activeCollection === 'all' ? 'bg-white/[0.07] text-ink-100' : 'text-ink-300 hover:bg-white/[0.04] hover:text-ink-100',
          dropTarget === 'all' && 'ring-1 ring-accent/60',
        ]"
        @click="state.activeCollection = 'all'"
        @dragover="onDragOver($event, 'all')"
        @dragleave="dropTarget = null"
        @drop="onDrop($event, 'all')"
      >
        <LayoutGrid :size="15" class="text-ink-400" />
        <span class="flex-1 text-left">All sounds</span>
        <span class="font-mono text-[11px] tabular-nums text-ink-500">{{ counts.all }}</span>
      </button>

      <div class="mt-5 flex items-center justify-between px-2">
        <p class="label mb-0">Collections</p>
        <button class="icon-btn -mr-1 h-6 w-6" title="New collection" @click="startAdd"><Plus :size="14" /></button>
      </div>
      <div class="mt-1 space-y-px">
        <div
          v-for="c in state.collections"
          :key="c.id"
          class="group relative flex h-8 w-full cursor-pointer items-center gap-2.5 rounded-lg px-2 text-[13px] transition-colors"
          :class="[
            state.activeCollection === c.id ? 'bg-white/[0.07] text-ink-100' : 'text-ink-300 hover:bg-white/[0.04] hover:text-ink-100',
            dropTarget === c.id && 'ring-1 ring-accent/60',
          ]"
          :style="state.activeCollection === c.id && c.color ? { backgroundColor: `${resolveColorHex(c.color)}18` } : undefined"
          @click="state.activeCollection = c.id"
          @dblclick="startRename(c.id, c.name)"
          @dragover="onDragOver($event, c.id)"
          @dragleave="dropTarget = null"
          @drop="onDrop($event, c.id)"
        >
          <!-- Active Color Indicator Pill -->
          <span
            v-if="c.color && state.activeCollection === c.id"
            class="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-r"
            :style="{ backgroundColor: resolveColorHex(c.color) || '#8b93ff' }"
          />

          <button
            type="button"
            class="flex h-5 w-5 shrink-0 items-center justify-center rounded hover:bg-white/10 transition-colors"
            :title="c.icon || c.color ? 'Style collection (icon & color)' : 'Set collection icon & color'"
            @click.stop="openIconPicker(c.id, $event)"
          >
            <PadIcon
              v-if="c.icon"
              :name="c.icon"
              :size="14"
              :style="c.color ? { color: resolveColorHex(c.color) || undefined } : undefined"
              :class="!c.color && 'text-accent'"
            />
            <Folder
              v-else
              :size="14"
              :style="c.color ? { color: resolveColorHex(c.color) || undefined } : undefined"
              :class="!c.color && 'text-ink-400 group-hover:text-ink-200'"
            />
          </button>
          <input
            v-if="renamingId === c.id"
            :id="`rename-${c.id}`"
            v-model="renameValue"
            class="field -ml-1 h-6 px-1.5"
            @keydown.enter="commitRename"
            @keydown.esc.stop="renamingId = null"
            @blur="commitRename"
            @click.stop
          >
          <template v-else>
            <span class="flex-1 truncate text-left">{{ c.name }}</span>
            <span class="font-mono text-[11px] tabular-nums text-ink-500 group-hover:hidden">{{ counts[c.id] ?? 0 }}</span>
            <span class="hidden items-center group-hover:flex">
              <button class="flex h-6 w-6 items-center justify-center rounded text-ink-400 hover:text-ink-100" title="Style icon & color" @click.stop="openIconPicker(c.id, $event)"><Palette :size="12" /></button>
              <button class="flex h-6 w-6 items-center justify-center rounded text-ink-400 hover:text-ink-100" title="Rename" @click.stop="startRename(c.id, c.name)"><Pencil :size="12" /></button>
              <button class="flex h-6 w-6 items-center justify-center rounded text-ink-400 hover:text-red-300" title="Delete" @click.stop="remove(c.id, c.name)"><Trash2 :size="12" /></button>
            </span>
          </template>
        </div>
        <div v-if="adding" class="flex h-8 items-center gap-2.5 px-2">
          <button
            type="button"
            class="flex h-5 w-5 shrink-0 items-center justify-center rounded hover:bg-white/10 transition-colors"
            title="Choose icon & color"
            @click.stop="openNewIconPicker($event)"
          >
            <PadIcon
              v-if="newIcon"
              :name="newIcon"
              :size="14"
              :style="newColor ? { color: resolveColorHex(newColor) || undefined } : undefined"
              :class="!newColor && 'text-accent'"
            />
            <Folder
              v-else
              :size="14"
              :style="newColor ? { color: resolveColorHex(newColor) || undefined } : undefined"
              :class="!newColor && 'text-ink-400'"
            />
          </button>
          <input
            id="new-collection"
            v-model="newName"
            placeholder="Collection name"
            class="field -ml-1 h-6 px-1.5"
            @keydown.enter="commitAdd"
            @keydown.esc.stop="adding = false"
            @blur="commitAdd"
          >
        </div>
        <button
          v-if="!adding && state.collections.length === 0"
          class="flex h-8 w-full items-center gap-2.5 rounded-lg px-2 text-[12.5px] text-ink-500 hover:text-ink-300"
          @click="startAdd"
        >
          <Plus :size="14" /> New collection
        </button>
      </div>
    </div>

    <!-- Collection Styling Popover (Icon & Color) -->
    <Teleport to="body">
      <div
        v-if="activePickerCollectionId && pickerPos"
        class="fixed inset-0 z-50"
        @click="closeIconPicker"
      >
        <div
          class="fixed z-50 w-72 rounded-2xl border border-white/10 bg-ink-900 p-3.5 shadow-2xl backdrop-blur-md animate-pop-in space-y-3.5"
          :style="{ top: `${pickerPos.top}px`, left: `${pickerPos.left}px` }"
          @click.stop
        >
          <!-- Header -->
          <div class="flex items-center justify-between border-b border-white/[0.06] pb-2">
            <span class="text-[12px] font-semibold text-ink-200">Collection Styling</span>
            <button
              type="button"
              class="icon-btn h-5 w-5 text-ink-400 hover:text-ink-100"
              @click="closeIconPicker"
            >
              <X :size="13" />
            </button>
          </div>

          <!-- Section 1: Icon Picker -->
          <div>
            <div class="mb-1.5 flex items-center justify-between">
              <span class="text-[11px] font-medium uppercase tracking-wider text-ink-400">Icon</span>
              <button
                v-if="currentCollectionIcon"
                type="button"
                class="text-[10.5px] text-ink-400 hover:text-ink-200 transition-colors"
                @click="selectIcon(activePickerCollectionId!, null)"
              >
                Reset icon
              </button>
            </div>
            <div class="grid grid-cols-7 gap-1">
              <button
                type="button"
                class="flex aspect-square items-center justify-center rounded-lg border transition-colors"
                :class="!currentCollectionIcon ? 'border-accent bg-accent/20 text-accent font-medium' : 'border-white/[0.06] text-ink-400 hover:bg-white/10 hover:text-ink-200'"
                title="Default folder"
                @click="selectIcon(activePickerCollectionId!, null)"
              >
                <Folder :size="14" />
              </button>
              <button
                v-for="name in iconNames"
                :key="name"
                type="button"
                class="flex aspect-square items-center justify-center rounded-lg border transition-colors"
                :class="currentCollectionIcon === name ? 'border-accent bg-accent/20 text-accent' : 'border-white/[0.06] text-ink-400 hover:bg-white/10 hover:text-ink-200'"
                :title="name"
                @click="selectIcon(activePickerCollectionId!, name)"
              >
                <PadIcon :name="name" :size="14" />
              </button>
            </div>
          </div>

          <!-- Section 2: Color Accent -->
          <div>
            <div class="mb-1.5 flex items-center justify-between">
              <span class="text-[11px] font-medium uppercase tracking-wider text-ink-400">Color Accent</span>
              <button
                v-if="currentCollectionColor"
                type="button"
                class="text-[10.5px] text-ink-400 hover:text-ink-200 transition-colors"
                @click="selectColor(activePickerCollectionId!, null)"
              >
                Reset color
              </button>
            </div>
            <div class="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                class="flex h-6 w-6 items-center justify-center rounded-lg border text-2xs text-ink-500 transition-colors"
                :class="!currentCollectionColor ? 'border-accent bg-accent/20 text-ink-100 font-semibold' : 'border-white/[0.08] hover:bg-white/[0.05]'"
                title="Default (No color)"
                @click="selectColor(activePickerCollectionId!, null)"
              >
                —
              </button>
              <button
                v-for="preset in COLOR_PRESETS"
                :key="preset.id"
                type="button"
                class="relative flex h-6 w-6 items-center justify-center rounded-lg border transition-transform hover:scale-105 active:scale-95"
                :class="currentCollectionColor === preset.id || currentCollectionColor === preset.hex ? 'border-white ring-2 ring-white/20' : 'border-transparent'"
                :title="preset.label"
                :style="{ backgroundColor: preset.hex }"
                @click="selectColor(activePickerCollectionId!, preset.id)"
              >
                <Check
                  v-if="currentCollectionColor === preset.id || currentCollectionColor === preset.hex"
                  :size="12"
                  :class="getContrastTextColor(preset.hex) === 'black' ? 'text-black' : 'text-white'"
                  stroke-width="3"
                />
              </button>
              <label class="cursor-pointer ml-auto" title="Custom color picker">
                <input
                  type="color"
                  class="sr-only"
                  :value="resolveColorHex(currentCollectionColor) || '#8b93ff'"
                  @input="(e) => selectColor(activePickerCollectionId!, (e.target as HTMLInputElement).value)"
                >
                <span class="btn-outline h-6 px-1.5 text-[10px] text-ink-300 hover:text-ink-100">
                  Custom
                </span>
              </label>
            </div>
          </div>
        </div>
      </div>
    </Teleport>

    <div class="shrink-0 space-y-px border-t border-white/[0.06] p-2.5">
      <button class="flex h-8 w-full items-center gap-2.5 rounded-lg px-2 text-[13px] text-ink-300 hover:bg-white/[0.04] hover:text-ink-100" @click="ui.remoteOpen = true">
        <Smartphone :size="15" class="text-ink-400" />
        <span class="flex-1 text-left">Remote Control</span>
        <span
          v-if="state.remoteRunning"
          class="flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium"
          :class="state.remoteDevices.length ? 'bg-emerald-400/15 text-emerald-300' : 'bg-white/[0.06] text-ink-400'"
        >
          <span class="h-1.5 w-1.5 rounded-full" :class="state.remoteDevices.length ? 'bg-emerald-400' : 'bg-ink-500'" />
          {{ state.remoteDevices.length ? `${state.remoteDevices.length}` : 'On' }}
        </span>
      </button>
      <button class="flex h-8 w-full items-center gap-2.5 rounded-lg px-2 text-[13px] text-ink-300 hover:bg-white/[0.04] hover:text-ink-100" @click="ui.setupOpen = true">
        <BookOpen :size="15" class="text-ink-400" /> Setup guide
      </button>
      <button class="flex h-8 w-full items-center gap-2.5 rounded-lg px-2 text-[13px] text-ink-300 hover:bg-white/[0.04] hover:text-ink-100" @click="ui.settingsOpen = true">
        <Settings :size="15" class="text-ink-400" />
        <span class="flex-1 text-left">Settings</span>
        <UiKbd :combo="sb.platform === 'mac' ? 'Meta+Comma' : 'Ctrl+Comma'" dim />
      </button>
      <button class="flex h-8 w-full items-center gap-2.5 rounded-lg px-2 text-[13px] text-ink-300 hover:bg-white/[0.04] hover:text-ink-100" @click="ui.aboutOpen = true">
        <Info :size="15" class="text-ink-400" />
        <span class="flex-1 text-left">About</span>
      </button>
    </div>
  </nav>
</template>
