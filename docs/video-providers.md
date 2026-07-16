# Video providers

## Modes

| Mode | Behavior |
|------|----------|
| `auto` | Probe gateway; on failure use FFmpeg stub |
| `http` | Always OpenAI-style `/v1/videos` |
| `stub` | Color clips only |

## Grok CLI OpenAI Videos (primary)

Aligned with **Grok-Cli-to-OpenAI-compatible**:

1. `POST {baseUrl}/videos` with `seconds` **6 or 10**  
2. Poll `GET {baseUrl}/videos/{id}` until `completed`  
3. Download `GET {baseUrl}/videos/{id}/content` → local clip path  

Optional:

- `aspect_ratio` (settings, default `16:9`)  
- `source_document_id` after uploading Character ref image to `/v1/documents`  

See [grok-gateway.md](./grok-gateway.md).

## Duration snap

`snapVideoSeconds(d)`: `d >= 8 → 10`, else `6` (matches gateway).

## Settings knobs

| Key | Default |
|-----|---------|
| videoPollMs | 2000 |
| videoTimeoutSec | 300 |
| videoMaxRetries | 3 |
| videoConcurrency | 1 |
| aspectRatio | 16:9 |
