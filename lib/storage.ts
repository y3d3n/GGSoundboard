/**
 * Local persistence. Two interchangeable backends:
 *  - Electron: JSON config + audio files in the OS user-data folder (via preload IPC)
 *  - Browser:  IndexedDB (fallback when running `npm run dev:web` in Chrome)
 */
import type { NativeBridge, PersistedState } from './types'

export interface StorageBackend {
  readonly kind: 'electron' | 'indexeddb'
  loadState(): Promise<PersistedState | null>
  saveState(state: PersistedState): Promise<void>
  saveFile(name: string, data: ArrayBuffer): Promise<void>
  readFile(name: string): Promise<ArrayBuffer>
  deleteFile(name: string): Promise<void>
}

class ElectronStorage implements StorageBackend {
  readonly kind = 'electron' as const
  constructor(private native: NativeBridge) {}
  async loadState() {
    const json = await this.native.loadState()
    if (!json) return null
    try {
      return JSON.parse(json) as PersistedState
    } catch {
      return null
    }
  }
  saveState(state: PersistedState) {
    return this.native.saveState(JSON.stringify(state, null, 2))
  }
  saveFile(name: string, data: ArrayBuffer) {
    return this.native.saveFile(name, data)
  }
  readFile(name: string) {
    return this.native.readFile(name)
  }
  deleteFile(name: string) {
    return this.native.deleteFile(name)
  }
}

class IndexedDbStorage implements StorageBackend {
  readonly kind = 'indexeddb' as const
  private dbp: Promise<IDBDatabase>
  constructor() {
    this.dbp = new Promise((resolve, reject) => {
      const req = indexedDB.open('soundboard', 1)
      req.onupgradeneeded = () => {
        req.result.createObjectStore('kv')
        req.result.createObjectStore('files')
      }
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
  }
  private async tx<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
    const db = await this.dbp
    return new Promise((resolve, reject) => {
      const t = db.transaction(store, mode)
      const req = fn(t.objectStore(store))
      t.oncomplete = () => resolve(req.result)
      t.onerror = () => reject(t.error)
      t.onabort = () => reject(t.error)
    })
  }
  async loadState() {
    return ((await this.tx('kv', 'readonly', (s) => s.get('state'))) as PersistedState | undefined) ?? null
  }
  async saveState(state: PersistedState) {
    await this.tx('kv', 'readwrite', (s) => s.put(JSON.parse(JSON.stringify(state)), 'state'))
  }
  async saveFile(name: string, data: ArrayBuffer) {
    await this.tx('files', 'readwrite', (s) => s.put(data, name))
  }
  async readFile(name: string) {
    const data = (await this.tx('files', 'readonly', (s) => s.get(name))) as ArrayBuffer | undefined
    if (!data) throw new Error(`Missing audio file: ${name}`)
    return data
  }
  async deleteFile(name: string) {
    await this.tx('files', 'readwrite', (s) => s.delete(name))
  }
}

export function createStorage(): StorageBackend {
  if (typeof window !== 'undefined' && window.soundboardNative?.isElectron) return new ElectronStorage(window.soundboardNative)
  return new IndexedDbStorage()
}
