import { describe, expect, it, vi } from 'vitest'
import { SceneService } from './SceneService'
import { createMockPrisma } from '../../test/mockPrisma'

describe('SceneService', () => {
  it('create validates description', async () => {
    const prisma = createMockPrisma()
    const svc = new SceneService(prisma as never)
    await expect(svc.create({ description: '' })).rejects.toMatchObject({
      code: 'VALIDATION'
    })
  })

  it('create rejects invalid status', async () => {
    const prisma = createMockPrisma()
    const svc = new SceneService(prisma as never)
    await expect(
      svc.create({ description: 'Hallway', status: 'NOPE' as 'PENDING' })
    ).rejects.toMatchObject({ code: 'VALIDATION' })
  })

  it('create persists trimmed fields and optional link', async () => {
    const prisma = createMockPrisma()
    ;(prisma.scene.create as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'sc1',
      description: 'Hallway'
    })
    ;(prisma.scene.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'sc1'
    })
    ;(prisma.story.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 's1'
    })
    ;(prisma.storyScene.aggregate as ReturnType<typeof vi.fn>).mockResolvedValue({
      _max: { sceneNumber: 0, sortOrder: -1 }
    })
    ;(prisma.storyScene.upsert as ReturnType<typeof vi.fn>).mockResolvedValue({})
    const svc = new SceneService(prisma as never)
    await svc.create({
      description: '  Hallway  ',
      script: '  go  ',
      title: '  A  ',
      locationType: '  int  ',
      timeOfDay: '  night  ',
      weather: '  rain  ',
      mood: '  tense  ',
      lighting: '  neon  ',
      colorPalette: '  cyan  ',
      setDressing: '  trash  ',
      soundscape: '  drip  ',
      cameraNotes: '  handheld  ',
      visualTags: '  wet  ',
      artStyle: '  noir  ',
      refImagePath: '  /r.png  ',
      refGalleryJson: '  []  ',
      looksJson: '  {}  ',
      profileJson: '  {}  ',
      seedPrompt: '  seed  ',
      hardRules: '  no gore  ',
      locationKey: '  alley  ',
      linkStoryId: 's1',
      sceneNumber: 2
    } as never)
    expect(prisma.scene.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          description: 'Hallway',
          script: 'go',
          title: 'A',
          status: 'PENDING'
        })
      })
    )
    expect(prisma.storyScene.upsert).toHaveBeenCalled()
  })

  it('create links with storyId and invalid sceneNumber falls back', async () => {
    const prisma = createMockPrisma()
    ;(prisma.scene.create as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'sc1'
    })
    ;(prisma.scene.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'sc1'
    })
    ;(prisma.story.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 's1'
    })
    ;(prisma.storyScene.aggregate as ReturnType<typeof vi.fn>).mockResolvedValue({
      _max: { sceneNumber: 1, sortOrder: 0 }
    })
    ;(prisma.storyScene.upsert as ReturnType<typeof vi.fn>).mockResolvedValue({})
    const svc = new SceneService(prisma as never)
    await svc.create({
      description: 'Place',
      storyId: 's1',
      sceneNumber: 1.5
    } as never)
    expect(prisma.storyScene.upsert).toHaveBeenCalled()
  })

  it('get throws NOT_FOUND and returns row', async () => {
    const prisma = createMockPrisma()
    const svc = new SceneService(prisma as never)
    await expect(svc.get('x')).rejects.toMatchObject({ code: 'NOT_FOUND' })
    ;(prisma.scene.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'sc1',
      description: 'Hall'
    })
    await expect(svc.get('sc1')).resolves.toMatchObject({ id: 'sc1' })
  })

  it('list supports query and empty', () => {
    const prisma = createMockPrisma()
    const svc = new SceneService(prisma as never)
    void svc.list({ q: 'rain' })
    expect(prisma.scene.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          OR: [
            { title: { contains: 'rain' } },
            { description: { contains: 'rain' } }
          ]
        }
      })
    )
    void svc.list()
    expect(prisma.scene.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({ where: undefined })
    )
  })

  it('listForStory delegates to cast service', async () => {
    const prisma = createMockPrisma()
    ;(prisma.story.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 's1'
    })
    ;(prisma.storyScene.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([])
    const svc = new SceneService(prisma as never)
    await svc.listForStory('s1')
    expect(prisma.storyScene.findMany).toHaveBeenCalled()
  })

  it('update validates and patches all fields', async () => {
    const prisma = createMockPrisma()
    ;(prisma.scene.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'sc1'
    })
    ;(prisma.scene.update as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'sc1' })
    const svc = new SceneService(prisma as never)
    await expect(svc.update('sc1', { description: '' })).rejects.toMatchObject({
      code: 'VALIDATION'
    })
    await expect(
      svc.update('sc1', { status: 'BAD' as 'PENDING' })
    ).rejects.toMatchObject({ code: 'VALIDATION' })
    await svc.update('sc1', { title: 'only' } as never)
    await svc.update('sc1', {
      description: '  New  ',
      script: '  s  ',
      status: 'COMPLETED',
      title: '  t  ',
      locationType: 'ext',
      timeOfDay: 'day',
      weather: 'clear',
      mood: 'calm',
      lighting: 'soft',
      colorPalette: 'warm',
      setDressing: 'plants',
      soundscape: 'birds',
      cameraNotes: 'wide',
      visualTags: 'green',
      artStyle: 'real',
      refImagePath: '/a.png',
      refGalleryJson: '[]',
      looksJson: '{}',
      profileJson: '{}',
      seedPrompt: 'p',
      hardRules: 'r',
      locationKey: 'park'
    } as never)
    expect(prisma.scene.update).toHaveBeenCalled()
  })

  it('delete and ensureExists', async () => {
    const prisma = createMockPrisma()
    const svc = new SceneService(prisma as never)
    await expect(svc.delete('missing')).rejects.toMatchObject({ code: 'NOT_FOUND' })
    ;(prisma.scene.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'sc1'
    })
    ;(prisma.scene.delete as ReturnType<typeof vi.fn>).mockResolvedValue({})
    await expect(svc.delete('sc1')).resolves.toEqual({ ok: true })
  })
})
