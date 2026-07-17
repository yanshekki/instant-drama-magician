# Production UX（Round 8）

試用深化層：在 Beta 之上補齊 **可控生成、對白音軌、人物一致性、可分發打包**。

## 能力一覽

| 能力 | 說明 |
|------|------|
| 取消生成 | 全管線與單 clip 皆可 `generation:cancel` |
| 只重試失敗 | 只跑 `video` step（跳過 script…export） |
| 即時進度 | clip 狀態徽章 + job id 摘要 |
| 對白 TTS | Settings 開啟後，匯出時合成並 `adelay` 混入成片 |
| BGM | 可選路徑 + 音量滑桿 |
| 人物參考圖 | Characters 頁選圖；缺圖 live 警告 |
| Style bible | Story `styleNote` 注入 clip prompt |
| 片段連貫 | 前一段摘要寫入下一 prompt |
| 匯出開資料夾 | `openExportFolder` 預設開啟 |
| 打包 | `npm run pack` → `release/linux-unpacked` |

## 建議試用路徑

1. 載入 Demo（含 styleNote）  
2. 人物頁為角色加參考圖  
3. 時間軸 → 生成此段 / 開始生成  
4. Settings 可選開 TTS + BGM  
5. 匯出成片 → 自動在資料夾顯示  

## 已知仍未做（商業發行）

- 代碼簽章、商店上架  
- 多軌 NLE  
- 商用級 TTS 模型 / 自動配樂  

見 [release.md](./release.md)。
