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

## Round 9 — Release Candidate

| Module | Role |
|--------|------|
| exportLayout | aspect → frame size, xfade chain, duck expression |
| exportFinal | fade/cut transitions, aspect-aware, BGM ducking |
| app:getInfo | version / packaged / userData / mediaRoot |
| release.yml | tag `v*` → AppImage + deb (unsigned RC) |

## Round 10 — Commercial path

| Module | Role |
|--------|------|
| AppUpdateService | electron-updater → GitHub Releases |
| ActivityLog | userData JSONL for support |
| SupportReport | redacted diagnostics export |
| release.yml | linux + windows + macos matrix |

## Round 11 — Grok Gateway LLM first

| Module | Role |
|--------|------|
| gatewayDefaults | :3847 base + migrate :39281 |
| GrokCliClient | listModels, probeChat, testChat |
| Settings | Grok Gateway card (primary LLM) |

## Pipeline

Script → Character → Scene → Props → Timeline → **Video** (6/10s jobs) → Export  

Retry-failed path: **Video only**.

## Docs

- [grok-gateway.md](./grok-gateway.md)  
- [video-providers.md](./video-providers.md)  
- [production-ux.md](./production-ux.md)  
- [beta.md](./beta.md)  
- [release.md](./release.md)  
