# Architecture — InstantDrama Magician

> **Language:** [English](./architecture.md) · [中文](./architecture-ZH.md)

Version **1.3.1**. Presentation → Application → Domain → Infrastructure, with a **shared handler runtime** used by Electron, Web, and CLI.

## Layers

```text
Presentation (React pages / CLI / browser UI)
        │
        ▼
  IPC  |  HTTP POST /api/invoke  |  instant-drama invoke
        │
        ▼
  registerAllHandlers + HandlerHost   ← single source of truth (~157 channels)
        │
        ▼
  Application services (Generation, Timeline, Export, Backup, …)
        │
        ▼
  Domain (pure TS: prompts, snap, layout, legal, providers, …)
        │
        ▼
  Infrastructure (Prisma/SQLite, AI HTTP, FFmpeg, settings, media, gateway, updater)
```

Media in the desktop app is served via privileged scheme **`idm-media://`** (range requests for video).

## Shared runtime

| Entry | Path | Notes |
|-------|------|--------|
| Electron | `electron/main/ipc.ts` → handlers | `userData` under Electron paths |
| CLI local | `src/cli` + `createRuntime` | `IDM_DATA_DIR` (default `OS app data root (same as desktop)`) |
| Web / server | `server/index.ts` + `EmbeddedWebServer` | Same handlers; SPA from `out/renderer` |

Channel catalog: `src/runtime/channelManifest.ts` (**157** unique ids).

Notable media surfaces:

| Surface | Role |
|---------|------|
| `mediaGen:*` | Unified materials → multi-vision polish → still (library + timeline refine) |
| `videoPrep:*` | Still/keyframe → confirm video (incl. timeline-clip) |
| `costumes:appendTryOnStill` | Dual-write try-on still into costume multi-gallery |
| Timeline advanced | End-frame continuity stills; prev keyframe edit base; refine via MediaGen |

## Desktop pages

| Route | Page |
|-------|------|
| `/` | Stories |
| `/characters` | Characters (+ SoulMD Hub, reference sheets) |
| `/costumes` | Costumes (try-on dual-write multi-gallery) |
| `/scenes` | Scenes |
| `/props` | Props |
| `/timeline` | Timeline + Advanced prep (continuity + refine) |
| `/audit` | Activity log |
| `/settings` | Settings |

## Generation pipeline

```text
Script → Character → Scene → Props → Timeline → Video (6|10s) → Export
```

- Full run: `generation:run`
- Retry failures only: video step
- Cancel: `generation:cancel`
- Advanced prep: cast lock → stills → video queue

## Data paths (Linux)

| Mode | Path |
|------|------|
| Packaged Electron | `~/.config/instant-drama-magician/` |
| Dev (`!app.isPackaged`) | `~/.config/instant-drama-magician-dev/` |
| CLI / server | `IDM_DATA_DIR` |

## Related

- [cli.md](./cli.md) · [self-host.md](./self-host.md) · [video-providers.md](./video-providers.md) · [testing.md](./testing.md)
