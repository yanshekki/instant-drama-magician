---
name: instant-drama
description: >-
  Control InstantDrama Magician via the instant-drama CLI — 183 shared channels
  for stories, chapters, plot beats (suggestFromStory/segmentKeys), characters,
  costumes, scenes, props, actions, comics, key art, timeline, generation,
  settings. Use when the user wants to create or manage dramas, fill assets from
  story chapters/beats, run generation, or change app settings from the terminal.
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

You control **InstantDrama Magician** through the **`instant-drama` CLI** (not the GUI). Desktop, web, and CLI share **183** channels.

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
instant-drama channels describe scenes:aiFill --json
```

Only call channels that appear in `channels list` (expect **183**). If a channel is missing, the binary is likely outdated.

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

## Full control (183 channels)

```bash
instant-drama channels list --json
instant-drama invoke <channel> --args '[...]' --json
instant-drama chapters list --args '["STORY_ID"]' --json
instant-drama scenes ai-fill --args '[{"storyId":"…","suggestFromStory":true,"segmentKeys":["chapter:…","beat:…"]}]' --json
instant-drama keyArt get --args '["STORY_ID"]' --json
instant-drama costumes append-try-on-still --args '[{"costumeId":"…","sourcePath":"/path.png"}]' --json
instant-drama mediaGen extract --args '[{"kind":"timeline-still","storyId":"…","entryId":"…"}]' --json
instant-drama mediaGen extract --args '[{"kind":"character-sheet","characterId":"…","advancedIdentity":true,"identityCollage":true,"lookPackId":"identity-lock"}]' --json
instant-drama mediaGen extract --args '[{"kind":"timeline-clip","storyId":"…","entryId":"…","continuityMode":"chain-end","motionPriority":"action"}]' --json
instant-drama timeline get-advanced-prep --args '["STORY_ID"]' --json
instant-drama videoPrep create --args '[{"kind":"timeline-clip","storyId":"…","entryId":"…","stillOnly":true}]' --json
instant-drama generation run STORY_ID --json
instant-drama media check-ffmpeg --json
```

Sheets / plates / intros go through **`mediaGen:extract` → `polish` → `generateImage`** (legacy `generate-sheet` / `generatePlate` channels are deprecated).

Opt-in payload flags (Settings defaults; **do not add channels**): `continuityMode` (`storyboard`|`chain-end`), `motionPriority` (`default`|`action`), `advancedIdentity`, `identityCollage`, `lookPackId` (`follow-asset`|`identity-lock`|`continuous-clip`|`key-art`|`comic`), `generateAudio`, `grokVideoVoice` (`ara`|`eve`|`leo`|`rex`|`sal`|`mio`). Describe with `channels describe mediaGen:extract`.

Grok native clip voice is Settings + `POST /v1/videos` `voices[]` (gctoac 1.7.4+ → `reference_to_video`). Do **not** call `/v1/audio/speech`. Example:

```bash
instant-drama settings set --args '[{"generateAudio":true,"grokVideoVoice":"ara"}]' --json
instant-drama videoPrep confirm --args '[{"kind":"timeline-clip","storyId":"…","entryId":"…","stillPath":"/path/still.png","professionalPrompt":"…"}]' --json
```

```json
{
  "prompt": "… Spoken dialogue uses preset voices <AUDIO_0> in character order (ara).",
  "seconds": 6,
  "aspect_ratio": "16:9",
  "voices": ["ara"]
}
```

With `voices[]`, Grok leaves first-frame `image_to_video` lock. Chain-end `last_frame` is Seedance-only.

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

1. `stories seed-demo zh-HK` or `stories create`
2. Write **chapters**: `chapters ai-fill` / `ai-polish`; extract cast with `chapters generate-cast`
3. Fill assets from plot: `*:ai-fill` with `suggestFromStory` + `segmentKeys` (see [plot-focus.md](./plot-focus.md))
4. Bind beats: `timeline create` with `characterIds` / `sceneIds` / `propIds` / `actionIds`
5. Optional desks: `keyArt get` / `add-shot` + `mediaGen`; `comics get` / `add-page`
6. `generation run <storyId>`
7. Export via `media:exportFinal` or project backup

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

Contact: email@ysk.hk · Docs: docs/cli.md · docs/agent-cli.md · Plot payload: [plot-focus.md](./plot-focus.md)
