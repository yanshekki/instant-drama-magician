---
name: instant-drama
description: >-
  用 instant-drama CLI 控制 InstantDrama Magician——183 個共用 channel：故事、章節、劇情焦點
 （suggestFromStory/segmentKeys）、角色、戲服、場景、道具、動作、漫畫、劇照、時間軸、生成、設定。
  當用戶要喺終端機建短劇、由章節／段落填資產、出片或改設定時使用。
metadata:
  {
    "openclaw":
      {
        "emoji": "🎬",
        "requires": { "bins": ["instant-drama"] },
        "homepage": "https://github.com/yanshekki/instant-drama-magician"
      }
  }
---

> **語言：** [English](./SKILL.md) · [中文](./SKILL-ZH.md)

# InstantDrama Magician（`instant-drama`）

透過 **`instant-drama` CLI**（非 GUI）控制 **InstantDrama Magician**。桌面／web／CLI 共用 **183** 個 channel。

## 一次性設定

- PATH 上有 `instant-drama`（repo 內 `npm install -g`／`npm link`）
- 建議對長駐 server 用 **remote**：

```bash
export IDM_URL=http://127.0.0.1:8787
export IDM_TOKEN=<server bearer>
export IDM_JSON=1
```

- 或 **local** headless：

```bash
export IDM_DATA_DIR=~/.local/share/idm
instant-drama --local doctor --json
```

盡量**不要**把 API token 貼進用戶可見對話——用環境變數。

## 永遠先探索

```bash
instant-drama doctor --json
instant-drama channels list --json
instant-drama channels describe scenes:aiFill --json
```

只呼叫 `channels list` 出現的 channel（應 **183**）。若缺少 channel，多半是二進位過舊。

## 輸出契約

- 優先 `--json` 或 `IDM_JSON=1`
- 成功：`{ "ok": true, "channel", "result", "meta" }`
- 失敗：`{ "ok": false, "error": { "code", "message" } }`
- Exit：0 成功 · 1 錯誤 · 2 用法 · 3 授權 · 4 連線

## 桌面 build 與 open

```bash
instant-drama build --json
instant-drama build --target installer --json
instant-drama open --build-if-missing --json
instant-drama open --dev
```

支援 **macOS、Ubuntu/Linux、Windows**。macOS 目標在 Mac 上建。

## 全控制（183 channels）

```bash
instant-drama channels list --json
instant-drama invoke <channel> --args '[...]' --json
instant-drama chapters list --args '["STORY_ID"]' --json
instant-drama scenes ai-fill --args '[{"storyId":"…","suggestFromStory":true,"segmentKeys":["chapter:…","beat:…"]}]' --json
instant-drama keyArt get --args '["STORY_ID"]' --json
instant-drama costumes append-try-on-still --args '[{"costumeId":"…","sourcePath":"/path.png"}]' --json
instant-drama mediaGen extract --args '[{"kind":"timeline-still","storyId":"…","entryId":"…"}]' --json
instant-drama timeline get-advanced-prep --args '["STORY_ID"]' --json
instant-drama videoPrep create --args '[{"kind":"timeline-clip","storyId":"…","entryId":"…","stillOnly":true}]' --json
instant-drama generation run STORY_ID --json
instant-drama media check-ffmpeg --json
```

角色 sheet／道具 plate／介紹片走 **`mediaGen:extract` → `polish` → `generateImage`**（舊 `generate-sheet`／`generatePlate` 已棄用）。

## 高頻指令

```bash
instant-drama stories list --json
instant-drama stories create --title "Title" --json
instant-drama stories get <id> --json
instant-drama stories delete <id> --yes --json
instant-drama stories seed-demo zh-HK --json
instant-drama settings get --json
instant-drama settings set locale zh-HK --json
instant-drama ai status --json
instant-drama app info --json
```

破壞性 channel 需 `--yes` 或 `IDM_YES=1`。  
Headless 檔案對話框：`IDM_PICK_FILE`／`IDM_SAVE_PATH`。

## 典型創作流程

1. `stories seed-demo zh-HK` 或 `stories create`
2. 寫**章節**：`chapters ai-fill`／`ai-polish`；`chapters generate-cast` 抽 cast
3. 由劇情填資產：`*:ai-fill` 加 `suggestFromStory` + `segmentKeys`（見 [plot-focus.md](./plot-focus.md)）
4. 綁段落：`timeline create` 用 `characterIds`／`sceneIds`／`propIds`／`actionIds`
5. 可選：`keyArt get`／`add-shot` + `mediaGen`；`comics get`／`add-page`
6. `generation run <storyId>`
7. `media:exportFinal` 或 project backup 匯出

## Tool schema

```bash
instant-drama tools schema --openai
instant-drama tools call idm_stories_list --args '[]' --json
```

## 伺服器

```bash
instant-drama server start --port 8787 --host 127.0.0.1
```

前景行程——通常由 ops 啟動，不要在 agent 回合中途開。

## 安全

- 公網介面勿關 auth
- 刪除／全量備份匯入／批量覆寫前先確認用戶
- 對用戶摘要遮罩密鑰

聯絡：email@ysk.hk · 文件：docs/cli-ZH.md · docs/agent-cli-ZH.md · 劇情 payload：[plot-focus.md](./plot-focus.md)
