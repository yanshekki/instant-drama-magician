# Video providers

## Modes

| Mode | Behavior |
|------|----------|
| `auto` | Probe HTTP; fallback to FFmpeg stub |
| `http` | Always HTTP (`videoPath`) |
| `stub` | Color clips only |

## HTTP POST body

```json
{
  "model": "grok-cli",
  "prompt": "...",
  "duration": 5,
  "ref_image": null,
  "output_path": "/abs/path.mp4"
}
```

## Responses (all supported)

1. JSON immediate: `{ "output_path" }`, `{ "path" }`, `{ "url" }` / `{ "output_url" }`
2. Binary `video/*` body
3. **Async job**: `{ "job_id", "status_url" }` or `{ "id" }` → poll until `status` is `succeeded|completed|ready`

## Client settings

| Setting | Default | Meaning |
|---------|---------|---------|
| `videoPollMs` | 2000 | Job poll interval |
| `videoTimeoutSec` | 300 | Max wait |
| `videoMaxRetries` | 3 | Retry on 429/5xx/network |
| `videoConcurrency` | 1 | Parallel clip gens |

## Retry

Exponential backoff with jitter on retryable errors.
