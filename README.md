# 瞬劇魔法師 · InstantDrama Magician

AI 專業短劇生成桌面工具（Electron + React + TypeScript + Prisma/SQLite）。

## Quick start

```bash
cd "/home/ki/文件/instant-drama-magician"
npm install
npx prisma db push
npm run dev
```

Optional AI backend: [Grok-Cli-to-OpenAI-compatible](https://github.com/yanshekki/Grok-Cli-to-OpenAI-compatible) on `:39281`.

Optional export: system `ffmpeg` (or `FFMPEG_PATH`).

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Electron + Vite |
| `npm run build` | Production bundle |
| `npm run typecheck` | Strict TS |
| `npm test` | Domain unit tests (vitest) |
| `npm run db:push` | SQLite schema |
| `npm run pack` / `dist` | electron-builder |

## Architecture

See [docs/architecture.md](./docs/architecture.md) and [docs/project-brief.md](./docs/project-brief.md).

### Pages

| Route | Purpose |
|-------|---------|
| `/` | Stories |
| `/characters` | Characters + soul.md import |
| `/scenes` | Scenes + scripts |
| `/props` | Props |
| `/timeline` | Linear timeline (drag/drop, generate, export) |

## i18n

- **zh-HK** (default) — 香港書面語繁體
- **en** — English

## Tech

- Electron + electron-vite
- React 18, TypeScript strict, TailwindCSS
- Prisma + SQLite (`src/types/prisma` generated client)
- Grok CLI OpenAI-compatible AI client
- FFmpeg storyboard export
