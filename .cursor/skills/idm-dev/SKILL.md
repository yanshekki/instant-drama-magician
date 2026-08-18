---
name: idm-dev
description: >-
  InstantDrama Magician repo conventions: shared 183-channel runtime (Electron,
  Web, CLI), channelManifest argsHints, plot-focus segmentKeys, bilingual docs,
  OpenClaw skill, Electron main-process restart. Use when editing handlers,
  CLI, preload, electron-api, plot suggest, chapters, key art, or docs/skills
  in this repository.
---

# InstantDrama Magician — repo agent

Reply to the user in **Cantonese / zh-HK**. Keep product docs as **EN + ZH pairs**.

## Shared runtime (do not fork)

Electron, Web (`POST /api/invoke`), and CLI (`instant-drama invoke`) share **`registerAllHandlers`** — **183** channels in `src/runtime/channelManifest.ts`.

Adding or changing an API:

1. Handler under `src/runtime/handlers/`
2. Types in `src/types/electron-api.ts`
3. Preload in `electron/preload/index.ts` (if the GUI calls it)
4. **`argsHint` in `channelManifest.ts`** (`channels describe` + `tools schema` read this)
5. Matching EN + ZH docs (`docs/cli.md` + `docs/cli-ZH.md`, and agent docs if agents need the payload)
6. OpenClaw skill `skills/idm/` when the agent-facing flow changes

Do **not** add a new IPC channel for plot suggest — it is payload flags on `*:aiFill`. Do **not** add CLI-only sugar that duplicates `--args` JSON.

Hardcoded channel counts (`157`, `158`) are stale. Tests and `scripts/cli-smoke.sh` expect **183**.

## Plot suggest

- Payload: `suggestFromStory: true` + `storyId` + optional `segmentKeys` (`chapter:<id>`, `beat:<id>`). Empty keys = entire story, **chapters first**.
- `segmentKey` (singular) is deprecated.
- GUI `defaultBeatBind` / `focusBindId` (pre-check beats already bound to this entity) is **not** a CLI default. Do not expose those props on CLI.
- Details: `src/domain/plotFocus.ts`, `skills/idm/plot-focus.md`.

Timeline multi-bind caps: characters 4 / scenes 2 / props 4 / actions 4 (`src/domain/timelineBindings.ts`).

## Electron

Main-process handler changes need a **full Electron restart**. See [electron.md](electron.md).

## Do not

- Edit plan files unless the user asks
- Commit leftover helpers such as `scripts/to_written_zh.py` or `src/prompts/copy/_*.mjs`
- Force-push `main`
- Skip git hooks
- Dump all 183 methods into markdown; `channels list` / `channels describe` stay the catalog
