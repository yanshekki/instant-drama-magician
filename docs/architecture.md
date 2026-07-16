# Architecture — InstantDrama Magician

## Layers

```
Presentation (React, Konva, PreviewPlayer, Settings)
        ↓ IPC + idm-media:// protocol
Application (Services, GenerationPipeline)
        ↓
Domain (timeline, subtitle, soul parse)
        ↓
Infrastructure (Prisma, GrokCliClient, VideoProviders, FFmpeg, MediaStore, SettingsStore)
```

## Round 3 modules

| Module | Path |
|--------|------|
| SettingsStore | `src/infrastructure/settings/SettingsStore.ts` |
| CompositeVideoProvider | `src/infrastructure/ai/video/*` |
| exportFinal | `FfmpegService.exportFinal` + `buildSrt` |
| PreviewPlayer | `idm-media://` protocol + `<video>` |
| soul URL import | `characters:importSoulMdUrl` |

## Pipeline

Script → Character → Scene → Props → Timeline → **Video** → Export

Video uses `settings.videoMode`: auto | http | stub.

## Media protocol

`idm-media://local/?p=<encodeURIComponent(absPath)>` — registered in Electron main for safe preview.

## Verification

```bash
npm run typecheck && npm test && npm run build && npm run pack
```

See also [video-providers.md](./video-providers.md).
