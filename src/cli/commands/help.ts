import { printHuman } from '../output'

export function printHelp(): void {
  printHuman(`instant-drama — InstantDrama Magician CLI

Control the full app from the shell (humans + OpenClaw/Hermes bots).

USAGE
  instant-drama [global-options] <command> [args]

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
  update [check|install] [ver]  npm CLI updates (install needs --yes)
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
  instant-drama <namespace> <action> [jsonArgs…]
  Namespaces: activity ai app characters costumes diagnostics gateway
    generation media project props scenes settings shell souls stories
    support timeline updates videoPrep webServer
  kebab-case actions map to camelCase (generate-sheet → generateSheet)

  instant-drama characters list --json
  instant-drama characters generate-sheet --args '[{"characterId":"…"}]'
  instant-drama generation run STORY_ID --json
  instant-drama media check-ffmpeg --json
  instant-drama video-prep create --args '[{…}]'

MODES
  remote   When --url / IDM_URL / config.url is set (default for bots)
  local    Headless runtime on --data-dir / IDM_DATA_DIR (~/.local/share/idm)

HEADLESS FILE PICKS
  IDM_PICK_FILE=/path/to/file.png   # one-shot open dialog substitute
  IDM_SAVE_PATH=/path/to/out.zip    # one-shot save dialog substitute

DESKTOP BUILD / OPEN (macOS · Ubuntu · Windows)
  instant-drama build                         # current OS, unpacked dir (fast)
  instant-drama build --target installer      # dmg / AppImage+deb / nsis
  instant-drama build --platform linux --target dir
  instant-drama build --platform win --force  # cross-build (when supported)
  instant-drama open                          # launch latest packaged app
  instant-drama open --build-if-missing       # build dir then open
  instant-drama open --dev                    # electron-vite dev
  instant-drama open --app-path /path/to.app

  Cross-build: mac installers need a Mac. See docs/cli.md.

EXAMPLES
  instant-drama doctor --json
  instant-drama update
  instant-drama update install --yes
  instant-drama update install 1.3.0 --yes
  instant-drama --local stories list --json
  instant-drama invoke stories:create '{"title":"Demo"}' --json
  instant-drama --url http://127.0.0.1:8787 --token $IDM_TOKEN channels list
  instant-drama tools schema --openai > /tmp/idm-tools.json
  instant-drama build --json && instant-drama open --json

ENV
  IDM_URL  IDM_TOKEN  IDM_AUTH_TOKEN  IDM_DATA_DIR  IDM_YES  IDM_PROFILE
  IDM_JSON=1  IDM_PICK_FILE  IDM_SAVE_PATH  IDM_SKIP_UPDATE=1

Agent docs: docs/agent-cli.md · OpenClaw skill: skills/idm/SKILL.md
`)
}
