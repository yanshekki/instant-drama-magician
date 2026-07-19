# Release Candidate（Round 9）

> **語言：** [English](./rc.md) · [中文](./rc-ZH.md)

在 Production UX 之上：**成片更像片** + **可下載 Linux 包**（無商店簽章）。

## 版本

- App：見 `package.json`（商業路徑後為 `1.0.0`）  
- 現行分發／更新：[commercial-ZH.md](./commercial-ZH.md)

## 成片能力（本輪）

| 能力 | 說明 |
|------|------|
| 轉場 | Settings → `fade`（xfade）或 `cut` |
| 比例 | 16:9 → 1280×720；9:16 → 720×1280；1:1 → 1080² |
| BGM ducking | 有 TTS 對白時段壓低 BGM（`duckRatio`） |
| About | Settings 顯示 version／packaged／userData／media |

## 下載 RC 包

### GitHub Actions

1. 推 tag：`git tag v0.3.0 && git push origin v0.3.0`（歷史示例）  
2. Workflow **Release** 產出 AppImage + deb  
3. 在 GitHub Releases 下載  

或：

```bash
npm run typecheck && npm test && npm run build
CSC_IDENTITY_AUTO_DISCOVERY=false npx electron-builder --linux AppImage deb
```

### 本機目錄包

```bash
npm run pack
# → release/linux-unpacked
```

## 系統要求

- Linux x64（AppImage／deb）  
- **FFmpeg** 經 `ffmpeg-static`；可用 `FFMPEG_PATH`  
- 可選本機 Grok gateway 真 video  

## 已知限制

> **現況（v1.0.0 商業路徑）：** GitHub Releases 已含 **Linux + Windows + macOS**；**electron-updater** 已接；FFmpeg 經 `ffmpeg-static`。見 [commercial-ZH.md](./commercial-ZH.md)、[release-ZH.md](./release-ZH.md)。

仍成立：

- 無憑證則無商店簽章／Notarization  
- TTS 品質取決於 HTTP TTS 設定  
- 無多軌 NLE  
- 成片品質受模型邊界限制  

## 建議試用

1. 載入 Demo  
2. Settings：aspect 9:16 或 16:9、transition fade  
3. 生成 → 匯出  
4. 核對轉場與（若開 TTS）BGM ducking
