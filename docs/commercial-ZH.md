# 商業發行路徑 · v1.0.0

> **語言：** [English](./commercial.md) · [中文](./commercial-ZH.md)

完成 **可商業分發** 的發行路徑（GitHub Releases + 自動更新 + 支援報告）。  
**商店上架與付費憑證簽章** 仍需你方 Apple／Microsoft 憑證——倉庫已預留設定，但不會代申請帳號。

## 誠實進度

| 項目 | 狀態 |
|------|------|
| GitHub 多平台安裝包（Linux／Windows／mac，預設 unsigned） | **已做** |
| `electron-updater` 檢查／下載／重啟 | **已做**（打包版） |
| 活動日誌 + 支援報告（遮罩 API key） | **已做** |
| publish → GitHub Releases | **已做** |
| Apple／Windows **商店級簽章** | **需憑證（未做）** |
| 影院級自動成片品質 | **模型邊界** |

## 自動更新

- `electron-updater` + `build.publish` → `github:yanshekki/instant-drama-magician`  
- 設定 → **檢查／下載／重啟**  
- 開發模式（`!app.isPackaged`）回 `dev-skipped`  

### 發版

```bash
# 1. bump package.json version（現 1.0.0）
# 2. commit + tag
git tag v1.0.0
git push origin v1.0.0
# 3. Release workflow 上傳 linux/win/mac 產物
```

Feed：`latest.yml`／`latest-linux.yml`／`latest-mac.yml`。

## 簽章（可選 secrets）

| 平台 | 變數 |
|------|------|
| Windows | `CSC_LINK`／`CSC_KEY_PASSWORD` |
| macOS | `CSC_LINK`／Apple ID／team（+ Notarize） |
| 無 | `CSC_IDENTITY_AUTO_DISCOVERY=false`（CI 預設） |

見 [release-ZH.md](./release-ZH.md)。

## 支援報告

設定 → **匯出支援報告**：

- app 版本／platform／packaged  
- chat／video／ffmpeg 診斷  
- settings（**apiKey 已 redacted**）  
- 最近 activity.jsonl  

## 活動日誌

`userData/logs/activity.jsonl`：generation／export／update／support 事件。

## FFmpeg

- 經 **`ffmpeg-static`** 打包（asarUnpack）  
- 可用 **`FFMPEG_PATH`** 覆寫  
- `instant-drama media check-ffmpeg --json` 或設定診斷  

## 聯絡

- **YSK Limited** · [email@ysk.hk](mailto:email@ysk.hk)  
- 中文產品說明：[../README-ZH.md](../README-ZH.md)

## 刻意不做

- App Store／Microsoft Store 審核提交  
- 付費授權伺服器  
- 無憑證時的商店級簽章
