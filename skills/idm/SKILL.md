---
name: idm
description: Control InstantDrama Magician (AI short-drama app) via the idm CLI — stories, cast, timeline, generation, settings, backups. Use when the user wants to create or manage dramas, characters, scenes, exports, or app settings from the terminal.
metadata:
  {
    "openclaw":
      {
        "emoji": "🎬",
        "requires": { "bins": ["idm"] },
        "homepage": "https://github.com/yanshekki/instant-drama-magician"
      }
  }
---

> **Language:** [English](./SKILL.md) · [中文](./SKILL-ZH.md)

# InstantDrama Magician (`idm`)

You control the **InstantDrama Magician** app through the **`idm`** CLI (not the GUI).

## Setup (once)

- Binary on PATH: `idm` (`npm install -g` / `npm link` in the app repo)
- Prefer **remote** mode against a running server:

```bash
export IDM_URL=http://127.0.0.1:8787
export IDM_TOKEN=<bearer from server>
export IDM_JSON=1
```

- Or **local** headless:

```bash
export IDM_DATA_DIR=~/.local/share/idm
idm --local doctor --json
```

**Never** paste API tokens into user-visible chat if avoidable — use env.

## Always start with discovery

```bash
idm doctor --json
idm channels list --json
```

Only call channels that appear in `channels list` (expect **~137**). Desktop, web, and CLI share one registry. If a channel is missing, the binary is likely outdated.

## Output contract

- Prefer `--json` or `IDM_JSON=1`
- Success: `{ "ok": true, "channel", "result", "meta" }`
- Failure: `{ "ok": false, "error": { "code", "message" } }`
- Exit codes: 0 ok · 1 error · 2 usage · 3 auth · 4 connect

## Desktop app build & open

```bash
idm build --json
idm build --target installer --json
idm open --build-if-missing --json
idm open --dev
```

Supports **macOS, Ubuntu/Linux, Windows**. Build macOS targets on a Mac.

## Full control (137 channels)

```bash
idm channels list --json
idm invoke <channel> --args '[...]' --json
idm characters list --json
idm characters generate-sheet --args '[{...}]' --json
idm generation run STORY_ID --json
idm media check-ffmpeg --json
```

## High-frequency commands

```bash
idm stories list --json
idm stories create --title "Title" --json
idm stories get <id> --json
idm stories delete <id> --yes --json
idm stories seed-demo zh-HK --json
idm settings get --json
idm settings set locale zh-HK --json
idm ai status --json
idm app info --json
```

Destructive channels require `--yes` or `IDM_YES=1`.  
Headless file dialogs: `IDM_PICK_FILE` / `IDM_SAVE_PATH`.

## Typical creative flow

1. `idm stories seed-demo zh-HK --json` or `stories create`
2. Inspect with `stories get` / `characters list`
3. Generate sheets / covers / prep via domain sugar
4. `idm generation run <storyId> --json`
5. Export via media/export channels or project backup

## Tool schema

```bash
idm tools schema --openai
idm tools call idm_stories_list --args '[]' --json
```

## Server

```bash
idm server start --port 8787 --host 127.0.0.1
```

Foreground — usually started by ops, not mid-agent-turn.

## Safety

- Do not disable auth on public interfaces
- Confirm before delete / full backup import / bulk overwrites
- Redact secrets in user-visible summaries

Contact: email@ysk.hk · Docs: docs/cli.md · docs/agent-cli.md
