# 瞬劇魔法師（InstantDrama Magician） - Professional Project Specification

**Project Name**：瞬劇魔法師（InstantDrama Magician）  
**Tagline**：AI 專業短劇生成桌面工具  
**Type**：Cross-platform Electron Desktop Application

## Project Goal
建立一個專業、模組化、可擴展嘅 AI 短劇生成器。用戶可透過獨立頁面創作人物、場景、道具、多個故事，再透過線性時間軸控制生成短劇影片。  
系統支援從 idea 到完整短劇影片之全流程生成，並因應 AI video 長度限制提供精準時間軸管理。

## Core Tech Stack
- **Frontend**：React 18 + TypeScript + TailwindCSS + Vite
- **Desktop**：Electron (latest) + electron-vite
- **Database**：SQLite + Prisma ORM
- **Language**：TypeScript（strict mode，獨立 types/interfaces）
- **AI**：Grok CLI（透過 https://github.com/yanshekki/Grok-Cli-to-OpenAI-compatible 包裝成 OpenAI-compatible client）
- **i18n**：react-i18next（zh-HK 使用標準香港書面語繁體中文，en 使用標準英文）
- **Media**：FFmpeg、Konva.js / Fabric.js（canvas）、自訂 timeline

## Professional Architecture（Layered + Modular）

採用 Clean Architecture + Feature-Sliced Design：

### Layers
- **Presentation Layer**：React pages、components、hooks
- **Application Layer**：Services（GenerationService、TimelineService 等）
- **Domain Layer**：純 TypeScript domain entities 與 interfaces（獨立於框架）
- **Infrastructure Layer**：Prisma、AI Client、FFmpeg、Electron IPC

### 關鍵可重用模組
- **AI Client**：使用 Grok CLI wrapper 作為 OpenAI-compatible client，實作 `AIProvider` interface
- **Generation Pipeline**：可組合 steps（ScriptStep、CharacterStep、SceneStep、PropsStep、TimelineStep、ExportStep）
- **Timeline Control**：線性時間軸（因 AI video 長度限制），支援拖拉引用人物、場景、道具、對白
- **Domain Types**：獨立 `src/types/domain/` 資料夾

### 獨立創作頁面（必須實作）
1. **Stories Page**（多個故事管理）：建立、列表、管理多個獨立故事
2. **Characters Page**（人物創作）：獨立創作人物，可匯入 soulmd-hub.ysk.hk 之 soul.md 檔案作為人物靈魂設定
3. **Scenes Page**（場景創作）：獨立創作場景
4. **Props Page**（道具創作）：獨立創作道具
5. **Timeline Page**（線性時間軸控制）：主創作頁面，可引用上述人物、場景、道具、對白，並控制時間線（因 AI video 長度限制）

### Prisma Schema（SQLite）
```prisma
generator client { provider = "prisma-client-js" }
datasource db { provider = "sqlite" url = "file:./dev.db" }

model Story {
  id          String   @id @default(cuid())
  title       String
  status      StoryStatus @default(DRAFT)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  characters  Character[]
  scenes      Scene[]
  props       Prop[]
  timeline    TimelineEntry[]
}

model Character {
  id           String @id @default(cuid())
  storyId      String
  name         String
  soulMdPath   String?   // soulmd-hub.ysk.hk 匯入之路徑
  description  String
  refImagePath String?

  story        Story @relation(fields: [storyId], references: [id])
}

model Scene {
  id          String @id @default(cuid())
  storyId     String
  sceneNumber Int
  description String
  script      String?

  story       Story @relation(fields: [storyId], references: [id])
}

model Prop {
  id          String @id @default(cuid())
  storyId     String
  name        String
  description String

  story       Story @relation(fields: [storyId], references: [id])
}

model TimelineEntry {
  id          String   @id @default(cuid())
  storyId     String
  startTime   Float    // 秒數（線性時間控制）
  endTime     Float
  characterId String?
  sceneId     String?
  propId      String?
  dialogue    String?
  order       Int

  story       Story @relation(fields: [storyId], references: [id])
}

enum StoryStatus { DRAFT GENERATING COMPLETED FAILED }
enum SceneStatus   { PENDING GENERATING COMPLETED FAILED }
```

## TypeScript Strategy
- 所有 domain entities 使用獨立 interface（`src/types/domain/`）
- 嚴格 `strict: true`，禁止 `any`
- Prisma Client types 自動生成並存放於 `types/prisma/`

## Folder Structure
```
instant-drama-magician/
├── electron/
├── prisma/
├── src/
│   ├── application/      # Services
│   ├── domain/           # Domain logic
│   ├── infrastructure/   # Prisma, AI Client (Grok CLI wrapper), FFmpeg
│   ├── presentation/     # Pages (StoriesPage, CharactersPage, ScenesPage, PropsPage, TimelinePage)
│   ├── types/            # 獨立 types 層
│   ├── locales/          # zh-HK（標準香港書面語繁體）+ en
│   └── lib/
├── package.json
└── tsconfig.json
```

## Grok Build 執行任務（請按順序執行）
1. 初始化 Electron + Vite + React + TypeScript 專案（strict mode）。
2. 安裝並設定 Prisma + SQLite，生成以上 schema。
3. 建立 `src/types/domain/` 並定義所有 interface。
4. 整合 Grok CLI wrapper（https://github.com/yanshekki/Grok-Cli-to-OpenAI-compatible）作為 AI Client，並實作 `AIProvider` interface。
5. 建立五個獨立頁面：Stories、Characters（支援 soul.md 匯入）、Scenes、Props、Timeline（線性時間軸 + 引用功能）。
6. 加入 react-i18next 並建立 zh-HK（標準書面語繁體）+ en 語言包。
7. 實作線性時間軸控制（引用人物、場景、道具、對白）。
8. 建立基本 Generation Pipeline。

請以專業、可維護方式生成 starter code，先完成 architecture 骨架與頁面結構。

**Success Criteria**：專案必須 type-safe、模組化，所有創作頁面獨立且可透過時間軸互相引用。
