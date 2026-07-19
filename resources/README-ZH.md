# App 資源

> **語言：** [English](./README.md) · [中文](./README-ZH.md)

**InstantDrama Magician** 的執行期與打包資源。

## 圖示（純 YSK mark）

| 檔案 | 用途 |
|------|------|
| `icon.png` | 打包／tray／BrowserWindow 圖示（`extraResources`） |
| `../build/icon.png` | electron-builder 根圖示（1024） |
| `../build/icons/{16,32,48,64,128,256,512,1024}x*.png` | Linux hicolor + AppImage／deb |
| `../build/icon.ico` | Windows 多尺寸 ICO |
| `../src/assets/ysk-logo.svg` | 來源幾何（六邊形 + Y 電路） |
| `../src/assets/app-icon.svg` | App 底板變體 |

Linux 桌面：

- **Icon 名／WM class：** `instant-drama-magician`  
- 必須與 `StartupWMClass` 及 Chromium `--class` 一致  

## 截圖（文件）

README 用 UI 截圖：**`../src/assets/screen/`**（`1.png` … `6.png`），嵌入 [../README-ZH.md](../README-ZH.md) 與 [../README.md](../README.md)。

## 聯絡

YSK Limited · [email@ysk.hk](mailto:email@ysk.hk)
