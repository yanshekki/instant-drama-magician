# Video & image providers

> **Language:** [English](./video-providers.md) · [中文](./video-providers-ZH.md)

Settings live in `settings.json` under userData / `IDM_DATA_DIR`. Types: `src/types/settings.ts`, presets: `src/domain/openaiCompatible.ts`.

## Video mode (`videoMode`)

| Mode | Behavior |
|------|----------|
| `auto` | Prefer live HTTP video; on failure fall back to FFmpeg **stub** color clips |
| `http` | Always use configured video HTTP provider |
| `stub` | Color / placeholder clips only (no model) |

## Video provider (`videoProvider`)

| Value | Behavior |
|-------|----------|
| `same-as-llm` | Inherit chat base URL / key when capable |
| `stub` | Placeholders |
| `grok-gateway` / `custom` / LLM presets with `caps.video` | OpenAI-style `/v1/videos` where supported |
| **`seedance`** | ByteDance / Volcengine **Ark Seedance** |

### Grok CLI OpenAI Videos

1. `POST {baseUrl}/videos` with `seconds` **6 or 10**  
2. Poll `GET {baseUrl}/videos/{id}` until `completed`  
3. Download `GET {baseUrl}/videos/{id}/content`  

Optional: `aspect_ratio` (default `16:9`), `source_document_id` after uploading a character ref. See [grok-gateway.md](./grok-gateway.md).

### Seedance (Volcengine Ark / BytePlus)

- Base e.g. `https://ark.cn-beijing.volces.com/api/v3`  
- Default model example: `doubao-seedance-1-0-pro`  
- Requires Ark API key; **not** Grok `/v1/videos` protocol  

## Duration snap

`snapVideoSeconds(d)`: **`d >= 8 → 10`**, else **`6`**. Timeline UI only offers 6s / 10s for AI clips.

## Image provider (`imageProvider`)

| Value | Behavior |
|-------|----------|
| `same-as-llm` | Use chat endpoint when capable |
| LLM presets with `caps.image` | e.g. Grok gateway images |
| **`seedream`** | Ark Seedream (can share Ark key with Seedance) |

Default Seedream model example: `doubao-seedream-4-0`.

## LLM chat presets (`llmProvider`)

| Preset | Notes |
|--------|--------|
| `grok-gateway` | **Default** · `http://127.0.0.1:3847/v1` |
| `openai` | api.openai.com |
| `kimi` | Moonshot · chat/script |
| `xai` · `openrouter` · `groq` · `deepseek` · `mistral` · `together` · `google-openai` | Cloud OpenAI-compatible |
| `ollama` · `lmstudio` | Local (key optional) |
| `custom` | Any base URL |

## Settings knobs

| Key | Default | Meaning |
|-----|---------|---------|
| `videoPollMs` | 2000 | Job poll interval |
| `videoTimeoutSec` | 300 | Per-job timeout |
| `videoMaxRetries` | 3 | Retries |
| `videoConcurrency` | 1 | Parallel video jobs |
| `aspectRatio` | `16:9` | Aspect |

Also: `burnSubtitles`, `ttsEnabled`, `bgmPath`, `duckRatio`, transition `cut`|`fade`.

## Diagnostics

- Settings → **Test Chat** / model list  
- `idm ai status --json` · `idm media check-ffmpeg --json`  
- Support report redacts API keys  

## Related

- [grok-gateway.md](./grok-gateway.md) · [architecture.md](./architecture.md) · [../README.md](../README.md)
