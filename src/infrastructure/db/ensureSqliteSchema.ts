/**
 * First-run SQLite schema for packaged installs (no `prisma db push`).
 *
 * Prisma Client does not create tables. Fresh Windows/macOS/Linux installers
 * therefore open an empty file and every query fails. Chapter/Comic/KeyArt
 * already self-create; this covers the rest, idempotently.
 *
 * Regenerate the DDL with:
 *   npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script
 */
import type { PrismaClient } from '../../types/prisma'

const INIT_STATEMENTS: string[] = [
  `CREATE TABLE IF NOT EXISTS "Story" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "exportPath" TEXT,
    "styleNote" TEXT,
    "artStyle" TEXT,
    "coverPath" TEXT,
    "refGalleryJson" TEXT,
    "hardRules" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS "Chapter" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "storyId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Chapter_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "Story" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS "Character" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "soulMdPath" TEXT,
    "description" TEXT NOT NULL,
    "refImagePath" TEXT,
    "appearance" TEXT,
    "personality" TEXT,
    "backstory" TEXT,
    "costume" TEXT,
    "ageRange" TEXT,
    "gender" TEXT,
    "voiceDesc" TEXT,
    "spokenLanguages" TEXT,
    "mannerisms" TEXT,
    "relationships" TEXT,
    "visualTags" TEXT,
    "seedPrompt" TEXT,
    "hardRules" TEXT,
    "profileJson" TEXT,
    "refSheetPath" TEXT,
    "refGalleryJson" TEXT,
    "soulHubId" INTEGER,
    "artStyle" TEXT,
    "costumesJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS "Costume" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "artStyle" TEXT,
    "refImagePath" TEXT,
    "refGalleryJson" TEXT,
    "seedPrompt" TEXT,
    "hardRules" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS "CharacterCostume" (
    "characterId" TEXT NOT NULL,
    "costumeId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "dressedImagePath" TEXT,
    PRIMARY KEY ("characterId", "costumeId"),
    CONSTRAINT "CharacterCostume_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CharacterCostume_costumeId_fkey" FOREIGN KEY ("costumeId") REFERENCES "Costume" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS "Scene" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "description" TEXT NOT NULL,
    "script" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "title" TEXT,
    "locationType" TEXT,
    "timeOfDay" TEXT,
    "weather" TEXT,
    "mood" TEXT,
    "lighting" TEXT,
    "colorPalette" TEXT,
    "setDressing" TEXT,
    "soundscape" TEXT,
    "cameraNotes" TEXT,
    "visualTags" TEXT,
    "artStyle" TEXT,
    "refImagePath" TEXT,
    "refGalleryJson" TEXT,
    "looksJson" TEXT,
    "profileJson" TEXT,
    "seedPrompt" TEXT,
    "hardRules" TEXT,
    "locationKey" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS "Prop" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "material" TEXT,
    "sizeNotes" TEXT,
    "condition" TEXT,
    "visualTags" TEXT,
    "artStyle" TEXT,
    "refImagePath" TEXT,
    "refGalleryJson" TEXT,
    "profileJson" TEXT,
    "seedPrompt" TEXT,
    "hardRules" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS "StoryCharacter" (
    "storyId" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "roleNote" TEXT,
    "costumeId" TEXT,
    PRIMARY KEY ("storyId", "characterId"),
    CONSTRAINT "StoryCharacter_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "Story" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StoryCharacter_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StoryCharacter_costumeId_fkey" FOREIGN KEY ("costumeId") REFERENCES "Costume" ("id") ON DELETE SET NULL ON UPDATE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS "StoryScene" (
    "storyId" TEXT NOT NULL,
    "sceneId" TEXT NOT NULL,
    "sceneNumber" INTEGER NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "scriptOverride" TEXT,
    "statusOverride" TEXT,
    PRIMARY KEY ("storyId", "sceneId"),
    CONSTRAINT "StoryScene_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "Story" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StoryScene_sceneId_fkey" FOREIGN KEY ("sceneId") REFERENCES "Scene" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS "StoryProp" (
    "storyId" TEXT NOT NULL,
    "propId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY ("storyId", "propId"),
    CONSTRAINT "StoryProp_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "Story" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StoryProp_propId_fkey" FOREIGN KEY ("propId") REFERENCES "Prop" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS "Action" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "motionNotes" TEXT,
    "intention" TEXT,
    "cameraNotes" TEXT,
    "panelLayout" TEXT,
    "visualTags" TEXT,
    "artStyle" TEXT,
    "refImagePath" TEXT,
    "refGalleryJson" TEXT,
    "castRefsJson" TEXT,
    "profileJson" TEXT,
    "seedPrompt" TEXT,
    "hardRules" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS "StoryAction" (
    "storyId" TEXT NOT NULL,
    "actionId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY ("storyId", "actionId"),
    CONSTRAINT "StoryAction_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "Story" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StoryAction_actionId_fkey" FOREIGN KEY ("actionId") REFERENCES "Action" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS "TimelineEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "storyId" TEXT NOT NULL,
    "startTime" REAL NOT NULL,
    "endTime" REAL NOT NULL,
    "characterId" TEXT,
    "sceneId" TEXT,
    "propId" TEXT,
    "actionId" TEXT,
    "characterIds" TEXT,
    "sceneIds" TEXT,
    "propIds" TEXT,
    "actionIds" TEXT,
    "dialogue" TEXT,
    "beatContentJson" TEXT,
    "cameraTemplateId" TEXT,
    "order" INTEGER NOT NULL,
    "mediaPath" TEXT,
    "mediaStatus" TEXT NOT NULL DEFAULT 'EMPTY',
    "mediaError" TEXT,
    "videoJobId" TEXT,
    CONSTRAINT "TimelineEntry_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "Story" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TimelineEntry_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "TimelineEntry_sceneId_fkey" FOREIGN KEY ("sceneId") REFERENCES "Scene" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "TimelineEntry_propId_fkey" FOREIGN KEY ("propId") REFERENCES "Prop" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "TimelineEntry_actionId_fkey" FOREIGN KEY ("actionId") REFERENCES "Action" ("id") ON DELETE SET NULL ON UPDATE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS "Comic" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "storyId" TEXT NOT NULL,
    "title" TEXT,
    "artStyle" TEXT,
    "hardRules" TEXT,
    "pageFormat" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Comic_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "Story" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS "ComicPage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "comicId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "panelLayout" TEXT NOT NULL,
    "pageFormat" TEXT,
    "artStyle" TEXT,
    "panelScriptJson" TEXT,
    "imagePath" TEXT,
    "videoPath" TEXT,
    "videoGalleryJson" TEXT,
    "refGalleryJson" TEXT,
    "mediaStatus" TEXT NOT NULL DEFAULT 'EMPTY',
    "mediaError" TEXT,
    "seedPrompt" TEXT,
    "hardRules" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ComicPage_comicId_fkey" FOREIGN KEY ("comicId") REFERENCES "Comic" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS "KeyArt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "storyId" TEXT NOT NULL,
    "title" TEXT,
    "artStyle" TEXT,
    "hardRules" TEXT,
    "pageFormat" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "KeyArt_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "Story" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS "KeyArtShot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "keyArtId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "shotType" TEXT NOT NULL,
    "makeMethod" TEXT,
    "pageFormat" TEXT,
    "artStyle" TEXT,
    "brief" TEXT,
    "cameraTemplateId" TEXT,
    "characterIdsJson" TEXT,
    "sceneId" TEXT,
    "timelineEntryId" TEXT,
    "comicPageId" TEXT,
    "imagePath" TEXT,
    "imageGalleryJson" TEXT,
    "mediaStatus" TEXT NOT NULL DEFAULT 'EMPTY',
    "mediaError" TEXT,
    "seedPrompt" TEXT,
    "hardRules" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "KeyArtShot_keyArtId_fkey" FOREIGN KEY ("keyArtId") REFERENCES "KeyArt" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,
  `CREATE INDEX IF NOT EXISTS "Chapter_storyId_order_idx" ON "Chapter"("storyId", "order")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "StoryScene_storyId_sceneNumber_key" ON "StoryScene"("storyId", "sceneNumber")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "Comic_storyId_key" ON "Comic"("storyId")`,
  `CREATE INDEX IF NOT EXISTS "ComicPage_comicId_order_idx" ON "ComicPage"("comicId", "order")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "KeyArt_storyId_key" ON "KeyArt"("storyId")`,
  `CREATE INDEX IF NOT EXISTS "KeyArtShot_keyArtId_order_idx" ON "KeyArtShot"("keyArtId", "order")`
]

export function sqliteInitStatementCount(): number {
  return INIT_STATEMENTS.length
}

function hasRawApi(
  prisma: PrismaClient
): prisma is PrismaClient & {
  $queryRaw: PrismaClient['$queryRaw']
  $executeRawUnsafe: PrismaClient['$executeRawUnsafe']
} {
  return (
    typeof prisma?.$queryRaw === 'function' &&
    typeof prisma.$executeRawUnsafe === 'function'
  )
}

/** Create missing tables on an empty SQLite file. Returns true if DDL ran. */
export async function ensureSqliteSchema(
  prisma: PrismaClient
): Promise<boolean> {
  if (!hasRawApi(prisma)) return false
  try {
    await prisma.$queryRaw`SELECT 1 FROM "Story" LIMIT 1`
    return false
  } catch {
    /* empty file / missing table */
  }
  for (const sql of INIT_STATEMENTS) {
    await prisma.$executeRawUnsafe(sql)
  }
  return true
}
