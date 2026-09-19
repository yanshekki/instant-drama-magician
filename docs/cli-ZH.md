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
instant-drama update
instant-drama update install --yes   # npm install -g instant-drama-magician@latest
```

需要 **Node.js 20+**。會安裝一個指令：**`instant-drama`**。  
CLI 更新走 **npm registry**；桌面安裝包更新走 **GitHub Releases**（App 內設定）。  
桌面 `instant-drama build`／`instant-drama open` 仍需完整 clone 並安裝含 Electron 的 devDependencies。  
略過 CLI 更新探測：`IDM_SKIP_UPDATE=1`。

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
| **local** | 無 URL／`--local` | 操作 `IDM_DATA_DIR`（預設 `OS app data（見 appPaths／README）`） |
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

Electron、Web、CLI 共用 **`registerAllHandlers`** — **189** 個 channel。

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
instant-drama characters render-photo-book --args '[{"characterId":"C","mode":"slideshow"}]' --json
instant-drama chapters list --args '["S"]' --json
instant-drama scenes ai-fill --args '[{"storyId":"S","suggestFromStory":true,"segmentKeys":["chapter:…","beat:…"]}]' --json
instant-drama generation run <storyId> --json
instant-drama media check-ffmpeg --json
```

Namespaces 包括：`actions` `activity` `ai` `app` `chapters` `characters` `comics` `costumes` `desktopNotify` `diagnostics` `gateway` `generation` `keyArt` `media` `mediaGen` `project` `props` `scenes` `settings` `shell` `souls` `spatial` `stories` `support` `timeline` `updates` `videoPrep` `webServer`。

## 近期 API 表面（1.11.3）

桌面、Web、CLI 共用同一 registry。優先用 **domain sugar** 或 `invoke`。

**1.8.0 進階碼板** **不加新 channel**。桌面「進階」把範本編入現有文字欄。角色／場景／道具／動作的 create／update 可把選擇 ID 寫入 `profileJson`（`appearanceKit`、`costumeKit`、`voiceKit`、`mannerismKit`、`locationKit`、`setDressingKit`、`cameraKit`、`propLookKit`、`motionKit`、`hardRulesKit`）。服裝館造型與故事風格／鐵則只套用文字（無 kit 袋）。圖像／影片處理程式仍只使用組裝後的文字。合約以 `channels describe characters:update` 為準。

**角色攝影集**只加 **一條** channel（`characters:renderPhotoBook`）。靜圖沿用現有 `mediaGen:*`（`kind=character-photoshoot`）。桌面出片走 `kind=character-photoshoot-clip`（與介紹片 MediaGen 步驟相同：提取 → 潤飾導演提示 → 跳過靜圖 → `videoPrep:confirm`），再以 `concatOnly` 串 **當前相冊**。短片提取以該相冊靜圖做像素底圖（人設參考只作視覺參考）。永久相冊記在 `profileJson.photoBook.albums`（舊頂層 `shots` 會遷入 `album_default`；不寫入身分 `refGalleryJson`）。桌面鏡頭範本在攝影集編輯欄選擇，出影片彈窗可再改。時間軸節拍與主視覺鏡頭同樣以 `cameraTemplateId` 記住（`timeline:update`／`keyArt:updateShot`）。MediaGen 靜圖（`timeline-still`、`key-art`、`story-cover`、`character-photoshoot`）與視頻 kind 可在 `mediaGen:extract` 傳 `introTemplateId`。CLI `ai-clips` 仍然使用 `introTemplateId`；可選 `albumId` 指定要串的相冊。

**空間交換包（1.11.3）**加 **五條** channel（`spatial:compileBeat`、`spatial:importPackage`、`spatial:attachRef`、`spatial:blenderStatus`、`spatial:generateMesh`）——合計 **189**。白模靜圖鎖定分鏡靜圖的走位，再走現有圖生影片。可選貼圖平面 glTF 只是走位代理，不是成片。Blender 是命令列客戶端——見 [blender-ZH.md](./blender-ZH.md)。請用 `channels describe`，此處不羅列全部 channel。

**十語 PromptCatalog**——角色表／場地板／換裝／幾何／畫質鎖與 packs 均為該語正文（準則為香港書面語）。`mediaGen:extract` 傳 `payload.locale`。不加 channel。

**導演臺（1.10.0）不加新 channel。** 時間軸條件軌把參考編譯成即時提示，把 `generation.run`／片段預備限制在工作區，並由桌面匯出 `idm-timeline-workflow` JSON。綁定仍走 `timeline:update`。

