# Application Icons

Place your application icons in this folder (`build/`). The app is configured to automatically pick them up during development and production packaging:

### File Names & Formats:

1. **`icon.png`** (Recommended: 512×512 or 1024×1024 px)
   - Used for the **macOS Dock** during development (`npm run dev` / `npm start`).
   - Used as the default window icon on Windows and Linux.
   - Used as the default app icon for Linux builds.

2. **`icon.icns`** (Apple Icon Image format)
   - Used for **macOS packaged app** (`npm run dist`).
   - Contains 16×16 up to 1024×1024 resolutions.
   - Can be generated from `icon.png` using macOS built-in `iconutil` or online converters.

3. **`icon.ico`** (Windows Icon format)
   - Used for **Windows packaged app** (`.exe` installer / taskbar).
   - Contains 16×16 up to 256×256 resolutions.

4. **Web Favicon** (Optional)
   - Place a `favicon.ico` or `icon.png` in the `public/` directory for browser tabs and mobile home screen shortcuts when using the Remote Controller.

---

### Quick command to generate `icon.icns` on macOS from a PNG:
If you have a 1024×1024 PNG named `icon.png`:
```bash
mkdir icon.iconset
sips -z 16 16     icon.png --out icon.iconset/icon_16x16.png
sips -z 32 32     icon.png --out icon.iconset/icon_16x16@2x.png
sips -z 32 32     icon.png --out icon.iconset/icon_32x32.png
sips -z 64 64     icon.png --out icon.iconset/icon_32x32@2x.png
sips -z 128 128   icon.png --out icon.iconset/icon_128x128.png
sips -z 256 256   icon.png --out icon.iconset/icon_128x128@2x.png
sips -z 256 256   icon.png --out icon.iconset/icon_256x256.png
sips -z 512 512   icon.png --out icon.iconset/icon_256x256@2x.png
sips -z 512 512   icon.png --out icon.iconset/icon_512x512.png
sips -z 1024 1024 icon.png --out icon.iconset/icon_512x512@2x.png
iconutil -c icns icon.iconset
rm -rf icon.iconset
```
