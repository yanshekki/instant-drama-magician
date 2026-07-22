# 測試指南

> **語言：** [English](./testing.md) · [中文](./testing-ZH.md)

## 指令

```bash
npm test                 # 全部單元 + 契約測試
npm run test:integration # *.integration.test.ts
npm run test:coverage    # 覆蓋率 → coverage/
npm run test:ci          # CI 入口（coverage）
```

## 佈局

| 區域 | 位置 |
|------|------|
| Helpers | `src/test/`（mockPrisma、tempRuntime、renderWithProviders） |
| Domain | `src/domain/*.test.ts` |
| Services | `src/application/services/*.test.ts` |
| CLI | `src/cli/**/*.test.ts` |
| Runtime／契約 | `src/runtime/*`、`src/contract/*` |
| Presentation | `src/presentation/**/*.test.tsx`（happy-dom） |
| Electron | `electron/*.contract.test.ts` |

## 近期焦點（1.3.3）

| 區域 | 測試（示例） |
|------|----------------|
| 時間軸連續性 | `writeClipContinuityStill`、`resolveTimelineStillRefs`、片尾 heal |
| MediaGen timeline | `mediaGen.test.ts`、`timelineMediaGen.test.ts` |
| MediaGen Host | `MediaGenHost.test.tsx`（`idm:timeline-still-done`） |
| 進階 studio | `TimelineAdvancedStudio.test.tsx`（精修 → `startMediaGen`） |
| 戲服雙寫 | `costumes:appendTryOnStill`、`AiJobsContext` |
| 共用圖庫 | `EntityGalleryPanel.test.tsx` |

```bash
npx vitest run src/runtime/handlers/mediaGen.test.ts \
  src/presentation/components/MediaGenHost.test.tsx \
  src/domain/timelineMediaGen.test.ts \
  src/application/video/writeClipContinuityStill.test.ts
```

## 標準

- 不打真實外網 AI  
- 檔案系統／SQLite 整合用暫存目錄  
- 服務單元測試 mock Prisma  
- 覆蓋率門檻在 `vitest.config.ts` 漸進提高  

## 覆蓋現況

| 指標 | 狀態 |
|------|------|
| 模組 companion 測試 | 生產模組 **100%**（+ electron／server 入口） |
| 行覆蓋（整體） | 漸進（整體約 22%；UI／handlers 為 smoke） |
| Channel 註冊數 | **157/157** 契約 + 安全 invoke 矩陣 |

## Channel 對齊

`src/contract/channels.contract.test.ts` + `channelParity.test.ts` 確保 headless runtime 維持 **157** 個 IPC channel。  
`channelInvoke.matrix.test.ts` 對安全無參 channel 做 invoke，不應 `NOT_FOUND`。

## 相關

- 語系對齊：`npm run locales:verify`  
- [architecture-ZH.md](./architecture-ZH.md) · [cli-ZH.md](./cli-ZH.md)
