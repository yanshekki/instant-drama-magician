import { printHuman } from '../output'

export function printHelp(): void {
  printHuman(`idm — InstantDrama Magician CLI

Control the full app from the shell (humans + OpenClaw/Hermes bots).

USAGE
  idm [global-options] <command> [args]

GLOBAL OPTIONS
  --json              Machine-readable JSON on stdout
  --pretty            Pretty-print JSON
  -q, --quiet         Less stderr noise
  --url <url>         Remote server (http://host:8787)
  --token <token>     Bearer auth token
  --local             Force local headless runtime (ignore --url)
  --data-dir <path>   Local data directory
  -p, --profile <n>   Named profile from config
  -y, --yes           Skip confirmations (IDM_YES=1)
  -h, --help          Show help
  -V, --version       Version

COMMANDS
  help                This message
  version             Print version
  doctor              Health / connectivity check
  config path|get|set Manage ~/.config/idm/config.json
  server start        Start web control server (foreground)
  build               Build desktop app (mac / linux / win)
  open / launch       Open desktop GUI (packaged or --dev)
  desktop build|open  Alias for build / open
  channels list       List API channels
  channels describe   Describe one channel
  invoke <channel>    Call any channel (escape hatch for full control)
  tools schema        Emit OpenAI-style tool definitions for agents
  tools call          Call a tool by schema name
  stories list|create|get|delete|seed-demo|…
  settings get|set
  ai status|models|test-chat|…
  app info            Runtime info via API
  app open|build      Same as open / build

DOMAIN SUGAR (all ~137 channels)
  idm <namespace> <action> [jsonArgs…]
  Namespaces: activity ai app characters costumes diagnostics gateway
    generation media project props scenes settings shell souls stories
    support timeline updates videoPrep webServer
  kebab-case actions map to camelCase (generate-sheet → generateSheet)

  idm characters list --json
  idm characters generate-sheet --args '[{"characterId":"…"}]'
  idm generation run STORY_ID --json
  idm media check-ffmpeg --json
  idm video-prep create --args '[{…}]'

MODES
  remote   When --url / IDM_URL / config.url is set (default for bots)
  local    Headless runtime on --data-dir / IDM_DATA_DIR (~/.local/share/idm)

HEADLESS FILE PICKS
  IDM_PICK_FILE=/path/to/file.png   # one-shot open dialog substitute
  IDM_SAVE_PATH=/path/to/out.zip    # one-shot save dialog substitute

DESKTOP BUILD / OPEN (macOS · Ubuntu · Windows)
  idm build                         # current OS, unpacked dir (fast)
  idm build --target installer      # dmg / AppImage+deb / nsis
  idm build --platform linux --target dir
  idm build --platform win --force  # cross-build (when supported)
  idm open                          # launch latest packaged app
  idm open --build-if-missing       # build dir then open
  idm open --dev                    # electron-vite dev
  idm open --app-path /path/to.app

  Cross-build: mac installers need a Mac. See docs/cli.md.

EXAMPLES
  idm doctor --json
  idm --local stories list --json
  idm invoke stories:create '{"title":"Demo"}' --json
  idm --url http://127.0.0.1:8787 --token $IDM_TOKEN channels list
  idm tools schema --openai > /tmp/idm-tools.json
  idm build --json && idm open --json

ENV
  IDM_URL  IDM_TOKEN  IDM_AUTH_TOKEN  IDM_DATA_DIR  IDM_YES  IDM_PROFILE
  IDM_JSON=1  IDM_PICK_FILE  IDM_SAVE_PATH

Agent docs: docs/agent-cli.md · OpenClaw skill: skills/idm/SKILL.md
`)
}
