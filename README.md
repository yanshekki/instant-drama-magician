# 瞬劇魔法師 · InstantDrama Magician

AI 專業短劇生成桌面工具（Electron + React + TypeScript + Prisma/SQLite）。

## Quick start

```bash
cd "/home/ki/文件/instant-drama-magician"
npm install
npx prisma db push
npm run dev
```

## Features

- Konva timeline (zoom, playhead, play/pause, preview, snap, undo)
- **Grok OpenAI Videos API** (`/v1/videos` create → poll → content), 6/10s snaps
- Pluggable video modes: auto / http / stub
- Final export: subtitles, BGM, optional TTS
- soul.md file + URL import; story backup zip
- Project CI on GitHub Actions

## Gateway

See [docs/grok-gateway.md](./docs/grok-gateway.md) to connect **Grok-Cli-to-OpenAI-compatible**.

## Docs

- [docs/project-brief.md](./docs/project-brief.md)
- [docs/architecture.md](./docs/architecture.md)
- [docs/video-providers.md](./docs/video-providers.md)

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Electron dev |
| `npm run build` | Bundle |
| `npm test` | Vitest |
| `npm run pack` | electron-builder `--dir` |

## Release checklist

1. `npm run typecheck && npm test && npm run build`
2. `npm run pack` → `release/linux-unpacked`
3. Configure Settings → video mode if you have a real video API
4. Ensure system `ffmpeg` is installed

## i18n

zh-HK (default) + en
