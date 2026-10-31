/**
 * Electron main process — the native desktop companion.
 *
 * Responsibilities (everything the browser sandbox cannot do on its own):
 *  - Hosts the Nuxt UI + Web Audio engine in a Chromium renderer whose
 *    AudioContexts can be routed to any output device (BlackHole / VB-CABLE)
 *    via AudioContext.setSinkId — this is what makes the mix appear as a
 *    system-wide microphone to Discord, Zoom, Meet and games.
 *  - Keeps audio running at full priority while the window is in the background.
 *  - Grants / requests microphone permission (macOS TCC).
 *  - Registers global hotkeys so pads fire while another app is focused.
 *  - Stores the sound library + settings on disk in the user-data folder.
 */
const { app, BrowserWindow, Menu, ipcMain, globalShortcut, session, shell, systemPreferences, protocol, net } = require('electron')
const path = require('node:path')
const fs = require('node:fs/promises')
const { pathToFileURL } = require('node:url')
const { remoteServer } = require('./remoteServer.cjs')
const updater = require('./updater.cjs')
const pkg = require('../package.json')

const APP_NAME = pkg.productName || 'Soundboard'
const APP_VERSION = pkg.version || '1.0.0'

// Explicitly configure app identity so native menus and about panels don't show Electron v45
app.name = APP_NAME
if (app.setName) app.setName(APP_NAME)

const DEV_URL = process.env.NUXT_DEV_URL
const PUBLIC_DIR = path.join(__dirname, '..', '.output', 'public')
const DATA_DIR = app.getPath('userData')
const SOUNDS_DIR = path.join(DATA_DIR, 'sounds')
const STATE_FILE = path.join(DATA_DIR, 'soundboard.json')

// Low-latency, never-throttled audio.
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required')
app.commandLine.appendSwitch('disable-renderer-backgrounding')
app.commandLine.appendSwitch('disable-background-timer-throttling')

protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } },
])

/** @type {BrowserWindow | null} */
let win = null

function safeName(name) {
  const base = path.basename(String(name))
  if (!/^[\w.-]+$/.test(base)) throw new Error('Invalid file name')
  return base
}

function getAppIconPath() {
  const fsSync = require('node:fs')
  const candidates = [
    path.join(__dirname, '..', 'build', 'icon.png'),
    path.join(__dirname, '..', 'build', 'icon.icns'),
    path.join(__dirname, '..', 'public', 'icon.png'),
  ]
  for (const c of candidates) {
    if (fsSync.existsSync(c)) return c
  }
  return null
}

async function createWindow() {
  const iconPath = getAppIconPath()
  win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#0b0b0d',
    show: false,
    ...(iconPath ? { icon: iconPath } : {}),
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'hidden',
    titleBarOverlay: process.platform === 'darwin' ? undefined : { color: '#0b0b0d', symbolColor: '#a1a1ab', height: 44 },
    trafficLightPosition: { x: 16, y: 15 },
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: false,
      autoplayPolicy: 'no-user-gesture-required',
      spellcheck: false,
    },
  })
  win.once('ready-to-show', () => win?.show())
  win.on('closed', () => { win = null })

  // Initialize auto-updater with the main window
  updater.initUpdater(win)

  // Open external links in the default browser.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) shell.openExternal(url)
    return { action: 'deny' }
  })

  if (DEV_URL) await win.loadURL(DEV_URL)
  else await win.loadURL('app://soundboard/')
}

function setupPermissions() {
  const allowed = new Set(['media', 'audioCapture', 'speaker-selection', 'clipboard-sanitized-write'])
  session.defaultSession.setPermissionRequestHandler((_wc, permission, cb) => cb(allowed.has(permission)))
  session.defaultSession.setPermissionCheckHandler((_wc, permission) => allowed.has(permission))
  // Expose device labels / ids to enumerateDevices + setSinkId.
  session.defaultSession.setDevicePermissionHandler(() => true)
}

