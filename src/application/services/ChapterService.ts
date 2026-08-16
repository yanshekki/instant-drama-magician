import type { PrismaClient } from '../../types/prisma'
import type {
  Chapter,
  CreateChapterInput,
  UpdateChapterInput
} from '../../types/domain'
import { AppError } from '../../types/errors'
import { reindexOrders } from '../../domain/timeline'

let chapterSchemaReady = false

/** Existing user DBs predate Chapter — create the table without prisma CLI. */
export async function ensureChapterSchema(prisma: PrismaClient): Promise<void> {
  if (chapterSchemaReady) return
  try {
    await prisma.chapter.findFirst({ select: { id: true } })
    chapterSchemaReady = true
    return
  } catch {
    /* table missing */
  }
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "Chapter" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "storyId" TEXT NOT NULL,
      "order" INTEGER NOT NULL,
      "title" TEXT NOT NULL,
      "body" TEXT NOT NULL DEFAULT '',
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL,
      CONSTRAINT "Chapter_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "Story" ("id") ON DELETE CASCADE ON UPDATE CASCADE
    )
  `)
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "Chapter_storyId_order_idx" ON "Chapter"("storyId", "order")`
  )
  chapterSchemaReady = true
}

export function resetChapterSchemaFlag(): void {
  chapterSchemaReady = false
}

function mapRow(row: {
  id: string
  storyId: string
  order: number
  title: string
  body: string
  createdAt?: Date | string
  updatedAt?: Date | string
}): Chapter {
  return {
    id: row.id,
    storyId: row.storyId,
    order: row.order,
    title: row.title,
    body: row.body,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  }
}

export class ChapterService {
  constructor(private readonly prisma: PrismaClient) {}

  async list(storyId: string): Promise<Chapter[]> {
    await ensureChapterSchema(this.prisma)
    await this.ensureStory(storyId)
    const rows = await this.prisma.chapter.findMany({
      where: { storyId },
      orderBy: { order: 'asc' }
    })
    return rows.map(mapRow)
  }

  async create(input: CreateChapterInput): Promise<Chapter> {
    await ensureChapterSchema(this.prisma)
    await this.ensureStory(input.storyId)
    const max = await this.prisma.chapter.aggregate({
      where: { storyId: input.storyId },
      _max: { order: true }
    })
    const order = (max._max.order ?? -1) + 1
    const title = (input.title ?? '').trim()
    const row = await this.prisma.chapter.create({
      data: {
        storyId: input.storyId,
        order,
        title,
        body: (input.body ?? '').trim()
      }
    })
    return mapRow(row)
  }

  async update(id: string, data: UpdateChapterInput): Promise<Chapter> {
    await ensureChapterSchema(this.prisma)
    const existing = await this.prisma.chapter.findUnique({ where: { id } })
    if (!existing) {
      throw new AppError('NOT_FOUND', 'errors.chapterNotFound', String(id))
    }
    const row = await this.prisma.chapter.update({
      where: { id },
      data: {
        ...(data.title !== undefined ? { title: data.title.trim() } : {}),
        ...(data.body !== undefined ? { body: data.body.trim() } : {})
      }
    })
    return mapRow(row)
  }

  async delete(id: string): Promise<{ ok: true }> {
    await ensureChapterSchema(this.prisma)
    const existing = await this.prisma.chapter.findUnique({ where: { id } })
    if (!existing) {
      throw new AppError('NOT_FOUND', 'errors.chapterNotFound', String(id))
    }
    await this.prisma.chapter.delete({ where: { id } })
    return { ok: true }
  }

  async reorder(storyId: string, orderedIds: string[]): Promise<Chapter[]> {
    await ensureChapterSchema(this.prisma)
    await this.ensureStory(storyId)
    const indexMap = reindexOrders(orderedIds)
    await this.prisma.$transaction(
      orderedIds.map((id) =>
        this.prisma.chapter.update({
          where: { id },
          data: { order: indexMap.get(id) ?? 0 }
        })
      )
    )
    return this.list(storyId)
  }

  async replaceAll(
    storyId: string,
    items: Array<{ title: string; body: string }>
  ): Promise<Chapter[]> {
    await ensureChapterSchema(this.prisma)
    await this.ensureStory(storyId)
    await this.prisma.chapter.deleteMany({ where: { storyId } })
    if (items.length > 0) {
      await this.prisma.chapter.createMany({
        data: items.map((c, i) => ({
          storyId,
          order: i,
          title: c.title.trim(),
          body: c.body.trim()
        }))
      })
    }
    return this.list(storyId)
  }

  async appendAll(
    storyId: string,
    items: Array<{ title: string; body: string }>
  ): Promise<Chapter[]> {
    await ensureChapterSchema(this.prisma)
    await this.ensureStory(storyId)
    if (items.length === 0) {
      return this.list(storyId)
    }
    const max = await this.prisma.chapter.aggregate({
      where: { storyId },
      _max: { order: true }
    })
    const start = (max._max.order ?? -1) + 1
    await this.prisma.chapter.createMany({
      data: items.map((c, i) => ({
        storyId,
        order: start + i,
        title: c.title.trim(),
        body: c.body.trim()
      }))
    })
    return this.list(storyId)
  }

  private async ensureStory(storyId: string): Promise<void> {
    const story = await this.prisma.story.findUnique({
      where: { id: storyId },
      select: { id: true }
    })
    if (!story) {
      throw new AppError('NOT_FOUND', 'errors.storyNotFound', String(storyId))
    }
  }
}
