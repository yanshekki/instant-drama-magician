# 瞬劇魔法師 · InstantDrama Magician

AI 專業短劇生成桌面工具（Electron + React + TypeScript + Prisma/SQLite）。

## 進度（誠實）

| 範圍 | 完成度 |
|------|--------|
| **Project Brief MVP** | **100%** |
| **Beta 試用層**（Round 7） | **100%** |
| **Production UX**（Round 8） | **100%** |
| **Release Candidate**（Round 9） | **100%** |
| **商業發行**（簽章／商店／真人級成片） | **未做** |

版本：**0.3.0**

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

## Production UX checklist（Round 8）

- [x] 全管線／單 clip **可取消** + 即時 clip 進度  
- [x] **只重試失敗**（僅 video step）  
- [x] 對白 **TTS → 匯出混音** + BGM 音量  
- [x] 人物 **參考圖** + styleNote + 片段連貫 prompt  
- [x] 匯出後開資料夾、CI pack artifact  
- [x] [docs/production-ux.md](./docs/production-ux.md)  

## Release Candidate checklist（Round 9）

- [x] 成片 **xfade 轉場** + **BGM ducking**  
- [x] **比例感知 export**（16:9 / 9:16 / 1:1）  
- [x] About + 版本號 + pack 環境提示  
- [x] Tag → AppImage/deb **Release workflow**  
- [x] [docs/rc.md](./docs/rc.md)  

---

## Quick start

```bash
cd "/home/ki/文件/instant-drama-magician"
npm install && npx prisma db push && npm run dev
```

1. **載入 Demo 故事**  
2. Settings 可調 **轉場 / 比例 / ducking**  
3. 時間軸生成 → **匯出成片**  

真 video：[docs/grok-gateway.md](./docs/grok-gateway.md)  
RC 下載：[docs/rc.md](./docs/rc.md)

---

## Docs

- [docs/project-brief.md](./docs/project-brief.md)  
- [docs/beta.md](./docs/beta.md)  
- [docs/production-ux.md](./docs/production-ux.md)  
- [docs/rc.md](./docs/rc.md)  
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
| `npm run pack` | 目錄包 → `release/linux-unpacked` |
| `npm run dist` | 安裝包（AppImage/deb 等） |

## i18n

zh-HK（預設）+ en
