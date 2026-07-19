---
name: instant-drama
description: Control InstantDrama Magician (AI short-drama app) via the instant-drama CLI — stories, cast, timeline, generation, settings, backups. Use when the user wants to create or manage dramas, characters, scenes, exports, or app settings from the terminal.
metadata:
  {
    "openclaw":
      {
        "emoji": "🎬",
        "requires": { "bins": ["instant-drama"] },
        "homepage": "https://github.com/yanshekki/instant-drama-magician"
      }
  }
---

> **Language:** [English](./SKILL.md) · [中文](./SKILL-ZH.md)

# InstantDrama Magician (`instant-drama`)

You control the **InstantDrama Magician** app through the **`instant-drama`** CLI (not the GUI).

## Setup (once)

- Binary on PATH: `instant-drama` (`npm install -g` / `npm link` in the app repo)
- Prefer **remote** mode against a running server:

```bash
export IDM_URL=http://127.0.0.1:8787
export IDM_TOKEN=<bearer from server>
export IDM_JSON=1
```

- Or **local** headless:

```bash
export IDM_DATA_DIR=~/.local/share/idm
instant-drama --local doctor --json
```

**Never** paste API tokens into user-visible chat if avoidable — use env.

## Always start with discovery

```bash
instant-drama doctor --json
instant-drama channels list --json
```

Only call channels that appear in `channels list` (expect **~138**). Desktop, web, and CLI share one registry. If a channel is missing, the binary is likely outdated.

## Output contract

- Prefer `--json` or `IDM_JSON=1`
- Success: `{ "ok": true, "channel", "result", "meta" }`
- Failure: `{ "ok": false, "error": { "code", "message" } }`
- Exit codes: 0 ok · 1 error · 2 usage · 3 auth · 4 connect

## Desktop app build & open

```bash
instant-drama build --json
instant-drama build --target installer --json
instant-drama open --build-if-missing --json
instant-drama open --dev
```

Supports **macOS, Ubuntu/Linux, Windows**. Build macOS targets on a Mac.

## Full control (138 channels)

```bash
instant-drama channels list --json
instant-drama invoke <channel> --args '[...]' --json
instant-drama characters list --json
instant-drama characters generate-sheet --args '[{...}]' --json
instant-drama generation run STORY_ID --json
instant-drama media check-ffmpeg --json
```

## High-frequency commands

```bash
instant-drama stories list --json
instant-drama stories create --title "Title" --json
instant-drama stories get <id> --json
instant-drama stories delete <id> --yes --json
instant-drama stories seed-demo zh-HK --json
instant-drama settings get --json
instant-drama settings set locale zh-HK --json
instant-drama ai status --json
instant-drama app info --json
```

Destructive channels require `--yes` or `IDM_YES=1`.  
Headless file dialogs: `IDM_PICK_FILE` / `IDM_SAVE_PATH`.

## Typical creative flow

1. `instant-drama stories seed-demo zh-HK --json` or `stories create`
2. Inspect with `stories get` / `characters list`
3. Generate sheets / covers / prep via domain sugar
4. `instant-drama generation run <storyId> --json`
5. Export via media/export channels or project backup

## Tool schema

```bash
instant-drama tools schema --openai
instant-drama tools call idm_stories_list --args '[]' --json
```

## Server

```bash
instant-drama server start --port 8787 --host 127.0.0.1
```

Foreground — usually started by ops, not mid-agent-turn.

## Safety

- Do not disable auth on public interfaces
- Confirm before delete / full backup import / bulk overwrites
- Redact secrets in user-visible summaries

Contact: email@ysk.hk · Docs: docs/cli.md · docs/agent-cli.md
