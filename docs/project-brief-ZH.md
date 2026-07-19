# 瞬劇魔法師（InstantDrama Magician）— 專業產品規格

> **語言：** [English](./project-brief.md) · [中文](./project-brief-ZH.md)

**專案名稱：** 瞬劇魔法師（InstantDrama Magician）  
**Tagline：** AI 專業短劇生成桌面工具  
**類型：** 跨平台 Electron 桌面應用  

> ### 現況註記（v1.0.0）
>
> | 項目 | 目前 |
> |------|------|
> | 版本 | **1.0.0** |
> | 頁面 | Stories · Characters · **Costumes** · Scenes · Props · Timeline · Activity · Settings |
> | i18n | **10** 種語系 |
> | CLI／Web | 完整 **137** channel 共用 runtime |
> | 聯絡 | **email@ysk.hk** · YSK Limited |
> | 用戶說明 | [../README-ZH.md](../README-ZH.md) · [../README.md](../README.md) |
> | 文件總覽 | [README-ZH.md](./README-ZH.md) |
>
> 以下保留 **原始啟動規格** 摘要。

## 專案目標

建立專業、模組化、可擴展的 AI 短劇生成器。用戶在獨立頁面創作人物、場景、道具與多個故事，再以 **線性時間軸** 控制生成。系統支援 idea 到成片流程，並因 AI 影片時長限制（6s／10s）提供精準時間軸管理。

## 核心技術棧

- **Frontend：** React 18 + TypeScript + TailwindCSS + Vite  
- **Desktop：** Electron + electron-vite  
- **Database：** SQLite + Prisma  
- **AI：** OpenAI-compatible（預設 Grok CLI 閘道）  
- **i18n：** react-i18next（現 10 語）  
- **Media：** FFmpeg（`ffmpeg-static`）、自訂時間軸 UI  

## 架構

Clean Architecture + 分層：Presentation · Application · Domain · Infrastructure。  
共用 `registerAllHandlers` 驅動 Electron IPC、Web `/api/invoke`、CLI `instant-drama invoke`。

## 獨立創作頁（原規格 + 已出貨）

1. Stories  
2. Characters（soul.md／SoulMD Hub）  
3. Scenes  
4. Props  
5. Timeline  
6. **Costumes**（已出貨）  
7. **Activity**（已出貨）  
8. **Settings**（已出貨）  

## 相關

- [architecture-ZH.md](./architecture-ZH.md) · [commercial-ZH.md](./commercial-ZH.md) · 聯絡 [email@ysk.hk](mailto:email@ysk.hk)
