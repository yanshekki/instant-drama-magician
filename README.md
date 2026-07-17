# 瞬劇魔法師 · InstantDrama Magician

AI 專業短劇生成桌面工具（Electron + React + TypeScript + Prisma/SQLite）。

## 進度（誠實）

| 範圍 | 完成度 |
|------|--------|
| **Project Brief MVP 成功標準** | **100%**（見下方 checklist） |
| **商業發行級「完整 AI 短劇工廠」** | **未完成**（真模型產能、商店簽章、專業 NLE 等） |

本 repo 以 brief 的 **Success Criteria** 為 MVP 完成線：type-safe、模組化、五頁獨立創作、時間軸互相引用、i18n、Grok CLI 接線、可演示 idea→片流程。

---

## MVP 成功標準 checklist（100%）

- [x] Electron + React + TypeScript strict  
- [x] Prisma + SQLite schema  
- [x] Domain types + layered architecture  
- [x] Grok CLI OpenAI-compatible client（chat + `/v1/videos`）  
- [x] 五頁：Stories / Characters / Scenes / Props / Timeline  
- [x] soul.md 匯入（檔案 + URL）  
- [x] 線性時間軸（Konva、引用人物／場景／道具／對白、6/10s）  
- [x] Generation pipeline + progress  
- [x] i18n zh-HK + en  
- [x] FFmpeg export（concat / final + 字幕／BGM）  
- [x] Demo 一鍵種子 + 首次引導  
- [x] Settings / Gateway 檢測 / stub 標示  

**非 MVP（未做）**：商店簽章、auto-update、雲端帳號、多軌 NLE、穩定真人級 AI 片品質。

---

## Quick start

```bash
cd "/home/ki/文件/instant-drama-magician"
npm install
npx prisma db push
npm run dev
```

建議路徑：

1. 首次彈窗或故事頁 → **載入 Demo 故事**  
2. 時間軸 → **6s / 10s** → **開始生成**（無 gateway 會用 stub 色塊）  
3. **匯出成片**（需系統 `ffmpeg`）  

真 video： [docs/grok-gateway.md](./docs/grok-gateway.md)

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
