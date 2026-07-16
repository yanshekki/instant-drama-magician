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

## Pipeline

Script → Character → Scene → Props → Timeline → **Video** (6/10s jobs) → Export

## Docs

- [grok-gateway.md](./grok-gateway.md)  
- [video-providers.md](./video-providers.md)  
- [release.md](./release.md)  
