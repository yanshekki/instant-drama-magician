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
# → release.yml：Linux AppImage/deb + Windows NSIS + macOS dmg（預設 unsigned）
```

手動：

```bash
CSC_IDENTITY_AUTO_DISCOVERY=false npm run dist:linux
```

自動更新 feed：GitHub Releases（`build.publish`）。見 [commercial-ZH.md](./commercial-ZH.md)。

## 可選代碼簽章

- `CSC_LINK`／`CSC_KEY_PASSWORD`  
- macOS 商店級需 Apple notarization secrets  
- 無 secrets 時 CI 設 `CSC_IDENTITY_AUTO_DISCOVERY=false`  

## CI

- `.github/workflows/ci.yml` — typecheck、test、build、pack on `main`  
- `.github/workflows/release.yml` — tag `v*` → 多平台安裝包 + Release 資產  

## 仍需你方帳號

- Apple Developer／Microsoft Partner／EV 代碼簽章憑證  
- 商店文案與審核提交
