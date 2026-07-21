import { describe, expect, it, vi } from 'vitest'
import { StoryService } from './StoryService'
import { createMockPrisma } from '../../test/mockPrisma'
import { AppError } from '../../types/errors'

describe('StoryService', () => {
  it('create validates empty title', () => {
    const prisma = createMockPrisma()
    const svc = new StoryService(prisma as never)
    expect(() => svc.create({ title: '   ' })).toThrow(AppError)
    expect(prisma.story.create).not.toHaveBeenCalled()
  })

  it('create normalizes title and optional fields', () => {
    const prisma = createMockPrisma()
    ;(prisma.story.create as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 's1',
      title: 'My Story'
    })
    const svc = new StoryService(prisma as never)
    void svc.create({
      title: '  My   Story  ',
      styleNote: '  neon  ',
      hardRules: '  no gore  ',
      artStyle: '  noir  '
    })
    expect(prisma.story.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          title: 'My Story',
          styleNote: 'neon',
          hardRules: 'no gore',
          artStyle: 'noir'
        })
      })
    )
    void svc.create({ title: 'Bare' })
    expect(prisma.story.create).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          styleNote: null,
          hardRules: null,
          artStyle: null
        })
      })
    )
  })

  it('get throws NOT_FOUND', async () => {
    const prisma = createMockPrisma()
    const svc = new StoryService(prisma as never)
    await expect(svc.get('missing')).rejects.toMatchObject({
      code: 'NOT_FOUND'
    })
  })

  it('get flattens cast arrays including costume', async () => {
    const prisma = createMockPrisma()
    ;(prisma.story.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 's1',
      title: 'T',
      storyCharacters: [
        {
          costumeId: 'co1',
          costume: {
            id: 'co1',
            name: 'Suit',
            description: 'black',
            refImagePath: '/c.png'
          },
          character: { id: 'c1', name: 'A' }
        },
        {
          costumeId: null,
          costume: null,
          character: { id: 'c2', name: 'B' }
        }
      ],
      storyScenes: [
        {
          sceneNumber: 1,
          scriptOverride: 'ov',
          statusOverride: 'DONE',
          scene: { id: 'sc1', name: 'Loc', script: 's', status: 'DRAFT' }
        },
        {
          sceneNumber: 2,
          scriptOverride: null,
          statusOverride: null,
          scene: { id: 'sc2', script: 'base', status: 'PENDING' }
        }
      ],
      storyProps: [{ prop: { id: 'p1', name: 'Cup' } }],
      storyActions: [{ action: { id: 'a1', name: 'Draw' } }],
      timeline: [{ id: 't1' }]
    })
    const svc = new StoryService(prisma as never)
    const row = (await svc.get('s1')) as {
      characters: Array<{ storyCostume: unknown; storyCostumeId: string | null }>
      scenes: Array<{ script: string; status: string }>
      props: unknown[]
      actions: unknown[]
      _count: Record<string, number>
    }
    expect(row.characters).toHaveLength(2)
    expect(row.characters[0].storyCostume).toMatchObject({ id: 'co1' })
    expect(row.characters[1].storyCostume).toBeNull()
    expect(row.scenes[0]).toMatchObject({ script: 'ov', status: 'DONE' })
    expect(row.scenes[1]).toMatchObject({ script: 'base', status: 'PENDING' })
    expect(row.props).toHaveLength(1)
    expect(row.actions).toHaveLength(1)
    expect(row._count).toEqual({
      characters: 2,
      scenes: 2,
      props: 1,
      actions: 1,
      timeline: 1
    })
  })

  it('get handles missing nested arrays', async () => {
    const prisma = createMockPrisma()
    ;(prisma.story.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 's1',
      title: 'T',
      storyCharacters: undefined,
      storyScenes: undefined,
      storyProps: undefined,
      timeline: undefined
    })
    const svc = new StoryService(prisma as never)
    const row = (await svc.get('s1')) as { characters: unknown[]; _count: { timeline: number } }
    expect(row.characters).toEqual([])
    expect(row._count.timeline).toBe(0)
  })

  it('list uses orderBy updatedAt', () => {
    const prisma = createMockPrisma()
    const svc = new StoryService(prisma as never)
    void svc.list()
    expect(prisma.story.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
        include: expect.any(Object)
      })
    )
  })

  it('update rejects invalid status and empty title', async () => {
    const prisma = createMockPrisma()
    ;(prisma.story.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 's1'
    })
    const svc = new StoryService(prisma as never)
    await expect(
      svc.update('s1', { status: 'NOPE' as 'DRAFT' })
    ).rejects.toMatchObject({ code: 'VALIDATION' })
    await expect(svc.update('s1', { title: '   ' })).rejects.toMatchObject({
      code: 'VALIDATION'
    })
  })

  it('update patches all optional fields', async () => {
    const prisma = createMockPrisma()
    ;(prisma.story.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 's1'
    })
    ;(prisma.story.update as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 's1' })
    const svc = new StoryService(prisma as never)
    await svc.update('s1', {
      title: '  New  Title  ',
      status: 'DRAFT',
      styleNote: '  s  ',
      hardRules: '  h  ',
      artStyle: '  a  ',
      coverPath: '  /c.png  ',
      refGalleryJson: '  []  '
    })
    expect(prisma.story.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          title: 'New Title',
          status: 'DRAFT',
          styleNote: 's',
          hardRules: 'h',
          artStyle: 'a',
          coverPath: '/c.png',
          refGalleryJson: '[]'
        })
      })
    )
    await svc.update('s1', {
      styleNote: '  ',
      hardRules: '  ',
      artStyle: '  ',
      coverPath: '  ',
      refGalleryJson: '  '
    })
    expect(prisma.story.update).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          styleNote: null,
          hardRules: null,
          artStyle: null,
          coverPath: null,
          refGalleryJson: null
        })
      })
    )
  })

  it('delete', async () => {
    const prisma = createMockPrisma()
    const svc = new StoryService(prisma as never)
    await expect(svc.delete('x')).rejects.toMatchObject({ code: 'NOT_FOUND' })
    ;(prisma.story.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 's1'
    })
    ;(prisma.story.delete as ReturnType<typeof vi.fn>).mockResolvedValue({})
    await expect(svc.delete('s1')).resolves.toEqual({ ok: true })
  })
})
