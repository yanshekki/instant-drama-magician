import { afterEach, describe, expect, it, vi } from 'vitest'
import { ChapterCastService } from './ChapterCastService'
import { CharacterService } from './CharacterService'
import { SceneService } from './SceneService'
import { PropService } from './PropService'
import { ActionService } from './ActionService'
import { StoryCastService } from './StoryCastService'
import { createMockPrisma } from '../../test/mockPrisma'
import type { CastFromChaptersExtract } from '../../domain/storyChapterPrompt'

function prismaReady(chapters: Array<Record<string, unknown>>) {
  const prisma = createMockPrisma()
  ;(prisma.story.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
    id: 's1',
    artStyle: 'noir'
  })
  ;(prisma.chapter.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(
    chapters
  )
  ;(prisma.storyCharacter.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(
    []
  )
  ;(prisma.storyScene.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([])
  ;(prisma.storyProp.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([])
  ;(prisma.storyAction.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([])
  ;(prisma.character.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([])
  ;(prisma.scene.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([])
  ;(prisma.prop.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([])
  ;(prisma.action.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([])
  return prisma
}

const drafts: CastFromChaptersExtract = {
  characters: [
    {
      name: 'Ming',
      description: 'courier',
      appearance: 'short',
      personality: 'stubborn',
      costume: 'jacket',
      roleNote: 'lead'
    }
  ],
  scenes: [
    {
      title: 'Roof',
      description: 'rain',
      locationType: 'exterior',
      timeOfDay: 'night',
      mood: 'tense'
    }
  ],
  props: [{ name: 'Umbrella', description: 'black' }],
  actions: [
    {
      name: 'Sprint',
      description: 'run',
      motionNotes: 'fast',
      intention: 'escape'
    }
  ]
}

describe('ChapterCastService', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('loadPlanContext requires a chapter with body', async () => {
    const prisma = prismaReady([
      { id: 'c1', storyId: 's1', order: 0, title: 'Empty', body: '  ' }
    ])
    await expect(
      new ChapterCastService(prisma as never).loadPlanContext('s1')
    ).rejects.toMatchObject({ message: 'errors.chaptersRequired' })
  })

  it('applyPlan skips linked names, links library, creates the rest with artStyle', async () => {
    const prisma = prismaReady([
      { id: 'ch1', storyId: 's1', order: 0, title: 'One', body: 'Rain.' }
    ])
    ;(prisma.character.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: 'lib-mei', name: 'Mei' }
    ])
    const createChar = vi
      .spyOn(CharacterService.prototype, 'create')
      .mockResolvedValue({ id: 'c-new', name: 'Ming' } as never)
    const createScene = vi
      .spyOn(SceneService.prototype, 'create')
      .mockResolvedValue({ id: 'sc-new' } as never)
    const createProp = vi
      .spyOn(PropService.prototype, 'create')
      .mockResolvedValue({ id: 'p-new' } as never)
    const createAction = vi
      .spyOn(ActionService.prototype, 'create')
      .mockResolvedValue({ id: 'a-new' } as never)
    const linkChar = vi
      .spyOn(StoryCastService.prototype, 'linkCharacter')
      .mockResolvedValue({} as never)
    const linkScene = vi
      .spyOn(StoryCastService.prototype, 'linkScene')
      .mockResolvedValue({} as never)
    const linkProp = vi
      .spyOn(StoryCastService.prototype, 'linkProp')
      .mockResolvedValue({} as never)
    const linkAction = vi
      .spyOn(StoryCastService.prototype, 'linkAction')
      .mockResolvedValue({} as never)

    const svc = new ChapterCastService(prisma as never)
    const ctx = await svc.loadPlanContext('s1')
    const mixed: CastFromChaptersExtract = {
      ...drafts,
      characters: [
        drafts.characters[0],
        {
          name: 'Mei',
          description: 'friend',
          appearance: '',
          personality: '',
          costume: '',
          roleNote: ''
        }
      ]
    }
    const plan = svc.planFromDrafts(mixed, {
      ...ctx,
      linked: {
        ...ctx.linked,
        characters: [{ id: 'c1', name: 'Ming' }]
      }
    })
    expect(plan.characters[0].action).toBe('skip')
    expect(plan.characters[1].action).toBe('link')

    await svc.applyPlan('s1', plan, 'noir')
    expect(createChar).not.toHaveBeenCalled()
    expect(linkChar).toHaveBeenCalledWith('s1', 'lib-mei', {
      roleNote: null
    })

    const createPlan = svc.planFromDrafts(drafts, ctx)
    await svc.applyPlan('s1', createPlan, '  noir  ')
    expect(createChar).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Ming',
        artStyle: 'noir',
        linkStoryId: 's1'
      })
    )
    expect(linkChar).toHaveBeenCalledWith('s1', 'c-new', {
      roleNote: 'lead'
    })
    expect(createScene).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Roof', artStyle: 'noir' })
    )
    expect(createProp).toHaveBeenCalled()
    expect(createAction).toHaveBeenCalled()
    expect(linkScene).not.toHaveBeenCalled()
    expect(linkProp).not.toHaveBeenCalled()
    expect(linkAction).not.toHaveBeenCalled()
  })
})
