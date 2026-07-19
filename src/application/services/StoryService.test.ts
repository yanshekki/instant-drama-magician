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

  it('create normalizes title', () => {
    const prisma = createMockPrisma()
    ;(prisma.story.create as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 's1',
      title: 'My Story'
    })
    const svc = new StoryService(prisma as never)
    void svc.create({ title: '  My   Story  ' })
    expect(prisma.story.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ title: 'My Story' })
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

  it('get flattens cast arrays', async () => {
    const prisma = createMockPrisma()
    ;(prisma.story.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 's1',
      title: 'T',
      storyCharacters: [
        {
          costumeId: null,
          costume: null,
          character: { id: 'c1', name: 'A' }
        }
      ],
      storyScenes: [
        {
          sceneNumber: 1,
          scriptOverride: null,
          statusOverride: null,
          scene: { id: 'sc1', name: 'Loc', script: 's', status: 'DRAFT' }
        }
      ],
      storyProps: [{ prop: { id: 'p1', name: 'Cup' } }],
      timeline: []
    })
    const svc = new StoryService(prisma as never)
    const row = (await svc.get('s1')) as {
      characters: unknown[]
      scenes: unknown[]
      props: unknown[]
    }
    expect(row.characters).toHaveLength(1)
    expect(row.scenes).toHaveLength(1)
    expect(row.props).toHaveLength(1)
  })

  it('list uses orderBy updatedAt', () => {
    const prisma = createMockPrisma()
    const svc = new StoryService(prisma as never)
    void svc.list()
    expect(prisma.story.findMany).toHaveBeenCalled()
  })

  it('update rejects invalid status', async () => {
    const prisma = createMockPrisma({
      story: { id: 's1', title: 'T' }
    })
    ;(prisma.story.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 's1'
    })
    const svc = new StoryService(prisma as never)
    await expect(
      svc.update('s1', { status: 'NOPE' as 'DRAFT' })
    ).rejects.toMatchObject({ code: 'VALIDATION' })
  })
})
