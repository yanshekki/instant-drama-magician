# 發版 checklist

> **語言：** [English](./release.md) · [中文](./release-ZH.md)

1. `npm run typecheck && npm test && npm run build`  
2. `npm run pack` → 檢查 `release/linux-unpacked`  
3. 可選：`npm run dist`／`idm build --target installer`（linux AppImage+deb、win NSIS、mac dmg）  
4. 設定 → LLM／影片供應商（若用真 API）  
5. FFmpeg：經 **`ffmpeg-static`** 打包；可選 `FFMPEG_PATH`  
6. 勿提交 `userData` 密鑰  
7. 版本 **`1.0.0`**。聯絡 **email@ysk.hk**。商店簽章可選。  
8. Linux 圖示：純 YSK mark；`StartupWMClass=instant-drama-magician`  

## 由 git tag 發版

```bash
git tag v1.0.0
git push origin v1.0.0
# → release.yml：Linux AppImage/deb + Windows NSIS + macOS dmg（mac 先 ad-hoc 簽名先上傳）
```

手動：

```bash
CSC_IDENTITY_AUTO_DISCOVERY=false npm run dist:linux
```

自動更新 feed：GitHub Releases（`build.publish`）。見 [commercial-ZH.md](./commercial-ZH.md)。

## 代碼簽章

- macOS GitHub Release 必須 **ad-hoc 簽名**（`scripts/adhoc-sign-mac.cjs`）先上傳。`mac.identity` 保持 `null`，避免 electron-builder 25 去 keychain 搵名為 `-` 的憑證。CI 跑 `codesign --verify --deep --strict`，並要求 `Signature=adhoc`；失敗就唔上傳。
- 第一次打開仍要去「系統設定 → 私隱與保安 → 仍要打開」。未包含 notarization。
- Windows 開發者簽章：`CSC_LINK`／`CSC_KEY_PASSWORD`  
- macOS 商店級：Apple Developer ID + notarization secrets  
- CI 設 `CSC_IDENTITY_AUTO_DISCOVERY=false`，冇 Developer ID 時都唔會跳過 ad-hoc hook  

## CI

- `.github/workflows/ci.yml` — typecheck、test、build、pack on `main`  
- `.github/workflows/release.yml` — tag `v*` → 多平台安裝包 + Release 資產  

## 仍需你方帳號

- Apple Developer／Microsoft Partner／EV 代碼簽章憑證  
- 商店文案與審核提交