function setupProtocol() {
  // Serve the generated Nuxt SPA from app://soundboard/ (a secure origin).
  protocol.handle('app', async (req) => {
    const { pathname } = new URL(req.url)
    let file = path.normalize(path.join(PUBLIC_DIR, decodeURIComponent(pathname)))
    if (!file.startsWith(PUBLIC_DIR)) return new Response('Forbidden', { status: 403 })
    try {
      const stat = await fs.stat(file)
      if (stat.isDirectory()) file = path.join(file, 'index.html')
    } catch {
      file = path.join(PUBLIC_DIR, 'index.html') // SPA fallback
    }
    return net.fetch(pathToFileURL(file).toString())
  })
}

function setupIpc() {
  ipcMain.handle('state:load', async () => {
    try {
      return await fs.readFile(STATE_FILE, 'utf8')
    } catch {
      return null
    }
  })
  ipcMain.handle('state:save', async (_e, json) => {
    // Atomic write so a crash never corrupts the library.
    const tmp = STATE_FILE + '.tmp'
    await fs.writeFile(tmp, String(json), 'utf8')
    await fs.rename(tmp, STATE_FILE)
  })
  ipcMain.handle('file:save', async (_e, name, data) => {
    await fs.mkdir(SOUNDS_DIR, { recursive: true })
    await fs.writeFile(path.join(SOUNDS_DIR, safeName(name)), Buffer.from(data))
  })
  ipcMain.handle('file:read', async (_e, name) => {
    const buf = await fs.readFile(path.join(SOUNDS_DIR, safeName(name)))
    return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)
  })
  ipcMain.handle('file:delete', async (_e, name) => {
    await fs.rm(path.join(SOUNDS_DIR, safeName(name)), { force: true })
  })
  ipcMain.handle('library:path', () => SOUNDS_DIR)
  ipcMain.handle('library:reveal', async () => {
    await fs.mkdir(SOUNDS_DIR, { recursive: true })
    await shell.openPath(SOUNDS_DIR)
  })
  ipcMain.handle('shell:open', (_e, url) => {
    if (/^https?:/.test(url)) return shell.openExternal(url)
  })
  ipcMain.handle('shell:sound-settings', () => {
    if (process.platform === 'darwin') return shell.openExternal('x-apple.systempreferences:com.apple.preference.sound')
    if (process.platform === 'win32') return shell.openExternal('ms-settings:sound')
  })

  // Global hotkeys: renderer sends the full desired set; we diff by re-registering.
  ipcMain.handle('hotkeys:register', (_e, list) => {
    globalShortcut.unregisterAll()
    const registered = []
    const failed = []
    for (const { id, accelerator } of Array.isArray(list) ? list : []) {
      try {
        const ok = globalShortcut.register(accelerator, () => win?.webContents.send('hotkey', id))
        ;(ok ? registered : failed).push(id)
      } catch {
        failed.push(id)
      }
    }
    return { registered, failed }
  })

  // ── Remote Controller Server IPC ──
  remoteServer.callbacks = {
    onPlay: (soundId) => win?.webContents.send('remote:command', { type: 'sound:play', soundId }),
    onStop: (soundId) => win?.webContents.send('remote:command', { type: 'sound:stop', soundId }),
    onStopAll: () => win?.webContents.send('remote:command', { type: 'sound:stop-all' }),
    onVolume: (soundId, volume) => win?.webContents.send('remote:command', { type: 'sound:volume', soundId, volume }),
    onDevicesChanged: (devices) => win?.webContents.send('remote:devices', devices),
  }

  ipcMain.handle('remote:start', async (_e, opts) => {
    return remoteServer.start(opts)
  })
  ipcMain.handle('remote:stop', async () => {
    return remoteServer.stop()
  })
  ipcMain.handle('remote:status', async () => {
    return remoteServer.getStatus()
  })
  ipcMain.handle('remote:set-pin', async (_e, pin) => {
    return remoteServer.setPin(pin)
  })
  ipcMain.handle('remote:revoke', async (_e, deviceId) => {
    return remoteServer.revokeDevice(deviceId)
  })
  ipcMain.handle('remote:sync', async (_e, data) => {
    return remoteServer.syncSoundboard(data)
  })
  ipcMain.handle('remote:playing', async (_e, playing) => {
    return remoteServer.broadcastPlaying(playing)
  })

  // ── Auto Updater IPC ──
  ipcMain.handle('updater:check', async () => updater.checkForUpdates(true))
  ipcMain.handle('updater:download', async () => updater.downloadUpdate())
  ipcMain.handle('updater:install', () => updater.installUpdate())
  ipcMain.handle('app:version', () => app.getVersion())
}

