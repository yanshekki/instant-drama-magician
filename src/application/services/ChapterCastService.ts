import type { PrismaClient } from '../../types/prisma'
import { AppError } from '../../types/errors'
import { CharacterService } from './CharacterService'
import { SceneService } from './SceneService'
import { PropService } from './PropService'
import { ActionService } from './ActionService'
import { StoryCastService } from './StoryCastService'
import { ChapterService } from './ChapterService'
import {
  classifyCastDrafts,
  hasNonEmptyChapterBody,
  type CastFromChaptersExtract,
  type CastPlan
} from '../../domain/storyChapterPrompt'

export class ChapterCastService {
  constructor(private readonly prisma: PrismaClient) {}

  async loadPlanContext(storyId: string): Promise<{
    linked: Parameters<typeof classifyCastDrafts>[0]['linked']
    library: Parameters<typeof classifyCastDrafts>[0]['library']
    artStyle: string | null
    chapters: Awaited<ReturnType<ChapterService['list']>>
  }> {
    const story = await this.prisma.story.findUnique({
      where: { id: storyId },
      select: { id: true, artStyle: true }
    })
    if (!story) {
      throw new AppError('NOT_FOUND', 'errors.storyNotFound', String(storyId))
    }
    const chapters = await new ChapterService(this.prisma).list(storyId)
    if (!hasNonEmptyChapterBody(chapters)) {
      throw new AppError('VALIDATION', 'errors.chaptersRequired')
    }
    const cast = new StoryCastService(this.prisma)
    const [linkedChars, linkedScenes, linkedProps, linkedActions] =
      await Promise.all([
        cast.listCharactersForStory(storyId),
        cast.listScenesForStory(storyId),
        cast.listPropsForStory(storyId),
        cast.listActionsForStory(storyId)
      ])
    const [characters, scenes, props, actions] = await Promise.all([
      this.prisma.character.findMany({ select: { id: true, name: true } }),
      this.prisma.scene.findMany({
        select: { id: true, title: true, description: true }
      }),
      this.prisma.prop.findMany({ select: { id: true, name: true } }),
      this.prisma.action.findMany({ select: { id: true, name: true } })
    ])
    return {
      artStyle: story.artStyle ?? null,
      chapters,
      linked: {
        characters: linkedChars.map((c) => ({ id: c.id, name: c.name })),
        scenes: linkedScenes.map((s) => ({
          id: s.id,
          title: s.title,
          description: s.description
        })),
        props: linkedProps.map((p) => ({ id: p.id, name: p.name })),
        actions: linkedActions.map((a) => ({ id: a.id, name: a.name }))
      },
      library: { characters, scenes, props, actions }
    }
  }

  planFromDrafts(
    drafts: CastFromChaptersExtract,
    ctx: Awaited<ReturnType<ChapterCastService['loadPlanContext']>>
  ): CastPlan {
    return classifyCastDrafts({
      drafts,
      linked: ctx.linked,
      library: ctx.library
    })
  }

  async applyPlan(
    storyId: string,
    plan: CastPlan,
    artStyle: string | null
  ): Promise<CastPlan> {
    const characters = new CharacterService(this.prisma)
    const scenes = new SceneService(this.prisma)
    const props = new PropService(this.prisma)
    const actions = new ActionService(this.prisma)
    const cast = new StoryCastService(this.prisma)
    const style = artStyle?.trim() || null

    for (const item of plan.characters) {
      if (item.action === 'skip') continue
      if (item.action === 'link' && item.existingId) {
        await cast.linkCharacter(storyId, item.existingId, {
          roleNote: item.draft.roleNote || null
        })
        continue
      }
      const created = await characters.create({
        name: item.draft.name,
        description: item.draft.description,
        appearance: item.draft.appearance || null,
        personality: item.draft.personality || null,
        costume: item.draft.costume || null,
        artStyle: style,
        linkStoryId: storyId
      })
      if (item.draft.roleNote) {
        await cast.linkCharacter(storyId, created.id, {
          roleNote: item.draft.roleNote
        })
      }
    }

    for (const item of plan.scenes) {
      if (item.action === 'skip') continue
      if (item.action === 'link' && item.existingId) {
        await cast.linkScene(storyId, item.existingId)
        continue
      }
      await scenes.create({
        title: item.draft.title,
        description: item.draft.description,
        locationType: item.draft.locationType || null,
        timeOfDay: item.draft.timeOfDay || null,
        mood: item.draft.mood || null,
        artStyle: style,
        linkStoryId: storyId
      })
    }

    for (const item of plan.props) {
      if (item.action === 'skip') continue
      if (item.action === 'link' && item.existingId) {
        await cast.linkProp(storyId, item.existingId)
        continue
      }
      await props.create({
        name: item.draft.name,
        description: item.draft.description,
        artStyle: style,
        linkStoryId: storyId
      })
    }

    for (const item of plan.actions) {
      if (item.action === 'skip') continue
      if (item.action === 'link' && item.existingId) {
        await cast.linkAction(storyId, item.existingId)
        continue
      }
      await actions.create({
        name: item.draft.name,
        description: item.draft.description,
        motionNotes: item.draft.motionNotes || null,
        intention: item.draft.intention || null,
        artStyle: style,
        linkStoryId: storyId
      })
    }

    return plan
  }
}
