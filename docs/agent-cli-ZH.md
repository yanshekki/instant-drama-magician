# Agent 控制 — OpenClaw / Hermes / 腳本

> **語言：** [English](./agent-cli.md) · [中文](./agent-cli-ZH.md)

InstantDrama Magician 提供穩定 CLI（`instant-drama`），讓 agent 無需 GUI 即可驅動 App。

## 桌面 build 與 open

```bash
instant-drama build --json
instant-drama open --build-if-missing --json
instant-drama open --dev
```

平台：**macOS**、**Ubuntu/Linux**、**Windows**。macOS 安裝包須在 Mac 上建。無 GUI 時建議 `instant-drama server`。

## 在 agent 主機安裝

```bash
npm install -g .   # 或 npm link
which instant-drama
instant-drama doctor --json
```

建議 **remote 模式**：一個長駐 server，多個 agent 進程呼叫。

```bash
export IDM_DATA_DIR=/var/lib/instant-drama
export IDM_AUTH_TOKEN='long-random-secret'
export DATABASE_URL="file:${IDM_DATA_DIR}/instant-drama.db"
npx prisma db push
instant-drama server start --host 127.0.0.1 --port 8787
```

Agent 環境：

```bash
export IDM_URL=http://127.0.0.1:8787
export IDM_TOKEN="$IDM_AUTH_TOKEN"
export IDM_JSON=1
```

## 探索迴圈

1. `instant-drama doctor --json` — 連線 + **約 138 channels**
2. `instant-drama channels list --json` — 即時能力
3. `instant-drama tools schema --openai` — OpenAI 風格 tool 定義
4. 以 `instant-drama invoke`／`instant-drama <namespace> <action>` 變更狀態

```bash
instant-drama characters list --json
instant-drama generation run <storyId> --json
instant-drama media check-ffmpeg --json
```

## OpenClaw

Skill：`skills/idm/SKILL.md`（中文：`SKILL-ZH.md`）。

```bash
openclaw skills install ./skills/idm
```

需要 PATH 上有 `instant-drama`。勿把 token 寫進 prompt；用環境變數／設定。使用 `--json`／`IDM_JSON=1`。破壞性操作僅在用戶確認後加 `--yes`。

## Hermes

用 terminal／shell 工具：

```bash
instant-drama --url "$IDM_URL" --token "$IDM_TOKEN" stories list --json -q
instant-drama invoke stories:create '{"title":"Agent demo"}' --json
```

## 範例工作流

```bash
instant-drama stories seed-demo zh-HK --json
instant-drama stories list --json
instant-drama settings set locale zh-HK --json
instant-drama invoke ai:status --json
instant-drama invoke media:checkFfmpeg --json
```

## 安全

| 風險 | 緩解 |
|------|------|
| 公網 server 無 token | bind `127.0.0.1` 或強 `IDM_AUTH_TOKEN` |
| 誤刪 | sugar delete 需 `--yes`／`IDM_YES=1` |
| 日誌洩密 | 優先環境變數 |
| 未知 channel | 以 `channels list` 為準（桌面／web／CLI 同一 registry） |

## 原始 HTTP

```http
POST /api/invoke
Authorization: Bearer <token>
Content-Type: application/json

{"channel":"stories:list","args":[]}
```

另有：`GET /api/channels`、`GET /api/health`。Agent 建議用 CLI（exit code + schema + skill）。

## 相關

- [cli-ZH.md](./cli-ZH.md) · [self-host-ZH.md](./self-host-ZH.md) · 聯絡 [email@ysk.hk](mailto:email@ysk.hk)
