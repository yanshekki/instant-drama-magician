# InstantDrama ↔ OpenAI-compatible LLM

> **Language:** [English](./grok-gateway.md) · [中文](./grok-gateway-ZH.md)

The app uses one **OpenAI-compatible** client (`/v1/models` · `/v1/chat/completions`).  
Pick an endpoint via Settings **provider preset**:

| Preset | Base URL example | Key |
|--------|------------------|-----|
| **Grok CLI Gateway** (default) | `http://127.0.0.1:3847/v1` | `gk_live_…` |
| **OpenAI** | `https://api.openai.com/v1` | `sk-…` |
| **Kimi / others** | See Settings catalog | Vendor key |
| **Custom** | Any | Any Bearer |

Local default aligns with [Grok-Cli-to-OpenAI-compatible](https://github.com/yanshekki/Grok-Cli-to-OpenAI-compatible) · port **`3847`**.  
Full image/video providers (Seedance/Seedream…): [video-providers.md](./video-providers.md).

## 1. LLM (Chat)

| Method | Path | Use |
|--------|------|-----|
| `GET` | `/v1/models` | List models |
| `POST` | `/v1/chat/completions` | Script / character / scene pipeline |

### Managed gateway wiring

InstantDrama vendors `grok-cli-to-openai-compatible` (`gctoac`):

1. System needs **Grok Build** CLI (`grok`) when using managed start.  
2. With **Grok local gateway** selected, the app can **auto** `setup`/`start` on port **3847**.  
3. Each `ensureRunning` applies the InstantDrama gateway preset (`IDM_GATEWAY_PRESET`): images/video/vision/tools/chat on; high rate limits; keys rate-capped safely.  
4. Admin: `http://127.0.0.1:3847/admin/`  
5. Settings → chat model → Grok local gateway → refresh models → **Test Chat**  
6. Timeline **Generate** runs real LLM steps  

Debug: `npx gctoac doctor` · `npx gctoac status`.

### Chat body / `strictSampling`

Grok Gateway locked presets **forbid** `temperature`/`top_p`/`stop` (HTTP 400). InstantDrama **omits** them for the Grok preset. OpenAI preset still sends temperature.

### Chat errors

| Symptom | Action |
|---------|--------|
| AI_UNAVAILABLE | Start gateway; check port 3847 |
| AI_UNAUTHORIZED / 401 | Correct `gk_live_` key |
| AI_RATE_LIMIT / 429 | Ensure gateway preset; may be upstream xAI limits |
| timeout | Raise `chatTimeoutMs` |

## 2. Video (same Gateway)

| Method | Path |
|--------|------|
| `POST` | `/v1/videos` · `{ prompt, seconds: 6\|10, … }` |
| `GET` | `/v1/videos/:id` |
| `GET` | `/v1/videos/:id/content` |

Enable **videoApi** in gateway admin. Clip length snaps to **6 or 10** only.

## Related

- [video-providers.md](./video-providers.md) · [cli.md](./cli.md) · Contact [email@ysk.hk](mailto:email@ysk.hk)
