# 媒體生成路徑棄用說明

> **語言：** [English](./media-gen-deprecations.md) · [中文](./media-gen-deprecations-ZH.md)

**正式介面**只走同一條殼：

1. `mediaGen:extract` → 材料  
2. `mediaGen:polish` → prompt（先圖，再影片階段）  
3. `mediaGen:generateImage` → 靜圖／關鍵幀  
4. `videoPrep:confirm` → 成片（當 kind 為影片）

## 未掛載的 UI

| 元件 | 狀態 |
|------|------|
| `MediaGenHost` | **已掛載**於 `Layout` |
| `VideoPrepHost`／`VideoPrepModal` | **未掛載** — 僅單元測試 |

`startVideoPrep` 與草稿 **繼續** 會開啟 MediaGen（同一套草稿鍵）。

## 已棄用但仍註冊的 IPC（CLI／測試）

新程式請用 mediaGen。以下 channel 保留至未來 major：

- `characters:generateSheet`
- `characters:generateIntroVideo`
- `characters:swapCostume`
- `scenes:generatePlate`／`generateIntroVideo`／`swapAtmosphere`
- `props:generatePlate`／`generateIntroVideo`
- `actions:generatePlate`／`generateIntroVideo`
- `costumes:generateIntroVideo`

## 仍然是一等公民

- `characters:commitSheet`、`scenes:commitPlate`、`props:commitPlate` …
- `videoPrep:create` 加 `stillOnly`（進階工作室批次靜圖）
- `videoPrep:confirm`（由 MediaGen 出片）
- `mediaGen:*`

見 `src/runtime/channelManifest.ts`（規格上 `deprecated: true`）。
