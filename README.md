# 瞬劇魔法師 · InstantDrama Magician

AI 專業短劇生成桌面工具（Electron + React + TypeScript + Prisma/SQLite）。

## 進度狀態

| 項目 | 狀態 |
|------|------|
| **產品完成度** | **約 10%**（相對「idea → 完整可發行 AI 短劇成片」目標） |
| **現階段定位** | 早期 prototype / architecture scaffold，**未達可用產品** |
| **目標** | 見 [docs/project-brief.md](./docs/project-brief.md) |

> 已有介面骨架、時間軸、pipeline 與 export 接線，但真 AI 出片、成片品質、體驗與發行仍差很遠。  
> **請勿當作已完成產品。**

### 10% 大致對應

| 已有（骨架） | 未完成（約 90%） |
|--------------|------------------|
| 專案結構、五個創作頁 | 真 Grok video 穩定出片與營運驗證 |
| Prisma 資料模型 | 專業成片（演技級畫面、口型、聲畫） |
| 線性時間軸 UI（可拖） | 完整 NLE / 多軌 / 專業預覽 |
| Pipeline 步驟接線 | 端到端可靠生成與重試策略打磨 |
| FFmpeg stub / 色塊／簡易 concat | 發行級打包、簽章、更新 |
| i18n、Settings 雛形 | soulmd-hub 深度整合、帳號／雲端等 |

---

## Quick start（開發試跑）

```bash
cd "/home/ki/文件/instant-drama-magician"
npm install
npx prisma db push
npm run dev
```

可選：

- 系統需有 `ffmpeg` 先試匯出  
- 真 AI：見 [docs/grok-gateway.md](./docs/grok-gateway.md)（仍屬實驗）

---

## 而家有咩（prototype）

- Electron 桌面殼 + React 頁面（Stories / Characters / Scenes / Props / Timeline / Settings）  
- 時間軸：拖曳、zoom、playhead、簡易預覽  
- 生成 pipeline 骨架（腳本 → … → video → export）  
- Video：`stub` 色塊片為主；`http` 對齊 `/v1/videos` 契約（需自行接 gateway）  
- 匯出：簡易 concat / 字幕 / 可選 BGM·TTS（品質未達產品級）  
- soul.md 本機／URL 匯入（淺層）  

## 未做（主要缺口）

- 穩定、可演示的「一鍵真短劇片」  
- 真 video 模型產能、失敗恢復、成本與佇列  
- 專業時間軸與媒體管理  
- 產品級 UX、錯誤處理、引導  
- 測試覆蓋（E2E / live gateway）、多平台發行  
- 商店簽章、auto-update、帳號與雲端  

---

## Docs

| 文件 | 說明 |
|------|------|
| [docs/project-brief.md](./docs/project-brief.md) | 產品規格（目標狀態） |
| [docs/architecture.md](./docs/architecture.md) | 現有架構筆記 |
| [docs/video-providers.md](./docs/video-providers.md) | Video API 接線 |
| [docs/grok-gateway.md](./docs/grok-gateway.md) | 接 Grok CLI gateway |
| [docs/release.md](./docs/release.md) | 打包檢查（未達發行） |

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | 開發模式 |
| `npm run build` | 建置 bundle |
| `npm test` | 單元測試 |
| `npm run pack` | electron-builder `--dir`（實驗） |

---

## i18n

- **zh-HK**（預設）  
- **en**  

---

## License

MIT（見 repo；產品本身仍屬 early prototype）
