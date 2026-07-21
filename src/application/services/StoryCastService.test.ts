import { describe, expect, it, vi } from 'vitest'
import { StoryCastService } from './StoryCastService'
import { createMockPrisma } from '../../test/mockPrisma'

function basePrisma() {
  const prisma = createMockPrisma()
  ;(prisma.story.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
    id: 's1'
  })
  ;(prisma.character.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
    id: 'c1'
  })
  ;(prisma.scene.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
    id: 'sc1'
  })
  ;(prisma.prop.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
    id: 'p1'
  })
  ;(prisma.action.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
    id: 'a1'
  })
  ;(prisma.costume.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
    id: 'co1'
  })
  ;(prisma.characterCostume.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
    characterId: 'c1',
    costumeId: 'co1'
  })
  return prisma
}

describe('StoryCastService', () => {
  it('linkCharacter creates join row', async () => {
    const prisma = basePrisma()
    ;(prisma.storyCharacter.aggregate as ReturnType<typeof vi.fn>).mockResolvedValue({
      _max: { sortOrder: 0 }
    })
    ;(prisma.storyCharacter.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
      null
    )
    ;(prisma.storyCharacter.upsert as ReturnType<typeof vi.fn>).mockResolvedValue({
      storyId: 's1',
      characterId: 'c1'
    })
    const svc = new StoryCastService(prisma as never)
    await svc.linkCharacter('s1', 'c1')
    expect(prisma.storyCharacter.upsert).toHaveBeenCalled()
  })

  it('linkCharacter with costumeId and opts', async () => {
    const prisma = basePrisma()
    ;(prisma.storyCharacter.aggregate as ReturnType<typeof vi.fn>).mockResolvedValue({
      _max: { sortOrder: null }
    })
    ;(prisma.storyCharacter.upsert as ReturnType<typeof vi.fn>).mockResolvedValue({
      storyId: 's1',
      characterId: 'c1',
      costumeId: 'co1'
    })
    const svc = new StoryCastService(prisma as never)
    await svc.linkCharacter('s1', 'c1', {
      sortOrder: 2,
      roleNote: 'lead',
      costumeId: 'co1'
    })
    expect(prisma.storyCharacter.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          sortOrder: 2,
          roleNote: 'lead',
          costumeId: 'co1'
        }),
        update: expect.objectContaining({
          roleNote: 'lead',
          sortOrder: 2,
          costumeId: 'co1'
        })
      })
    )
  })

  it('listCharactersForStory maps costume fields', async () => {
    const prisma = basePrisma()
    ;(prisma.storyCharacter.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        sortOrder: 0,
        roleNote: 'lead',
        costumeId: 'co1',
        character: { id: 'c1', name: 'Ming' },
        costume: {
          id: 'co1',
          name: 'Suit',
          description: 'black suit',
          refImagePath: '/x.png'
        }
      },
      {
        sortOrder: 1,
        roleNote: null,
        costumeId: null,
        character: { id: 'c2', name: 'Yau' },
        costume: null
      }
    ])
    const svc = new StoryCastService(prisma as never)
    const rows = await svc.listCharactersForStory('s1')
    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({
      id: 'c1',
      storyCostumeId: 'co1',
      storyCostume: { id: 'co1', name: 'Suit' },
      linked: true
    })
    expect(rows[1].storyCostume).toBeNull()
  })

  it('listScenesForStory / listPropsForStory / listActionsForStory map overrides', async () => {
    const prisma = basePrisma()
    ;(prisma.storyScene.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        sceneNumber: 2,
        sortOrder: 0,
        scriptOverride: 'override script',
        statusOverride: 'DONE',
        scene: {
          id: 'sc1',
          script: 'base',
          status: 'PENDING',
          title: 'Alley'
        }
      }
    ])
    ;(prisma.storyProp.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { sortOrder: 0, prop: { id: 'p1', name: 'Bag' } }
    ])
    ;(prisma.storyAction.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { sortOrder: 1, action: { id: 'a1', name: 'Draw' } }
    ])
    const svc = new StoryCastService(prisma as never)
    const scenes = await svc.listScenesForStory('s1')
    expect(scenes[0]).toMatchObject({
      script: 'override script',
      status: 'DONE',
      sceneNumber: 2,
      linked: true
    })
    const props = await svc.listPropsForStory('s1')
    expect(props[0]).toMatchObject({ id: 'p1', linked: true })
    const actions = await svc.listActionsForStory('s1')
    expect(actions[0]).toMatchObject({ id: 'a1', sortOrder: 1 })
  })

  it('listScenesForStory falls back to scene script/status', async () => {
    const prisma = basePrisma()
    ;(prisma.storyScene.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        sceneNumber: 1,
        sortOrder: 0,
        scriptOverride: null,
        statusOverride: null,
        scene: { id: 'sc1', script: 'base script', status: 'PENDING' }
      }
    ])
    const svc = new StoryCastService(prisma as never)
    const scenes = await svc.listScenesForStory('s1')
    expect(scenes[0].script).toBe('base script')
    expect(scenes[0].status).toBe('PENDING')
  })

  it('setCharacterCostume updates link', async () => {
    const prisma = basePrisma()
    ;(prisma.storyCharacter.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      storyId: 's1',
      characterId: 'c1'
    })
    ;(prisma.storyCharacter.update as ReturnType<typeof vi.fn>).mockResolvedValue({
      storyId: 's1',
      characterId: 'c1',
      costumeId: 'co1'
    })
    const svc = new StoryCastService(prisma as never)
    await svc.setCharacterCostume('s1', 'c1', 'co1')
    expect(prisma.storyCharacter.update).toHaveBeenCalled()
    await svc.setCharacterCostume('s1', 'c1', null)
    expect(prisma.storyCharacter.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { costumeId: null } })
    )
  })

  it('setCharacterCostume throws when not in cast', async () => {
    const prisma = basePrisma()
    ;(prisma.storyCharacter.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
      null
    )
    const svc = new StoryCastService(prisma as never)
    await expect(svc.setCharacterCostume('s1', 'c1', 'co1')).rejects.toMatchObject({
      code: 'VALIDATION'
    })
  })

  it('unlinkCharacter blocks when on timeline', async () => {
    const prisma = basePrisma()
    ;(prisma.timelineEntry.count as ReturnType<typeof vi.fn>).mockResolvedValue(2)
    const svc = new StoryCastService(prisma as never)
    await expect(svc.unlinkCharacter('s1', 'c1')).rejects.toMatchObject({
      code: 'VALIDATION'
    })
  })

  it('unlinkCharacter deletes when free', async () => {
    const prisma = basePrisma()
    ;(prisma.timelineEntry.count as ReturnType<typeof vi.fn>).mockResolvedValue(0)
    ;(prisma.storyCharacter.deleteMany as ReturnType<typeof vi.fn>).mockResolvedValue({
      count: 1
    })
    const svc = new StoryCastService(prisma as never)
    await expect(svc.unlinkCharacter('s1', 'c1')).resolves.toEqual({ ok: true })
  })

  it('linkScene assigns sceneNumber and handles invalid/NaN', async () => {
    const prisma = basePrisma()
    ;(prisma.storyScene.aggregate as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ _max: { sceneNumber: 3 } })
      .mockResolvedValueOnce({ _max: { sortOrder: 1 } })
    ;(prisma.storyScene.upsert as ReturnType<typeof vi.fn>).mockResolvedValue({})
    const svc = new StoryCastService(prisma as never)
    await svc.linkScene('s1', 'sc1', { sceneNumber: Number.NaN })
    expect(prisma.storyScene.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ sceneNumber: 4 })
      })
    )
    ;(prisma.storyScene.aggregate as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ _max: { sortOrder: null } })
    await svc.linkScene('s1', 'sc1', { sceneNumber: 2, sortOrder: 5 })
    expect(prisma.storyScene.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ sceneNumber: 2, sortOrder: 5 }),
        update: expect.objectContaining({ sceneNumber: 2, sortOrder: 5 })
      })
    )
  })

  it('linkScene rejects non-integer sceneNumber', async () => {
    const prisma = basePrisma()
    ;(prisma.storyScene.aggregate as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ _max: { sceneNumber: 0 } })
      .mockResolvedValueOnce({ _max: { sortOrder: -1 } })
    ;(prisma.storyScene.upsert as ReturnType<typeof vi.fn>).mockResolvedValue({})
    const svc = new StoryCastService(prisma as never)
    await svc.linkScene('s1', 'sc1', { sceneNumber: 1.5 })
    expect(prisma.storyScene.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ sceneNumber: 1 })
      })
    )
  })

  it('unlinkScene / unlinkProp / unlinkAction honor timeline guards', async () => {
    const prisma = basePrisma()
    const svc = new StoryCastService(prisma as never)
    ;(prisma.timelineEntry.count as ReturnType<typeof vi.fn>).mockResolvedValue(1)
    await expect(svc.unlinkScene('s1', 'sc1')).rejects.toMatchObject({
      code: 'VALIDATION'
    })
    await expect(svc.unlinkProp('s1', 'p1')).rejects.toMatchObject({
      code: 'VALIDATION'
    })
    await expect(svc.unlinkAction('s1', 'a1')).rejects.toMatchObject({
      code: 'VALIDATION'
    })
    ;(prisma.timelineEntry.count as ReturnType<typeof vi.fn>).mockResolvedValue(0)
    await expect(svc.unlinkScene('s1', 'sc1')).resolves.toEqual({ ok: true })
    await expect(svc.unlinkProp('s1', 'p1')).resolves.toEqual({ ok: true })
    await expect(svc.unlinkAction('s1', 'a1')).resolves.toEqual({ ok: true })
  })

  it('linkProp and linkAction upsert with sortOrder', async () => {
    const prisma = basePrisma()
    ;(prisma.storyProp.aggregate as ReturnType<typeof vi.fn>).mockResolvedValue({
      _max: { sortOrder: null }
    })
    ;(prisma.storyProp.upsert as ReturnType<typeof vi.fn>).mockResolvedValue({})
    ;(prisma.storyAction.aggregate as ReturnType<typeof vi.fn>).mockResolvedValue({
      _max: { sortOrder: 2 }
    })
    ;(prisma.storyAction.upsert as ReturnType<typeof vi.fn>).mockResolvedValue({})
    const svc = new StoryCastService(prisma as never)
    await svc.linkProp('s1', 'p1')
    await svc.linkProp('s1', 'p1', { sortOrder: 9 })
    await svc.linkAction('s1', 'a1')
    await svc.linkAction('s1', 'a1', { sortOrder: 3 })
    expect(prisma.storyProp.upsert).toHaveBeenCalled()
    expect(prisma.storyAction.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ sortOrder: 3 })
      })
    )
  })

  it('is*Linked helpers', async () => {
    const prisma = basePrisma()
    const svc = new StoryCastService(prisma as never)
    ;(prisma.storyAction.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      storyId: 's1',
      actionId: 'a1'
    })
    ;(prisma.storyCharacter.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
      null
    )
    ;(prisma.storyScene.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      x: 1
    })
    ;(prisma.storyProp.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null)
    expect(await svc.isActionLinked('s1', 'a1')).toBe(true)
    expect(await svc.isCharacterLinked('s1', 'c1')).toBe(false)
    expect(await svc.isSceneLinked('s1', 'sc1')).toBe(true)
    expect(await svc.isPropLinked('s1', 'p1')).toBe(false)
  })

  it('ensureCostumeLinkedToCharacter validates costume and link', async () => {
    const prisma = basePrisma()
    ;(prisma.storyCharacter.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      storyId: 's1',
      characterId: 'c1'
    })
    ;(prisma.costume.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null)
    const svc = new StoryCastService(prisma as never)
    await expect(svc.setCharacterCostume('s1', 'c1', 'missing')).rejects.toMatchObject({
      code: 'NOT_FOUND'
    })
    ;(prisma.costume.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'co1'
    })
    ;(prisma.characterCostume.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
      null
    )
    await expect(svc.setCharacterCostume('s1', 'c1', 'co1')).rejects.toMatchObject({
      code: 'VALIDATION'
    })
  })

  it('assertCastMember validates all id lists', async () => {
    const prisma = basePrisma()
    const svc = new StoryCastService(prisma as never)
    ;(prisma.storyCharacter.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
      null
    )
    await expect(
      svc.assertCastMember('s1', { characterId: 'c1' })
    ).rejects.toMatchObject({ code: 'VALIDATION' })

    ;(prisma.storyCharacter.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      x: 1
    })
    ;(prisma.storyScene.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null)
    await expect(
      svc.assertCastMember('s1', { characterIds: ['c1'], sceneId: 'sc1' })
    ).rejects.toMatchObject({ code: 'VALIDATION' })

    ;(prisma.storyScene.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      x: 1
    })
    ;(prisma.storyProp.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null)
    await expect(
      svc.assertCastMember('s1', {
        characterIds: ['c1'],
        sceneIds: ['sc1'],
        propId: 'p1'
      })
    ).rejects.toMatchObject({ code: 'VALIDATION' })

    ;(prisma.storyProp.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      x: 1
    })
    ;(prisma.storyAction.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null)
    await expect(
      svc.assertCastMember('s1', {
        characterIds: ['c1'],
        sceneIds: ['sc1'],
        propIds: ['p1'],
        actionId: 'a1'
      })
    ).rejects.toMatchObject({ code: 'VALIDATION' })

    ;(prisma.storyAction.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      x: 1
    })
    await expect(
      svc.assertCastMember('s1', {
        characterIds: ['c1'],
        sceneIds: ['sc1'],
        propIds: ['p1'],
        actionIds: ['a1']
      })
    ).resolves.toBeUndefined()
  })

  it('ensure* throw NOT_FOUND for missing entities', async () => {
    const prisma = createMockPrisma()
    const svc = new StoryCastService(prisma as never)
    ;(prisma.story.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null)
    await expect(svc.listCharactersForStory('missing')).rejects.toMatchObject({
      code: 'NOT_FOUND'
    })

    ;(prisma.story.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 's1' })
    ;(prisma.character.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null)
    await expect(svc.linkCharacter('s1', 'missing')).rejects.toMatchObject({
      code: 'NOT_FOUND'
    })

    ;(prisma.character.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'c1'
    })
    ;(prisma.scene.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null)
    await expect(svc.linkScene('s1', 'missing')).rejects.toMatchObject({
      code: 'NOT_FOUND'
    })

    ;(prisma.scene.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'sc1' })
    ;(prisma.prop.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null)
    await expect(svc.linkProp('s1', 'missing')).rejects.toMatchObject({
      code: 'NOT_FOUND'
    })

    ;(prisma.prop.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'p1' })
    ;(prisma.action.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null)
    await expect(svc.linkAction('s1', 'missing')).rejects.toMatchObject({
      code: 'NOT_FOUND'
    })
  })
})
