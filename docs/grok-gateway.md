# InstantDrama ↔ OpenAI-compatible LLM

App 用 **同一套** OpenAI-compatible 客戶端（`/v1/models` · `/v1/chat/completions`）。  
用 Settings 的 **供應商 preset** 揀 endpoint：

| Preset | Base URL 例 | Key |
|--------|-------------|-----|
| **Grok CLI Gateway**（預設） | `http://127.0.0.1:3847/v1` | `gk_live_…` |
| **OpenAI** | `https://api.openai.com/v1` | `sk-…` |
| **Custom** | 任意 | 任意 Bearer |

本機預設對齊：[Grok-Cli-to-OpenAI-compatible](https://github.com/yanshekki/Grok-Cli-to-OpenAI-compatible) · port **`3847`**

---

## 1. LLM（Chat）

| Method | Path | 用途 |
|--------|------|------|
| `GET` | `/v1/models` | 列模型（Settings 下拉） |
| `POST` | `/v1/chat/completions` | 劇本／人物／場景等 pipeline |

### 快速接線（App 代管閘道）

InstantDrama **已內建** `grok-cli-to-openai-compatible`（`gctoac`）：

1. 系統需安裝 **Grok Build** CLI（指令 `grok`）。未安裝時設定頁會提示並可開啟安裝說明。  
2. 選 **Grok 本機閘道** 後，app 會 **自動** `setup`／`start` 閘道（port **3847**），**唔使**人手 `gctoac start`。  
3. **每次** `ensureRunning`／開閘道，app 會重套 **InstantDrama gateway preset**（`IDM_GATEWAY_PRESET`）：
   - API features：images / video / vision / tools / chat 全開  
   - DDoS rate：全域／IP 上限（約 10 萬／分）、auto-ban 關  
   - 所有 API key → rate **10000**（gctoac 上限；**唔好用 0**，express-rate-limit v7 會擋晒）  
   - Queue 高並發、settings global-safe off  
   - 寫入 `~/.gctoac/.env` 開機預設  
4. Admin：`http://127.0.0.1:3847/admin/`（一般唔使人手改限流）  
5. InstantDrama → **設定 → 對話模型 → Grok 本機閘道**  
   - Key 由 app 自動建立／接線  
   - **刷新模型列表** → 選 model  
   - **測試 Chat** 應回 OK  
6. 時間軸 **開始生成** → Script 等步驟走真 LLM  

手動除錯仍可用：`npx gctoac doctor` · `npx gctoac status`。

### Chat body 同 `strictSampling`（重要）

Gateway 契約（`chat.dto` + `grok-request-builder`）：

| 欄位 | 預設 features | `strictSampling: true`（locked preset） |
|------|---------------|------------------------------------------|
| `messages`, `model` | ✅ | ✅ |
| `max_tokens` | ✅ | ✅ |
| `temperature` / `top_p` / `stop` | 可送（會被忽略） | **禁止出現** → HTTP 400 |

InstantDrama **Grok CLI Gateway preset** 會 **omit** temperature/top_p/stop，以兼容 locked Gateway。  
OpenAI preset 仍會送 temperature。

### Chat 錯誤對照

| 症狀 | 處理 |
|------|------|
| AI_UNAVAILABLE / 連線失敗 | `gctoac start`；檢查 port 3847 |
| AI_UNAUTHORIZED / 401 | 貼正確 `gk_live_` key |
| AI_KEY_MODE / 403 | Admin 檢查 key 模式 |
| AI_RATE_LIMIT / 429 | 先確認 app 已 ensure 閘道（會重套 max preset）；若仍 429 可能是 **xAI 上游** 限流 |
| Sampling parameters / strictSampling | 用最新 app（Grok 已 omit）；或 Admin 關 strictSampling |
| timeout | 加大 `chatTimeoutMs`；查 chat 佇列 |

---

## 2. Video（同一 Gateway）

| Method | Path | 說明 |
|--------|------|------|
| `POST` | `/v1/videos` | `{ prompt, seconds: 6\|10, aspect_ratio?, source_document_id? }` |
| `GET` | `/v1/videos/:id` | job 狀態 |
| `GET` | `/v1/videos/:id/content` | 下載 mp4 |

需要：

- Admin → API features → **videoApi**  
- Key 模式 **agent** 或 **admin**  

設定：

- `videoPath` = `http://127.0.0.1:3847/v1/videos`  
- `videoMode` = `http` 或 `auto`  

人物 **參考圖** → 上傳 `/v1/documents` → `source_document_id`（app 自動）。

### Video 錯誤

見 Settings 診斷；常見：`VIDEO_FEATURE_OFF`、`VIDEO_KEY_MODE`、`VIDEO_TIMEOUT`。

---

## 3. Fallback

- Chat offline → pipeline 降級 placeholder（degraded）  
- Video fail / stub → FFmpeg 色塊占位  

---

## 4. 舊 port 遷移

早期 InstantDrama 預設 **39281**。Round 11 起預設 **3847**。  
若 settings 仍精確等於舊預設 URL，載入時會自動遷移並寫回。

---

## 5. 健康檢查

- Gateway：`GET http://127.0.0.1:3847/health`  
- App：Settings → **檢測 Chat + Video** / **測試 Chat**
