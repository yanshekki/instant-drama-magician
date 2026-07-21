/**
 * Video prep — registerVideoPrepRegenStill
 */
import type { HandlerContext } from '../context'
import { AppError } from '../../../types/errors'

export function registerVideoPrepRegenStill(ctx: HandlerContext): void {
  const {
    reg,
    host,
    stories,
    characters,
    scenes,
    props,
    actions,
    costumes,
    generation
  } = ctx

reg(
  'videoPrep:regenStill',
  (
    async (
      payload: {
        professionalPrompt: string
        improvementNotes: string
        sourceImagePath?: string | null
        stillOutputHint?: string | null
        characterId?: string
        sceneId?: string
        propId?: string
        costumeId?: string
        actionId?: string
        storyId?: string
        entryId?: string
        durationSeconds?: number
        aspectRatio?: string
        locale?: 'zh-HK' | 'en'
      }
    ) => {
      const locale = payload.locale === 'en' ? 'en' : 'zh-HK'
      const notes = payload.improvementNotes?.trim()
      if (!notes) {
        throw new AppError('VALIDATION', 'errors.ideaOrDraftRequired')
      }
      const professionalPrompt = payload.professionalPrompt?.trim()
      if (!professionalPrompt) {
        throw new AppError('VALIDATION', 'errors.ideaOrDraftRequired')
      }
      const {
        polishProfessionalVideoPrompt
      } = await import('../../../application/video/prepareVideoPrompt')
      const {
        generateVideoStillKeyframe
      } = await import('../../../application/video/generateVideoStill')
      const {
        buildStillRegenPolishUserPrompt
      } = await import('../../../domain/videoPrep')
      const seconds =
        typeof payload.durationSeconds === 'number'
          ? payload.durationSeconds
          : 10
      const aspectRatio =
        payload.aspectRatio === '9:16' || payload.aspectRatio === '16:9'
          ? payload.aspectRatio
          : ctx.settings.aspectRatio === '9:16' || ctx.settings.aspectRatio === '16:9'
            ? ctx.settings.aspectRatio
            : '16:9'

      // Reload hard rules for this entity / timeline clip so regen cannot drop them
      let regenHardRules: string | null = null
      try {
        if (payload.characterId) {
          regenHardRules =
            (await characters().get(payload.characterId))?.hardRules ?? null
        } else if (payload.sceneId) {
          regenHardRules =
            (await scenes().get(payload.sceneId))?.hardRules ?? null
        } else if (payload.propId) {
          regenHardRules =
            (await props().get(payload.propId))?.hardRules ?? null
        } else if (payload.costumeId) {
          regenHardRules =
            (await costumes().get(payload.costumeId))?.hardRules ?? null
        } else if (payload.actionId) {
          regenHardRules =
            (await actions().get(payload.actionId))?.hardRules ?? null
        } else if (payload.storyId && payload.entryId) {
          const { collectTimelineHardRules } = await import(
            '../../../domain/promptHardRules'
          )
          const { hydrateTimelineBindings } = await import(
            '../../../domain/timelineBindings'
          )
          const story = await stories().get(payload.storyId)
          const entryRaw = await host
            .getPrisma()
            .timelineEntry.findUnique({ where: { id: payload.entryId } })
          const entry = entryRaw
            ? hydrateTimelineBindings(entryRaw as never)
            : null
          const e = entry as {
            characterId?: string | null
            sceneId?: string | null
            propId?: string | null
            actionId?: string | null
            characterIds?: string[]
            sceneIds?: string[]
            propIds?: string[]
            actionIds?: string[]
          } | null
          const charIds = [
            e?.characterId,
            ...(e?.characterIds ?? [])
          ].filter(Boolean) as string[]
          const sceneIds = [
            e?.sceneId,
            ...(e?.sceneIds ?? [])
          ].filter(Boolean) as string[]
          const propIds = [
            e?.propId,
            ...(e?.propIds ?? [])
          ].filter(Boolean) as string[]
          const actionIds = [
            e?.actionId,
            ...(e?.actionIds ?? [])
          ].filter(Boolean) as string[]
          const prisma = host.getPrisma()
          const [chars, scns, prps, acts] = await Promise.all([
            charIds.length
              ? prisma.character.findMany({ where: { id: { in: charIds } } })
              : Promise.resolve([]),
            sceneIds.length
              ? prisma.scene.findMany({ where: { id: { in: sceneIds } } })
              : Promise.resolve([]),
            propIds.length
              ? prisma.prop.findMany({ where: { id: { in: propIds } } })
              : Promise.resolve([]),
            actionIds.length
              ? prisma.action.findMany({ where: { id: { in: actionIds } } })
              : Promise.resolve([])
          ])
          regenHardRules = collectTimelineHardRules({
            story,
            characters: chars,
            scenes: scns,
            props: prps,
            actions: acts
          })
        }
      } catch {
        /* non-fatal */
      }

      const revised = await polishProfessionalVideoPrompt({
        ai: ctx.aiClient,
        locale,
        fallbackPrompt: professionalPrompt,
        polishUserContent: buildStillRegenPolishUserPrompt({
          locale,
          professionalPrompt,
          improvementNotes: notes,
          seconds,
          aspectRatio,
          hardRules: regenHardRules
        }),
        hardRules: regenHardRules
      })

      const store = generation().getMediaStore()
      store.ensureLibraryDirs()
      let stillOut = store.tmpImagePath('video_prep_still', '.png')
      if (payload.characterId) {
        stillOut = store.characterImagePath(
          payload.characterId,
          'video_prep_still',
          '.png'
        )
      } else if (payload.sceneId) {
        stillOut = store.sceneImagePath(
          payload.sceneId,
          'video_prep_still',
          '.png'
        )
      } else if (payload.propId) {
        stillOut = store.propImagePath(
          payload.propId,
          'video_prep_still',
          '.png'
        )
      } else if (payload.costumeId) {
        stillOut = store.costumeImagePath(
          payload.costumeId,
          'video_prep_still',
          '.png'
        )
      } else if (payload.storyId && payload.entryId) {
        // Timeline clip: keep continuity still path so next beat can chain.
        store.ensureStoryDirs(payload.storyId)
        stillOut = store.clipContinuityStillPath(
          payload.storyId,
          payload.entryId,
          '.png'
        )
      } else if (payload.stillOutputHint?.trim()) {
        stillOut = payload.stillOutputHint.trim()
      }

      const size =
        aspectRatio === '9:16'
          ? ctx.settings.imageSizeTall
          : aspectRatio === '16:9'
            ? ctx.settings.imageSizeWide
            : ctx.settings.imageSizeSquare || '1024x1024'

      const still = await generateVideoStillKeyframe({
        ai: ctx.aiClient,
        store,
        professionalPrompt: revised.prompt,
        sourceImagePath: payload.sourceImagePath,
        improvementNotes: notes,
        locale,
        aspectRatio,
        size,
        hardRules: regenHardRules,
        outputPath: stillOut
      })

      return {
        professionalPrompt: revised.prompt,
        stillPath: still.stillPath,
        stillPromptUsed: still.stillPromptUsed,
        polished: revised.polished
      }
    }
  )
)
}
