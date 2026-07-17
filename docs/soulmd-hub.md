# SoulMD Hub 整合

**站點**：https://soulmd-hub.ysk.hk  
**API 文檔**：https://soulmd-hub.ysk.hk/api-docs  

InstantDrama 人物頁用公開 API 選 soul（唔登入、唔 fork 到帳號）。

## 使用的端點

| 用途 | Path |
|------|------|
| 列表 | `GET /api/souls?page=&limit=&is_nft=0` |
| 搜尋 | `GET /api/souls?q=&limit=`（輔以本地索引） |
| 分類 | `GET /api/categories` |
| 詳情 | `GET /api/soul/{id}`（**單數** soul） |

## 50 頁快速建議

App 會拉 `page=1…50`（limit=12）建本地索引（`userData/cache/soulmd-index.json`），用於：

- 搜尋框 **suggestion chips**（role / domain / title）
- 本地 filter（Hub `q` 不穩時仍可用）

## 與角色表單

選 soul → 填 `name` / `description` / `soulMdPath=soulmd-hub://{id}` / `soulHubId`；  
`content`（single_md 或 full_soul_folder）可作預覽，再配合 **AI 萬能 Prompt** 結構化欄位。

## 多角度圖

見人物頁「生成多角度參考圖」— 走 Grok Gateway `POST /v1/images/generations`（需 `imagesApi`）。
