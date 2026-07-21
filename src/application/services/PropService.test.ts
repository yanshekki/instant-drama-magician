import { describe, expect, it, vi } from 'vitest'
import { PropService } from './PropService'
import { createMockPrisma } from '../../test/mockPrisma'

describe('PropService', () => {
  it('create requires name', async () => {
    const prisma = createMockPrisma()
    const svc = new PropService(prisma as never)
    await expect(
      svc.create({ name: '  ', description: 'd' })
    ).rejects.toMatchObject({ code: 'VALIDATION' })
  })

  it('create trims fields and links story', async () => {
    const prisma = createMockPrisma()
    ;(prisma.prop.create as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'p1',
      name: 'Cup'
    })
    ;(prisma.prop.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'p1'
    })
    ;(prisma.story.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 's1'
    })
    ;(prisma.storyProp.aggregate as ReturnType<typeof vi.fn>).mockResolvedValue({
      _max: { sortOrder: -1 }
    })
    ;(prisma.storyProp.upsert as ReturnType<typeof vi.fn>).mockResolvedValue({})
    const svc = new PropService(prisma as never)
    await svc.create({
      name: ' Cup ',
      description: ' ceramic ',
      material: '  clay  ',
      sizeNotes: '  small  ',
      condition: '  worn  ',
      visualTags: '  red  ',
      artStyle: '  real  ',
      refImagePath: '  /p.png  ',
      refGalleryJson: '  []  ',
      profileJson: '  {}  ',
      seedPrompt: '  s  ',
      hardRules: '  r  ',
      linkStoryId: 's1'
    } as never)
    expect(prisma.prop.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: 'Cup',
          description: 'ceramic',
          material: 'clay'
        })
      })
    )
    expect(prisma.storyProp.upsert).toHaveBeenCalled()
  })

  it('create uses storyId alias for link', async () => {
    const prisma = createMockPrisma()
    ;(prisma.prop.create as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'p1' })
    ;(prisma.prop.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'p1'
    })
    ;(prisma.story.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 's1'
    })
    ;(prisma.storyProp.aggregate as ReturnType<typeof vi.fn>).mockResolvedValue({
      _max: { sortOrder: 0 }
    })
    ;(prisma.storyProp.upsert as ReturnType<typeof vi.fn>).mockResolvedValue({})
    const svc = new PropService(prisma as never)
    await svc.create({ name: 'Bag', description: 'd', storyId: 's1' } as never)
    expect(prisma.storyProp.upsert).toHaveBeenCalled()
  })

  it('list and listForStory', async () => {
    const prisma = createMockPrisma()
    const svc = new PropService(prisma as never)
    void svc.list({ q: 'cup' })
    expect(prisma.prop.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          OR: [
            { name: { contains: 'cup' } },
            { description: { contains: 'cup' } }
          ]
        }
      })
    )
    void svc.list()
    ;(prisma.story.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 's1'
    })
    ;(prisma.storyProp.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([])
    await svc.listForStory('s1')
    expect(prisma.storyProp.findMany).toHaveBeenCalled()
  })

  it('get not found and get success', async () => {
    const prisma = createMockPrisma()
    const svc = new PropService(prisma as never)
    await expect(svc.get('missing')).rejects.toMatchObject({
      code: 'NOT_FOUND'
    })
    ;(prisma.prop.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'p1',
      name: 'Cup'
    })
    await expect(svc.get('p1')).resolves.toMatchObject({ id: 'p1' })
  })

  it('update validates name and patches fields', async () => {
    const prisma = createMockPrisma()
    ;(prisma.prop.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'p1'
    })
    ;(prisma.prop.update as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'p1' })
    const svc = new PropService(prisma as never)
    await expect(svc.update('p1', { name: '  ' })).rejects.toMatchObject({
      code: 'VALIDATION'
    })
    await svc.update('p1', { description: 'only' })
    // omit description to hit false branch of description ternary
    await svc.update('p1', { material: 'only-mat' })
    await svc.update('p1', {
      name: '  Cup  ',
      description: '  d  ',
      material: 'm',
      sizeNotes: 's',
      condition: 'c',
      visualTags: 'v',
      artStyle: 'a',
      refImagePath: '/x',
      refGalleryJson: '[]',
      profileJson: '{}',
      seedPrompt: 'p',
      hardRules: 'r'
    })
    expect(prisma.prop.update).toHaveBeenCalled()
  })

  it('delete', async () => {
    const prisma = createMockPrisma()
    const svc = new PropService(prisma as never)
    await expect(svc.delete('x')).rejects.toMatchObject({ code: 'NOT_FOUND' })
    ;(prisma.prop.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'p1'
    })
    ;(prisma.prop.delete as ReturnType<typeof vi.fn>).mockResolvedValue({})
    await expect(svc.delete('p1')).resolves.toEqual({ ok: true })
  })
})
