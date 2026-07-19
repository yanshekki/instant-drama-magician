# 影片與影像供應商

> **語言：** [English](./video-providers.md) · [中文](./video-providers-ZH.md)

設定存於 userData／`IDM_DATA_DIR` 下的 `settings.json`。型別：`src/types/settings.ts`；preset：`src/domain/openaiCompatible.ts`。

## 影片模式（`videoMode`）

| 模式 | 行為 |
|------|------|
| `auto` | 優先真實 HTTP 影片；失敗回落 FFmpeg **stub** 色塊 |
| `http` | 一律使用設定的影片 HTTP 供應商 |
| `stub` | 僅色塊／佔位（無模型） |

## 影片供應商（`videoProvider`）

| 值 | 行為 |
|----|------|
| `same-as-llm` | 在能力允許時繼承 chat base URL／key |
| `stub` | 佔位 |
| `grok-gateway`／`custom`／具 `caps.video` 的 LLM preset | 支援處走 OpenAI 風格 `/v1/videos` |
| **`seedance`** | 字節／火山方舟 **Seedance** |

### Grok CLI OpenAI Videos

1. `POST {baseUrl}/videos`，`seconds` 為 **6 或 10**  
2. 輪詢 `GET {baseUrl}/videos/{id}` 至 `completed`  
3. 下載 `GET {baseUrl}/videos/{id}/content`  

可選：`aspect_ratio`（預設 `16:9`）、上傳角色 ref 後的 `source_document_id`。見 [grok-gateway-ZH.md](./grok-gateway-ZH.md)。

### Seedance（火山方舟／BytePlus）

- Base 例：`https://ark.cn-beijing.volces.com/api/v3`  
- 預設模型例：`doubao-seedance-1-0-pro`  
- 需方舟 API Key；**非** Grok `/v1/videos` 協定  

## 時長 snap

`snapVideoSeconds(d)`：`**d >= 8 → 10**`，否則 **`6`**。時間軸 AI clip 僅提供 6s／10s。

## 影像供應商（`imageProvider`）

| 值 | 行為 |
|----|------|
| `same-as-llm` | 能力允許時用 chat 端點 |
| 具 `caps.image` 的 LLM preset | 如 Grok gateway images |
| **`seedream`** | 方舟 Seedream（可與 Seedance 共用 key） |

預設 Seedream 模型例：`doubao-seedream-4-0`。

## LLM 對話 preset（`llmProvider`）

| Preset | 說明 |
|--------|------|
| `grok-gateway` | **預設** · `http://127.0.0.1:3847/v1` |
| `openai` | api.openai.com |
| `kimi` | Moonshot · 對話／劇本 |
| `xai` · `openrouter` · `groq` · `deepseek` · `mistral` · `together` · `google-openai` | 雲端 OpenAI-compatible |
| `ollama` · `lmstudio` | 本機（key 可選） |
| `custom` | 任意 base URL |

## 設定旋鈕

| 鍵 | 預設 | 含義 |
|----|------|------|
| `videoPollMs` | 2000 | 輪詢間隔 |
| `videoTimeoutSec` | 300 | 單 job 逾時 |
| `videoMaxRetries` | 3 | 重試 |
| `videoConcurrency` | 1 | 並行 |
| `aspectRatio` | `16:9` | 比例 |

另有：`burnSubtitles`、`ttsEnabled`、`bgmPath`、`duckRatio`、轉場 `cut`|`fade`。

## 診斷

- 設定 → **測試 Chat**／模型列表  
- `instant-drama ai status --json` · `instant-drama media check-ffmpeg --json`  
- 支援報告會遮罩 API key  

## 相關

- [grok-gateway-ZH.md](./grok-gateway-ZH.md) · [architecture-ZH.md](./architecture-ZH.md) · [../README-ZH.md](../README-ZH.md)
