import { reactive } from 'vue'

/** Pure UI state (dialogs, panels) shared across components. */
const ui = reactive({
  editingSoundId: null as string | null,
  settingsOpen: false,
  setupOpen: false,
  remoteOpen: false,
  aboutOpen: false,
  confirm: null as null | { title: string; message: string; action: string; onConfirm: () => void },
  contextMenu: null as null | { x: number; y: number; soundId: string },
})

export function useUi() {
  const anyModalOpen = () => !!(ui.editingSoundId || ui.settingsOpen || ui.setupOpen || ui.remoteOpen || ui.aboutOpen || ui.confirm)
  function askConfirm(title: string, message: string, action: string, onConfirm: () => void) {
    ui.confirm = { title, message, action, onConfirm }
  }
  return { ui, anyModalOpen, askConfirm }
}
