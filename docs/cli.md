# CLI — `instant-drama` (InstantDrama Magician)

> **Language:** [English](./cli.md) · [中文](./cli-ZH.md)

Control the full app from the shell: local headless runtime or a running web server.  
For scripts, CI, and **OpenClaw / Hermes** agents.

## Install

### Global from npm (recommended)

```bash
npm install -g instant-drama-magician
instant-drama --help
instant-drama doctor --json
instant-drama update
instant-drama update install --yes   # npm install -g instant-drama-magician@latest
```

Requires **Node.js 20+**. Installs one command: **`instant-drama`**.  
CLI updates use the **npm registry**. Desktop installer updates use **GitHub Releases** (in-app Settings).  
Desktop `instant-drama build` / `instant-drama open` still need a full clone with Electron devDependencies.  
Skip CLI update probes: `IDM_SKIP_UPDATE=1`.

### From this repository

```bash
cd instant-drama-magician
npm install
npm link          # or: npm install -g .
instant-drama --help
instant-drama --help
```

Without global link:

```bash
npm run instant-drama -- doctor --json
npx tsx src/cli/bin.ts stories list --json
```

## Modes

| Mode | When | Behavior |
|------|------|----------|
| **local** | no URL / `--local` | Operate on `IDM_DATA_DIR` (default: OS app data root, same as desktop) |
| **remote** | `--url` / `IDM_URL` set | `POST {url}/api/invoke` + Bearer |

```bash
instant-drama --local --data-dir ./data doctor --json
instant-drama --local stories list --json
instant-drama server start --port 8787 --data-dir ./data
instant-drama --url http://127.0.0.1:8787 --token "$IDM_TOKEN" channels list --json
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
instant-drama build
instant-drama build --target dir --json
instant-drama build --target installer   # mac dmg · linux AppImage+deb · win nsis
instant-drama build --platform linux --target dir
instant-drama open
instant-drama open --build-if-missing
instant-drama open --dev
instant-drama launch
instant-drama desktop build|open
instant-drama app open|build
```

| Platform | dir artifact | installer |
|----------|--------------|-----------|
| Linux | `release/linux*-unpacked/instant-drama-magician` | `.AppImage`, `.deb` |
| macOS | `release/mac*/InstantDrama Magician.app` | `.dmg` |
| Windows | `release/win-unpacked/*.exe` | NSIS `.exe` |

Cross-build: mac installers need a Mac. Use `--force` only when you know the toolchain.

## Discovery & invoke

Electron, Web, and CLI share **`registerAllHandlers`** — **138** channels.

```bash
instant-drama doctor --json
instant-drama channels list
instant-drama channels list --filter stories --json
instant-drama channels describe stories:create
instant-drama tools schema --openai > tools.json
instant-drama invoke stories:list --json
instant-drama invoke stories:create '{"title":"Demo"}' --json
instant-drama invoke stories:get '["story-id"]' --json
```

## Domain sugar

```bash
instant-drama stories list|create|get|delete|seed-demo …
instant-drama settings get|set
instant-drama ai status|models|test-chat …
instant-drama app info
instant-drama characters list
instant-drama characters generate-sheet --args '[{...}]' --json
instant-drama generation run <storyId> --json
instant-drama media check-ffmpeg --json
```

Namespaces include: `activity` `ai` `app` `characters` `costumes` `diagnostics` `gateway` `generation` `media` `project` `props` `scenes` `settings` `shell` `souls` `stories` `support` `timeline` `updates` `videoPrep` `webServer`.

## Server

```bash
instant-drama server start --port 8787 --host 0.0.0.0
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
| Channel count | **138** |
| `instant-drama invoke` | ✅ any channel |
| Domain sugar | ✅ all namespaces |
| OpenAI tool schema | ✅ |
| OpenClaw skill | ✅ `skills/idm/SKILL.md` |
| Headless file dialogs | `IDM_PICK_FILE` / `IDM_SAVE_PATH` |

## Data directories (local)

| Context | Path |
|---------|------|
| CLI default | `OS app data (see appPaths / README)` or `IDM_DATA_DIR` |
| Common dev | `./data` |
| Packaged desktop | `~/.config/instant-drama-magician/` |
| Dev desktop | `~/.config/instant-drama-magician-dev/` |

## Related

- [agent-cli.md](./agent-cli.md) · [self-host.md](./self-host.md) · [architecture.md](./architecture.md)  
- Product: [../README.md](../README.md) · Contact: [email@ysk.hk](mailto:email@ysk.hk)
