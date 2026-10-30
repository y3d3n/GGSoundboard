import { reactive } from 'vue'

export interface Toast {
  id: number
  kind: 'info' | 'error' | 'success'
  message: string
}

const toasts = reactive<Toast[]>([])
let nextId = 1

export function useToasts() {
  function push(message: string, kind: Toast['kind'] = 'info', ttl = 4200) {
    // De-duplicate identical messages that are already visible.
    if (toasts.some((t) => t.message === message)) return
    const id = nextId++
    toasts.push({ id, kind, message })
    setTimeout(() => dismiss(id), ttl)
  }
  function dismiss(id: number) {
    const i = toasts.findIndex((t) => t.id === id)
    if (i >= 0) toasts.splice(i, 1)
  }
  return { toasts, push, dismiss }
}
