---
name: idm
description: Control InstantDrama Magician (AI short-drama app) via the idm CLI — stories, cast, timeline, generation, settings, backups. Use when the user wants to create or manage dramas, characters, scenes, exports, or app settings from the terminal.
metadata:
  {
    "openclaw":
      {
        "emoji": "🎬",
        "requires": { "bins": ["idm"] },
        "homepage": "https://github.com/yanshekki/instant-drama-magician"
      }
  }
---

> **語言：** [English](./SKILL.md) · [中文](./SKILL-ZH.md)

# InstantDrama Magician（`idm`）

透過 **`idm` CLI**（非 GUI）控制 **InstantDrama Magician**。

## 一次性設定

- PATH 上有 `idm`（repo 內 `npm install -g`／`npm link`）
- 建議對長駐 server 用 **remote**：

```bash
export IDM_URL=http://127.0.0.1:8787
export IDM_TOKEN=<server bearer>
export IDM_JSON=1
```

- 或 **local** headless：

```bash
export IDM_DATA_DIR=~/.local/share/idm
idm --local doctor --json
```

盡量**不要**把 API token 貼進用戶可見對話——用環境變數。

## 永遠先探索

```bash
idm doctor --json
idm channels list --json
```

只呼叫 `channels list` 出現的 channel（應約 **137**）。桌面／web／CLI 同一 registry。若缺少 channel，多半是二進位過舊。

## 輸出契約

- 優先 `--json` 或 `IDM_JSON=1`
- 成功：`{ "ok": true, "channel", "result", "meta" }`
- 失敗：`{ "ok": false, "error": { "code", "message" } }`
- Exit：0 成功 · 1 錯誤 · 2 用法 · 3 授權 · 4 連線

## 桌面 build 與 open

```bash
idm build --json
idm build --target installer --json
idm open --build-if-missing --json
idm open --dev
```

支援 **macOS、Ubuntu/Linux、Windows**。macOS 目標在 Mac 上建。

## 全控制（137 channels）

```bash
idm channels list --json
idm invoke <channel> --args '[...]' --json
idm characters list --json
idm characters generate-sheet --args '[{...}]' --json
idm generation run STORY_ID --json
idm media check-ffmpeg --json
```

## 高頻指令

```bash
idm stories list --json
idm stories create --title "Title" --json
idm stories get <id> --json
idm stories delete <id> --yes --json
idm stories seed-demo zh-HK --json
idm settings get --json
idm settings set locale zh-HK --json
idm ai status --json
idm app info --json
```

破壞性 channel 需 `--yes` 或 `IDM_YES=1`。  
Headless 檔案對話框：`IDM_PICK_FILE`／`IDM_SAVE_PATH`。

## 典型創作流程

1. `idm stories seed-demo zh-HK --json` 或 `stories create`
2. `stories get`／`characters list` 檢查
3. domain sugar 生成 sheet／封面／prep
4. `idm generation run <storyId> --json`
5. 經 media／export 或 project backup 匯出

## Tool schema

```bash
idm tools schema --openai
idm tools call idm_stories_list --args '[]' --json
```

## 伺服器

```bash
idm server start --port 8787 --host 127.0.0.1
```

前景行程——通常由 ops 啟動，不要在 agent 回合中途開。

## 安全

- 公網介面勿關 auth
- 刪除／全量備份匯入／批量覆寫前先確認用戶
- 對用戶摘要遮罩密鑰

聯絡：email@ysk.hk · 文件：docs/cli-ZH.md · docs/agent-cli-ZH.md