| Channel | 用途 | 示例 |
|---------|------|------|
| generate／AI fill | 可選 `promptTemplateId`（桌面配方選擇器；不再暗中套系統預設） | 桌面：生成前選擇配方。CLI：在 generate／fill／MediaGen payload 傳 `promptTemplateId` |
| `mediaGen:extract` | 建立材料 sections（庫頁 + `timeline-still`／`timeline-clip`／`key-art`／`story-cover`）。可選：`continuityMode`、`motionPriority`、`advancedIdentity`、`identityCollage`、`lookPackId`、`introTemplateId`（單鏡頭目錄）、`spatialPlayblastPath` | `instant-drama mediaGen extract --args '[{"kind":"timeline-clip","storyId":"S","entryId":"E","introTemplateId":"pov"}]' --json` |
| `mediaGen:polish` | 多圖視覺潤飾提示 | `instant-drama mediaGen polish --args '[{...}]' --json` |
| `mediaGen:generateImage` | 單張靜圖；timeline 會寫入 continuity 路徑 | `instant-drama mediaGen generate-image --args '[{...}]' --json` |
| `costumes:appendTryOnStill` | 試穿 still 追加至戲服多圖庫 | `instant-drama costumes append-try-on-still --args '[{"costumeId":"C","sourcePath":"/a.png"}]' --json` |
| `costumes:generateDressed` | 生成試穿靜圖 | `instant-drama costumes generate-dressed --args '[{...}]' --json` |
| `videoPrep:create` | 準備靜圖／開 clip 流程 | `instant-drama videoPrep create --args '[{"kind":"timeline-clip","storyId":"S","entryId":"E","stillOnly":true}]' --json` |
| `spatial:compileBeat` | 編譯 `idm-spatial-package`（身份靜圖 + 白模 playblast）。同組：`importPackage`、`attachRef`、`blenderStatus`、`generateMesh`（貼圖平面代理）。[blender-ZH.md](./blender-ZH.md) | `instant-drama spatial compile-beat --args '[{"storyId":"S","entryId":"E"}]' --json` |
| `videoPrep:confirm` | 由靜圖確認出片。timeline-clip 會由嚴格連續文脈組出 Seedance `lastFramePath`（Grok 會忽略）。攝影集短片（`character-photoshoot-clip`）把 `clipPath` 寫入 `profileJson.photoBook`（不寫入身分 gallery）。原生音訊跟設定 `generateAudio`／`grokVideoVoice`。 | `instant-drama videoPrep confirm --args '[{"kind":"timeline-clip","storyId":"S","entryId":"E","stillPath":"/still.png","professionalPrompt":"…"}]' --json` |
| `settings:set` | 合併設定；`generateAudio` + `grokVideoVoice`（`ara` `eve` `leo` `rex` `sal` `mio`） | `instant-drama settings set --args '[{"generateAudio":true,"grokVideoVoice":"ara"}]' --json` |
| `characters:renderPhotoBook` | 串一本攝影集**相冊**：`slideshow`（ffmpeg，CLI）、`ai-clips`（每張靜圖一條介紹式短片再串接——CLI）、或 `concatOnly:true`（桌面 MediaGen 出短片後只串現有 `clipPath`）。可選 `albumId`（缺省＝第一本，或含 `shotIds` 的那本）。可選 `introTemplateId` 會把鏡頭範本注入 CLI 短片潤飾（鏡頭亦可存 `cameraTemplateId`）。路徑在 `profileJson.photoBook.albums` | `instant-drama characters render-photo-book --args '[{"characterId":"C","mode":"ai-clips","albumId":"album_default","introTemplateId":"hero-walkin"}]' --json` |
| `characters:aiFill` | 可選 `referenceImagePaths`（與 `referenceImagePath` 合併；多圖上限） | `instant-drama characters ai-fill --args '[{"idea":"…","referenceImagePaths":["/a.png","/b.png"]}]' --json` |
| `generation:run` | 無介面整劇生成。會先補時間軸靜圖再出片。桌面「開始生成」是互動 `videoPrep`，**不會**走這條路徑。 | `instant-drama generation run STORY_ID --json` |
| `comics:get` | 取得或建立該故事的漫畫書 | `instant-drama comics get --args '["S"]' --json` |
| `comics:addPage`／`updatePage` | 新增或編輯頁（排板、開本、分格） | `instant-drama comics add-page --args '[{"storyId":"S","panelLayout":"grid-2x2"}]' --json` |
| `comics:deletePageVideo`／`setPageVideoPrimary` | 多版本本頁影片 | `instant-drama comics delete-page-video --args '["PAGE","VID"]' --json` |
| `keyArt:get` | 取得或建立該故事的劇照冊 | `instant-drama keyArt get --args '["S"]' --json` |
| `keyArt:addShot`／`updateShot` | 新增或編輯宣傳靜圖（題材、開本、出圖方式、`cameraTemplateId`） | `instant-drama keyArt update-shot --args '["SHOT",{"cameraTemplateId":"low-angle-hero"}]' --json` |
| `keyArt:setAsStoryCover` | 用成圖寫入 `Story.coverPath` | `instant-drama keyArt set-as-story-cover --args '["SHOT"]' --json` |
| `chapters:list`／`create`／`update`／`delete`／`reorder` | 故事章節正文 | `instant-drama chapters list --args '["S"]' --json` |
| `chapters:aiFill`／`aiPolish` | 生成或潤飾章節 | `instant-drama chapters ai-fill --args '[{"storyId":"S","idea":"…"}]' --json` |
| `chapters:generateCast` | 由章節預覽或寫入角色／場景／道具／動作 | `instant-drama chapters generate-cast --args '[{"storyId":"S","preview":true}]' --json` |
| `media:exportFinal` | 時間軸成片，或 `{ clipSource: "comics" }` 只串已有片的漫畫頁 | `instant-drama media export-final --args '["S",{"clipSource":"comics"}]' --json` |
| `desktopNotify:show` | 作業系統完成通知 | `instant-drama desktopNotify show --args '[{"title":"T","body":"B"}]' --json` |
| `timeline:getAdvancedPrep` | 進階預備 snapshot | `instant-drama timeline get-advanced-prep --args '["S"]' --json` |
| `timeline:setCastPrep` | 儲存 cast 鎖定 | `instant-drama timeline set-cast-prep --args '[{...}]' --json` |
| `timeline:clearEntryStill` | 清除該段 continuity 靜圖 | `instant-drama timeline clear-entry-still --args '[{...}]' --json` |
| `timeline:create`／`update` | 段落；多綁 `characterIds`（最多 4）、`sceneIds`（最多 2）、`propIds`（最多 4）、`actionIds`（最多 4）；可選 `cameraTemplateId` | `instant-drama timeline update --args '["E",{"cameraTemplateId":"pov"}]' --json` |
| `*:aiFill` 劇情焦點 | characters／scenes／props／actions／costumes（＋wardrobe）的 `suggestFromStory` + `segmentKeys` | 見下方 **劇情焦點／AI fill** |

