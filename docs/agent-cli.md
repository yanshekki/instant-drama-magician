# Agent control — OpenClaw / Hermes / scripts

> **Language:** [English](./agent-cli.md) · [中文](./agent-cli-ZH.md)

InstantDrama Magician exposes a stable CLI (`idm`) so agents can drive the app without the GUI.

## Desktop build & open

```bash
idm build --json
idm open --build-if-missing --json
idm open --dev
```

Platforms: **macOS**, **Ubuntu/Linux**, **Windows**. macOS installers must be built on a Mac. Prefer `idm server` for headless bot control.

## Install on the agent host

```bash
npm install -g .   # from clone, or npm link
which idm
idm doctor --json
```

Prefer **remote mode**: one long-lived server, many agent processes.

```bash
export IDM_DATA_DIR=/var/lib/idm
export IDM_AUTH_TOKEN='long-random-secret'
export DATABASE_URL="file:${IDM_DATA_DIR}/instant-drama.db"
npx prisma db push
idm server start --host 127.0.0.1 --port 8787
```

Agent env:

```bash
export IDM_URL=http://127.0.0.1:8787
export IDM_TOKEN="$IDM_AUTH_TOKEN"
export IDM_JSON=1
```

## Discovery loop

1. `idm doctor --json` — connectivity + **~137 channels**
2. `idm channels list --json` — live capabilities
3. `idm tools schema --openai` — OpenAI-style tool definitions
4. Mutate via `idm invoke` / `idm <namespace> <action>`

```bash
idm characters list --json
idm generation run <storyId> --json
idm media check-ffmpeg --json
```

## OpenClaw

Skill: `skills/idm/SKILL.md` (Chinese: `SKILL-ZH.md`).

```bash
openclaw skills install ./skills/idm
```

Requires `idm` on `PATH`. Never put tokens in prompts; use env / config. Use `--json` / `IDM_JSON=1`. Pass `--yes` only after user confirmed destructive ops.

## Hermes

Use a terminal/shell tool:

```bash
idm --url "$IDM_URL" --token "$IDM_TOKEN" stories list --json -q
idm invoke stories:create '{"title":"Agent demo"}' --json
```

## Example workflow

```bash
idm stories seed-demo zh-HK --json
idm stories list --json
idm settings set locale zh-HK --json
idm invoke ai:status --json
idm invoke media:checkFfmpeg --json
```

## Safety

| Risk | Mitigation |
|------|------------|
| Public server without token | Bind `127.0.0.1` or strong `IDM_AUTH_TOKEN` |
| Accidental delete | `--yes` / `IDM_YES=1` required for sugar deletes |
| Secrets in logs | Prefer env vars |
| Unknown channel | `channels list` is source of truth (desktop/web/CLI share one registry) |

## Raw HTTP

```http
POST /api/invoke
Authorization: Bearer <token>
Content-Type: application/json

{"channel":"stories:list","args":[]}
```

Also: `GET /api/channels`, `GET /api/health`. CLI preferred for agents (exit codes + schema + skill docs).

## Related

- [cli.md](./cli.md) · [self-host.md](./self-host.md) · Contact [email@ysk.hk](mailto:email@ysk.hk)
