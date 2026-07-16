# Video providers

InstantDrama Magician supports pluggable video generation modes.

## Modes (`settings.videoMode`)

| Mode | Behavior |
|------|----------|
| `auto` (default) | Probe HTTP video endpoint; on failure use FFmpeg **stub** color clips (`degraded`) |
| `http` | Always call `videoPath` HTTP API |
| `stub` | Always FFmpeg solid-color placeholder clips |

Configure in-app: **Settings** sidebar page, or edit `userData/settings.json`.

## HTTP contract (Grok / OpenAI-compatible style)

`POST {videoPath}`

```json
{
  "model": "grok-cli",
  "prompt": "...",
  "duration": 5,
  "ref_image": "/optional/path.png",
  "output_path": "/absolute/path/clip.mp4"
}
```

Accepted responses:

1. **JSON** `{ "output_path": "..." }` or `{ "path": "..." }` or `{ "url": "https://..." }`  
2. **Binary** `video/mp4` body written to `output_path`

Headers: `Authorization: Bearer {apiKey}`

## Env defaults (overridden by settings file after first save)

| Variable | Default |
|----------|---------|
| `GROK_CLI_BASE_URL` | `http://127.0.0.1:39281/v1` |
| Video path | `{baseUrl}/video/generations` |

## Export final

`media:exportFinal` / Timeline **Export final**:

- Concat READY clips (fallback color segments if missing)
- Optional burn-in SRT from dialogue
- Optional silent AAC track
- Profiles: `fast` (CRF 28), `balanced` (CRF 23)
