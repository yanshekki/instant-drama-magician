# Beta 試用說明

## 系統要求

- Node 20+（開發）
- 系統 **ffmpeg**（匯出）
- 可選：本機 [Grok-Cli-to-OpenAI-compatible](./grok-gateway.md)（真 video）

## 5 分鐘路徑

1. `npm run dev`
2. 首次彈窗或故事頁 → **載入 Demo 故事**
3. 時間軸右側選 **6s / 10s**
4. 對單一 clip 按 **生成此段**，或整條 **開始生成**
5. **匯出成片**（預檢會提示 fallback）

## stub vs live

| 模式 | 結果 |
|------|------|
| `stub` / auto 降級 | 紫色色塊占位 mp4 |
| `http` + gateway videoApi | `/v1/videos` job → content |

側欄顯示 `Video: stub|http|auto`；上次 stub 會標示。

## 已知限制（Beta）

- 非商店簽章安裝包
- TTS / BGM 品質有限
- 單軌時間軸
- 真片品質取決於 gateway `MEDIA_PROVIDER`

## 打包

```bash
npm run pack
# → release/linux-unpacked
```
