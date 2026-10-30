<script setup lang="ts">
import { LayoutGrid, Folder, Plus, Settings, Pencil, Trash2, BookOpen, Smartphone, Info } from 'lucide-vue-next'

const sb = useSoundboard()
const { state } = sb
const { ui, askConfirm } = useUi()
const isMac = sb.platform === 'mac' && !!sb.native

const adding = ref(false)
const newName = ref('')
const renamingId = ref<string | null>(null)
const renameValue = ref('')
const dropTarget = ref<string | null>(null)

const counts = computed(() => {
  const c: Record<string, number> = { all: state.sounds.length }
  for (const s of state.sounds) if (s.collectionId) c[s.collectionId] = (c[s.collectionId] ?? 0) + 1
  return c
})

function startAdd() {
  adding.value = true
  newName.value = ''
  nextTick(() => document.getElementById('new-collection')?.focus())
}
function commitAdd() {
  if (!adding.value) return
  adding.value = false
  const name = newName.value.trim()
  newName.value = ''
  if (name) {
    const c = sb.createCollection(name)
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
  <nav class="flex h-full w-[220px] shrink-0 flex-col border-r border-white/[0.06] bg-ink-900/60">
    <div class="drag flex h-[52px] shrink-0 items-center" :class="isMac ? 'pl-[84px]' : 'pl-4'">
      <span class="text-[13px] font-semibold tracking-tight text-ink-100">GGSoundboard</span>
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
          class="group flex h-8 w-full cursor-pointer items-center gap-2.5 rounded-lg px-2 text-[13px] transition-colors"
          :class="[
            state.activeCollection === c.id ? 'bg-white/[0.07] text-ink-100' : 'text-ink-300 hover:bg-white/[0.04] hover:text-ink-100',
            dropTarget === c.id && 'ring-1 ring-accent/60',
          ]"
          @click="state.activeCollection = c.id"
          @dblclick="startRename(c.id, c.name)"
          @dragover="onDragOver($event, c.id)"
          @dragleave="dropTarget = null"
          @drop="onDrop($event, c.id)"
        >
          <Folder :size="15" class="shrink-0 text-ink-400" />
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
              <button class="flex h-6 w-6 items-center justify-center rounded text-ink-400 hover:text-ink-100" title="Rename" @click.stop="startRename(c.id, c.name)"><Pencil :size="12" /></button>
              <button class="flex h-6 w-6 items-center justify-center rounded text-ink-400 hover:text-red-300" title="Delete" @click.stop="remove(c.id, c.name)"><Trash2 :size="12" /></button>
            </span>
          </template>
        </div>
        <div v-if="adding" class="flex h-8 items-center gap-2.5 px-2">
          <Folder :size="15" class="shrink-0 text-ink-400" />
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
