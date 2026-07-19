# Beta trial notes (Round 7)

> **Language:** [English](./beta.md) · [中文](./beta-ZH.md)

## System requirements

- Node 20+ (development)  
- **FFmpeg:** `ffmpeg-static` or `FFMPEG_PATH`  
- Optional: local [Grok gateway](./grok-gateway.md) for real video  

## 5-minute path

1. `npm run dev`  
2. First dialog or Stories → **Load demo story**  
3. Timeline: pick **6s / 10s**  
4. **Generate this clip** or full **Generate**  
5. **Export** (preflight may warn about fallback)  

## stub vs live

| Mode | Result |
|------|--------|
| `stub` / auto degrade | Purple placeholder mp4 |
| `http` + gateway videoApi | `/v1/videos` job → content |

Sidebar shows `Video: stub|http|auto`.

## Known limits (Beta era)

- Non-store-signed packages  
- TTS / BGM quality limited (Round 8 added mix path)  
- Single-track timeline  
- Real film quality depends on gateway `MEDIA_PROVIDER`  

Production UX: [production-ux.md](./production-ux.md). Current shipping: [commercial.md](./commercial.md).

## Packaging

```bash
npm run pack
# → release/linux-unpacked
```
