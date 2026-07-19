# CLI — `idm` (InstantDrama Magician)

> **Language:** [English](./cli.md) · [中文](./cli-ZH.md)

Control the full app from the shell: local headless runtime or a running web server.  
For scripts, CI, and **OpenClaw / Hermes** agents.

## Install

```bash
cd instant-drama-magician
npm install
npm link          # or: npm install -g .
idm --help
instant-drama --help
```

Without global link:

```bash
npm run idm -- doctor --json
npx tsx src/cli/bin.ts stories list --json
```

## Modes

| Mode | When | Behavior |
|------|------|----------|
| **local** | no URL / `--local` | Operate on `IDM_DATA_DIR` (default `~/.local/share/idm`) |
| **remote** | `--url` / `IDM_URL` set | `POST {url}/api/invoke` + Bearer |

```bash
idm --local --data-dir ./data doctor --json
idm --local stories list --json
idm server start --port 8787 --data-dir ./data
idm --url http://127.0.0.1:8787 --token "$IDM_TOKEN" channels list --json
```

First-time local/server schema:

```bash
export IDM_DATA_DIR=./data
export DATABASE_URL="file:${IDM_DATA_DIR}/instant-drama.db"
npx prisma db push
```

## Global options

| Option | Meaning |
|--------|---------|
| `--json` | Single JSON on stdout |
| `--pretty` | Pretty JSON |
| `-q` / `--quiet` | Less stderr |
| `--url` | Remote base URL |
| `--token` | Bearer token |
| `--local` | Force local |
| `--data-dir` | Data directory |
| `-p` / `--profile` | Config profile |
| `-y` / `--yes` | Confirm destructive ops (`IDM_YES=1`) |

Env: `IDM_URL` `IDM_TOKEN` `IDM_AUTH_TOKEN` `IDM_DATA_DIR` `IDM_YES` `IDM_PROFILE` `IDM_JSON=1`  
Config file: `~/.config/idm/config.json`

## Desktop build / open (macOS · Ubuntu · Windows)

```bash
idm build
idm build --target dir --json
idm build --target installer   # mac dmg · linux AppImage+deb · win nsis
idm build --platform linux --target dir
idm open
idm open --build-if-missing
idm open --dev
idm launch
idm desktop build|open
idm app open|build
```

| Platform | dir artifact | installer |
|----------|--------------|-----------|
| Linux | `release/linux*-unpacked/instant-drama-magician` | `.AppImage`, `.deb` |
| macOS | `release/mac*/InstantDrama Magician.app` | `.dmg` |
| Windows | `release/win-unpacked/*.exe` | NSIS `.exe` |

Cross-build: mac installers need a Mac. Use `--force` only when you know the toolchain.

## Discovery & invoke

Electron, Web, and CLI share **`registerAllHandlers`** — **137** channels.

```bash
idm doctor --json
idm channels list
idm channels list --filter stories --json
idm channels describe stories:create
idm tools schema --openai > tools.json
idm invoke stories:list --json
idm invoke stories:create '{"title":"Demo"}' --json
idm invoke stories:get '["story-id"]' --json
```

## Domain sugar

```bash
idm stories list|create|get|delete|seed-demo …
idm settings get|set
idm ai status|models|test-chat …
idm app info
idm characters list
idm characters generate-sheet --args '[{...}]' --json
idm generation run <storyId> --json
idm media check-ffmpeg --json
```

Namespaces include: `activity` `ai` `app` `characters` `costumes` `diagnostics` `gateway` `generation` `media` `project` `props` `scenes` `settings` `shell` `souls` `stories` `support` `timeline` `updates` `videoPrep` `webServer`.

## Server

```bash
idm server start --port 8787 --host 0.0.0.0
```

## Exit codes

| Code | Meaning |
|------|---------|
| 0 | OK |
| 1 | Business / runtime error |
| 2 | Usage error |
| 3 | Unauthorized |
| 4 | Connection failure |

## JSON contract

Success: `{ "ok": true, "channel", "result", "meta" }`  
Failure: `{ "ok": false, "error": { "code", "message" } }`

## Full coverage (100%)

| Capability | Status |
|------------|--------|
| Shared `registerAllHandlers` | ✅ Electron + web + CLI |
| Channel count | **137** |
| `idm invoke` | ✅ any channel |
| Domain sugar | ✅ all namespaces |
| OpenAI tool schema | ✅ |
| OpenClaw skill | ✅ `skills/idm/SKILL.md` |
| Headless file dialogs | `IDM_PICK_FILE` / `IDM_SAVE_PATH` |

## Data directories (local)

| Context | Path |
|---------|------|
| CLI default | `~/.local/share/idm` or `IDM_DATA_DIR` |
| Common dev | `./data` |
| Packaged desktop | `~/.config/instant-drama-magician/` |
| Dev desktop | `~/.config/instant-drama-magician-dev/` |

## Related

- [agent-cli.md](./agent-cli.md) · [self-host.md](./self-host.md) · [architecture.md](./architecture.md)  
- Product: [../README.md](../README.md) · Contact: [email@ysk.hk](mailto:email@ysk.hk)
