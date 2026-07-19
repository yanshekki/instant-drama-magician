# Beta 試用說明（Round 7）

> **語言：** [English](./beta.md) · [中文](./beta-ZH.md)

## 系統要求

- Node 20+（開發）  
- **FFmpeg：** `ffmpeg-static` 或 `FFMPEG_PATH`  
- 可選：本機 [Grok 閘道](./grok-gateway-ZH.md)（真 video）  

## 5 分鐘路徑

1. `npm run dev`  
2. 首次彈窗或故事頁 → **載入 Demo 故事**  
3. 時間軸選 **6s／10s**  
4. **生成此段** 或整條 **開始生成**  
5. **匯出成片**（預檢可能提示 fallback）  

## stub vs live

| 模式 | 結果 |
|------|------|
| `stub`／auto 降級 | 紫色佔位 mp4 |
| `http` + gateway videoApi | `/v1/videos` job → content |

側欄顯示 `Video: stub|http|auto`。

## 已知限制（Beta 時期）

- 非商店簽章安裝包  
- TTS／BGM 品質有限（Round 8 已接混音路徑）  
- 單軌時間軸  
- 真片品質取決於 gateway `MEDIA_PROVIDER`  

Production UX：[production-ux-ZH.md](./production-ux-ZH.md)。現行出貨：[commercial-ZH.md](./commercial-ZH.md)。

## 打包

```bash
npm run pack
# → release/linux-unpacked
```
