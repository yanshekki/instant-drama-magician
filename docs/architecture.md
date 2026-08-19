# Architecture — InstantDrama Magician

> **Language:** [English](./architecture.md) · [中文](./architecture-ZH.md)

Version **1.7.0**. Presentation → Application → Domain → Infrastructure, with a **shared handler runtime** used by Electron, Web, and CLI.

## Layers

```text
Presentation (React pages / CLI / browser UI)
        │
        ▼
  IPC  |  HTTP POST /api/invoke  |  instant-drama invoke
        │
        ▼
  registerAllHandlers + HandlerHost   ← single source of truth (~183 channels)
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

Same runtime, three desks — timeline board, comic page, key-art still:

<table>
  <tr>
    <td width="50%" valign="top">
      <img src="../src/assets/screen/7.png" alt="Timeline pipeline" width="100%">
    </td>
    <td width="50%" valign="top">
      <img src="../src/assets/screen/10.png" alt="Comics finished page" width="100%">
    </td>
  </tr>
</table>

## Shared runtime

| Entry | Path | Notes |
|-------|------|--------|
| Electron | `electron/main/ipc.ts` → handlers | `userData` under Electron paths |
| CLI local | `src/cli` + `createRuntime` | `IDM_DATA_DIR` (default `OS app data root (same as desktop)`) |
| Web / server | `server/index.ts` + `EmbeddedWebServer` | Same handlers; SPA from `out/renderer` |

Channel catalog: `src/runtime/channelManifest.ts` (**183** unique ids).

Notable media surfaces:

| Surface | Role |
|---------|------|
| `mediaGen:*` | Unified materials → multi-vision polish → still (library + timeline refine) |
| `videoPrep:*` | Still/keyframe → confirm video (incl. timeline-clip) |
| `costumes:appendTryOnStill` | Dual-write try-on still into costume multi-gallery |
| Timeline advanced | End-frame continuity stills; prev keyframe edit base; refine via MediaGen |

Opt-in generation flags (defaults = current behaviour; no new channels):

- `continuityMode`: `storyboard` (default) or `chain-end` (previous end-frame wins; Generate All is sequential)
- `motionPriority`: `default` or `action` (bound action plates always polish; action mode raises them above scene/prop)
- `advancedIdentity` / `identityCollage`: auto-pick gallery stills for multi-vision polish; optional FFmpeg collage for the 1-image edits API
- `lookPackId`: `follow-asset` · `identity-lock` · `continuous-clip` · `key-art` · `comic`
- `generateAudio` / `preserveClipAudio` / `grokVideoVoice`: native clip audio when the provider supports it (Seedance `with_audio`; gctoac 1.7+ `voices[]` → `reference_to_video`, leaving first-frame lock). Export may keep clip audio. Grok ignores `last_frame`; chain-end last-frame lock is Seedance.

Pass the same fields on `mediaGen:extract` / `generateImage` payloads or Settings. `channels describe` shows `argsHint`.

## Desktop pages

| Route | Page |
|-------|------|
| `/` | Stories (chapters + plot beats) |
| `/characters` | Characters (+ SoulMD Hub, reference sheets) |
| `/costumes` | Costumes (try-on dual-write multi-gallery) |
| `/scenes` | Scenes |
| `/props` | Props |
| `/actions` | Actions (motion-direction boards) |
| `/comics` | Comics studio |
| `/key-art` | Key art desk |
| `/timeline` | Timeline + Advanced prep (continuity + refine) |
| `/timeline-v2` | Timeline v2 studio |
| `/audit` | Activity log |
| `/settings` | Settings |

Asset AI fill can inject plot via `suggestFromStory` + `segmentKeys` (`chapter:<id>` / `beat:<id>`; empty = entire story, chapters first). Same payload on CLI.

## Generation pipeline

```text
Chapters → Cast (generateCast) → Beats → Characters / Scenes / Props / Actions
  → Timeline → Video (6|10s) → Export
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
