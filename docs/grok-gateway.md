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

### 快速接線

1. 啟動 Gateway：`gctoac start` → `http://127.0.0.1:3847`  
2. Admin：`http://127.0.0.1:3847/admin/` → **Keys** 建立 **`gk_live_…`**  
3. InstantDrama → **設定 → Grok Gateway（LLM 首選）**  
   - Base URL：`http://127.0.0.1:3847/v1`（可按「套用官方預設」）  
   - 貼上 API Key  
   - **刷新模型列表** → 選 model  
   - **測試 Chat** 應回 OK  
4. 時間軸 **開始生成** → Script 等步驟走真 LLM  

### Chat 錯誤對照

| 症狀 | 處理 |
|------|------|
| AI_UNAVAILABLE / 連線失敗 | `gctoac start`；檢查 port 3847 |
| AI_UNAUTHORIZED / 401 | 貼正確 `gk_live_` key |
| AI_KEY_MODE / 403 | Admin 檢查 key 模式 |
| AI_RATE_LIMIT / 429 | 等一下；查 Gateway 限流／佇列 |
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
