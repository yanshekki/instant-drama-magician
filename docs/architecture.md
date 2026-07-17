# Architecture — InstantDrama Magician

## Layers

Presentation → IPC / `idm-media://` → Application → Domain → Infrastructure

## Round 5

| Module | Role |
|--------|------|
| GrokHttpVideoProvider | OpenAI `/v1/videos` create/poll/content + document upload for ref |
| snapVideoSeconds | Map clip length → 6 \| 10 |
| videoJobId | TimelineEntry + progress UI |
| useTimelineHistory | Persistent undo/redo via IPC |

## Round 8 — Production UX

| Module | Role |
|--------|------|
| generateClip + cancel | AbortController for single-clip jobs |
| onlyFailedVideos | Pipeline runs **video** step only |
| buildAudioMixFilter | BGM + timed dialogue TTS stems |
| buildClipPrompt / previousClipContext | Style bible + continuity |
| Story.styleNote | Per-story visual tone note |
| openExportFolder | Reveal export after save |

## Pipeline

Script → Character → Scene → Props → Timeline → **Video** (6/10s jobs) → Export  

Retry-failed path: **Video only**.

## Docs

- [grok-gateway.md](./grok-gateway.md)  
- [video-providers.md](./video-providers.md)  
- [production-ux.md](./production-ux.md)  
- [beta.md](./beta.md)  
- [release.md](./release.md)  
