/**
 * registerScenesIntroVideo
 */
import { existsSync } from 'fs'
import type { HandlerContext } from '../context'
import { AppError } from '../../../types/errors'
import { buildSceneIntroVideoPrompt } from '../../../domain/sceneMasterPrompt'

export function registerScenesIntroVideo(ctx: HandlerContext): void {
  const {
    reg,
    scenes,
    generation,
    activity
  } = ctx

reg(
  'scenes:generateIntroVideo',
  (
    async (
      payload: {
        sceneId: string
        sourceImagePath: string
        durationSeconds?: number
        locale?: 'zh-HK' | 'en'
      }
    ) => {
      const row = await scenes().get(payload.sceneId)
      const sourceImagePath = payload.sourceImagePath?.trim()
      if (!sourceImagePath || !existsSync(sourceImagePath)) {
        throw new AppError(
          'VALIDATION',
          'errors.sourceImageRequired',
          'Select a reference still first'
        )
      }
      if (!ctx.aiClient.generateVideo) {
        throw new AppError(
          'AI_UNAVAILABLE',
          'errors.videoUnavailable',
          'Enable Grok gateway videoApi and use a key with agent/admin mode'
        )
      }

      const profile = {
        title: row.title ?? undefined,
        description: row.description || row.title || 'Scene',
        script: row.script ?? undefined,
        locationType: row.locationType ?? undefined,
        timeOfDay: row.timeOfDay ?? undefined,
        weather: row.weather ?? undefined,
        mood: row.mood ?? undefined,
        lighting: row.lighting ?? undefined,
        colorPalette: row.colorPalette ?? undefined,
        setDressing: row.setDressing ?? undefined,
        soundscape: row.soundscape ?? undefined,
        cameraNotes: row.cameraNotes ?? undefined,
        visualTags: row.visualTags ?? undefined,
        artStyle: (row as { artStyle?: string | null }).artStyle ?? undefined
      }
      const locale = payload.locale === 'en' ? 'en' : 'zh-HK'
      const fallbackPrompt = buildSceneIntroVideoPrompt(profile, locale)
      const store = generation().getMediaStore()
      store.ensureLibraryDirs()
      const outPath = store.sceneVideoPath(row.id, 'intro', '.mp4')
      const seconds =
        typeof payload.durationSeconds === 'number'
          ? payload.durationSeconds
          : 10
      const aspectRatio =
        ctx.settings.aspectRatio === '9:16' || ctx.settings.aspectRatio === '16:9'
          ? ctx.settings.aspectRatio
          : '16:9'

      const {
        polishThenGenerateVideo
      } = await import('../../../application/video/polishVideoPrompt')
      const {
        buildSceneIntroVideoPolishUserPrompt
      } = await import('../../../domain/videoPromptPolish')

      const sceneHardRules = row.hardRules ?? null
      const result = await polishThenGenerateVideo({
        ai: ctx.aiClient,
        locale,
        fallbackPrompt,
        hardRules: sceneHardRules,
        polishUserContent: buildSceneIntroVideoPolishUserPrompt({
          locale,
          seconds,
          aspectRatio,
          hasRefImage: true,
          fallbackPrompt,
          title: profile.title,
          description: profile.description,
          script: profile.script,
          locationType: profile.locationType,
          timeOfDay: profile.timeOfDay,
          weather: profile.weather,
          mood: profile.mood,
          lighting: profile.lighting,
          colorPalette: profile.colorPalette,
          setDressing: profile.setDressing,
          soundscape: profile.soundscape,
          cameraNotes: profile.cameraNotes,
          visualTags: profile.visualTags,
          artStyle: profile.artStyle,
          seedPrompt:
            (row as { seedPrompt?: string | null }).seedPrompt ?? undefined,
          hardRules: sceneHardRules
        }),
        videoRequest: {
          durationSeconds: seconds,
          refImagePath: sourceImagePath,
          outputPath: outPath,
          aspectRatio
        }
      })

      const {
        parseSceneGallery,
        serializeSceneGallery,
        setSceneGalleryIntroVideo
      } = await import('../../../domain/sceneGallery')
      const gallery = parseSceneGallery(row.refGalleryJson, {
        refImagePath: row.refImagePath
      })
      const nextGallery = setSceneGalleryIntroVideo(
        gallery,
        sourceImagePath,
        result.outputPath
      )
      const updated = await scenes().update(row.id, {
        refGalleryJson: serializeSceneGallery(nextGallery)
      })
      activity.append({
        kind: 'scene',
        message: 'generateIntroVideo',
        meta: {
          sceneId: row.id,
          sourceImagePath,
          path: result.outputPath,
          seconds,
          degraded: result.degraded ?? false,
          polished: result.polished,
          promptPreview: result.promptUsed.slice(0, 200)
        }
      })
      return {
        scene: updated,
        path: result.outputPath,
        sourceImagePath,
        gallery: nextGallery,
        jobId: result.jobId,
        degraded: result.degraded,
        polished: result.polished
      }
    }
  )
)
}
