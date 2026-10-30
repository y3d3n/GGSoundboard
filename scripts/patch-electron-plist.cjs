/**
 * Patches macOS Electron dev binary Info.plist so the macOS menu bar
 * next to the Apple icon shows "GGSoundboard" instead of "Electron".
 */
const { execFileSync } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')

if (process.platform === 'darwin') {
  const plistPath = path.join(__dirname, '..', 'node_modules', 'electron', 'dist', 'Electron.app', 'Contents', 'Info.plist')
  const appPath = path.join(__dirname, '..', 'node_modules', 'electron', 'dist', 'Electron.app')

  if (fs.existsSync(plistPath)) {
    try {
      execFileSync('plutil', ['-replace', 'CFBundleName', '-string', 'GGSoundboard', plistPath])
      execFileSync('plutil', ['-replace', 'CFBundleDisplayName', '-string', 'GGSoundboard', plistPath])
      execFileSync('codesign', ['--force', '--deep', '--sign', '-', appPath])
      console.log('✓ Patched Electron.app Info.plist: Menu bar app title set to "GGSoundboard"')
    } catch (err) {
      console.warn('Notice: Could not patch Electron.app Info.plist:', err.message)
    }
  }
}
