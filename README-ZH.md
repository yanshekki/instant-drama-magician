# 瞬劇魔法師 · InstantDrama Magician

> **語言：** [English](./README.md) · [中文](./README-ZH.md)

**AI 專業短劇生成桌面工具**

由一個 idea 到完整短劇：故事 → 人物／服裝／場景／道具／**動作** → 線性時間軸 → AI 分鏡與影片 → FFmpeg 成片匯出。  
跨平台桌面（Electron）+ 可選瀏覽器遠控 + 完整命令列 `instant-drama`（**157** 個 channel，對齊桌面 IPC）。

| | |
|---|---|
| **版本** | 1.3.2 |
| **作者** | YSK Limited |
| **聯絡** | [email@ysk.hk](mailto:email@ysk.hk) |
| **授權** | MIT |
| **English** | [README.md](./README.md) |

---

## 目錄

1. [介面預覽](#介面預覽)
2. [功能總覽](#功能總覽)
3. [桌面應用詳解](#桌面應用詳解)
4. [推薦工作流](#推薦工作流)
5. [安裝與啟動](#安裝與啟動)
6. [命令列 CLI（instant-drama）](#命令列-cliidm)
7. [網頁遠控與自架](#網頁遠控與自架)
8. [AI 與媒體供應商](#ai-與媒體供應商)
9. [多語系](#多語系)
10. [資料目錄與備份](#資料目錄與備份)
11. [技術架構](#技術架構)
12. [文件索引](#文件索引)
13. [創作者](#-創作者)
14. [授權與聯絡](#授權與聯絡)

---

## 介面預覽

以下截圖來自實際 App（`src/assets/screen/`）。

### 1. 故事管理

多專案列表：封面、狀態（Draft 等）、角色／場景／道具／動作／clip 數量、搜尋與篩選、**匯出備份**／**匯入故事備份**、新建故事。

![故事管理](./src/assets/screen/1.png)

### 2. 故事編輯（Basics）

故事封面、AI 快速建立（**AI generate style note**／**AI generate beats**）、標題與狀態、藝術風格、**Style bible**（風格聖經）、外部參考圖與身份鎖定選項。

![故事編輯](./src/assets/screen/2.png)

### 3. 人物庫

全域角色庫：多圖參考 sheet、性別／藝術風格／有無圖／Soul／語言篩選、縮放／重新生成／另存、編輯與刪除。側欄顯示 Grok CLI 連線狀態。

![人物庫](./src/assets/screen/3.png)

### 4. 人物參考圖（References）

專業參考圖流程：Identity／Body／Base／Costume／Detail 圖庫、**Character bible** 多角度 sheet、藝術風格鎖定、外部參考圖、**Lock identity**、Intro video、設為封面。

![人物參考圖](./src/assets/screen/4.png)

### 5. 時間軸製作台

核心產線：時間軸 snap、clip 列表、預覽、**Clip editor**（綁定資產、6s／10s AI 時長、beat screenplay）、單段生成／重試、**Generate**／**Export**／Export history、**Advanced** 進階預備入口。

![時間軸](./src/assets/screen/5.png)

### 6. 進階預備（Advanced prep）

三步流水線：**Cast lock → Storyboard stills → Video**。批量 keyframe still、連貫性鎖定（continuity）、單格 re-gen／To video、影片佇列。

![進階預備](./src/assets/screen/6.png)

---

## 功能總覽

| 領域 | 你能做什麼 |
|------|------------|
| **故事 Stories** | 多故事管理、封面 AI、風格聖經、腳本 beats、cast 綁定（角色／場景／道具／**動作**）、`.idm.zip` 備份匯入匯出 |
| **人物 Characters** | 全域角色庫、soul.md／SoulMD Hub、多角度 sheet、身份鎖定、外部 ref、intro video、**僅憑靜圖 AI 填充**（vision） |
| **服裝 Costumes** | 服裝庫、換裝、wardrobe 建議、**僅憑參考圖 AI 填充**、多圖 gallery；**試穿雙寫**角色及戲服多圖庫（`costumes:appendTryOnStill`） |
| **場景 Scenes** | 場景文案、plate／looks／atmosphere、場景圖庫、**vision AI 填充** |
| **道具 Props** | 道具描述、master prompt、plate 變體、**vision AI 填充** |
| **動作 Actions** | 全域**動作指導**庫：多格指示圖（2–6 格）、藝術風格、外部參考、cast 參考、**vision AI 填充**、多圖累積 |
| **MediaGen 生成殼** | 統一材料 → 多圖 vision 潤飾 → 出圖／出片（`mediaGen:extract` · `polish` · `generateImage`）；庫頁與時間軸精修共用 |
| **圖庫 UI** | 共用 **EntityGalleryPanel**：大圖預覽、放大／另存／封面／移除／介紹片、縮圖列（預覽 vs 身份鎖定多選） |
| **時間軸 Timeline** | 線性編排、snap／pack、單 clip 生成、綁定角色／場景／道具／**動作**、6s／10s 時長、對白與鏡頭標記 |
| **進階預備** | Cast 鎖定 → 分鏡 stills（**片尾連續**、強制上一段 keyframe、多 ref 潤飾）→ 出片；單格**精修靜圖／精修出片**（MediaGen） |
| **音訊／字幕** | 可選 TTS 混音、燒錄對白字幕、xfade／ducking、比例感知匯出 |
| **活動日誌** | 生成／匯出／更新等事件（JSONL），便於除錯 |
| **設定** | LLM／影像／影片供應商、診斷、FFmpeg、網頁伺服器、自動更新、支援報告、法律條款 |
| **CLI `instant-drama`** | 本地 headless 或遠端 invoke；建置／開啟桌面 App；OpenClaw／Hermes agent（**157** 個 IPC channel） |
| **網頁遠控** | 桌面內建 Web Server 或獨立 `instant-drama server`，瀏覽器操作同一份資料 |
| **多語系** | 10 種介面語言（含繁中、簡中、阿語 RTL）；圖庫標籤、網絡錯誤與使用者錯誤訊息已本地化 |
| **自動更新** | 打包版經 GitHub Releases（electron-updater） |

---

## 桌面應用詳解

側欄導航：**Stories · Characters · Costumes · Scenes · Props · Actions · Timeline · Activity · Settings**。

### Stories（故事）

- 建立／編輯／刪除多個獨立短劇專案  
- 狀態、封面有無、排序（例如最近更新）  
- 封面：Zoom／Regenerate／Save As  
- **Import story backup**／**Export backup**（故事級 `.idm.zip`）  
- 編輯分頁：  
  - **Basics**：封面、AI quick create、title、status、art style、style bible  
  - **Cast（選角）**：連結**角色、場景、道具、動作**（搜尋 + 已加入／未加入篩選）  
  - **Script beats（劇情段落）**：每段可多選角色／場景／道具／**動作**，並寫 beat screenplay  

### Characters（人物）

- **全域角色庫**（故事可選用共用 cast）  
- 搜尋、性別、藝術風格、有無圖片、Soul、語言等篩選  
- 每卡多張參考圖；Edit／Delete  
- 編輯分頁：  
  - **Profile**：名稱、描述、年齡、性別、語言、聲音等；**AI 填充**可用構思、草稿、soul，或**只憑上載靜圖**（vision）  
  - **References**：多角度 bible（front／¾／close-up 等）、body／base／costume 管線、外部參考、身份鎖定、生成專業參考、Intro video  
  - **Costume**：綁定服裝  
- **SoulMD Hub**（soulmd-hub.ysk.hk）：索引建議、匯入 soul.md 作為人物靈魂設定  
- 詳見 [docs/soulmd-hub-ZH.md](./docs/soulmd-hub-ZH.md) · [docs/soulmd-hub.md](./docs/soulmd-hub.md)

### Costumes（服裝）

- 全域服裝庫（可連結 0…N 個角色）  
- **只憑參考圖 AI 填充**（構思可留空）  
- 多圖 gallery、封面、介紹影片；縮圖支援**身份鎖定多選**  
- 以角色參考圖試穿／換裝（身份鎖定）  
- **接受試穿草稿**後，靜圖會寫入**角色圖庫及此戲服多圖庫**，已連結角色及其他使用者均可瀏覽（`costumes:appendTryOnStill`）  

### Scenes（場景）

- 場景描述與腳本欄位  
- 場景 plate、looks、atmosphere  
- 場景圖庫與變體生成  
- **vision AI 填充**（依選中／封面靜圖）  

### Props（道具）

- 道具名稱與描述  
- Prop master prompt、plate 變體  
- 供時間軸 clip 綁定  
- **vision AI 填充**（依參考靜圖）  

### Actions（動作指導）

- **全域動作庫** — 可重用的肢體／走位／場面調度指示（先建庫，再掛入故事）  
- **多格指示圖**：2／3／4／5／6 格（橫向 strip 或 2×2／2×3）；第 1 格＝第一動作，第 N 格＝最後動作  
- 藝術風格、外部參考圖、由角色／服裝／場景／道具引入 cast 參考  
- **vision AI 填充**；多圖累積（append 指示板、排序、封面）  
- 可掛入故事 cast、劇情段落與時間軸 clip；出片時注入節奏／意圖／鏡頭備註，並可使用指示圖作 image-to-video 參考  

### Timeline（時間軸 · 主製作台）

- 選擇當前故事；**Play**／**Undo**／**Redo**  
- **Generate** 批次生成；**Export** 成片；**Export history**  
- 總時長、ready 數、Video 模式、AI clip 僅 6s 或 10s  
- 時間軸縮放、**Timeline snap**、snap grid、**Pack clips**  
- **Clip editor**：綁定角色／場景／道具／**動作**、時長、beat screenplay（`[MOOD]`／`[ATMO]`／`[DIALOGUE]` 等標記）  
- 單 clip：**Generate this clip**／**Regenerate**／**Continue video**  
- 失敗可重試；支援取消生成、只重試失敗片段  
- 匯出可選：TTS、燒錄字幕、轉場 xfade、音量 ducking、畫面比例  

### Advanced prep（進階預備）

由 Timeline 的 **Advanced** 開啟：

1. **Cast lock** — 鎖定出場人物造型  
2. **Storyboard stills** — 依 beat 批量生成關鍵靜幀，並鎖定上一段連續性  
   - 由影片補靜圖時優先抽取**片尾幀**；出片後亦以片尾更新 continuity  
   - 下一段靜圖／出片**編輯底圖**優先使用上一段 continuity keyframe  
   - 潤飾可同時附上一段、cast、庫圖等多張參考  
   - 批量「缺失」會補齊較前仍缺靜圖的段落，避免 silently 只做文字連續  
   - 狀態標籤說明**需更新／需先補上一段／就緒**  
3. **Video** — still ready 後入佇列出片（可 skip 已有影片）  
4. **單格精修** — **精修靜圖**（`timeline-still`）或**精修出片**（`timeline-clip`）開啟 MediaGen 材料殼  

適合要「先鎖定連貫再出片」的專業流程。

### Activity（活動日誌）

- 檢視本機 `activity.jsonl` 類事件  
- 生成、匯出、更新、支援報告等軌跡  
- 協助排查 API／管線問題  

### Settings（設定）

| 區塊 | 內容 |
|------|------|
| **LLM** | OpenAI-compatible；預設 **Grok Gateway**（如 `http://127.0.0.1:3847`）；亦可 OpenAI／Custom／**Kimi（Moonshot）** 等 |
| **影像** | 可跟 LLM 或獨立 base URL／key／model（含 Seedream 等方舟影像） |
| **影片** | `auto`／`http`／`stub`；**Seedance（火山方舟）**、Grok `/v1/videos` 等；6／10 秒；輪詢與逾時 |
| **診斷** | 測試 Chat、列模型、連線狀態 |
| **FFmpeg** | 硬依賴；可指定 `FFMPEG_PATH` |
| **網頁伺服器** | 啟用瀏覽器遠控、埠、權杖、僅本機／區網 |
| **自動更新** | 檢查／下載／重啟（打包版；開發模式略過） |
| **支援報告** | 匯出診斷 JSON（**API key 已遮罩**） |
| **介面語言** | 見下方多語系 |
| **法律** | 免責聲明與可接受使用政策（AUP）；版本變更時需再次同意 |

---

## 推薦工作流

```text
① 設定 → 貼上 API Key → 測試 Chat
② Stories → 新建／AI style note + beats
③ Characters → 生成多角度 sheet → 鎖定身份
   （或上載靜圖 → 只憑圖 AI 填充角色資料）
④ Scenes / Props / Costumes / Actions → 補齊資產
   （Actions：生成多格指示圖）
⑤ 故事 Cast → 連結角色、場景、道具、動作
⑥ 劇情段落 → 每段綁定資產（含動作）
⑦ Timeline → 排 clip、寫 beat screenplay
⑧ Advanced prep → stills（連貫）→ 出片
⑨ Export → 成片（可選 TTS／字幕）
```

Demo：開發時可載入示範故事；CLI 亦有 `instant-drama stories seed-demo`。

---

## 安裝與啟動

### 只裝 CLI（npm 全域）

```bash
npm install -g instant-drama-magician
instant-drama doctor --json
```

完整指令見 [命令列 CLI（`instant-drama`）](#命令列-cliidm)。npm 套件名：**`instant-drama-magician`**。

### 安裝包（使用者）

| 平台 | 產物 |
|------|------|
| **Linux / Ubuntu** | `.AppImage`、`.deb` |
| **Windows** | NSIS 安裝程式 |
| **macOS** | `.dmg` |

本機建置後產物在 `release/`；或由 GitHub Releases 下載。

```bash
# Linux 範例
sudo dpkg -i release/instant-drama-magician_1.3.2_amd64.deb
# 或
./release/InstantDrama\ Magician-1.0.0.AppImage
```

亦可用 CLI：

```bash
instant-drama build --target installer
instant-drama open
```

### 開發者快速開始

```bash
# （建議）另開終端啟動 Grok OpenAI-compatible Gateway
# gctoac start  →  http://127.0.0.1:3847

cd instant-drama-magician
npm install
npx prisma db push
npm run dev
```

1. **設定** → API key → **測試 Chat**  
2. 建立或載入故事 → 時間軸生成  
3. 匯出成片  

詳見 [docs/grok-gateway-ZH.md](./docs/grok-gateway-ZH.md)。

### 常用 npm scripts

| 指令 | 說明 |
|------|------|
| `npm run dev` | Electron 開發模式 |
| `npm run build` | 編譯 main／preload／renderer |
| `npm test` | Vitest |
| `npm run dist:linux` / `dist:win` / `dist:mac` | 分平台安裝包 |
| `npm run instant-drama -- …` | 執行 CLI（無需全域 link） |

---

## 命令列 CLI（`instant-drama`）

用終端控制**整套**能力：本地 headless runtime，或連線已啟動的 Web Server。適合腳本、CI、**OpenClaw／Hermes** 等 agent。

全域安裝後 PATH 上會有：**`instant-drama`**。

### 全域安裝 CLI（推薦）

需要 **Node.js 20+**。npm 套件：[instant-drama-magician](https://www.npmjs.com/package/instant-drama-magician)。

```bash
npm install -g instant-drama-magician

# 驗證
instant-drama --help
instant-drama doctor --json
instant-drama version
```

#### CLI 更新（npm）

```bash
instant-drama update              # 檢查 npm registry 是否有新版
instant-drama update install --yes   # 全域安裝 latest（會驗證版本）
instant-drama update install 1.3.2 --yes   # 釘選版本
```

`instant-drama doctor` 亦會報告 npm 更新狀態（可用 `IDM_SKIP_UPDATE=1` 略過）。

#### 桌面 App 更新（GitHub Releases）

打包安裝版使用 **electron-updater**。啟動後會安靜檢查 GitHub Release；若有新版會顯示 **頂部橫幅 + Toast**。  
**設定 → 應用程式 → 更新**：檢查／下載／重啟安裝。

你會得到：

| 指令 | 用途 |
|------|------|
| `instant-drama` | CLI（唯一指令名；避免與 npm 上無關套件 `idm` 撞名） |

全域安裝後常見用法：

```bash
instant-drama --local stories list --json
instant-drama server start --port 8787
instant-drama channels list --json          # 約 157 個 channel
```

> **說明：** 全域安裝提供 **CLI／headless／網頁伺服器** 控制面（故事、角色、生成、匯出輔助、agent 工具）。若要 **建置或開啟 Electron 桌面 GUI**（`instant-drama build`／`instant-drama open`），仍需完整 git clone、`npm install`（含 Electron 等 devDependencies）以及本機 `release/` 產物。

### 從本倉庫安裝

```bash
git clone https://github.com/yanshekki/instant-drama-magician.git
cd instant-drama-magician
npm install
npm link                 # 將 instant-drama 掛上 PATH
# 或不 link：
npm run instant-drama -- doctor --json
```

### 模式

| 模式 | 條件 | 行為 |
|------|------|------|
| **local** | `--local` 或無 URL | 操作 `IDM_DATA_DIR`（預設：與桌面相同的 OS app data 根） |
| **remote** | `--url` / `IDM_URL` | `POST {url}/api/invoke` + Bearer |

### 常用指令

```bash
# 診斷（channel 數應約 157）
instant-drama doctor --json
instant-drama channels list --json

# 任意 channel
instant-drama invoke stories:list --json
instant-drama invoke generation:run '["storyId"]' --json

# Domain sugar
instant-drama stories list --json
instant-drama stories create --title "我的短劇" --json
instant-drama characters list --json
instant-drama characters generate-sheet --args '[{"characterId":"…"}]' --json
instant-drama costumes list --json
instant-drama costumes append-try-on-still --args '[{"costumeId":"…","sourcePath":"/path/to/still.png"}]' --json
instant-drama mediaGen extract --args '[{"kind":"timeline-still","storyId":"…","entryId":"…"}]' --json
instant-drama mediaGen polish --args '[{...}]' --json
instant-drama mediaGen generate-image --args '[{...}]' --json
instant-drama timeline get-advanced-prep --args '["STORY_ID"]' --json
instant-drama videoPrep create --args '[{"kind":"timeline-clip","storyId":"…","entryId":"…","stillOnly":true}]' --json
instant-drama invoke actions:list --json
instant-drama generation run <storyId> --json
instant-drama settings get --json
instant-drama ai status --json
instant-drama media check-ffmpeg --json

# 桌面生命週期（macOS · Ubuntu · Windows）
instant-drama build                         # 本機 unpacked
instant-drama build --target installer      # dmg / AppImage+deb / nsis
instant-drama open                          # 開已打包 App
instant-drama open --dev                    # 開發模式
instant-drama open --build-if-missing

# 網頁伺服器
instant-drama server start --port 8787 --data-dir ./data

# Agent 工具定義
instant-drama tools schema --openai > tools.json
```

**Namespaces 示例：**  
`activity` · `ai` · `app` · `characters` · `costumes` · `diagnostics` · `gateway` · `generation` · `media` · `project` · `props` · `scenes` · `settings` · `shell` · `souls` · `stories` · `support` · `timeline` · `updates` · `videoPrep` · `webServer`

Headless 檔案對話框替代：`IDM_PICK_FILE`、`IDM_SAVE_PATH`。

完整說明：[docs/cli-ZH.md](./docs/cli-ZH.md) · Agent：[docs/agent-cli-ZH.md](./docs/agent-cli-ZH.md) · OpenClaw skill：[`skills/idm/SKILL-ZH.md`](./skills/idm/SKILL-ZH.md)

---

## 網頁遠控與自架

### 方式 A — 桌面 App 內建（推薦）

1. 開啟 Electron 桌面版  
2. **設定 → 網頁伺服器（瀏覽器控制）**  
3. 啟用、複製網址與權杖  
4. 瀏覽器開啟；與桌面**共用同一 userData**  

### 方式 B — 獨立進程

```bash
npm run build:web
export IDM_DATA_DIR=./data
export IDM_AUTH_TOKEN='your-long-secret'
export IDM_PORT=8787
export DATABASE_URL="file:${IDM_DATA_DIR}/instant-drama.db"
npx prisma db push
instant-drama server start
# 瀏覽器 → http://127.0.0.1:8787  貼上 token
```

詳見 [docs/self-host-ZH.md](./docs/self-host-ZH.md)。

---

## AI 與媒體供應商

### LLM（對話／劇本／風格）

- 統一 **OpenAI-compatible** Chat Completions  
- 預設：**Grok CLI Gateway**（常見埠 `3847`；舊埠可自動遷移）  
- 亦可：OpenAI、Custom base URL、**Kimi（Moonshot）** 等  

### 影像

- 可與 LLM 共用或獨立設定  
- 支援 Gateway images API、方舟 **Seedream** 等（視設定）  

### 影片

| 模式 | 行為 |
|------|------|
| `auto` | 優先真實影片 API；失敗可回落 stub |
| `http` | 固定走 OpenAI 風格 `/v1/videos` 等 |
| `stub` | 色塊佔位（無真實模型） |

- 時長對齊供應商：**僅 6 或 10 秒**（Grok 影片）  
- **Seedance（火山方舟）** 可作獨立影片供應商  
- 設定：輪詢間隔、逾時、重試、併發、畫面比例  

詳見 [docs/video-providers-ZH.md](./docs/video-providers-ZH.md)、[docs/grok-gateway-ZH.md](./docs/grok-gateway-ZH.md)。

### FFmpeg

- **硬依賴**：拼接、轉場、混音、字幕燒錄、匯出  
- 經 **`ffmpeg-static`** 打包；亦可設 `FFMPEG_PATH`  

> **誠實邊界：** 成片觀感取決於你選的模型與提示詞；本工具負責工作流、連貫性與匯出管線，不保證「影院級」自動出片。商店簽章／Notarize 需自備憑證。

---

## 多語系

介面語言（設定內切換）：

| 代碼 | 語言 |
|------|------|
| `zh-HK` | 繁體中文（香港）— 預設之一 |
| `zh-CN` | 简体中文 |
| `en` | English |
| `es` | Español |
| `hi` | हिन्दी |
| `ar` | العربية（RTL） |
| `pt-BR` | Português（Brasil） |
| `fr` | Français |
| `ja` | 日本語 |
| `ru` | Русский |

---

## 資料目錄與備份

每個 profile 只有 **一個 data root**（DB、設定、媒體同根），由 `src/domain/appPaths.ts` 解析。

| 情境 | Linux (Ubuntu) | macOS | Windows |
|------|----------------|-------|---------|
| **安裝版／CLI 預設** | `~/.config/instant-drama-magician/` | `~/Library/Application Support/instant-drama-magician/` | `%APPDATA%\instant-drama-magician\` |
| **開發 `npm run dev`** | `~/.config/instant-drama-magician-dev/` | `~/Library/Application Support/instant-drama-magician-dev/` | `%APPDATA%\instant-drama-magician-dev\` |
| **覆蓋** | `IDM_DATA_DIR` 或 `--data-dir` | 同左 | 同左 |
| **Profile** | `IDM_PROFILE=default\|dev\|…` | 同左 | 同左 |

data root 內固定：

```
instant-drama.db   settings.json   media/   logs/   cache/   exports/
```

首次啟動可能會把舊資料（如 `prisma/dev.db`、`~/.local/share/idm`）**複製**進來（不會自動刪舊目錄）。

**備份：**

- 故事級：Stories 頁 **Export backup**（`.idm.zip`）  
- 全量：App 資料備份能力／支援報告（見設定與 CLI `support`）  

清除安裝版本機資料（**會刪除故事與媒體**）：

```bash
rm -rf ~/.config/instant-drama-magician
```

> 安裝包 **不會** 把你本機測試資料打進去；若裝完看到舊故事，多半是本機 userData 共用／殘留。

---

## 技術架構

| 層 | 技術 |
|----|------|
| 桌面 | Electron + electron-vite |
| UI | React 18 + TypeScript + Tailwind |
| 資料 | SQLite + Prisma |
| 媒體 | FFmpeg；時間軸 UI |
| 整合 | OpenAI-compatible HTTP；Grok Gateway |
| 執行時 | 共用 `registerAllHandlers` → Electron IPC / Web `/api/invoke` / CLI `instant-drama invoke` |

架構說明：[docs/architecture-ZH.md](./docs/architecture-ZH.md)

---

## 文件索引

**規則：** 檔名**無** `-ZH` 為英文版；**有** `-ZH` 為中文版。成對文件內容必須對等。

完整目錄與準則事實表：**[docs/README-ZH.md](./docs/README-ZH.md)** · **[docs/README.md](./docs/README.md)**

| 英文 | 中文 | 主題 |
|------|------|------|
| [docs/README.md](./docs/README.md) | [docs/README-ZH.md](./docs/README-ZH.md) | 文件總覽 + 準則 |
| [docs/project-brief.md](./docs/project-brief.md) | [docs/project-brief-ZH.md](./docs/project-brief-ZH.md) | 產品規格 |
| [docs/cli.md](./docs/cli.md) | [docs/cli-ZH.md](./docs/cli-ZH.md) | CLI（157 channels） |
| [docs/agent-cli.md](./docs/agent-cli.md) | [docs/agent-cli-ZH.md](./docs/agent-cli-ZH.md) | Agent／OpenClaw |
| [docs/self-host.md](./docs/self-host.md) | [docs/self-host-ZH.md](./docs/self-host-ZH.md) | 網頁遠控 |
| [docs/grok-gateway.md](./docs/grok-gateway.md) | [docs/grok-gateway-ZH.md](./docs/grok-gateway-ZH.md) | Grok Gateway |
| [docs/video-providers.md](./docs/video-providers.md) | [docs/video-providers-ZH.md](./docs/video-providers-ZH.md) | 影片／影像供應商 |
| [docs/soulmd-hub.md](./docs/soulmd-hub.md) | [docs/soulmd-hub-ZH.md](./docs/soulmd-hub-ZH.md) | SoulMD Hub |
| [docs/commercial.md](./docs/commercial.md) | [docs/commercial-ZH.md](./docs/commercial-ZH.md) | 分發與更新 |
| [docs/release.md](./docs/release.md) | [docs/release-ZH.md](./docs/release-ZH.md) | 發版 checklist |
| [docs/legal.md](./docs/legal.md) | [docs/legal-ZH.md](./docs/legal-ZH.md) | 法律版本 |
| [docs/testing.md](./docs/testing.md) | [docs/testing-ZH.md](./docs/testing-ZH.md) | 測試 |
| [docs/architecture.md](./docs/architecture.md) | [docs/architecture-ZH.md](./docs/architecture-ZH.md) | 架構 |
| [docs/beta.md](./docs/beta.md) | [docs/beta-ZH.md](./docs/beta-ZH.md) | 歷史 Beta |
| [docs/production-ux.md](./docs/production-ux.md) | [docs/production-ux-ZH.md](./docs/production-ux-ZH.md) | 歷史 UX |
| [docs/rc.md](./docs/rc.md) | [docs/rc-ZH.md](./docs/rc-ZH.md) | 歷史 RC |
| [skills/idm/SKILL.md](./skills/idm/SKILL.md) | [skills/idm/SKILL-ZH.md](./skills/idm/SKILL-ZH.md) | OpenClaw skill |
| [resources/README.md](./resources/README.md) | [resources/README-ZH.md](./resources/README-ZH.md) | App 圖示 |

---

## 👤 創作者

**Ki (yanshekki)** — 全端開發者、量化交易者、[YSK Limited](https://ysk.hk/) 創辦人。

🌐 [linktr.ee/yanshekki](https://linktr.ee/yanshekki) · 🏢 [ysk.hk](https://ysk.hk/)

### ☕ Support / Donate

如果「瞬劇魔法師」幫到你的短劇創作與產線，歡迎請我喝杯咖啡支持開發！

| 網路 | 地址 |
| --- | --- |
| **EVM** (ETH/BSC/AVAX) | `yanshekki.eth` |
| **NEAR** | `yanshekki.near` |
| **ADA** (Cardano) | `$yanshekki` |

---

## 授權與聯絡

- **License：** MIT  
- **Vendor：** YSK Limited  
- **Email：** [email@ysk.hk](mailto:email@ysk.hk)  
- **Repository：** 見 `package.json` → `repository.url`  

歡迎用 Issues 回報問題；匯出**支援報告**時請一併附上（設定內，密鑰已遮罩）。

---

**瞬劇魔法師** — 把 AI 短劇從靈感做成可剪、可匯、可迭代的專業工作流。
