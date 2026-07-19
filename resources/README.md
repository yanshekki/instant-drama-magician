# App resources

> **Language:** [English](./README.md) · [中文](./README-ZH.md)

Runtime and packaging assets for **InstantDrama Magician**.

## Icon (pure YSK mark)

| File | Role |
|------|------|
| `icon.png` | Packaged / tray / BrowserWindow icon (`extraResources`) |
| `../build/icon.png` | electron-builder root icon (1024) |
| `../build/icons/{16,32,48,64,128,256,512,1024}x*.png` | Linux hicolor + AppImage / deb |
| `../build/icon.ico` | Windows multi-size ICO |
| `../src/assets/ysk-logo.svg` | Source geometry (hexagon + Y circuit) |
| `../src/assets/app-icon.svg` | App plate variant |

Linux desktop:

- **Icon name / WM class:** `instant-drama-magician`  
- Must match `StartupWMClass` and Chromium `--class`  

## Screenshots (docs)

UI screenshots for README: **`../src/assets/screen/`** (`1.png` … `6.png`), embedded in [../README.md](../README.md) and [../README-ZH.md](../README-ZH.md).

## Contact

YSK Limited · [email@ysk.hk](mailto:email@ysk.hk)
