import { describe, expect, it, vi } from 'vitest'
import { ActionService } from './ActionService'
import { createMockPrisma } from '../../test/mockPrisma'

describe('ActionService', () => {
  it('list orders by updatedAt desc then id desc', () => {
    const prisma = createMockPrisma()
    const svc = new ActionService(prisma as never)
    void svc.list()
    expect(prisma.action.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }]
      })
    )
  })

  it('list with q searches name description motionNotes', () => {
    const prisma = createMockPrisma()
    const svc = new ActionService(prisma as never)
    void svc.list({ q: 'punch' })
    expect(prisma.action.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          OR: [
            { name: { contains: 'punch' } },
            { description: { contains: 'punch' } },
            { motionNotes: { contains: 'punch' } }
          ]
        }
      })
    )
  })

  it('create requires name', async () => {
    const prisma = createMockPrisma()
    const svc = new ActionService(prisma as never)
    await expect(
      svc.create({ name: '  ', description: 'd' })
    ).rejects.toMatchObject({ code: 'VALIDATION' })
  })

  it('create trims and stores hardRules', async () => {
    const prisma = createMockPrisma()
    ;(prisma.action.create as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'a1',
      name: 'Draw',
      hardRules: 'two hands'
    })
    const svc = new ActionService(prisma as never)
    await svc.create({
      name: ' Draw ',
      description: 'motion',
      hardRules: '  two hands  '
    })
    expect(prisma.action.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: 'Draw',
          hardRules: 'two hands'
        })
      })
    )
  })

  it('update rejects empty name', async () => {
    const prisma = createMockPrisma()
    ;(prisma.action.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'a1'
    })
    const svc = new ActionService(prisma as never)
    await expect(svc.update('a1', { name: '  ' })).rejects.toMatchObject({
      code: 'VALIDATION'
    })
  })

  it('get not found', async () => {
    const prisma = createMockPrisma()
    const svc = new ActionService(prisma as never)
    await expect(svc.get('missing')).rejects.toMatchObject({
      code: 'NOT_FOUND'
    })
  })

  it('listForStory orders by action.updatedAt desc', async () => {
    const prisma = createMockPrisma()
    ;(prisma.storyAction.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(
      []
    )
    const svc = new ActionService(prisma as never)
    await svc.listForStory('s1')
    expect(prisma.storyAction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { storyId: 's1' },
        orderBy: { action: { updatedAt: 'desc' } },
        include: { action: true }
      })
    )
  })
})
