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

  it('create trims fields links story and uses defaults', async () => {
    const prisma = createMockPrisma()
    ;(prisma.action.create as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'a1',
      name: 'Draw',
      hardRules: 'two hands'
    })
    ;(prisma.storyAction.aggregate as ReturnType<typeof vi.fn>).mockResolvedValue({
      _max: { sortOrder: null }
    })
    ;(prisma.storyAction.upsert as ReturnType<typeof vi.fn>).mockResolvedValue({})
    const svc = new ActionService(prisma as never)
    await svc.create({
      name: ' Draw ',
      description: 'motion',
      motionNotes: '  m  ',
      intention: '  i  ',
      cameraNotes: '  c  ',
      panelLayout: '  ',
      visualTags: '  v  ',
      artStyle: '  a  ',
      refImagePath: '  /r  ',
      refGalleryJson: '  []  ',
      castRefsJson: '  []  ',
      profileJson: '  {}  ',
      seedPrompt: '  s  ',
      hardRules: '  two hands  ',
      linkStoryId: 's1'
    } as never)
    expect(prisma.action.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: 'Draw',
          hardRules: 'two hands',
          panelLayout: 'grid-2x2'
        })
      })
    )
    expect(prisma.storyAction.upsert).toHaveBeenCalled()

    await svc.create({
      name: 'Kick',
      description: 'd',
      storyId: 's1'
    } as never)
    expect(prisma.storyAction.upsert).toHaveBeenCalledTimes(2)
  })

  it('update rejects empty name and patches fields', async () => {
    const prisma = createMockPrisma()
    ;(prisma.action.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'a1'
    })
    ;(prisma.action.update as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'a1' })
    const svc = new ActionService(prisma as never)
    await expect(svc.update('a1', { name: '  ' })).rejects.toMatchObject({
      code: 'VALIDATION'
    })
    // partial update hits false branches of optional field ternaries
    await svc.update('a1', { description: 'only-desc' })
    // description omitted → false branch of description ternary
    await svc.update('a1', { motionNotes: 'only-motion' })
    await svc.update('a1', {
      name: '  Punch  ',
      description: '  d  ',
      motionNotes: 'm',
      intention: 'i',
      cameraNotes: 'c',
      panelLayout: '  ',
      visualTags: 'v',
      artStyle: 'a',
      refImagePath: '/r',
      refGalleryJson: '[]',
      castRefsJson: '[]',
      profileJson: '{}',
      seedPrompt: 's',
      hardRules: 'h'
    })
    expect(prisma.action.update).toHaveBeenCalled()
  })

  it('get not found and get success', async () => {
    const prisma = createMockPrisma()
    const svc = new ActionService(prisma as never)
    await expect(svc.get('missing')).rejects.toMatchObject({
      code: 'NOT_FOUND'
    })
    ;(prisma.action.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'a1',
      name: 'Draw'
    })
    await expect(svc.get('a1')).resolves.toMatchObject({ id: 'a1' })
  })

  it('listForStory orders by action.updatedAt desc', async () => {
    const prisma = createMockPrisma()
    ;(prisma.storyAction.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { action: { id: 'a1', name: 'Draw' } }
    ])
    const svc = new ActionService(prisma as never)
    const rows = await svc.listForStory('s1')
    expect(rows).toEqual([{ id: 'a1', name: 'Draw' }])
    expect(prisma.storyAction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { storyId: 's1' },
        orderBy: { action: { updatedAt: 'desc' } },
        include: { action: true }
      })
    )
  })

  it('delete linkStory unlinkStory', async () => {
    const prisma = createMockPrisma()
    const svc = new ActionService(prisma as never)
    await expect(svc.delete('x')).rejects.toMatchObject({ code: 'NOT_FOUND' })
    ;(prisma.action.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'a1'
    })
    ;(prisma.action.delete as ReturnType<typeof vi.fn>).mockResolvedValue({})
    await expect(svc.delete('a1')).resolves.toEqual({ ok: true })

    ;(prisma.storyAction.aggregate as ReturnType<typeof vi.fn>).mockResolvedValue({
      _max: { sortOrder: 2 }
    })
    ;(prisma.storyAction.upsert as ReturnType<typeof vi.fn>).mockResolvedValue({})
    await expect(svc.linkStory('s1', 'a1')).resolves.toEqual({ ok: true })

    ;(prisma.storyAction.delete as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('missing')
    )
    await expect(svc.unlinkStory('s1', 'a1')).resolves.toEqual({ ok: true })
  })
})
