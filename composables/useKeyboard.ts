import { onBeforeUnmount, onMounted } from 'vue'
import { eventToCombo, splitCombo } from '~/lib/hotkeys'
import { useSoundboard } from './useSoundboard'
import { useUi } from './useUi'

/** In-window keyboard handling: pads, push-to-talk, stop-all. */
export function useKeyboard() {
  if (typeof window !== 'undefined') {
    const p = window.location.pathname
    const s = window.location.search
    const h = window.location.hash
    if (p.startsWith('/remote') || s.includes('remote=1') || h.startsWith('#/remote')) {
      return // Skip desktop keyboard shortcuts in remote controller mode
    }
  }

  const sb = useSoundboard()
  const { ui, anyModalOpen } = useUi()

  function isTyping(e: KeyboardEvent) {
    const t = e.target as HTMLElement | null
    if (!t) return false
    if (t.isContentEditable) return true
    if (t.tagName === 'TEXTAREA' || t.tagName === 'SELECT') return true
    if (t.tagName === 'INPUT') {
      const type = (t as HTMLInputElement).type
      return !['range', 'checkbox', 'radio', 'button'].includes(type)
    }
    return false
  }

  function onKeyDown(e: KeyboardEvent) {
    const s = sb.state
    if (s.recordingHotkey) return
    if (anyModalOpen()) {
      if (e.key === 'Escape') {
        ui.editingSoundId = null
        ui.settingsOpen = false
        ui.setupOpen = false
        ui.confirm = null
        e.preventDefault()
      }
      return
    }
    if (ui.contextMenu && e.key === 'Escape') {
      ui.contextMenu = null
      e.preventDefault()
      return
    }
    if (isTyping(e)) {
      if (e.key === 'Escape') (e.target as HTMLElement).blur()
      return
    }
    // ⌘/Ctrl+K focuses search (Raycast-style).
    if ((e.metaKey || e.ctrlKey) && e.code === 'KeyK') {
      document.getElementById('sound-search')?.focus()
      e.preventDefault()
      return
    }
    // ⌘/Ctrl+B toggles sidebar.
    if ((e.metaKey || e.ctrlKey) && e.code === 'KeyB') {
      s.settings.sidebarOpen = !s.settings.sidebarOpen
      e.preventDefault()
      return
    }
    const combo = eventToCombo(e)
    if (!combo) return

    if (s.settings.pttEnabled && s.settings.pttKey && combo === s.settings.pttKey) {
      e.preventDefault()
      if (!e.repeat) sb.setPtt(true)
      return
    }
    if (s.settings.stopAllKey && combo === s.settings.stopAllKey) {
      e.preventDefault()
      if (!sb.isGloballyHandled(combo)) sb.stopAll()
      return
    }
    const sound = s.sounds.find((x) => x.hotkey === combo)
    if (sound) {
      e.preventDefault()
      if (!e.repeat && !sb.isGloballyHandled(combo)) void sb.triggerSound(sound.id)
    }
  }

  function onKeyUp(e: KeyboardEvent) {
    const s = sb.state
    if (!s.pttHeld) return
    const { code } = splitCombo(s.settings.pttKey)
    if (e.code === code) sb.setPtt(false)
  }

  function onBlur() {
    // Releasing focus while holding PTT would otherwise leave the mic open.
    sb.setPtt(false)
  }

  // Any gesture resumes audio if the browser suspended it (autoplay policy).
  function onGesture() {
    if (sb.state.engineState === 'suspended') void sb.resumeAudio()
  }

  onMounted(() => {
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', onBlur)
    window.addEventListener('pointerdown', onGesture, true)
    window.addEventListener('keydown', onGesture, true)
  })
  onBeforeUnmount(() => {
    window.removeEventListener('keydown', onKeyDown)
    window.removeEventListener('keyup', onKeyUp)
    window.removeEventListener('blur', onBlur)
    window.removeEventListener('pointerdown', onGesture, true)
    window.removeEventListener('keydown', onGesture, true)
  })
}
