# CLI — `instant-drama`（InstantDrama Magician）

> **語言：** [English](./cli.md) · [中文](./cli-ZH.md)

用命令列控制整個 App：本地 headless runtime，或連線已啟動的 Web Server。  
適合腳本、CI、以及 **OpenClaw / Hermes** 等 agent。

## 安裝

### 從 npm 全域安裝（推薦）

```bash
npm install -g instant-drama-magician
instant-drama --help
instant-drama doctor --json
```

需要 **Node.js 20+**。會安裝一個指令：**`instant-drama`**。  
桌面 `instant-drama build`／`instant-drama open` 仍需完整 clone 並安裝含 Electron 的 devDependencies。

### 從本倉庫安裝

```bash
cd instant-drama-magician
npm install
npm link          # 或: npm install -g .
instant-drama --help
instant-drama --help
```

不用全域 link：

```bash
npm run instant-drama -- doctor --json
npx tsx src/cli/bin.ts stories list --json
```

## 模式

| 模式 | 條件 | 行為 |
|------|------|------|
| **local** | 無 URL／`--local` | 操作 `IDM_DATA_DIR`（預設 `~/.local/share/idm`） |
| **remote** | 設定了 `--url`／`IDM_URL` | `POST {url}/api/invoke` + Bearer |

```bash
instant-drama --local --data-dir ./data doctor --json
instant-drama --local stories list --json
instant-drama server start --port 8787 --data-dir ./data
instant-drama --url http://127.0.0.1:8787 --token "$IDM_TOKEN" channels list --json
```

首次 local／server 需 schema：

```bash
export IDM_DATA_DIR=./data
export DATABASE_URL="file:${IDM_DATA_DIR}/instant-drama.db"
npx prisma db push
```

## 全域選項

| 選項 | 說明 |
|------|------|
| `--json` | stdout 單一 JSON |
| `--pretty` | 美化 JSON |
| `-q`／`--quiet` | 少 stderr |
| `--url` | 遠端 base URL |
| `--token` | Bearer token |
| `--local` | 強制本地 |
| `--data-dir` | 資料目錄 |
| `-p`／`--profile` | 設定檔 profile |
| `-y`／`--yes` | 確認破壞性操作（`IDM_YES=1`） |

環境變數：`IDM_URL` `IDM_TOKEN` `IDM_AUTH_TOKEN` `IDM_DATA_DIR` `IDM_YES` `IDM_PROFILE` `IDM_JSON=1`  
設定檔：`~/.config/idm/config.json`

## 桌面 Build／Open（macOS · Ubuntu · Windows）

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

| 平台 | dir 產物 | installer |
|------|----------|-----------|
| Linux | `release/linux*-unpacked/instant-drama-magician` | `.AppImage`、`.deb` |
| macOS | `release/mac*/InstantDrama Magician.app` | `.dmg` |
| Windows | `release/win-unpacked/*.exe` | NSIS `.exe` |

交叉編譯：mac 安裝包應在 Mac 上建。僅在清楚工具鏈時用 `--force`。

## 探索與 invoke

Electron、Web、CLI 共用 **`registerAllHandlers`** — **138** 個 channel。

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

Namespaces 包括：`activity` `ai` `app` `characters` `costumes` `diagnostics` `gateway` `generation` `media` `project` `props` `scenes` `settings` `shell` `souls` `stories` `support` `timeline` `updates` `videoPrep` `webServer`。

## 伺服器

```bash
instant-drama server start --port 8787 --host 0.0.0.0
```

## Exit codes

| Code | 含義 |
|------|------|
| 0 | 成功 |
| 1 | 業務／執行錯誤 |
| 2 | 用法錯誤 |
| 3 | 未授權 |
| 4 | 連線失敗 |

## JSON 契約

成功：`{ "ok": true, "channel", "result", "meta" }`  
失敗：`{ "ok": false, "error": { "code", "message" } }`

## 全功能覆蓋（100%）

| 能力 | 狀態 |
|------|------|
| Shared `registerAllHandlers` | ✅ Electron + web + CLI |
| Channel 數 | **138** |
| `instant-drama invoke` | ✅ 任意 channel |
| Domain sugar | ✅ 全部 namespace |
| OpenAI tool schema | ✅ |
| OpenClaw skill | ✅ `skills/idm/SKILL-ZH.md` |
| Headless 檔案對話框 | `IDM_PICK_FILE`／`IDM_SAVE_PATH` |

## 資料目錄（local）

| 情境 | 路徑 |
|------|------|
| CLI 預設 | `~/.local/share/idm` 或 `IDM_DATA_DIR` |
| 開發常用 | `./data` |
| 安裝版桌面 | `~/.config/instant-drama-magician/` |
| 開發桌面 | `~/.config/instant-drama-magician-dev/` |

## 相關

- [agent-cli-ZH.md](./agent-cli-ZH.md) · [self-host-ZH.md](./self-host-ZH.md) · [architecture-ZH.md](./architecture-ZH.md)  
- 產品：[../README-ZH.md](../README-ZH.md) · 聯絡：[email@ysk.hk](mailto:email@ysk.hk)
