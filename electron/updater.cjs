/**
 * Electron Updater Manager for GGSoundboard
 *
 * Integrates electron-updater with GitHub Releases:
 * - Checks for updates automatically on startup and periodically in the background.
 * - Supports manual check from Settings/About or application menu.
 * - Excludes checks in development mode (!app.isPackaged).
 * - Avoids duplicate downloads.
 * - Does not force-restart or interrupt playback.
 * - Handles errors gracefully without crashing the app.
 */
const { app, ipcMain } = require('electron')
const { autoUpdater } = require('electron-updater')

let mainWindow = null
let isDownloading = false
let updateDownloadedInfo = null
let periodicCheckTimer = null

// Configure autoUpdater
autoUpdater.autoDownload = false
autoUpdater.autoInstallOnAppQuit = false
autoUpdater.allowPrerelease = false
autoUpdater.allowDowngrade = false

function sendToRenderer(payload) {
  if (mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents) {
    mainWindow.webContents.send('updater:status', payload)
  }
}

function initUpdater(win) {
  mainWindow = win

  // Set up event listeners on autoUpdater
  autoUpdater.removeAllListeners()

  autoUpdater.on('checking-for-update', () => {
    sendToRenderer({ event: 'checking-for-update' })
  })

  autoUpdater.on('update-available', (info) => {
    sendToRenderer({
      event: 'update-available',
      info: {
        version: info.version,
        currentVersion: app.getVersion(),
        releaseDate: info.releaseDate,
        releaseNotes: info.releaseNotes,
        releaseName: info.releaseName,
        files: info.files?.map((f) => ({ url: f.url, size: f.size })),
      },
    })
  })

  autoUpdater.on('update-not-available', (info) => {
    sendToRenderer({
      event: 'update-not-available',
      info: {
        version: info?.version || app.getVersion(),
        currentVersion: app.getVersion(),
      },
    })
  })

  autoUpdater.on('error', (err) => {
    isDownloading = false
    const msg = err ? (err.message || String(err)) : 'Unknown updater error'
    // Format human-friendly message if network / GitHub rate limit / release 404
    let friendlyMessage = msg
    if (msg.includes('net::ERR_') || msg.includes('ENOTFOUND') || msg.includes('ETIMEDOUT') || msg.includes('ECONNREFUSED')) {
      friendlyMessage = 'Could not reach update server. Please check your internet connection.'
    } else if (msg.includes('404')) {
      friendlyMessage = 'No release update files found for this build.'
    }

    sendToRenderer({
      event: 'update-error',
      error: {
        message: friendlyMessage,
        raw: msg,
      },
    })
  })

  autoUpdater.on('download-progress', (progressObj) => {
    isDownloading = true
    sendToRenderer({
      event: 'download-progress',
      progress: {
        percent: Math.round(progressObj.percent || 0),
        bytesPerSecond: progressObj.bytesPerSecond || 0,
        transferred: progressObj.transferred || 0,
        total: progressObj.total || 0,
      },
    })
  })

  autoUpdater.on('update-downloaded', (info) => {
    isDownloading = false
    updateDownloadedInfo = info
    sendToRenderer({
      event: 'update-downloaded',
      info: {
        version: info.version,
        currentVersion: app.getVersion(),
        releaseDate: info.releaseDate,
        releaseNotes: info.releaseNotes,
      },
    })
  })

  // Start checking after application is loaded and ready
  if (app.isPackaged) {
    // Check 8 seconds after startup to ensure smooth launch
    setTimeout(() => {
      checkForUpdates(false).catch(() => {})
    }, 8000)

    // Check periodically every 4 hours while running
    if (periodicCheckTimer) clearInterval(periodicCheckTimer)
    periodicCheckTimer = setInterval(() => {
      checkForUpdates(false).catch(() => {})
    }, 4 * 60 * 60 * 1000)
  }
}

/**
 * Trigger check for updates
 * @param {boolean} isManual - true if initiated by user click
 */
async function checkForUpdates(isManual = false) {
  if (!app.isPackaged) {
    if (isManual) {
      sendToRenderer({
        event: 'update-error',
        error: {
          message: 'Automatic updates are disabled in development mode.',
        },
      })
    }
    return { success: false, reason: 'dev-mode' }
  }

  if (isDownloading) {
    return { success: false, reason: 'already-downloading' }
  }

  if (updateDownloadedInfo) {
    // If update is already downloaded and ready to install, notify renderer
    sendToRenderer({
      event: 'update-downloaded',
      info: {
        version: updateDownloadedInfo.version,
        currentVersion: app.getVersion(),
        releaseDate: updateDownloadedInfo.releaseDate,
        releaseNotes: updateDownloadedInfo.releaseNotes,
      },
    })
    return { success: true, reason: 'already-downloaded' }
  }

  try {
    return await autoUpdater.checkForUpdates()
  } catch (err) {
    const msg = err ? (err.message || String(err)) : 'Failed to check for updates'
    sendToRenderer({
      event: 'update-error',
      error: { message: msg },
    })
    return { success: false, error: msg }
  }
}

/**
 * Start downloading update
 */
async function downloadUpdate() {
  if (isDownloading) {
    return { success: false, reason: 'already-downloading' }
  }
  if (!app.isPackaged) {
    return { success: false, reason: 'dev-mode' }
  }

  try {
    isDownloading = true
    await autoUpdater.downloadUpdate()
    return { success: true }
  } catch (err) {
    isDownloading = false
    const msg = err ? (err.message || String(err)) : 'Failed to download update'
    sendToRenderer({
      event: 'update-error',
      error: { message: msg },
    })
    return { success: false, error: msg }
  }
}

/**
 * Restart and install downloaded update
 */
function installUpdate() {
  if (!updateDownloadedInfo) {
    return { success: false, reason: 'no-update-downloaded' }
  }

  // quitAndInstall(isSilent, isForceRunAfter)
  // isSilent = false (shows installer GUI if on Windows), isForceRunAfter = true (relaunches app)
  setImmediate(() => {
    autoUpdater.quitAndInstall(false, true)
  })
  return { success: true }
}

module.exports = {
  initUpdater,
  checkForUpdates,
  downloadUpdate,
  installUpdate,
}
