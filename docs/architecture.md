# Architecture — InstantDrama Magician

## Layers

```
Presentation (React, Konva, Preview, Settings, Undo snapshots)
        ↓ IPC + idm-media:// (path allowlist)
Application (Services, Pipeline, ProjectBackup)
        ↓
Domain (timeline, snap, subtitle, soul)
        ↓
Infrastructure (Prisma, Video providers+retry/jobs, FFmpeg, TTS, MediaStore, Settings)
```

## Round 4

| Module | Notes |
|--------|--------|
| GrokHttpVideoProvider | job poll, retry, mock tests |
| VideoStep | concurrent mapPool |
| BGM + TTS | settings + exportFinal mix |
| snapTime | Konva drag end |
| ProjectBackupService | jszip export/import |
| CI | `.github/workflows/ci.yml` |

## Security

`idm-media://` only serves files under `{userData}/media/`.

## Verify

```bash
npm run typecheck && npm test && npm run build && npm run pack
```
