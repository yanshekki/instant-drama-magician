# 架構 — InstantDrama Magician

> **語言：** [English](./architecture.md) · [中文](./architecture-ZH.md)

版本 **1.3.2**。Presentation → Application → Domain → Infrastructure，並以 **共用 handler runtime** 服務 Electron、Web 與 CLI。

## 分層

```text
Presentation（React 頁面／CLI／瀏覽器 UI）
        │
        ▼
  IPC  |  HTTP POST /api/invoke  |  instant-drama invoke
        │
        ▼
  registerAllHandlers + HandlerHost   ← 單一真相來源（約 157 channels）
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
| CLI local | `src/cli` + `createRuntime` | `IDM_DATA_DIR`（預設 `OS app data 根（與桌面相同）`） |
| Web／server | `server/index.ts` + `EmbeddedWebServer` | 同一 handlers；SPA 自 `out/renderer` |

Channel 目錄：`src/runtime/channelManifest.ts`（**157** 個唯一 id）。

主要媒體介面：

| 介面 | 角色 |
|------|------|
| `mediaGen:*` | 統一材料 → 多圖 vision 潤飾 → 靜圖（庫頁 + 時間軸精修） |
| `videoPrep:*` | 靜圖／關鍵幀 → 確認出片（含 timeline-clip） |
| `costumes:appendTryOnStill` | 試穿 still 雙寫入戲服多圖庫 |
| 時間軸進階 | 片尾 continuity 靜圖；上一段 keyframe 底圖；MediaGen 精修 |

## 桌面頁面

| 路由 | 頁面 |
|------|------|
| `/` | Stories |
| `/characters` | Characters（+ SoulMD Hub、參考 sheet） |
| `/costumes` | Costumes（試穿雙寫多圖庫） |
| `/scenes` | Scenes |
| `/props` | Props |
| `/timeline` | Timeline + Advanced prep（連續性 + 精修） |
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
