import { describe, expect, it, vi } from 'vitest'
import { CharacterService } from './CharacterService'
import { createMockPrisma } from '../../test/mockPrisma'

describe('CharacterService', () => {
  it('rejects empty name on create', async () => {
    const prisma = createMockPrisma()
    const svc = new CharacterService(prisma as never)
    await expect(
      svc.create({ name: '  ', description: 'x' } as never)
    ).rejects.toMatchObject({ code: 'VALIDATION' })
  })

  it('create trims name and optional fields and links', async () => {
    const prisma = createMockPrisma()
    ;(prisma.character.create as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'c1',
      name: 'Alice'
    })
    ;(prisma.character.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'c1'
    })
    ;(prisma.story.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 's1'
    })
    ;(prisma.storyCharacter.aggregate as ReturnType<typeof vi.fn>).mockResolvedValue({
      _max: { sortOrder: -1 }
    })
    ;(prisma.storyCharacter.upsert as ReturnType<typeof vi.fn>).mockResolvedValue({})
    const svc = new CharacterService(prisma as never)
    await svc.create({
      name: '  Alice  ',
      description: 'hero',
      appearance: '  short  ',
      personality: '  ',
      backstory: '  past  ',
      costume: '  coat  ',
      ageRange: '  20s  ',
      gender: '  f  ',
      voiceDesc: '  soft  ',
      spokenLanguages: '  []  ',
      mannerisms: '  nod  ',
      relationships: '  none  ',
      visualTags: '  dark  ',
      seedPrompt: '  s  ',
      hardRules: '  r  ',
      profileJson: '  {}  ',
      refSheetPath: '  /s.png  ',
      refGalleryJson: '  []  ',
      soulHubId: 'hub',
      artStyle: '  noir  ',
      costumesJson: '  []  ',
      soulMdPath: null,
      refImagePath: null,
      linkStoryId: 's1'
    } as never)
    expect(prisma.character.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: 'Alice',
          appearance: 'short',
          personality: null
        })
      })
    )
    expect(prisma.storyCharacter.upsert).toHaveBeenCalled()
  })

  it('create links via storyId', async () => {
    const prisma = createMockPrisma()
    ;(prisma.character.create as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'c1'
    })
    ;(prisma.character.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'c1'
    })
    ;(prisma.story.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 's1'
    })
    ;(prisma.storyCharacter.aggregate as ReturnType<typeof vi.fn>).mockResolvedValue({
      _max: { sortOrder: 0 }
    })
    ;(prisma.storyCharacter.upsert as ReturnType<typeof vi.fn>).mockResolvedValue({})
    const svc = new CharacterService(prisma as never)
    await svc.create({ name: 'Bob', description: 'd', storyId: 's1' } as never)
    expect(prisma.storyCharacter.upsert).toHaveBeenCalled()
  })

  it('list passes search filter or undefined', () => {
    const prisma = createMockPrisma()
    const svc = new CharacterService(prisma as never)
    void svc.list({ q: 'bob' })
    expect(prisma.character.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.any(Array)
        })
      })
    )
    void svc.list()
    expect(prisma.character.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({ where: undefined })
    )
  })

  it('listForStory', async () => {
    const prisma = createMockPrisma()
    ;(prisma.story.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 's1'
    })
    ;(prisma.storyCharacter.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(
      []
    )
    const svc = new CharacterService(prisma as never)
    await svc.listForStory('s1')
    expect(prisma.storyCharacter.findMany).toHaveBeenCalled()
  })

  it('get throws NOT_FOUND when missing', async () => {
    const prisma = createMockPrisma()
    ;(prisma.character.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
      null
    )
    const svc = new CharacterService(prisma as never)
    await expect(svc.get('missing')).rejects.toMatchObject({
      code: 'NOT_FOUND',
      message: 'errors.characterNotFound'
    })
    ;(prisma.character.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
      { id: 'c1', name: 'A' }
    )
    await expect(svc.get('c1')).resolves.toMatchObject({ id: 'c1' })
  })

  it('delete throws when missing', async () => {
    const prisma = createMockPrisma()
    const svc = new CharacterService(prisma as never)
    ;(prisma.character.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
      null
    )
    await expect(svc.delete('x')).rejects.toBeTruthy()
    ;(prisma.character.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'c1'
    })
    ;(prisma.character.delete as ReturnType<typeof vi.fn>).mockResolvedValue({})
    await expect(svc.delete('c1')).resolves.toEqual({ ok: true })
  })

  it('update validates name and patches all fields', async () => {
    const prisma = createMockPrisma()
    ;(prisma.character.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'c1',
      name: 'Old'
    })
    ;(prisma.character.update as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'c1'
    })
    const svc = new CharacterService(prisma as never)
    await expect(
      svc.update('c1', { name: '  ' } as never)
    ).rejects.toMatchObject({ code: 'VALIDATION' })
    // partial — false branches of optional ternaries
    await svc.update('c1', { description: 'only' } as never)
    await svc.update('c1', {
      name: '  New  ',
      description: '  d  ',
      soulMdPath: '/soul',
      refImagePath: '/r',
      appearance: 'a',
      personality: 'p',
      backstory: 'b',
      costume: 'c',
      ageRange: '20',
      gender: 'm',
      voiceDesc: 'v',
      spokenLanguages: '[]',
      mannerisms: 'm',
      relationships: 'r',
      visualTags: 't',
      seedPrompt: 's',
      hardRules: 'h',
      profileJson: '{}',
      refSheetPath: '/s',
      refGalleryJson: '[]',
      soulHubId: 'hub',
      artStyle: 'noir',
      costumesJson: '[]'
    } as never)
    expect(prisma.character.update).toHaveBeenCalled()
  })
})
