# 瞬劇魔法師 · InstantDrama Magician

AI 專業短劇生成桌面工具（Electron + React + TypeScript + Prisma/SQLite）。

## Quick start

```bash
cd "/home/ki/文件/instant-drama-magician"
npm install
npx prisma db push
npm run dev
```

### Optional services

- **Grok CLI wrapper**: [Grok-Cli-to-OpenAI-compatible](https://github.com/yanshekki/Grok-Cli-to-OpenAI-compatible) on `:39281`
- **FFmpeg**: required for export (`FFMPEG_PATH` override supported)
- **Video stub** (default): `GROK_VIDEO_STUB=1` generates solid-color clips when no video API exists

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Electron + Vite |
| `npm run build` | Production bundle |
| `npm run typecheck` | Strict TS |
| `npm test` | Unit tests (vitest) |
| `npm run db:push` | SQLite schema |
| `npm run pack` / `dist` | electron-builder |

## Features (Round 2)

- Konva linear timeline: zoom, playhead, drag/resize, library drop  
- Per-clip media status + import local clip  
- Generation pipeline with **video step** + cancel / retry failed  
- FFmpeg **concat final** (uses READY clips, else color fallback)  
- soul.md frontmatter preview + soulmd-hub link  

## Docs

- [docs/project-brief.md](./docs/project-brief.md)  
- [docs/architecture.md](./docs/architecture.md)  

## i18n

- **zh-HK** (default)  
- **en**  
