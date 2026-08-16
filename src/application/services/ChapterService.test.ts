import { readFileSync } from 'fs'
import { join } from 'path'
import { describe, expect, it, vi } from 'vitest'
import { ChapterService, ensureChapterSchema, resetChapterSchemaFlag } from './ChapterService'
import { createMockPrisma } from '../../test/mockPrisma'
import { AppError } from '../../types/errors'

function prismaWithStory() {
  const prisma = createMockPrisma()
  ;(prisma.story.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
    id: 's1'
  })
  return prisma
}

describe('ChapterService', () => {
  it('ensureChapterSchema creates table when findFirst throws', async () => {
    resetChapterSchemaFlag()
    const prisma = createMockPrisma()
    ;(prisma.chapter.findFirst as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error('no such table: Chapter')
    )
    prisma.$executeRawUnsafe = vi.fn().mockResolvedValue(0)
    await ensureChapterSchema(prisma as never)
    expect(prisma.$executeRawUnsafe).toHaveBeenCalled()
    await ensureChapterSchema(prisma as never)
    expect(prisma.$executeRawUnsafe).toHaveBeenCalledTimes(2)
  })

  it('schema cascade-deletes chapters with the story', () => {
    const schema = readFileSync(
      join(process.cwd(), 'prisma/schema.prisma'),
      'utf8'
    )
    expect(schema).toMatch(/model Chapter[\s\S]*onDelete: Cascade/)
  })

  it('list requires an existing story and orders by order', async () => {
    const prisma = createMockPrisma()
    const svc = new ChapterService(prisma as never)
    await expect(svc.list('missing')).rejects.toMatchObject({
      code: 'NOT_FOUND'
    })
    const ok = prismaWithStory()
    ;(ok.chapter.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: 'c1', storyId: 's1', order: 0, title: 'One', body: 'A' }
    ])
    const rows = await new ChapterService(ok as never).list('s1')
    expect(ok.chapter.findMany).toHaveBeenCalledWith({
      where: { storyId: 's1' },
      orderBy: { order: 'asc' }
    })
    expect(rows[0]).toMatchObject({ id: 'c1', title: 'One', body: 'A' })
  })

  it('create appends after max order', async () => {
    const prisma = prismaWithStory()
    ;(prisma.chapter.aggregate as ReturnType<typeof vi.fn>).mockResolvedValue({
      _max: { order: 2 }
    })
    ;(prisma.chapter.create as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'c3',
      storyId: 's1',
      order: 3,
      title: 'Three',
      body: 'body'
    })
    const row = await new ChapterService(prisma as never).create({
      storyId: 's1',
      title: '  Three  ',
      body: '  body  '
    })
    expect(prisma.chapter.create).toHaveBeenCalledWith({
      data: {
        storyId: 's1',
        order: 3,
        title: 'Three',
        body: 'body'
      }
    })
    expect(row.order).toBe(3)
  })

  it('update and delete throw when missing', async () => {
    const prisma = createMockPrisma()
    const svc = new ChapterService(prisma as never)
    await expect(svc.update('x', { title: 'T' })).rejects.toBeInstanceOf(
      AppError
    )
    await expect(svc.delete('x')).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })

  it('update trims fields', async () => {
    const prisma = createMockPrisma()
    ;(prisma.chapter.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'c1'
    })
    ;(prisma.chapter.update as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'c1',
      storyId: 's1',
      order: 0,
      title: 'T',
      body: 'B'
    })
    await new ChapterService(prisma as never).update('c1', {
      title: '  T  ',
      body: '  B  '
    })
    expect(prisma.chapter.update).toHaveBeenCalledWith({
      where: { id: 'c1' },
      data: { title: 'T', body: 'B' }
    })
  })

  it('delete removes the row', async () => {
    const prisma = createMockPrisma()
    ;(prisma.chapter.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'c1'
    })
    ;(prisma.chapter.delete as ReturnType<typeof vi.fn>).mockResolvedValue({})
    await expect(
      new ChapterService(prisma as never).delete('c1')
    ).resolves.toEqual({ ok: true })
  })

  it('reorder writes 0-based order then lists', async () => {
    const prisma = prismaWithStory()
    ;(prisma.chapter.update as ReturnType<typeof vi.fn>).mockResolvedValue({})
    ;(prisma.$transaction as ReturnType<typeof vi.fn>).mockImplementation(
      async (ops: unknown) => ops
    )
    ;(prisma.chapter.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: 'b', storyId: 's1', order: 0, title: 'B', body: '' },
      { id: 'a', storyId: 's1', order: 1, title: 'A', body: '' }
    ])
    const rows = await new ChapterService(prisma as never).reorder('s1', [
      'b',
      'a'
    ])
    expect(prisma.$transaction).toHaveBeenCalled()
    expect(rows.map((r) => r.id)).toEqual(['b', 'a'])
  })

  it('replaceAll wipes then inserts in order', async () => {
    const prisma = prismaWithStory()
    ;(prisma.chapter.deleteMany as ReturnType<typeof vi.fn>).mockResolvedValue({
      count: 2
    })
    ;(prisma.chapter.createMany as ReturnType<typeof vi.fn>).mockResolvedValue({
      count: 2
    })
    ;(prisma.chapter.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: 'n1', storyId: 's1', order: 0, title: 'A', body: 'aa' },
      { id: 'n2', storyId: 's1', order: 1, title: 'B', body: 'bb' }
    ])
    const rows = await new ChapterService(prisma as never).replaceAll('s1', [
      { title: ' A ', body: ' aa ' },
      { title: 'B', body: 'bb' }
    ])
    expect(prisma.chapter.deleteMany).toHaveBeenCalledWith({
      where: { storyId: 's1' }
    })
    expect(prisma.chapter.createMany).toHaveBeenCalledWith({
      data: [
        { storyId: 's1', order: 0, title: 'A', body: 'aa' },
        { storyId: 's1', order: 1, title: 'B', body: 'bb' }
      ]
    })
    expect(rows).toHaveLength(2)
  })

  it('replaceAll with empty list only deletes', async () => {
    const prisma = prismaWithStory()
    ;(prisma.chapter.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([])
    await new ChapterService(prisma as never).replaceAll('s1', [])
    expect(prisma.chapter.createMany).not.toHaveBeenCalled()
  })

  it('appendAll continues order after max without deleting', async () => {
    const prisma = prismaWithStory()
    ;(prisma.chapter.aggregate as ReturnType<typeof vi.fn>).mockResolvedValue({
      _max: { order: 1 }
    })
    ;(prisma.chapter.createMany as ReturnType<typeof vi.fn>).mockResolvedValue({
      count: 2
    })
    ;(prisma.chapter.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: 'o1', storyId: 's1', order: 0, title: 'Old', body: 'x' },
      { id: 'n1', storyId: 's1', order: 2, title: 'A', body: 'aa' },
      { id: 'n2', storyId: 's1', order: 3, title: 'B', body: 'bb' }
    ])
    const rows = await new ChapterService(prisma as never).appendAll('s1', [
      { title: ' A ', body: ' aa ' },
      { title: 'B', body: 'bb' }
    ])
    expect(prisma.chapter.deleteMany).not.toHaveBeenCalled()
    expect(prisma.chapter.createMany).toHaveBeenCalledWith({
      data: [
        { storyId: 's1', order: 2, title: 'A', body: 'aa' },
        { storyId: 's1', order: 3, title: 'B', body: 'bb' }
      ]
    })
    expect(rows).toHaveLength(3)
  })

  it('appendAll with empty list only lists', async () => {
    const prisma = prismaWithStory()
    ;(prisma.chapter.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([])
    await new ChapterService(prisma as never).appendAll('s1', [])
    expect(prisma.chapter.createMany).not.toHaveBeenCalled()
    expect(prisma.chapter.aggregate).not.toHaveBeenCalled()
  })
})