function setupAboutPanel() {
  const iconPath = getAppIconPath()
  app.setAboutPanelOptions({
    applicationName: APP_NAME,
    applicationVersion: APP_VERSION,
    version: APP_VERSION,
    copyright: 'Copyright © 2026 Yeden Sherpa',
    credits: 'Developed by Yeden Sherpa\nGGSoundboard — Local Virtual Microphone Soundboard\nLow-latency audio engine & virtual microphone routing',
    authors: ['Yeden Sherpa'],
    website: 'https://github.com',
    ...(iconPath ? { iconPath } : {}),
  })
}

function setupMenu() {
  const isMac = process.platform === 'darwin'
  const template = [
    ...(isMac
      ? [
          {
            label: APP_NAME,
            submenu: [
              {
                label: `About ${APP_NAME}`,
                role: 'about',
              },
              {
                label: 'Check for Updates…',
                click: () => updater.checkForUpdates(true),
              },
              { type: 'separator' },
              {
                label: 'Preferences…',
                accelerator: 'CmdOrCtrl+,',
                click: () => win?.webContents.send('menu:action', 'settings'),
              },
              { type: 'separator' },
              { role: 'services' },
              { type: 'separator' },
              { role: 'hide', label: `Hide ${APP_NAME}` },
              { role: 'hideOthers' },
              { role: 'unhide' },
              { type: 'separator' },
              { role: 'quit', label: `Quit ${APP_NAME}` },
            ],
          },
        ]
      : []),
    {
      label: 'File',
      submenu: [
        {
          label: 'Open Sound Library Folder',
          accelerator: 'CmdOrCtrl+O',
          click: async () => {
            await fs.mkdir(SOUNDS_DIR, { recursive: true })
            await shell.openPath(SOUNDS_DIR)
          },
        },
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit' },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    {
      label: 'View',
      submenu: [
        {
          label: 'Toggle Sidebar',
          accelerator: 'CmdOrCtrl+B',
          click: () => win?.webContents.send('menu:action', 'toggle-sidebar'),
        },
        { type: 'separator' },
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        ...(isMac
          ? [
              { type: 'separator' },
              { role: 'front' },
              { type: 'separator' },
              { role: 'window' },
            ]
          : [{ role: 'close' }]),
      ],
    },
    {
      role: 'help',
      submenu: [
        ...(!isMac
          ? [
              {
                label: `About ${APP_NAME}`,
                role: 'about',
              },
              {
                label: 'Check for Updates…',
                click: () => updater.checkForUpdates(true),
              },
              { type: 'separator' },
            ]
          : []),
        {
          label: 'GGSoundboard In-App Overview',
          click: () => win?.webContents.send('menu:action', 'about'),
        },
        {
          label: 'Virtual Mic Setup Guide',
          click: () => win?.webContents.send('menu:action', 'setup'),
        },
        {
          label: 'Remote Control Pairing',
          click: () => win?.webContents.send('menu:action', 'remote'),
        },
      ],
    },
  ]

  const menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)
}

app.whenReady().then(async () => {
  if (process.platform === 'darwin') {
    // Triggers the macOS microphone permission prompt up-front.
    try { await systemPreferences.askForMediaAccess('microphone') } catch { /* ignore */ }
    const iconPath = getAppIconPath()
    if (iconPath && app.dock) {
      try { app.dock.setIcon(iconPath) } catch { /* ignore */ }
    }
  }
  setupAboutPanel()
  setupMenu()
  setupPermissions()
  setupProtocol()
  setupIpc()
  await createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
  remoteServer.stop()
})
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