### 劇情焦點／AI fill

`suggestFromStory: true` 必須帶 `storyId`。省略 `segmentKeys` 或傳 `[]` = **整個故事**（先章節正文，再段落）。Key 格式：`chapter:<id>`、`beat:<id>`（`scene:<id>` 仍可解析；桌面選擇器已不再列出場次）。單數 `segmentKey` **已棄用**。桌面預勾（已綁此實體的段落）**只限桌面** — CLI 須自行傳 keys。

```bash
instant-drama scenes ai-fill --args '[{"storyId":"S","suggestFromStory":true,"segmentKeys":["chapter:C1","beat:B1"]}]' --json
instant-drama characters ai-fill --args '[{"storyId":"S","suggestFromStory":true}]' --json
instant-drama channels describe scenes:aiFill --json
```

```bash
instant-drama channels list --filter mediaGen --json
instant-drama channels list --filter costumes --json
instant-drama channels describe costumes:appendTryOnStill --json
```

### 驗證 CLI（smoke）

```bash
bash scripts/cli-smoke.sh
# 或手動：
npm run instant-drama -- version
npm run instant-drama -- doctor --json          # 預期 channelCount 189
npm run instant-drama -- channels list --filter mediaGen --json
npm run instant-drama -- channels describe mediaGen:extract --json
npm run instant-drama -- channels describe costumes:appendTryOnStill --json
npm run instant-drama -- channels describe scenes:aiFill --json
npm run instant-drama -- channels describe characters:aiFill --json
npm run instant-drama -- channels describe videoPrep:confirm --json
npm run instant-drama -- help
```

可選 headless 資料面（`IDM_DATA_DIR` 內已 `prisma db push`）：

```bash
export IDM_DATA_DIR=./data
export DATABASE_URL="file:${IDM_DATA_DIR}/instant-drama.db"
npm run instant-drama -- --local --data-dir ./data stories list --json
```

FFmpeg：若 doctor 顯示不可用，可設 `FFMPEG_PATH`，或使用桌面內建 `ffmpeg-static`。

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
| Channel 數 | **189** |
| `instant-drama invoke` | ✅ 任意 channel |
| Domain sugar | ✅ 全部 namespace |
| OpenAI tool schema | ✅ |
| OpenClaw skill | ✅ `skills/idm/SKILL-ZH.md` |
| Headless 檔案對話框 | `IDM_PICK_FILE`／`IDM_SAVE_PATH` |

## 資料目錄（local）

| 情境 | 路徑 |
|------|------|
| CLI 預設 | `OS app data（見 appPaths／README）` 或 `IDM_DATA_DIR` |
| 開發常用 | `./data` |
| 安裝版桌面 | `~/.config/instant-drama-magician/` |
| 開發桌面 | `~/.config/instant-drama-magician-dev/` |

## 相關

- [agent-cli-ZH.md](./agent-cli-ZH.md) · [self-host-ZH.md](./self-host-ZH.md) · [architecture-ZH.md](./architecture-ZH.md)  
- 產品：[../README-ZH.md](../README-ZH.md) · 聯絡：[email@ysk.hk](mailto:email@ysk.hk)
