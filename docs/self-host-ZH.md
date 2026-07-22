# 自架 — 瀏覽器控制（Web Service）

> **語言：** [English](./self-host.md) · [中文](./self-host-ZH.md)

把 InstantDrama Magician 裝成 **server**，用瀏覽器操作。  
桌面 Electron 版繼續可用；Web 與桌面共用同一套業務 handlers（**157** channels）。

## 需求

- Node.js 20+
- FFmpeg：`ffmpeg-static` 或 `FFMPEG_PATH`
- 磁碟空間：媒體庫 + 生成檔

## 方式 A — 桌面 App 設定開關（推薦）

1. 開啟 Electron 桌面版  
2. **設定 → 應用程式 → 網頁伺服器（瀏覽器控制）**  
3. 勾選啟用（自動產生登入權杖）  
4. 複製網址／權杖，用瀏覽器開啟  

- 與桌面 **共用同一 userData**（故事、媒體、API 設定）  
- 重開 app 若仍啟用會自動再開 server  
- 連接埠、僅本機／區網、重新產生權杖均可在設定改  

完整瀏覽器 UI 需要已建置 SPA：`npm run build:web`（打包版已內含）。

## 方式 B — 獨立 CLI 進程

```bash
cd instant-drama-magician
npm install
npm run build:web
npm link   # 可選

export IDM_DATA_DIR=/var/lib/instant-drama
export IDM_AUTH_TOKEN='your-long-secret'
export IDM_PORT=8787
export IDM_HOST=0.0.0.0
export DATABASE_URL="file:${IDM_DATA_DIR}/instant-drama.db"
npx prisma db push
instant-drama server start
# 開啟 http://SERVER:8787/ 並貼上 IDM_AUTH_TOKEN

export IDM_URL=http://127.0.0.1:8787
export IDM_TOKEN="$IDM_AUTH_TOKEN"
instant-drama doctor --json
instant-drama stories list --json
```

本機一鍵（建置 + schema + 免權杖）：

```bash
npm run dev:web
# http://127.0.0.1:8787  · IDM_AUTH_DISABLED=1
```

## 環境變數

| 變數 | 預設 | 說明 |
|------|------|------|
| `IDM_DATA_DIR` | `./data` | SQLite、settings.json、media/、logs/ |
| `IDM_PORT` | `8787` | HTTP port |
| `IDM_HOST` | `0.0.0.0` | bind address |
| `IDM_AUTH_TOKEN` | （空） | Bearer token；**公網務必設定** |
| `IDM_AUTH_DISABLED` | 否 | `1` = 關閉驗證（只限可信內網／本機） |
| `IDM_STATIC_DIR` | `./out/renderer` | SPA 靜態目錄 |
| `IDM_DATABASE_URL` | `file:$DATA_DIR/instant-drama.db` | 可選覆寫 |
| `FFMPEG_PATH` | 自動 | FFmpeg 二進位 |

未設 token 且未 disable：僅允許 **loopback** 連線。

## API（V1）

| 方法 | 路徑 | 說明 |
|------|------|------|
| GET | `/api/health` | 健康檢查（無需 auth） |
| POST | `/api/invoke` | `{ "channel": "stories:list", "args": [] }` |
| GET | `/api/media?p=` | 媒體預覽（需 auth；server 絕對路徑） |
| GET | `/api/download?p=` | 附件下載 |
| POST | `/api/upload?name=` | 原始 body 上載 → `media/uploads/` |
| GET | `/api/channels` | 已註冊 channel 列表（約 157） |

瀏覽器 UI 經 `HttpAppClient` 把 API 轉成 channel invoke。

## 桌面與 Web 差異

業務 channel 使用 **同一 runtime**。差異在殼層 UX：

| 功能 | Web／自架 |
|------|-----------|
| 故事／角色／場景／道具／戲服／時間軸／生成／匯出 | ✅ |
| 設定、AI status、模型、備份相關 channel | ✅ |
| 媒體預覽／下載／上載 API | ✅ |
| 原生 OS 檔案對話框 | 經上載 API／`IDM_PICK_FILE` 替代 |
| 系統選單、桌面圖示、electron-updater | **僅桌面** |
| 與 Electron 同一 userData | 僅方式 A；方式 B 用 `IDM_DATA_DIR` |

若 channel 回 `NOT_FOUND`：用 `GET /api/channels`／`instant-drama channels list` 確認版本——不是「Web 未 port」。

## 反向代理（建議 HTTPS）

```
instant-drama.example.com {
  reverse_proxy 127.0.0.1:8787
}
```

## 安全

1. 公網必須設強 `IDM_AUTH_TOKEN`  
2. 建議 bind `127.0.0.1` + reverse proxy TLS  
3. 供應商 API key 只存在 server `settings.json`  
4. 媒體 path 限制在 `DATA_DIR` 內  

## 資料目錄結構

```
$IDM_DATA_DIR/
  instant-drama.db
  settings.json
  media/
  logs/activity.jsonl
```

## 故障排除

- **503 SPA not built** → `npm run build:web`  
- **401** → token／`IDM_AUTH_TOKEN` 不對  
- **NOT_FOUND channel** → 升級 server；應約 157 channels  
- **FFmpeg** → `ffmpeg-static` 或 `FFMPEG_PATH`  

## 相關

- [cli-ZH.md](./cli-ZH.md) · [agent-cli-ZH.md](./agent-cli-ZH.md) · 聯絡 [email@ysk.hk](mailto:email@ysk.hk)
