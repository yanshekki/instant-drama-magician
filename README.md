# 瞬劇魔法師 · InstantDrama Magician

AI 專業短劇生成桌面工具（Electron + React + TypeScript + Prisma/SQLite）。

## Tech stack

- **Desktop**: Electron + electron-vite
- **UI**: React 18, TypeScript (strict), TailwindCSS, react-router, react-i18next
- **DB**: SQLite + Prisma
- **AI**: [Grok CLI → OpenAI-compatible](https://github.com/yanshekki/Grok-Cli-to-OpenAI-compatible) client

## Architecture

```
electron/          # Main process + preload IPC
prisma/            # SQLite schema
src/
  application/     # Generation pipeline, TimelineService
  domain/          # Domain logic (extensible)
  infrastructure/  # Grok CLI AI client, etc.
  presentation/    # Pages & UI components
  types/domain/    # Framework-free domain interfaces
  locales/         # zh-HK + en
```

### Pages

| Route | Page | Purpose |
|-------|------|---------|
| `/` | Stories | Multi-story management |
| `/characters` | Characters | Character creation + soul.md import |
| `/scenes` | Scenes | Scene & script fragments |
| `/props` | Props | Prop inventory |
| `/timeline` | Timeline | Linear timeline with asset references |

## Setup

```bash
npm install
npx prisma db push
npm run dev
```

### Optional: Grok CLI AI backend

```bash
# Run the OpenAI-compatible wrapper (default http://127.0.0.1:39281)
# See: https://github.com/yanshekki/Grok-Cli-to-OpenAI-compatible
```

Copy `.env.example` if you need to override base URL / model.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Electron + Vite dev |
| `npm run build` | Production build |
| `npm run typecheck` | Strict TypeScript check |
| `npm run db:push` | Push Prisma schema to SQLite |
| `npm run db:studio` | Open Prisma Studio |

## i18n

- **zh-HK**: 標準香港書面語繁體中文（default）
- **en**: English

Toggle language from the sidebar.

## Spec

See [docs/project-brief.md](./docs/project-brief.md) for full product requirements.
