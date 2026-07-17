# 瞬劇魔法師 · InstantDrama Magician

AI 專業短劇生成桌面工具（Electron + React + TypeScript + Prisma/SQLite）。

## 進度狀態

| 項目 | 狀態 |
|------|------|
| **產品完成度** | **約 15–20%**（相對「idea → 完整可發行 AI 短劇成片」） |
| **現階段定位** | **可演示 prototype**：可走完「Demo → 時間軸 → 生成／匯出」；**未達可用產品** |
| **目標** | [docs/project-brief.md](./docs/project-brief.md) |

> 已有介面、Demo 故事、6/10 秒時間軸提示、生成步驟人話說明與 stub／gateway 區分。  
> **真 AI 出片、成片品質、發行仍未完成。請勿當作成品。**

### 已有 vs 未完成

| 已有（prototype） | 未完成（主要 80%+） |
|-------------------|---------------------|
| 五頁創作 + Demo 一鍵種子 | 穩定真 Grok video 出片 |
| 時間軸 6/10s UX | 專業 NLE／多軌 |
| 生成步驟中文說明 | 演技級畫面／聲畫 |
| stub 占位片標示 | 產品級錯誤恢復 |
| 匯出路徑回饋 | 商店簽章、auto-update |
| Gateway 檢測 | soulmd-hub 深度整合 |

---

## Quick start

```bash
cd "/home/ki/文件/instant-drama-magician"
npm install
npx prisma db push
npm run dev
```

1. 故事頁 → **載入 Demo 故事**  
2. 時間軸 → 選 6s／10s → 生成（無 gateway 會用色塊 stub）  
3. 匯出成片（需系統 `ffmpeg`）  

真 AI：見 [docs/grok-gateway.md](./docs/grok-gateway.md)。

---

## Docs

- [docs/project-brief.md](./docs/project-brief.md)  
- [docs/architecture.md](./docs/architecture.md)  
- [docs/video-providers.md](./docs/video-providers.md)  
- [docs/grok-gateway.md](./docs/grok-gateway.md)  
- [docs/release.md](./docs/release.md)  

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | 開發 |
| `npm run build` | 建置 |
| `npm test` | 測試 |
| `npm run pack` | 實驗打包 |

## i18n

zh-HK（預設）+ en
