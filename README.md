# 瞬劇魔法師 · InstantDrama Magician

AI 專業短劇生成桌面工具（Electron + React + TypeScript + Prisma/SQLite）。

## 進度（誠實）

| 範圍 | 完成度 |
|------|--------|
| **Project Brief MVP** | **100%** |
| **Beta 試用層**（Round 7） | **100%** |
| **Production UX**（Round 8） | **100%** |
| **Release Candidate**（Round 9） | **100%** |
| **商業發行路徑**（Round 10 · 分發／更新／支援） | **100%** |
| **商店簽章上架**（Apple/MS 憑證＋審核） | **未做**（需你方帳號／憑證） |

版本：**1.0.0**

---

## MVP checklist

- [x] Electron + React + TS strict + Prisma  
- [x] 五頁創作 + soul.md + 時間軸引用  
- [x] Grok chat + `/v1/videos` 客戶端  
- [x] Pipeline + Demo + i18n  

## Beta checklist（Round 7）

- [x] Live 錯誤碼映射 + Settings 完整診斷  
- [x] 單 clip 生成／重試  
- [x] Export 預檢  
- [x] [docs/beta.md](./docs/beta.md)  

## Production UX checklist（Round 8）

- [x] 取消生成 + 只重試失敗  
- [x] TTS 混音 + 人物參考圖 + styleNote  
- [x] [docs/production-ux.md](./docs/production-ux.md)  

## Release Candidate checklist（Round 9）

- [x] xfade / ducking / 比例感知 export  
- [x] About + 版本  
- [x] [docs/rc.md](./docs/rc.md)  

## 商業發行路徑 checklist（Round 10）

- [x] **electron-updater**（檢查／下載／重啟安裝）  
- [x] GitHub Release **Linux + Windows + macOS** workflow  
- [x] 活動日誌 + **支援報告**（密鑰遮罩）  
- [x] `v1.0.0` + [docs/commercial.md](./docs/commercial.md)  
- [ ] 商店簽章／Notarize／Store 上架（需憑證）  

---

## Quick start

```bash
cd "/home/ki/文件/instant-drama-magician"
npm install && npx prisma db push && npm run dev
```

1. 載入 Demo  
2. 時間軸生成 → 匯出  
3. Settings：更新檢查、支援報告  

真 video：[docs/grok-gateway.md](./docs/grok-gateway.md)

### 發佈 v1.0.0

```bash
git tag v1.0.0 && git push origin v1.0.0
```

---

## Docs

- [docs/project-brief.md](./docs/project-brief.md)  
- [docs/beta.md](./docs/beta.md)  
- [docs/production-ux.md](./docs/production-ux.md)  
- [docs/rc.md](./docs/rc.md)  
- [docs/commercial.md](./docs/commercial.md)  
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
| `npm run pack` | 目錄包 |
| `npm run dist` | 當前平台安裝包 |
| `npm run dist:linux` / `dist:win` / `dist:mac` | 分平台 |

## i18n

zh-HK（預設）+ en
