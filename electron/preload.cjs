/**
 * Preload bridge — exposes a small, explicit API to the renderer.
 * Shape documented by `NativeBridge` in lib/types.ts.
 */
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('soundboardNative', {
  isElectron: true,
  platform: process.platform,
  loadState: () => ipcRenderer.invoke('state:load'),
  saveState: (json) => ipcRenderer.invoke('state:save', json),
  saveFile: (name, data) => ipcRenderer.invoke('file:save', name, data),
  readFile: (name) => ipcRenderer.invoke('file:read', name),
  deleteFile: (name) => ipcRenderer.invoke('file:delete', name),
  libraryPath: () => ipcRenderer.invoke('library:path'),
  revealLibrary: () => ipcRenderer.invoke('library:reveal'),
  registerHotkeys: (list) => ipcRenderer.invoke('hotkeys:register', list),
  onHotkey: (cb) => {
    const listener = (_e, id) => cb(id)
    ipcRenderer.on('hotkey', listener)
    return () => ipcRenderer.removeListener('hotkey', listener)
  },
  openExternal: (url) => ipcRenderer.invoke('shell:open', url),
  openSoundSettings: () => ipcRenderer.invoke('shell:sound-settings'),
  // Remote Server Bridge
  startRemoteServer: (opts) => ipcRenderer.invoke('remote:start', opts),
  stopRemoteServer: () => ipcRenderer.invoke('remote:stop'),
  getRemoteServerStatus: () => ipcRenderer.invoke('remote:status'),
  setRemotePin: (pin) => ipcRenderer.invoke('remote:set-pin', pin),
  revokeRemoteDevice: (deviceId) => ipcRenderer.invoke('remote:revoke', deviceId),
  syncRemoteSoundboard: (data) => ipcRenderer.invoke('remote:sync', data),
  broadcastRemotePlaying: (playing) => ipcRenderer.invoke('remote:playing', playing),
  onRemoteCommand: (cb) => {
    const listener = (_e, cmd) => cb(cmd)
    ipcRenderer.on('remote:command', listener)
    return () => ipcRenderer.removeListener('remote:command', listener)
  },
  onRemoteDevices: (cb) => {
    const listener = (_e, devices) => cb(devices)
    ipcRenderer.on('remote:devices', listener)
    return () => ipcRenderer.removeListener('remote:devices', listener)
  },
  onMenuAction: (cb) => {
    const listener = (_e, action) => cb(action)
    ipcRenderer.on('menu:action', listener)
    return () => ipcRenderer.removeListener('menu:action', listener)
  },
  // Auto Updater Bridge
  checkForUpdates: () => ipcRenderer.invoke('updater:check'),
  downloadUpdate: () => ipcRenderer.invoke('updater:download'),
  installUpdate: () => ipcRenderer.invoke('updater:install'),
  getAppVersion: () => ipcRenderer.invoke('app:version'),
  onUpdaterStatus: (cb) => {
    const listener = (_e, status) => cb(status)
    ipcRenderer.on('updater:status', listener)
    return () => ipcRenderer.removeListener('updater:status', listener)
  },
})
