# Production UX（Round 8）

> **語言：** [English](./production-ux.md) · [中文](./production-ux-ZH.md)

在 Beta 之上補齊 **可控生成、對白音軌、人物一致性、可分發打包**。

## 能力一覽

| 能力 | 說明 |
|------|------|
| 取消生成 | 全管線與單 clip 皆可 `generation:cancel` |
| 只重試失敗 | 只跑 `video` step（跳過 script…export） |
| 即時進度 | clip 狀態徽章 + job id |
| 對白 TTS | 可選合成並 `adelay` 混入成片 |
| BGM | 可選路徑 + 音量 |
| 人物參考圖 | Characters 頁；缺圖 live 警告 |
| Style bible | Story `styleNote` 注入 clip prompt |
| 片段連貫 | 上一段**片尾幀** continuity 靜圖 + prompt 鎖定；多 ref 潤飾；批量補齊較前缺圖段落 |
| MediaGen 殼 | 材料 → 潤飾 → 出圖／出片（庫頁與時間軸**精修**） |
| 戲服試穿雙寫 | 接受試穿 still → 角色圖庫**及**戲服多圖庫 |
| 匯出開資料夾 | 儲存後 `openExportFolder` |
| 打包 | `npm run pack` → `release/linux-unpacked` |

## 建議試用路徑

1. 載入 Demo（含 styleNote）  
2. 人物頁加參考圖  
3. 時間軸 → 生成此段／開始生成  
4. 設定可選開 TTS + BGM  
5. 匯出成片 → 自動開資料夾  

## 仍未做／邊界

- 代碼簽章、商店上架（需自備憑證）  
- 多軌 NLE  
- 商用級 TTS／自動配樂  

> **v1.0.0 之後已補：** 多平台 GitHub Release、electron-updater、活動日誌與支援報告、完整 CLI／Web **157** channels。見 [commercial-ZH.md](./commercial-ZH.md)。

RC 轉場／比例：[rc-ZH.md](./rc-ZH.md)。發版：[release-ZH.md](./release-ZH.md)。
