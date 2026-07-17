# Connect InstantDrama Magician ↔ Grok-Cli-to-OpenAI-compatible

## Gateway (read-only reference)

Repo (local example): `/home/ki/文件/Grok-Cli-to-OpenAI-compatible`

### Videos API (OpenAI-style)

| Method | Path | Body / notes |
|--------|------|----------------|
| `POST` | `/v1/videos` | `{ prompt, model?, seconds: 6\|10, aspect_ratio?, source_asset_id?, source_document_id? }` |
| `GET` | `/v1/videos/:id` | Job status: `queued` → `in_progress` → `completed` / `failed` |
| `GET` | `/v1/videos/:id/content` | Binary video bytes |

Requires:

- Feature flag **videoApi** enabled in Admin → API features  
- API key **agent** or **admin** mode  

Optional image_to_video:

- Upload image via `POST /v1/documents` (multipart `file`)  
- Pass returned document id as `source_document_id`  
- InstantDrama does this automatically when Character has `refImagePath`

## InstantDrama Settings

1. Start gateway (e.g. port **39281**)  
2. App → **Settings**  
3. `baseUrl` = `http://127.0.0.1:39281/v1`  
4. `videoPath` = `http://127.0.0.1:39281/v1/videos`  
5. Paste API key  
6. `videoMode` = `http` (or `auto`)  
7. **Probe video** should report gateway online  
8. Timeline → create clips with duration near **6 or 10s** (app snaps automatically)  
9. **Generate**

## Fallback

- `videoMode=stub` or HTTP failure → FFmpeg color stub (`degraded`)  
- Chat still uses `/v1/chat/completions`

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| VIDEO_FEATURE_OFF | Admin → API features → enable **videoApi** |
| VIDEO_KEY_MODE / 403 | Use **agent** or **admin** API key |
| VIDEO_UNAUTHORIZED / 401 | Check key in InstantDrama Settings |
| VIDEO_TIMEOUT | Raise `videoTimeoutSec`; check job queue |
| VIDEO_RATE_LIMIT / 429 | Lower `videoConcurrency`; wait |
| ffmpeg fail | Install ffmpeg; Settings shows status |

Settings → **檢測 Chat + Video** runs full diagnostics.
