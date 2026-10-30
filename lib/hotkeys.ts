/**
 * Keyboard shortcut helpers.
 *
 * A "combo" is a stable, layout-independent string built from KeyboardEvent.code,
 * e.g. "F1", "Space", "Ctrl+Shift+KeyA", "Meta+Digit1".
 */

const MODIFIER_CODES = new Set([
  'ShiftLeft', 'ShiftRight', 'ControlLeft', 'ControlRight', 'AltLeft', 'AltRight',
  'MetaLeft', 'MetaRight', 'OSLeft', 'OSRight', 'CapsLock', 'Fn', 'FnLock',
])

export const MODS = ['Ctrl', 'Alt', 'Shift', 'Meta'] as const

export function eventToCombo(e: KeyboardEvent): string | null {
  if (!e.code || MODIFIER_CODES.has(e.code)) return null
  const parts: string[] = []
  if (e.ctrlKey) parts.push('Ctrl')
  if (e.altKey) parts.push('Alt')
  if (e.shiftKey) parts.push('Shift')
  if (e.metaKey) parts.push('Meta')
  parts.push(e.code)
  return parts.join('+')
}

export function splitCombo(combo: string) {
  const parts = combo.split('+')
  const code = parts.pop() ?? ''
  return { mods: parts, code }
}

const isMac = typeof navigator !== 'undefined' && /Mac/i.test(navigator.userAgent)

const CODE_LABELS: Record<string, string> = {
  Space: 'Space', Escape: 'Esc', Enter: '↵', Backspace: '⌫', Tab: 'Tab', Delete: 'Del',
  ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→',
  Minus: '-', Equal: '=', BracketLeft: '[', BracketRight: ']', Backslash: '\\',
  Semicolon: ';', Quote: "'", Comma: ',', Period: '.', Slash: '/', Backquote: '`',
  PageUp: 'PgUp', PageDown: 'PgDn', Home: 'Home', End: 'End', Insert: 'Ins',
  NumpadAdd: 'Num+', NumpadSubtract: 'Num-', NumpadMultiply: 'Num*', NumpadDivide: 'Num/',
  NumpadEnter: 'Num↵', NumpadDecimal: 'Num.',
}

export function codeLabel(code: string): string {
  if (CODE_LABELS[code]) return CODE_LABELS[code]
  if (code.startsWith('Key')) return code.slice(3)
  if (code.startsWith('Digit')) return code.slice(5)
  if (code.startsWith('Numpad')) return 'Num' + code.slice(6)
  return code
}

export function formatCombo(combo: string | null | undefined): string[] {
  if (!combo) return []
  const { mods, code } = splitCombo(combo)
  const modLabels = mods.map((m) => {
    if (!isMac) return m === 'Meta' ? 'Win' : m
    return ({ Ctrl: '⌃', Alt: '⌥', Shift: '⇧', Meta: '⌘' } as Record<string, string>)[m] ?? m
  })
  return [...modLabels, codeLabel(code)]
}

/** Convert a combo to an Electron accelerator; null if not representable. */
export function comboToAccelerator(combo: string): string | null {
  const { mods, code } = splitCombo(combo)
  let key: string | null = null
  if (/^F([1-9]|1\d|2[0-4])$/.test(code)) key = code
  else if (code.startsWith('Key')) key = code.slice(3)
  else if (code.startsWith('Digit')) key = code.slice(5)
  else if (/^Numpad\d$/.test(code)) key = 'num' + code.slice(6)
  else {
    key = ({
      Space: 'Space', Escape: 'Escape', Enter: 'Enter', Backspace: 'Backspace', Tab: 'Tab',
      Delete: 'Delete', Insert: 'Insert', Home: 'Home', End: 'End', PageUp: 'PageUp', PageDown: 'PageDown',
      ArrowUp: 'Up', ArrowDown: 'Down', ArrowLeft: 'Left', ArrowRight: 'Right',
      Minus: '-', Equal: '=', BracketLeft: '[', BracketRight: ']', Backslash: '\\', Semicolon: ';',
      Quote: "'", Comma: ',', Period: '.', Slash: '/', Backquote: '`',
      NumpadAdd: 'numadd', NumpadSubtract: 'numsub', NumpadMultiply: 'nummult', NumpadDivide: 'numdiv',
      NumpadDecimal: 'numdec',
    } as Record<string, string>)[code] ?? null
  }
  if (!key) return null
  const accMods = mods.map((m) => ({ Ctrl: 'Control', Alt: 'Alt', Shift: 'Shift', Meta: 'Super' } as Record<string, string>)[m] ?? m)
  return [...accMods, key].join('+')
}

/**
 * Plain keys that would be hijacked system-wide if registered as global
 * shortcuts (typing in other apps would break). These only work in-app.
 */
export function isUnsafeGlobal(combo: string): boolean {
  const { mods, code } = splitCombo(combo)
  if (mods.length > 0) return false
  if (/^F\d+$/.test(code) || /^Numpad/.test(code)) return false
  return true
}

export const DEFAULT_PAD_KEYS = Array.from({ length: 12 }, (_, i) => `F${i + 1}`)
