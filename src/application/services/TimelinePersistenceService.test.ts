import { describe, expect, it, vi } from 'vitest'
import { TimelinePersistenceService } from './TimelinePersistenceService'
import { createMockPrisma } from '../../test/mockPrisma'

function entryRow(partial: Record<string, unknown> = {}) {
  return {
    id: 't1',
    storyId: 's1',
    startTime: 0,
    endTime: 6,
    characterId: null,
    sceneId: null,
    propId: null,
    actionId: null,
    characterIds: null,
    sceneIds: null,
    propIds: null,
    actionIds: null,
    dialogue: 'hi',
    beatContentJson: null,
    order: 0,
    mediaPath: null,
    mediaStatus: 'EMPTY',
    mediaError: null,
    videoJobId: null,
    ...partial
  }
}

function prismaWithStory() {
  const prisma = createMockPrisma()
  ;(prisma.story.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
    id: 's1'
  })
  // cast members linked
  ;(prisma.storyCharacter.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
    x: 1
  })
  ;(prisma.storyScene.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
    x: 1
  })
  ;(prisma.storyProp.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
    x: 1
  })
  ;(prisma.storyAction.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
    x: 1
  })
  return prisma
}

describe('TimelinePersistenceService', () => {
  it('list returns mapped rows without sync when order consistent', async () => {
    const prisma = createMockPrisma()
    ;(prisma.timelineEntry.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      entryRow({ id: 't1', order: 0, startTime: 0 }),
      entryRow({ id: 't2', order: 1, startTime: 6 })
    ])
    const svc = new TimelinePersistenceService(prisma as never)
    const rows = await svc.list('s1')
    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({ id: 't1', dialogue: 'hi' })
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })

  it('list reindexes when order out of sync', async () => {
    const prisma = createMockPrisma()
    const rows = [
      entryRow({ id: 't1', order: 5, startTime: 0 }),
      entryRow({ id: 't2', order: 0, startTime: 6 })
    ]
    ;(prisma.timelineEntry.findMany as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(rows)
      .mockResolvedValueOnce([
        entryRow({ id: 't1', order: 0, startTime: 0 }),
        entryRow({ id: 't2', order: 1, startTime: 6 })
      ])
    ;(prisma.timelineEntry.update as ReturnType<typeof vi.fn>).mockResolvedValue({})
    ;(prisma.$transaction as ReturnType<typeof vi.fn>).mockImplementation(
      async (ops: unknown) => ops
    )
    const svc = new TimelinePersistenceService(prisma as never)
    const out = await svc.list('s1')
    expect(out).toHaveLength(2)
    expect(prisma.$transaction).toHaveBeenCalled()
  })

  it('list empty returns []', async () => {
    const prisma = createMockPrisma()
    ;(prisma.timelineEntry.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([])
    const svc = new TimelinePersistenceService(prisma as never)
    await expect(svc.list('s1')).resolves.toEqual([])
  })

  it('create validates time range', async () => {
    const prisma = createMockPrisma()
    const svc = new TimelinePersistenceService(prisma as never)
    await expect(
      svc.create({
        storyId: 's1',
        startTime: 10,
        endTime: 1,
        dialogue: 'x',
        order: 0
      } as never)
    ).rejects.toBeTruthy()
  })

  it('create throws when story missing', async () => {
    const prisma = createMockPrisma()
    ;(prisma.story.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null)
    const svc = new TimelinePersistenceService(prisma as never)
    await expect(
      svc.create({
        storyId: 'missing',
        startTime: 0,
        endTime: 3,
        order: 0
      } as never)
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })

  it('create with bindings asserts cast and maps row', async () => {
    const prisma = prismaWithStory()
    const created = entryRow({
      id: 't-new',
      characterId: 'c1',
      sceneId: 'sc1',
      propId: 'p1',
      actionId: 'a1',
      dialogue: 'line',
      beatContentJson: '{}',
      order: 0
    })
    ;(prisma.timelineEntry.create as ReturnType<typeof vi.fn>).mockResolvedValue(created)
    ;(prisma.timelineEntry.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      created
    ])
    ;(prisma.timelineEntry.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
      created
    )
    const svc = new TimelinePersistenceService(prisma as never)
    const row = await svc.create({
      storyId: 's1',
      startTime: 0,
      endTime: 6,
      order: 0,
      characterId: 'c1',
      sceneId: 'sc1',
      propId: 'p1',
      actionId: 'a1',
      dialogue: 'line',
      beatContentJson: '{}'
    } as never)
    expect(row.id).toBe('t-new')
    expect(prisma.timelineEntry.create).toHaveBeenCalled()
  })

  it('create rejects unbound cast member', async () => {
    const prisma = prismaWithStory()
    ;(prisma.storyCharacter.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
      null
    )
    const svc = new TimelinePersistenceService(prisma as never)
    await expect(
      svc.create({
        storyId: 's1',
        startTime: 0,
        endTime: 3,
        order: 0,
        characterId: 'c-missing'
      } as never)
    ).rejects.toMatchObject({ code: 'VALIDATION' })
  })

  it('update not found', async () => {
    const prisma = createMockPrisma()
    ;(prisma.timelineEntry.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
      null
    )
    const svc = new TimelinePersistenceService(prisma as never)
    await expect(svc.update('missing', { dialogue: 'x' })).rejects.toMatchObject({
      code: 'NOT_FOUND'
    })
  })

  it('update validates times when touching range', async () => {
    const prisma = prismaWithStory()
    ;(prisma.timelineEntry.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
      entryRow()
    )
    const svc = new TimelinePersistenceService(prisma as never)
    await expect(
      svc.update('t1', { startTime: 10, endTime: 1 })
    ).rejects.toBeTruthy()
  })

  it('update heals overlong legacy clip on dialogue-only edit', async () => {
    const prisma = prismaWithStory()
    ;(prisma.timelineEntry.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
      entryRow({ startTime: 0, endTime: 60 })
    )
    ;(prisma.timelineEntry.update as ReturnType<typeof vi.fn>).mockResolvedValue(
      entryRow({ dialogue: 'fixed', endTime: 15 })
    )
    ;(prisma.timelineEntry.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([])
    const svc = new TimelinePersistenceService(prisma as never)
    await svc.update('t1', { dialogue: 'fixed' })
    expect(prisma.timelineEntry.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          dialogue: 'fixed',
          startTime: 0,
          endTime: expect.any(Number)
        })
      })
    )
  })

  it('update with bindings and media fields', async () => {
    const prisma = prismaWithStory()
    const existing = entryRow()
    ;(prisma.timelineEntry.findUnique as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(existing)
      .mockResolvedValueOnce(
        entryRow({
          startTime: 2,
          endTime: 8,
          characterId: 'c1',
          mediaPath: '/m.mp4',
          mediaStatus: 'READY'
        })
      )
    ;(prisma.timelineEntry.update as ReturnType<typeof vi.fn>).mockResolvedValue(
      entryRow({ startTime: 2, endTime: 8, characterId: 'c1' })
    )
    ;(prisma.timelineEntry.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      entryRow({ id: 't1', order: 0, startTime: 2 })
    ])
    const svc = new TimelinePersistenceService(prisma as never)
    const row = await svc.update('t1', {
      startTime: 2,
      endTime: 8,
      characterId: 'c1',
      sceneIds: ['sc1'],
      propIds: [],
      actionIds: null,
      beatContentJson: '{"x":1}',
      order: 1,
      mediaPath: '/m.mp4',
      mediaStatus: 'READY',
      mediaError: null,
      videoJobId: 'job1'
    } as never)
    expect(row).toBeTruthy()
    expect(prisma.timelineEntry.update).toHaveBeenCalled()
  })

  it('update dialogue-only without re-asserting cast when no bind change', async () => {
    const prisma = prismaWithStory()
    ;(prisma.timelineEntry.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
      entryRow({ startTime: 0, endTime: 6 })
    )
    ;(prisma.timelineEntry.update as ReturnType<typeof vi.fn>).mockResolvedValue(
      entryRow({ dialogue: 'new' })
    )
    const svc = new TimelinePersistenceService(prisma as never)
    await svc.update('t1', { dialogue: 'new' })
    // storyCharacter not needed for dialogue-only
    expect(prisma.timelineEntry.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ dialogue: 'new' })
      })
    )
  })

  it('setMedia updates media fields', async () => {
    const prisma = createMockPrisma()
    ;(prisma.timelineEntry.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 't1'
    })
    ;(prisma.timelineEntry.update as ReturnType<typeof vi.fn>).mockResolvedValue(
      entryRow({ mediaPath: '/c.mp4', mediaStatus: 'READY', videoJobId: 'j1' })
    )
    const svc = new TimelinePersistenceService(prisma as never)
    const row = await svc.setMedia('t1', {
      mediaPath: '/c.mp4',
      mediaStatus: 'READY',
      mediaError: null,
      videoJobId: 'j1'
    })
    expect(row.mediaStatus).toBe('READY')
  })

  it('setMedia not found', async () => {
    const prisma = createMockPrisma()
    ;(prisma.timelineEntry.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
      null
    )
    const svc = new TimelinePersistenceService(prisma as never)
    await expect(
      svc.setMedia('missing', { mediaStatus: 'FAILED' })
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })

  it('delete removes entry and reindexes', async () => {
    const prisma = createMockPrisma()
    ;(prisma.timelineEntry.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 't1',
      storyId: 's1'
    })
    ;(prisma.timelineEntry.delete as ReturnType<typeof vi.fn>).mockResolvedValue({})
    ;(prisma.timelineEntry.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([])
    const svc = new TimelinePersistenceService(prisma as never)
    await expect(svc.delete('t1')).resolves.toEqual({ ok: true })
  })

  it('delete not found', async () => {
    const prisma = createMockPrisma()
    ;(prisma.timelineEntry.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
      null
    )
    const svc = new TimelinePersistenceService(prisma as never)
    await expect(svc.delete('missing')).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })

  it('reorder reindexes and lists', async () => {
    const prisma = prismaWithStory()
    ;(prisma.timelineEntry.update as ReturnType<typeof vi.fn>).mockResolvedValue({})
    ;(prisma.$transaction as ReturnType<typeof vi.fn>).mockImplementation(
      async (ops: unknown) => ops
    )
    ;(prisma.timelineEntry.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      entryRow({ id: 't2', order: 0, startTime: 0 }),
      entryRow({ id: 't1', order: 1, startTime: 6 })
    ])
    const svc = new TimelinePersistenceService(prisma as never)
    const rows = await svc.reorder('s1', ['t2', 't1'])
    expect(Array.isArray(rows)).toBe(true)
    expect(prisma.$transaction).toHaveBeenCalled()
  })

  it('reorder missing story', async () => {
    const prisma = createMockPrisma()
    ;(prisma.story.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null)
    const svc = new TimelinePersistenceService(prisma as never)
    await expect(svc.reorder('missing', ['t1'])).rejects.toMatchObject({
      code: 'NOT_FOUND'
    })
  })
})
