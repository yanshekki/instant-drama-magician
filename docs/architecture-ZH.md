# 架構 — InstantDrama Magician

> **語言：** [English](./architecture.md) · [中文](./architecture-ZH.md)

版本 **1.0.0**。Presentation → Application → Domain → Infrastructure，並以 **共用 handler runtime** 服務 Electron、Web 與 CLI。

## 分層

```text
Presentation（React 頁面／CLI／瀏覽器 UI）
        │
        ▼
  IPC  |  HTTP POST /api/invoke  |  idm invoke
        │
        ▼
  registerAllHandlers + HandlerHost   ← 單一真相來源（約 137 channels）
        │
        ▼
  Application 服務（Generation、Timeline、Export、Backup…）
        │
        ▼
  Domain（純 TS：prompts、snap、layout、legal、providers…）
        │
        ▼
  Infrastructure（Prisma/SQLite、AI HTTP、FFmpeg、settings、media、gateway、updater）
```

桌面媒體經特權協定 **`idm-media://`** 提供（支援影片 Range）。

## 共用 runtime

| 入口 | 路徑 | 說明 |
|------|------|------|
| Electron | `electron/main/ipc.ts` → handlers | Electron `userData` |
| CLI local | `src/cli` + `createRuntime` | `IDM_DATA_DIR`（預設 `~/.local/share/idm`） |
| Web／server | `server/index.ts` + `EmbeddedWebServer` | 同一 handlers；SPA 自 `out/renderer` |

Channel 目錄：`src/runtime/channelManifest.ts`（**137** 個唯一 id）。

## 桌面頁面

| 路由 | 頁面 |
|------|------|
| `/` | Stories |
| `/characters` | Characters（+ SoulMD Hub、參考 sheet） |
| `/costumes` | Costumes |
| `/scenes` | Scenes |
| `/props` | Props |
| `/timeline` | Timeline + Advanced prep |
| `/audit` | 活動日誌 |
| `/settings` | 設定 |

## 生成管線

```text
Script → Character → Scene → Props → Timeline → Video（6|10s）→ Export
```

- 全量：`generation:run`
- 只重試失敗：video step
- 取消：`generation:cancel`
- 進階預備：cast lock → stills → video 佇列

## 資料路徑（Linux）

| 模式 | 路徑 |
|------|------|
| 打包 Electron | `~/.config/instant-drama-magician/` |
| 開發（`!app.isPackaged`） | `~/.config/instant-drama-magician-dev/` |
| CLI／server | `IDM_DATA_DIR` |

## 相關

- [cli-ZH.md](./cli-ZH.md) · [self-host-ZH.md](./self-host-ZH.md) · [video-providers-ZH.md](./video-providers-ZH.md) · [testing-ZH.md](./testing-ZH.md)
