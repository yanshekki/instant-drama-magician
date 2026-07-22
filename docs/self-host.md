# Self-host — browser control (Web Service)

> **Language:** [English](./self-host.md) · [中文](./self-host-ZH.md)

Run InstantDrama Magician as a **server** and control it from a browser.  
The Electron desktop app remains available; Web and desktop share the same business handlers (**157** channels).

## Requirements

- Node.js 20+
- FFmpeg via `ffmpeg-static` or `FFMPEG_PATH`
- Disk for media library + generations

## Mode A — desktop Settings toggle (recommended)

1. Open the Electron desktop app  
2. **Settings → Application → Web server (browser control)**  
3. Enable (auto-generates a login token)  
4. Copy URL / token and open in a browser  

- **Shares the same userData** as desktop (stories, media, API settings)  
- Server restarts with the app if still enabled  
- Port, localhost/LAN, regenerate token — all in Settings  

Full browser UI needs built SPA: `npm run build:web` (included in packaged builds).

## Mode B — standalone CLI process

```bash
cd instant-drama-magician
npm install
npm run build:web
npm link   # optional

export IDM_DATA_DIR=/var/lib/instant-drama
export IDM_AUTH_TOKEN='your-long-secret'
export IDM_PORT=8787
export IDM_HOST=0.0.0.0
export DATABASE_URL="file:${IDM_DATA_DIR}/instant-drama.db"
npx prisma db push
instant-drama server start
# Open http://SERVER:8787/ and paste IDM_AUTH_TOKEN

export IDM_URL=http://127.0.0.1:8787
export IDM_TOKEN="$IDM_AUTH_TOKEN"
instant-drama doctor --json
instant-drama stories list --json
```

Local one-shot (build + schema + auth disabled):

```bash
npm run dev:web
# http://127.0.0.1:8787  · IDM_AUTH_DISABLED=1
```

## Environment variables

| Variable | Default | Meaning |
|----------|---------|---------|
| `IDM_DATA_DIR` | `./data` | SQLite, settings.json, media/, logs/ |
| `IDM_PORT` | `8787` | HTTP port |
| `IDM_HOST` | `0.0.0.0` | Bind address |
| `IDM_AUTH_TOKEN` | (empty) | Bearer token; **required on public nets** |
| `IDM_AUTH_DISABLED` | no | `1` = disable auth (trusted LAN/localhost only) |
| `IDM_STATIC_DIR` | `./out/renderer` | SPA static dir |
| `IDM_DATABASE_URL` | `file:$DATA_DIR/instant-drama.db` | Optional override |
| `FFMPEG_PATH` | auto | FFmpeg binary |

Without token and without disable: only **loopback** clients allowed.

## API (V1)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Health (no auth) |
| POST | `/api/invoke` | `{ "channel": "stories:list", "args": [] }` |
| GET | `/api/media?p=` | Media preview (auth; absolute path on server) |
| GET | `/api/download?p=` | Attachment download |
| POST | `/api/upload?name=` | Raw body upload → `media/uploads/` |
| GET | `/api/channels` | Registered channel list (~157) |

Browser UI maps `getApi().…` to channel invokes via `HttpAppClient`.

## Desktop vs Web

Business channels use the **same runtime**. Differences are shell UX:

| Feature | Web / self-host |
|---------|-----------------|
| Stories / cast / scenes / props / costumes / timeline / generation / export | ✅ |
| Settings, AI status, models, backup channels | ✅ |
| Media preview / download / upload APIs | ✅ |
| Native OS file dialogs | Via upload API / `IDM_PICK_FILE` substitutes |
| System menu, desktop icon, electron-updater | **Desktop only** |
| Same userData as Electron | Mode A only; Mode B uses `IDM_DATA_DIR` |

If a channel returns `NOT_FOUND`, check version with `GET /api/channels` / `instant-drama channels list` — not “web not ported”.

## Reverse proxy (HTTPS recommended)

```
instant-drama.example.com {
  reverse_proxy 127.0.0.1:8787
}
```

## Security

1. Public internet: strong `IDM_AUTH_TOKEN`  
2. Prefer bind `127.0.0.1` + reverse proxy TLS  
3. Provider API keys only in server `settings.json`  
4. Media paths restricted under `DATA_DIR`  

## Data directory layout

```
$IDM_DATA_DIR/
  instant-drama.db
  settings.json
  media/
  logs/activity.jsonl
```

## Troubleshooting

- **503 SPA not built** → `npm run build:web`  
- **401** → correct token / `IDM_AUTH_TOKEN`  
- **NOT_FOUND channel** → upgrade server; expect ~157 channels  
- **FFmpeg** → `ffmpeg-static` or `FFMPEG_PATH`  

## Related

- [cli.md](./cli.md) · [agent-cli.md](./agent-cli.md) · Contact [email@ysk.hk](mailto:email@ysk.hk)
