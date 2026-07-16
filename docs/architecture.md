# Architecture — InstantDrama Magician

## Layers

```
Presentation (React pages, hooks, Konva timeline)
        ↓ IPC (preload bridge)
Application (Services, GenerationPipeline, TimelineService)
        ↓
Domain (pure rules: story / character / scene / timeline / layout)
        ↓
Infrastructure (Prisma, GrokCliClient, FfmpegService, MediaStore)
```

## Round 2 modules

| Module | Path | Role |
|--------|------|------|
| MediaStore | `src/infrastructure/media/MediaStore.ts` | clip/export paths under userData |
| VideoStep | `src/application/steps/VideoStep.ts` | per-clip generateVideo (+ stub) |
| FfmpegService | `exportConcat` / `makeColorClip` | real concat + fallback segments |
| KonvaTimeline | `src/presentation/components/timeline/KonvaTimeline.tsx` | zoom, playhead, drag/resize |
| soul.md parse | `parseSoulMd` in domain/character | frontmatter + tags preview |

## Generation pipeline

1. ScriptStep → Scene.script  
2. CharacterStep  
3. SceneStep  
4. PropsStep  
5. TimelineStep (suggest if empty)  
6. **VideoStep** → mediaPath / mediaStatus  
7. ExportStep → FFmpeg concat (media files or color fallback)

### Env

| Variable | Default | Meaning |
|----------|---------|---------|
| `GROK_CLI_BASE_URL` | `http://127.0.0.1:39281/v1` | Chat API |
| `GROK_VIDEO_ENABLED` | `1` | Enable video step |
| `GROK_VIDEO_STUB` | `1` | ffmpeg color stub if no video API |
| `GROK_CLI_VIDEO_PATH` | `{base}/video/generations` | Optional real endpoint |
| `FFMPEG_PATH` | `ffmpeg` | Binary |

## Timeline media status

`EMPTY | QUEUED | GENERATING | READY | FAILED` on `TimelineEntry`.

## Success criteria checklist

- [x] Type-safe TypeScript strict  
- [x] Modular clean architecture  
- [x] Independent creation pages  
- [x] Timeline cross-references + Konva UX  
- [x] i18n zh-HK + en  
- [x] Grok CLI chat + optional video  
- [x] FFmpeg concat export MVP  
- [x] Domain + media path unit tests  

## Release smoke

```bash
npm run typecheck && npm test && npm run build
npm run pack   # electron-builder --dir
```
