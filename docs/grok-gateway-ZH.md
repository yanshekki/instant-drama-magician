# InstantDrama ↔ OpenAI-compatible LLM

> **語言：** [English](./grok-gateway.md) · [中文](./grok-gateway-ZH.md)

App 使用同一套 **OpenAI-compatible** 客戶端（`/v1/models` · `/v1/chat/completions`）。  
在設定的 **供應商 preset** 選擇端點：

| Preset | Base URL 例 | Key |
|--------|-------------|-----|
| **Grok CLI Gateway**（預設） | `http://127.0.0.1:3847/v1` | `gk_live_…` |
| **OpenAI** | `https://api.openai.com/v1` | `sk-…` |
| **Kimi 等** | 見設定目錄 | 各家 key |
| **Custom** | 任意 | 任意 Bearer |

本機預設對齊 [Grok-Cli-to-OpenAI-compatible](https://github.com/yanshekki/Grok-Cli-to-OpenAI-compatible) · 埠 **`3847`**。  
完整影像／影片（Seedance／Seedream…）：[video-providers-ZH.md](./video-providers-ZH.md)。

## 1. LLM（Chat）

| Method | Path | 用途 |
|--------|------|------|
| `GET` | `/v1/models` | 列模型 |
| `POST` | `/v1/chat/completions` | 劇本／人物／場景等 pipeline |

### 由 App 代管閘道

InstantDrama 內建 `grok-cli-to-openai-compatible`（`gctoac`）：

1. 使用代管啟動時系統需 **Grok Build** CLI（`grok`）。  
2. 選 **Grok 本機閘道** 後，app 可 **自動** `setup`／`start` 埠 **3847**。  
3. 每次 `ensureRunning` 套用 InstantDrama gateway preset（影像／影片／vision／tools／chat 等）。  
4. Admin：`http://127.0.0.1:3847/admin/`  
5. 設定 → 對話模型 → Grok 本機閘道 → 刷新模型 → **測試 Chat**  
6. 時間軸 **開始生成** 走真 LLM  

除錯：`npx gctoac doctor` · `npx gctoac status`。

### Chat body／`strictSampling`

Grok Gateway locked preset **禁止** `temperature`／`top_p`／`stop`（HTTP 400）。InstantDrama 對 Grok preset **省略** 這些欄位。OpenAI preset 仍送 temperature。

### Chat 錯誤

| 症狀 | 處理 |
|------|------|
| AI_UNAVAILABLE | 開閘道；檢查 3847（`gctoac start`／`gctoac start --pm2`） |
| AI_UNAUTHORIZED／401 | 正確 `gk_live_` key |
| AI_RATE_LIMIT／429 | 確認 preset；可能是上游限流 |
| timeout | 加大 `chatTimeoutMs` |
| 502 · Grok CLI exited | 多為 **vision** 或 CLI 崩潰：確認 Gateway 版本支援 ACP 圖塊（`type:image` + `data` + `mimeType`）；大圖由 app 自動壓細 |
| 無法讀取參考圖 | 外部圖路徑失效：重新匯入靜圖 |

### Vision（外部圖 → AI 填寫）

- OpenAI 格式：`{ type: "image_url", image_url: { url: "data:image/…;base64,…" } }`  
- Grok CLI 需要 ACP：`{ type: "image", data, mimeType }`  
- InstantDrama 對 **grok-gateway** 會自動 rewrite；Gateway `buildPromptJson` 亦應正確轉換 data URL。  
- **BODY_LIMIT** 建議 ≥ `10mb`（`~/.gctoac/.env`）；預設 1mb 可能卡住大 data URL。  
- App 會將長邊 >1024 或過大 PNG 壓成 JPEG，避免 `grok --prompt-json` **E2BIG**。  
- 失敗時 chat 會 **ensureRunning 一次再重試**（僅本機 Grok preset）。

### 執行路徑（避免雙份 Gateway）

| 項目 | 說明 |
|------|------|
| 建議 | 全機只用 **一個** 運行中的 gctoac（PM2 或 detached） |
| 檢查 | `gctoac status` · `pm2 show grok-openai-gateway` |
| 埠 | 預設 **3847**；Admin `http://127.0.0.1:3847/admin/` |

## 2. Video（同一 Gateway）

| Method | Path |
|--------|------|
| `POST` | `/v1/videos` · `{ prompt, seconds: 6\|10, … }` |
| `GET` | `/v1/videos/:id` |
| `GET` | `/v1/videos/:id/content` |

Admin 需開 **videoApi**。Clip 時長僅 **6 或 10** 秒。

## 相關

- [video-providers-ZH.md](./video-providers-ZH.md) · [cli-ZH.md](./cli-ZH.md) · 聯絡 [email@ysk.hk](mailto:email@ysk.hk)
