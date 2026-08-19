# Agent control — OpenClaw / Hermes / scripts

> **Language:** [English](./agent-cli.md) · [中文](./agent-cli-ZH.md)

InstantDrama Magician exposes a stable CLI (`instant-drama`) so agents can drive the app without the GUI.

## Desktop build & open

```bash
instant-drama build --json
instant-drama open --build-if-missing --json
instant-drama open --dev
```

Platforms: **macOS**, **Ubuntu/Linux**, **Windows**. macOS installers must be built on a Mac. Prefer `instant-drama server` for headless bot control.

## Install on the agent host

```bash
npm install -g .   # from clone, or npm link
which instant-drama
instant-drama doctor --json
```

Prefer **remote mode**: one long-lived server, many agent processes.

```bash
export IDM_DATA_DIR=/var/lib/instant-drama
export IDM_AUTH_TOKEN='long-random-secret'
export DATABASE_URL="file:${IDM_DATA_DIR}/instant-drama.db"
npx prisma db push
instant-drama server start --host 127.0.0.1 --port 8787
```

Agent env:

```bash
export IDM_URL=http://127.0.0.1:8787
export IDM_TOKEN="$IDM_AUTH_TOKEN"
export IDM_JSON=1
```

## Discovery loop

1. `instant-drama doctor --json` — connectivity + **183 channels**
2. `instant-drama channels list --json` — live capabilities (`chapters`, `keyArt`, `actions`, …)
3. `instant-drama channels describe scenes:aiFill --json` — payload hints (`suggestFromStory`, `segmentKeys`)
4. `instant-drama tools schema --openai` — OpenAI-style tool definitions
5. Mutate via `instant-drama invoke` / `instant-drama <namespace> <action>`

```bash
instant-drama chapters list --args '["STORY_ID"]' --json
instant-drama scenes ai-fill --args '[{"storyId":"STORY_ID","suggestFromStory":true,"segmentKeys":["chapter:…","beat:…"]}]' --json
instant-drama keyArt get --args '["STORY_ID"]' --json
instant-drama characters list --json
instant-drama characters ai-fill --args '[{"idea":"…","referenceImagePaths":["/a.png"]}]' --json
instant-drama settings set --args '[{"generateAudio":true,"grokVideoVoice":"ara"}]' --json
instant-drama generation run <storyId> --json
instant-drama media check-ffmpeg --json
```

## OpenClaw

Skill: `skills/idm/SKILL.md` (Chinese: `SKILL-ZH.md`).

```bash
openclaw skills install ./skills/idm
```

Requires `instant-drama` on `PATH`. Never put tokens in prompts; use env / config. Use `--json` / `IDM_JSON=1`. Pass `--yes` only after user confirmed destructive ops.

## Hermes

Use a terminal/shell tool:

```bash
instant-drama --url "$IDM_URL" --token "$IDM_TOKEN" stories list --json -q
instant-drama invoke stories:create '{"title":"Agent demo"}' --json
```

## Example workflow

```bash
instant-drama stories seed-demo zh-HK --json
instant-drama stories list --json
instant-drama settings set locale zh-HK --json
instant-drama chapters ai-fill --args '[{"storyId":"STORY_ID","idea":"…"}]' --json
instant-drama chapters generate-cast --args '[{"storyId":"STORY_ID","preview":true}]' --json
instant-drama invoke ai:status --json
instant-drama invoke media:checkFfmpeg --json
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

- [cli.md](./cli.md) · [self-host.md](./self-host.md) · OpenClaw skill [`skills/idm/SKILL.md`](../skills/idm/SKILL.md) · plot payload [`skills/idm/plot-focus.md`](../skills/idm/plot-focus.md) · Contact [email@ysk.hk](mailto:email@ysk.hk)
