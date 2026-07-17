# 商業發行路徑（Round 10）· v1.0.0

本輪完成 **可商業分發的發行路徑**（GitHub Releases + 自動更新 + 支援報告）。  
**商店上架與付費憑證簽章** 仍需你方 Apple/Microsoft/代碼簽名憑證——本倉庫已預留設定，但唔會替你申請帳號。

## 誠實進度

| 項目 | 狀態 |
|------|------|
| GitHub 多平台安裝包（Linux / Windows / mac unsigned） | **已做** |
| `electron-updater` 檢查／下載／重啟安裝 | **已做**（打包版） |
| 活動日誌 + 支援報告（遮罩 API key） | **已做** |
| publish → GitHub Releases | **已做** |
| Apple/Windows **正式簽章 + 商店** | **需憑證（未做）** |
| 真人級 AI 成片品質 | **模型邊界（未做）** |

## 自動更新

- 依賴 `electron-updater` + `build.publish` → `github:yanshekki/instant-drama-magician`  
- Settings → **檢查更新 / 下載 / 重啟安裝**  
- 開發模式（`!app.isPackaged`）會回 `dev-skipped`，唔打外網  

### 發版

```bash
# 1. bump package.json version（現 1.0.0）
# 2. commit + tag
git tag v1.0.0
git push origin v1.0.0
# 3. Release workflow 產出 linux/win/mac 產物並上傳 GitHub Release
```

`latest.yml` / `latest-linux.yml` / `latest-mac.yml` 供 updater 讀取。

## 簽章（可選，需你方 secrets）

| 平台 | 變數 | 說明 |
|------|------|------|
| Windows | `CSC_LINK` / `CSC_KEY_PASSWORD` | 代碼簽名 PFX |
| macOS | `CSC_LINK` / Apple ID / team | Notarize 另需 |
| 無 secrets | `CSC_IDENTITY_AUTO_DISCOVERY=false` | 本 repo CI 預設 |

見 [release.md](./release.md)。

## 支援報告

Settings → **匯出支援報告**：

- app 版本／platform／packaged  
- chat / video / ffmpeg 診斷  
- settings（**apiKey 已 redacted**）  
- 最近 activity.jsonl  

## 活動日誌

`userData/logs/activity.jsonl`：generation / export / update / support 事件。

## 刻意不做

- App Store / Microsoft Store 審核提交  
- 付費授權伺服器  
- 內嵌 ffmpeg 二進位（體積／授權複雜）  
