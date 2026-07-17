# Release Candidate（Round 9）

在 Production UX 之上：**成片更像片** + **可下載 Linux 包**（無商店簽章）。

## 版本

- App：`0.3.0`  
- 進度標示：README **Release Candidate 100%**

## 成片能力（本輪）

| 能力 | 說明 |
|------|------|
| 轉場 | Settings → `fade`（xfade）或 `cut` |
| 比例 | 16:9 → 1280×720；9:16 → 720×1280；1:1 → 1080² |
| BGM ducking | 有 TTS 對白時段自動壓低 BGM（`duckRatio`） |
| About | Settings 顯示 version / packaged / userData / media |

## 下載 RC 包

### 由 GitHub Actions

1. 推 tag：`git tag v0.3.0 && git push origin v0.3.0`  
2. Workflow **Release** 產出 AppImage + deb  
3. 在 GitHub Releases 下載  

或手動：

```bash
npm run typecheck && npm test && npm run build
CSC_IDENTITY_AUTO_DISCOVERY=false npx electron-builder --linux AppImage deb
# → release/*.AppImage, release/*.deb
```

### 本機目錄包

```bash
npm run pack
# → release/linux-unpacked
```

## 系統要求

- Linux x64（AppImage / deb）  
- **ffmpeg** 已安裝（打包版不會內嵌 ffmpeg）  
- 可選：本機 Grok gateway 真 video  

## 已知限制（RC）

- **無** 代碼簽章 / Notarization  
- **無** Windows / mac 自動 Release（可後加）  
- **無** 自動更新 channel  
- TTS 品質取決於本機 espeak / HTTP TTS  
- 多軌 NLE 未做  

商業商店層見 [release.md](./release.md)。

## 建議試用

1. 載入 Demo  
2. Settings：aspect 9:16 或 16:9、transition fade  
3. 生成 → 匯出成片  
4. 核對轉場與（若開 TTS）BGM ducking  
