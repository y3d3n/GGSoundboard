export interface Sound {
  id: string
  name: string
  /** File name inside the local sound library (e.g. "abc123.mp3"). */
  file: string
  originalName: string
  mime: string
  size: number
  duration: number
  /** Per-sound gain, 0 – 1.5 */
  volume: number
  loop: boolean
  hotkey: string | null
  icon: string | null
  color?: string | null
  collectionId: string | null
  createdAt: number
}

export interface RemoteSound {
  id: string
  name: string
  icon: string | null
  color: string | null
  hotkey: string | null
  volume: number
  loop: boolean
  duration: number
  collectionId: string | null
}

export interface RemoteCollection {
  id: string
  name: string
}

export interface ConnectedDevice {
  id: string
  name: string
  ip: string
  userAgent: string
  authenticated: boolean
  connectedAt: number
  lastSeen: number
}

export interface RemoteServerStatus {
  running: boolean
  port: number
  ip: string
  url: string
  pin: string
  devices: ConnectedDevice[]
}

export interface Collection {
  id: string
  name: string
}

export interface Settings {
  micDeviceId: string | null
  virtualOutputId: string | null
  virtualOutputLabel: string | null
  monitorOutputId: string | null
  micVolume: number
  soundVolume: number
  masterVolume: number
  monitorVolume: number
  micMuted: boolean
  soundMuted: boolean
  micPassthrough: boolean
  monitorEnabled: boolean
  hearMyself: boolean
  pttEnabled: boolean
  pttKey: string
  stopAllKey: string
  globalHotkeys: boolean
  echoCancellation: boolean
  noiseSuppression: boolean
  autoGainControl: boolean
  padSize: 'sm' | 'md' | 'lg'
  mixerOpen: boolean
  onboarded: boolean
  remoteEnabled: boolean
  remotePort: number
  remotePin: string
  exclusivePlayback: boolean
}

export interface PersistedState {
  version: 1
  sounds: Sound[]
  collections: Collection[]
  settings: Settings
}

export const DEFAULT_SETTINGS: Settings = {
  micDeviceId: null,
  virtualOutputId: null,
  virtualOutputLabel: null,
  monitorOutputId: null,
  micVolume: 1,
  soundVolume: 0.7,
  masterVolume: 1,
  monitorVolume: 0.6,
  micMuted: false,
  soundMuted: false,
  micPassthrough: true,
  monitorEnabled: true,
  hearMyself: false,
  pttEnabled: false,
  pttKey: 'Space',
  stopAllKey: 'Escape',
  globalHotkeys: true,
  echoCancellation: false,
  noiseSuppression: true,
  autoGainControl: false,
  padSize: 'md',
  mixerOpen: true,
  onboarded: false,
  remoteEnabled: true,
  remotePort: 4567,
  remotePin: '4829',
  exclusivePlayback: true,
}

/** Bridge exposed by electron/preload.cjs (undefined when running in a browser). */
export interface NativeBridge {
  isElectron: true
  platform: NodeJS.Platform | string
  loadState(): Promise<string | null>
  saveState(json: string): Promise<void>
  saveFile(name: string, data: ArrayBuffer): Promise<void>
  readFile(name: string): Promise<ArrayBuffer>
  deleteFile(name: string): Promise<void>
  libraryPath(): Promise<string>
  revealLibrary(): Promise<void>
  registerHotkeys(list: { id: string; accelerator: string }[]): Promise<{ registered: string[]; failed: string[] }>
  onHotkey(cb: (id: string) => void): () => void
  openExternal(url: string): Promise<void>
  openSoundSettings(): Promise<void>
  // Remote Server
  startRemoteServer(opts?: { port?: number; pin?: string }): Promise<RemoteServerStatus>
  stopRemoteServer(): Promise<void>
  getRemoteServerStatus(): Promise<RemoteServerStatus>
  setRemotePin(pin: string): Promise<string>
  revokeRemoteDevice(deviceId: string): Promise<void>
  syncRemoteSoundboard(data: { sounds: RemoteSound[]; collections: RemoteCollection[] }): Promise<void>
  broadcastRemotePlaying(playing: Record<string, any>): Promise<void>
  onRemoteCommand(cb: (cmd: { type: string; payload?: any }) => void): () => void
  onRemoteDevices(cb: (devices: ConnectedDevice[]) => void): () => void
  onMenuAction?(cb: (action: string) => void): () => void
}

declare global {
  interface Window {
    soundboardNative?: NativeBridge
  }
}
