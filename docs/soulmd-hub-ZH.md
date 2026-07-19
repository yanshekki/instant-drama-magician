# SoulMD Hub 整合

> **語言：** [English](./soulmd-hub.md) · [中文](./soulmd-hub-ZH.md)

**站點：** https://soulmd-hub.ysk.hk  
**API 文檔：** https://soulmd-hub.ysk.hk/api-docs  

人物頁用公開 API 選 soul（不登入、不 fork 到帳號）。

## 使用的端點

| 用途 | Path |
|------|------|
| 列表 | `GET /api/souls?page=&limit=&is_nft=0` |
| 搜尋 | `GET /api/souls?q=&limit=`（+ 本地索引） |
| 分類 | `GET /api/categories` |
| 詳情 | `GET /api/soul/{id}`（**單數** soul） |

## 50 頁快速建議

App 拉 `page=1…50`（limit=12）到 `userData/cache/soulmd-index.json`，用於：

- 搜尋 **suggestion chips**（role／domain／title）  
- Hub `q` 不穩時的本地 filter  

## 與角色表單

選 soul → 填 `name`／`description`／`soulMdPath=soulmd-hub://{id}`／`soulHubId`。  
`content`（single_md 或 full_soul_folder）可預覽，再配合 **AI 萬能 Prompt** 結構化欄位。

## 多角度圖

人物頁「生成多角度參考圖」— 走設定中的影像供應商（預設 Grok Gateway `POST /v1/images/generations`，需 `imagesApi`；亦可 Seedream 等）。

## 相關

- 截圖：[../README-ZH.md](../README-ZH.md) · [../README.md](../README.md)  
- 聯絡：[email@ysk.hk](mailto:email@ysk.hk)
