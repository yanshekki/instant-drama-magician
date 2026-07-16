# Architecture — InstantDrama Magician

## Layers

```
Presentation (React pages, hooks, timeline UI)
        ↓ IPC (preload bridge)
Application (Services, GenerationPipeline, TimelineService)
        ↓
Domain (pure rules: story / character / scene / timeline)
        ↓
Infrastructure (Prisma, GrokCliClient, FfmpegService)
```

## Main process services

| Service | Responsibility |
|---------|----------------|
| `StoryService` | Story CRUD + validation |
| `CharacterService` | Characters + soul.md path |
| `SceneService` | Scenes + status |
| `PropService` | Props |
| `TimelinePersistenceService` | Timeline entries + reorder + clamp |
| `GenerationService` | Pipeline orchestration + export |

## Generation pipeline

1. **ScriptStep** — AI (or offline seed) → writes `Scene.script`
2. **CharacterStep** — character bible
3. **SceneStep** — visual beats
4. **PropsStep** — continuity notes
5. **TimelineStep** — suggest linear clips if empty (≤ max AI clip seconds)
6. **ExportStep** — FFmpeg storyboard MP4

## Timeline rules

- Linear single track (gaps allowed)
- Default max clip: **10s** (`DEFAULT_MAX_CLIP_SECONDS`)
- Drag / resize / library drop in Presentation

## AI

Grok CLI OpenAI-compatible wrapper (default `http://127.0.0.1:39281/v1`).  
See: https://github.com/yanshekki/Grok-Cli-to-OpenAI-compatible

## Media

- User data: `{userData}/media/{storyId}/exports/`
- FFmpeg required for export (`FFMPEG_PATH` override supported)

## Success criteria checklist

- [x] Type-safe TypeScript strict
- [x] Modular clean architecture
- [x] Independent creation pages
- [x] Timeline cross-references assets
- [x] i18n zh-HK + en
- [x] Grok CLI integration
- [x] FFmpeg export MVP
