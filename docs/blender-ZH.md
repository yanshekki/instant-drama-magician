# Blender 外掛 — 空間交換包客戶端

> **Language:** [English](./blender.md) · [中文](./blender-ZH.md)

InstantDrama Magician **不會**把 Blender 嵌進桌面應用。成片仍先經 `mediaGen` 分鏡靜圖，再走現有圖生影片（`videoPrep:confirm`）。Blender 與內建走位台一樣，只是 `spatial:*` 通道的客戶端。

## 外掛做什麼

`blender/idm_spatial/` 讀寫 **`idm-spatial-package`** 目錄：

- `manifest.json` — 拍／故事 ID、綁定、走位、相機、時長
- `identity/` — 臉、戲服、場景、道具靜圖複本
- `spatial/` — 白模 PNG playblast
- `mesh/` — 可選貼圖平面 glTF 代理（不是成品綁骨或布料）

不要把 `.blend` 當庫內主檔。

## 安裝

1. Blender 3.6 或以上（4.2 以上可把資料夾當擴充安裝）
2. 編輯 → 偏好設定 → 外掛 → 從磁碟安裝 → 選 `blender/idm_spatial` 資料夾
3. 啟用 **InstantDrama Spatial**
4. 設定 **instant-drama CLI**（預設 `PATH` 上的 `instant-drama`）及可選 **IDM 資料目錄**（`--data-dir`／`IDM_DATA_DIR`）

`spatial:blenderStatus` 只回報本機是否找得到 Blender 執行檔。外掛經命令列呼叫 InstantDrama，不會載入桌面應用。

## 典型流程

```bash
instant-drama spatial compile-beat --args '[{"storyId":"S","entryId":"E"}]' --json --local
# 或
instant-drama invoke spatial:compileBeat --args '[{"storyId":"S","entryId":"E","destDir":"/tmp/idm-pkg"}]' --json --local
```

在 3D 視圖側欄（**IDM**）：

1. 填寫 **Story ID** 與 **Beat / entry ID**
2. **Compile beat from InstantDrama** — 產生名為 `IDM|<kind>|<id>` 的空物件與相機
3. 在 Blender 走位，可選 OpenGL 輸出 PNG
4. **Push blocking**／**OpenGL playblast PNG then attach** → `spatial:attachRef`
5. 可選 **Generate textured-plane glTF proxy**（`spatial:generateMesh`）— 道具與硬表面場景較穩；戲服仍是着裝靜圖，不承諾布料模擬

若已有匯出目錄，用 **Import spatial package directory**（`spatial:importPackage`）。

## 產品邊界（有意為之）

- 白模靜圖約束分鏡靜圖的**位置與機位**。身份靜圖管臉。
- 以白模作圖生影片首幀須明示勾選，且**臉部鎖定較弱**。
- 現行影片供應商無法一次吞「白模影片 + 多張身份圖」。第一期不要把 playblast 影片當第二路影片參考。
- 代理網格只服務走位台／Blender，不是預設成片。

payload 請用 `channels describe spatial:compileBeat`。此處不羅列全部 channel。
