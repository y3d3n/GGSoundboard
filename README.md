# GGSoundboard — Local Virtual Microphone Soundboard

A modern, minimal, premium-grade local soundboard desktop application built with **Nuxt 3**, **Vue 3**, **Tailwind CSS**, the **Web Audio API**, and an **Electron native desktop companion**.

It mixes your physical microphone with custom audio effects in real time and routes the combined stream directly to a virtual audio device (such as **BlackHole** on macOS or **VB-CABLE** on Windows), making the audio recognizable as microphone input in **Discord**, **Zoom**, **Google Meet**, games, and other voice communication software without interrupting or muting your microphone.

---

## 📥 Downloads & Releases

Download the latest standalone installer for your platform from the [**GitHub Releases**](https://github.com/y3d3n/GGSoundboard/releases) page:

| Operating System | Format | Direct Download |
| :--- | :--- | :--- |
| 🍏 **macOS** *(Apple Silicon & Intel)* | `.dmg` installer / `.zip` | [**Download for macOS**](https://github.com/y3d3n/GGSoundboard/releases/latest) |
| 🪟 **Windows** *(Windows 10 / 11)* | `.exe` setup installer | [**Download for Windows**](https://github.com/y3d3n/GGSoundboard/releases/latest) |
| 🐧 **Linux** *(Ubuntu, Debian, Fedora)* | `.AppImage` / `.deb` | [**Download for Linux**](https://github.com/y3d3n/GGSoundboard/releases/latest) |

> 💡 **Tip:** You can also download the latest automated CI builds directly from the [GitHub Actions Artifacts](https://github.com/y3d3n/GGSoundboard/actions) tab.

---

## 🎧 Architecture & Signal Flow

```
                      ┌───────────────────────────────────────────────┐
                      │                 Physical Mic                  │
                      └──────────────────────┬────────────────────────┘
                                             │
                                     [Mic Gain Slider]
                                             │
                              [Mute · Passthrough · PTT Gate]
                                             │
     ┌───────────────────────┐               │
     │ Soundboard Audio Pads │               │
     └──────────┬────────────┘               │
                │                            │
        [Voice Gain & Loop]                  │
                │                            │
       [Soundboard Bus Gain]                 │
                │                            │
                ├────────────────────────────┴────────────────────────┐
                ▼                                                     ▼
      ┌──────────────────┐                                  ┌──────────────────┐
      │  VIRTUAL CHAIN   │                                  │  MONITOR CHAIN   │
      │  (Virtual Cable) │                                  │ (Headphones Out) │
      └─────────┬────────┘                                  └─────────┬────────┘
                │ [Master Gain & Brickwall Limiter]                   │ [Monitor Gain & Limiter]
                ▼                                                     ▼
      ┌──────────────────┐                                  ┌──────────────────┐
      │ BlackHole /      │                                  │ Headphones /     │
      │ VB-CABLE Input   │                                  │ Local Speakers   │
      └─────────┬────────┘                                  └──────────────────┘
                ▼
      ┌──────────────────┐
      │ Discord / Zoom / │
      │ Games Mic Input  │
      └──────────────────┘
```

### Key Technical Highlights
- **Two Independent AudioContext Sinks**: Prevents acoustic feedback by design. Your headphones receive the sound effects (and optionally your voice only when *Hear Myself* is checked), while the virtual driver receives the microphone + sound effects mix.
- **Low-Latency Brickwall Limiting**: Employs `DynamicsCompressorNode` tuned with zero-knee, 2ms attack, and high compression ratio to prevent digital clipping when multiple sound effects trigger simultaneously over your voice.
- **Global & In-Window Hotkeys**: Electron's `globalShortcut` API enables pads to fire with `F1–F12`, numpad keys, and modifier combos even when Discord or full-screen games are in focus.
- **Remote Soundboard (Controller-Only)**: Real-time Socket.IO controller allowing phones, tablets, or secondary computers on the local Wi-Fi to trigger sounds via a PIN-authenticated, mobile-first touch interface without any audio streaming or file alteration capabilities.
- **Local File & State Persistence**: All audio files and library metadata are saved locally on disk (in the OS user-data directory in Electron, and IndexedDB in browsers).

---

## 🚀 Quick Start

### 1. Prerequisites
- **Node.js** v18+ (tested on Node v20)
- **Virtual Audio Driver**:
  - **macOS**: [BlackHole 2ch](https://existential.audio/blackhole/) (`brew install blackhole-2ch`)
  - **Windows**: [VB-CABLE Virtual Audio Device](https://vb-audio.com/Cable/)

### 2. Launch the Application

#### Run the native desktop app (Electron)
```bash
# Production mode (pre-generates static Nuxt assets and launches Electron)
npm run start

# Or development mode (Nuxt HMR + Electron)
npm run dev
```

#### Run in a browser (fallback / web mode)
```bash
npm run dev:web
```
*Note: Audio output device selection via `setSinkId` works in Chromium-based browsers (Chrome, Edge, Brave 110+).*

---

## 🎙️ Virtual Audio Device Setup

### On macOS (BlackHole)
1. Install BlackHole via Homebrew or pkg installer:
   ```bash
   brew install blackhole-2ch
   ```
2. Open the **GGSoundboard** application.
3. In the **Mixer Panel** (right side):
   - **Microphone input**: Choose your real microphone (e.g. *MacBook Microphone*, *USB Mic*).
   - **Virtual output**: Choose **BlackHole 2ch**.
   - **Monitor**: Choose your headphones (e.g. *MacBook Speakers*, *AirPods*, *Headphones*).
4. Open **Discord** (or Zoom / Google Meet):
   - Go to **User Settings** → **Voice & Video**.
   - Set **Input Device** to **BlackHole 2ch**.
   - Set **Output Device** to your headphones.
   - *(Optional tip)*: In Discord, lower the input sensitivity threshold and disable aggressive noise suppression (like Krisp) so that subtle soundboard effects aren't filtered out as background noise.

### On Windows (VB-CABLE)
1. Download [VB-CABLE](https://vb-audio.com/Cable/) and extract the ZIP.
2. Right-click `VBCABLE_Setup_x64.exe` and click **Run as administrator**. Reboot your PC.
3. In **GGSoundboard**:
   - **Microphone input**: Your physical microphone.
   - **Virtual output**: **CABLE Input (VB-Audio Virtual Cable)**.
   - **Monitor**: Your primary headset/speakers.
4. In **Discord / Games**:
   - Set **Input Device** to **CABLE Output (VB-Audio Virtual Cable)**.

---

## 🎛️ Features

### 1. Soundboard Pads & Grid
- **Customizable grid sizes**: Small (`sm`), Medium (`md`), Large (`lg`).
- **Interactive EQ bars and pulse animation** when a sound is playing.
- **Drag-and-drop file import**: Drop MP3, WAV, OGG, FLAC, M4A, or Opus files anywhere onto the window.
- **Drag-to-reorder & drag-to-collection**: Reorganize pads or drag them directly into collections in the sidebar.
- **Right-click context menu** on any pad for quick play, monitor preview, loop toggle, editing, and deletion.
- **Built-in Starter Sounds**: Click *Load starter sounds* to immediately populate pads with iconic effects (Air Horn, Ba-Dum-Tss, Level Up, Laser Zap, Game Over, Chime).

### 2. Audio Mixer Panel
- **Real-time RMS & Peak meters** with peak-hold indicators.
- **Microphone Channel**: Volume slider (up to 200%), one-click mute, push-to-talk indicator, and virtual passthrough toggle.
- **Soundboard Channel**: Dedicated volume slider and mute toggle.
- **Master Channel**: Output gain into the virtual cable.
- **Monitor Channel**: Separate headphone volume slider, monitor mute, and optional "Hear myself" sidetone.
- **Engine Diagnostics**: Sample rate and live buffer latency reporting in milliseconds.

### 3. Keyboard Shortcuts & Push-to-Talk
- **Automatic F-key assignment**: Imported pads receive `F1` through `F12` automatically.
- **Custom key combinations**: Click any pad's shortcut to record standard keys, function keys, numpad keys, and modifier combos (`Ctrl`, `Alt`, `Shift`, `Cmd/Win`).
- **Conflict detection**: Prompts when a combination is already assigned and offers one-click reassigning.
- **Push-to-Talk (`Space` default)**: Hold to talk through the virtual microphone; releasing automatically gates the microphone input while leaving sound effects playing.
- **Emergency Panic Button (`Esc` default)**: Smoothly fades out every currently playing sound effect immediately.

### 4. Sound Management
- **Collections**: Create, rename, and delete custom sound folders (e.g. *Memes*, *Gaming*, *Music*, *Reaction*).
- **Per-sound controls**: Individual volume boost/cut, loop toggle, custom icon selection, solid color accent, and shortcut assignment.
- **Local Preview**: Audition a sound in your headphones without playing it through the virtual microphone to Discord.

### 5. Remote Soundboard (Controller-Only Access)
- **Zero Audio Streaming**: The desktop application is the sole host and audio source. Remote devices trigger existing sounds over WebSocket; all audio mixing routes through BlackHole/VB-CABLE to Discord.
- **Strict Permission Enforcement**:
  - **Allowed**: Play existing sounds, stop sounds, stop all, view playing animations, browse categories, search sounds.
  - **Blocked**: Cannot upload or import files, cannot delete or rename sounds, cannot modify categories or audio settings, cannot access host filesystem.
- **PIN-Based Pairing**: Point your phone camera at the QR code on desktop (or visit `http://<ip>:4567/remote`) and enter the 4-digit pairing PIN.
- **Desktop Control & Revocation**: View all connected remotes in real-time and revoke access with one click.
- **Automatic Sync**: Any updates to sounds or categories on the desktop immediately synchronize across all paired remote controllers.

---

## 📦 Directory Structure

```
├── assets/
│   └── css/main.css               # Dark theme, typography & scrollbar styles
├── components/
│   ├── ui/                        # Reusable accessible controls (Slider, Toggle, Modal, Kbd)
│   ├── AppSidebar.vue             # Collections navigation & library management
│   ├── BoardView.vue              # Responsive soundboard pads grid & toolbar
│   ├── SoundPad.vue               # Pad tile with playback animations & drag-reorder
│   ├── MixerPanel.vue             # Virtual audio mixer & real-time peak meters
│   ├── SoundEditor.vue            # Modal for renaming, icons, volume, looping & keys
│   ├── SettingsModal.vue          # Global hotkeys, mic filters & storage options
│   └── SetupGuide.vue             # Step-by-step virtual microphone routing guide
├── composables/
│   ├── useSoundboard.ts           # Central state reactive store
│   ├── useKeyboard.ts             # In-window keyboard shortcut dispatcher
│   ├── useUi.ts                   # Modals & contextual dialogs state
│   └── useToasts.ts               # Toast notifications
├── electron/
│   ├── main.cjs                   # Native companion process (TCC mic permission, global shortcuts, IPC)
│   └── preload.cjs                # Context-isolated secure bridge
├── engine/
│   ├── AudioEngine.ts             # Web Audio API dual-sink mixer & limiter architecture
│   └── devices.ts                 # Hardware & virtual audio device discovery
├── lib/
│   ├── hotkeys.ts                 # Accelerator formatting & conflict resolution
│   ├── icons.ts                   # Pad iconography catalog
│   ├── storage.ts                 # Atomic file storage (Node fs / IndexedDB)
│   └── types.ts                   # Type definitions & persisted schema
├── public/
│   └── starter/                   # Synthesized built-in starter sound effects
├── nuxt.config.ts                 # Nuxt 3 client-only desktop SPA config
└── tailwind.config.ts             # Raycast / Linear aesthetic styling tokens
```

---

## 🔄 Automatic Application Updates

GGSoundboard includes a production-grade automatic update system powered by **`electron-updater`**, **GitHub Releases**, and **GitHub Actions**.

### Features
- **Background Checks**: Automatically checks for new versions on launch (after 8s) and every 4 hours while running.
- **Manual Checks**: Users can trigger an update check anytime via:
  - Application menu (`GGSoundboard → Check for Updates…` on macOS, `Help → Check for Updates…` on Windows/Linux)
  - Settings Modal (`Settings → Software Updates`)
  - About Modal (`About GGSoundboard → Check for Updates`)
- **Interactive UI**: Modal presents version diff (`v1.0.1` → `v1.0.2`), release notes, download progress bar (speed, MB transferred, percentage), and restart options.
- **Playback Safe**: Audio playback is never interrupted by updates. Users choose when to restart and apply updates.
- **Zero Data Loss**: All sounds, custom categories, icons, colors, hotkeys, and preferences reside in the OS `userData` directory (`~/Library/Application Support/GGSoundboard` on macOS, `%APPDATA%\GGSoundboard` on Windows), completely isolated from the application binary directory.
- **Development Safe**: Automatic updates are automatically suppressed in development mode (`!app.isPackaged`).

---

## 🚀 Publishing Updates (CI/CD)

### 1. Update Version in `package.json`
`package.json` is the single source of truth for semantic versioning (`MAJOR.MINOR.PATCH`):
```bash
# Example: Bumping to v1.0.2
npm version 1.0.2 --no-git-tag-version
```

### 2. Commit and Tag
```bash
git add package.json
git commit -m "chore: release v1.0.2"
git tag v1.0.2
git push origin main
git push origin v1.0.2
```

### 3. Automated GitHub Release
When a tag matching `v*` is pushed:
1. GitHub Actions runs independent builds on `macos-latest`, `windows-latest`, and `ubuntu-latest`.
2. Compiles DMG, ZIP, NSIS EXE, AppImage, and all updater manifests (`latest-mac.yml`, `latest.yml`, `latest-linux.yml`).
3. Only after all platform builds succeed, a single consolidated GitHub Release is published automatically.
4. Installed desktop apps detect the release and offer a seamless one-click update.

### 4. Optional Code Signing Secrets
Unsigned builds work immediately. For official code signing and Apple Notarization, configure these secrets in **GitHub Repository → Settings → Secrets and variables → Actions**:

| Secret Name | Platform | Description |
| :--- | :--- | :--- |
| `CSC_LINK` | macOS | Base64-encoded Apple Developer `.p12` certificate |
| `CSC_KEY_PASSWORD` | macOS | Password for the `.p12` certificate |
| `APPLE_ID` | macOS | Apple Developer account email |
| `APPLE_APP_SPECIFIC_PASSWORD` | macOS | App-specific password generated on appleid.apple.com |
| `APPLE_TEAM_ID` | macOS | 10-character Apple Developer Team ID |
| `WIN_CSC_LINK` | Windows | Base64-encoded Windows code signing certificate (`.pfx`) |
| `WIN_CSC_KEY_PASSWORD` | Windows | Password for the Windows `.pfx` certificate |

---

## 👨‍💻 Author & Credits

Developed with ❤️ by **Yeden Sherpa**
- **Role:** Creator & Lead Developer
- **Architecture:** Web Audio API dual-bus mixing pipeline, Electron desktop companion, and Socket.IO remote controller
- **License:** MIT

