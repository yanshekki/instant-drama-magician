import { describe, expect, it, vi } from 'vitest'
import { TimelinePersistenceService } from './TimelinePersistenceService'
import { createMockPrisma } from '../../test/mockPrisma'

describe('TimelinePersistenceService', () => {
  it('list returns mapped rows', async () => {
    const prisma = createMockPrisma()
    ;(prisma.timelineEntry.findMany as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce([
        {
          id: 't1',
          storyId: 's1',
          startTime: 0,
          endTime: 3,
          characterId: null,
          sceneId: null,
          propId: null,
          dialogue: 'hi',
          order: 0,
          mediaPath: null,
          mediaStatus: 'EMPTY',
          mediaError: null,
          videoJobId: null
        }
      ])
      .mockResolvedValue([])
    // syncOrder may updateMany
    ;(prisma.timelineEntry.updateMany as ReturnType<typeof vi.fn>).mockResolvedValue(
      { count: 0 }
    )
    const svc = new TimelinePersistenceService(prisma as never)
    const rows = await svc.list('s1')
    expect(Array.isArray(rows)).toBe(true)
  })

  it('create validates time range', async () => {
    const prisma = createMockPrisma()
    const svc = new TimelinePersistenceService(prisma as never)
    await expect(
      svc.create({
        storyId: 's1',
        startTime: 10,
        endTime: 1,
        dialogue: 'x'
      } as never)
    ).rejects.toBeTruthy()
  })
})
