# 架構 — InstantDrama Magician

> **語言：** [English](./architecture.md) · [中文](./architecture-ZH.md)

版本 **1.6.1**。Presentation → Application → Domain → Infrastructure，並以 **共用 handler runtime** 服務 Electron、Web 與 CLI。

## 分層

```text
Presentation（React 頁面／CLI／瀏覽器 UI）
        │
        ▼
  IPC  |  HTTP POST /api/invoke  |  instant-drama invoke
        │
        ▼
  registerAllHandlers + HandlerHost   ← 單一真相來源（約 183 channels）
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

同一 runtime、三條路——時間軸流程、漫畫成頁、劇照成圖：

<table>
  <tr>
    <td width="50%" valign="top">
      <img src="../src/assets/screen/7.png" alt="時間軸流程" width="100%">
    </td>
    <td width="50%" valign="top">
      <img src="../src/assets/screen/10.png" alt="漫畫成圖" width="100%">
    </td>
  </tr>
</table>

## 共用 runtime

| 入口 | 路徑 | 說明 |
|------|------|------|
| Electron | `electron/main/ipc.ts` → handlers | Electron `userData` |
| CLI local | `src/cli` + `createRuntime` | `IDM_DATA_DIR`（預設 `OS app data 根（與桌面相同）`） |
| Web／server | `server/index.ts` + `EmbeddedWebServer` | 同一 handlers；SPA 自 `out/renderer` |

Channel 目錄：`src/runtime/channelManifest.ts`（**183** 個唯一 id）。

主要媒體介面：

| 介面 | 角色 |
|------|------|
| `mediaGen:*` | 統一材料 → 多圖 vision 潤飾 → 靜圖（庫頁 + 時間軸精修） |
| `videoPrep:*` | 靜圖／關鍵幀 → 確認出片（含 timeline-clip） |
| `costumes:appendTryOnStill` | 試穿 still 雙寫入戲服多圖庫 |
| 時間軸進階 | 片尾 continuity 靜圖；上一段 keyframe 底圖；MediaGen 精修 |

可選生成旗標（預設等於現有行為；**不加新 channel**）：

- `continuityMode`：`storyboard`（預設）或 `chain-end`（上一段片尾勝出；整批順序出片）
- `motionPriority`：`default` 或 `action`（已綁定動作板一定入 polish；action 模式提到場景／道具之上）
- `advancedIdentity`／`identityCollage`：自動選取圖庫靜圖做多圖潤飾；可選 FFmpeg 拼貼以配合 edits API 單圖上限
- `lookPackId`：`follow-asset` · `identity-lock` · `continuous-clip` · `key-art` · `comic`
- `generateAudio`／`preserveClipAudio`／`grokVideoVoice`：供應商支援時請求原生片段音訊（Seedance `with_audio`；gctoac 1.7+ `voices[]` → `reference_to_video`，不再使用片頭鎖定）。匯出可保留片段音訊。Grok 忽略 `last_frame`；嚴格連續的片尾約束依賴 Seedance。

同一欄位可放在 `mediaGen:extract`／`generateImage` payload 或設定。`channels describe` 會顯示 `argsHint`。

## 桌面頁面

| 路由 | 頁面 |
|------|------|
| `/` | Stories（章節 + 劇情段落） |
| `/characters` | Characters（+ SoulMD Hub、參考 sheet） |
| `/costumes` | Costumes（試穿雙寫多圖庫） |
| `/scenes` | Scenes |
| `/props` | Props |
| `/actions` | Actions（動作指導圖） |
| `/comics` | 漫畫工作室 |
| `/key-art` | 劇照桌 |
| `/timeline` | Timeline + Advanced prep（連續性 + 精修） |
| `/timeline-v2` | Timeline v2 工作室 |
| `/audit` | 活動日誌 |
| `/settings` | 設定 |

資產 AI fill 可用 `suggestFromStory` + `segmentKeys` 注入劇情（`chapter:<id>`／`beat:<id>`；空 = 成個故事，章節優先）。CLI 同一 payload。

## 生成管線

```text
章節 → Cast（generateCast）→ 劇情段落 → 角色／場景／道具／動作
  → Timeline → Video（6|10s）→ Export
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
