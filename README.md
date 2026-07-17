# 瞬劇魔法師 · InstantDrama Magician

AI 專業短劇生成桌面工具（Electron + React + TypeScript + Prisma/SQLite）。

## 進度（誠實）

| 範圍 | 完成度 |
|------|--------|
| **Project Brief MVP** | **100%** |
| **Beta 試用層**（本輪 DoD） | **100%** |
| **商業發行**（簽章／商店／真人級成片） | **未做** |

---

## MVP checklist

- [x] Electron + React + TS strict + Prisma  
- [x] 五頁創作 + soul.md + 時間軸引用  
- [x] Grok chat + `/v1/videos` 客戶端  
- [x] Pipeline + Demo + i18n  

## Beta checklist（Round 7）

- [x] Live 錯誤碼映射 + Settings 完整診斷  
- [x] **單 clip 生成／重試**  
- [x] **Export 預檢**（ffmpeg + READY/fallback 警告）  
- [x] [docs/beta.md](./docs/beta.md) 試用說明  
- [x] 自動化 smoke 測試  

---

## Quick start

```bash
cd "/home/ki/文件/instant-drama-magician"
npm install && npx prisma db push && npm run dev
```

1. **載入 Demo 故事**  
2. 時間軸 → **生成此段** 或整條生成  
3. **匯出成片**（需 ffmpeg）  

真 video：[docs/grok-gateway.md](./docs/grok-gateway.md)

---

## Docs

- [docs/project-brief.md](./docs/project-brief.md)  
- [docs/beta.md](./docs/beta.md)  
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
| `npm run pack` | Beta 目錄包 |

## i18n

zh-HK（預設）+ en
