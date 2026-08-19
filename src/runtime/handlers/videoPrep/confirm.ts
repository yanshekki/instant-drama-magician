/**
 * Video prep — registerVideoPrepConfirm
 */
import { copyFileSync, existsSync } from 'fs'
import type { HandlerContext } from '../context'
import { AppError } from '../../../types/errors'

export function registerVideoPrepConfirm(ctx: HandlerContext): void {
  const {
    reg,
    host,
    stories,
    characters,
    scenes,
    props,
    actions,
    costumes,
    comics,
    timeline,
    generation,
    activity
  } = ctx

reg(
  'videoPrep:confirm',
  (
    async (
      payload: {
        kind:
          | 'character-intro'
          | 'scene-intro'
          | 'prop-intro'
          | 'costume-intro'
          | 'action-intro'
          | 'comic-intro'
          | 'timeline-clip'
        professionalPrompt: string
        userExtraPrompt?: string | null
        stillPath: string
        sourceImagePath?: string | null
        characterId?: string
        sceneId?: string
        propId?: string
        costumeId?: string
        actionId?: string
        storyId?: string
        entryId?: string
        pageId?: string
        durationSeconds?: number
        aspectRatio?: string
        locale?: string
        comicVideoScheme?: 'page' | 'drama'
      }
    ) => {
      if (!ctx.aiClient.generateVideo) {
        throw new AppError('VALIDATION', 'errors.videoUnavailable')
      }
      const stillPath = payload.stillPath?.trim()
      if (!stillPath || !existsSync(stillPath)) {
        throw new AppError('VALIDATION', 'errors.sourceImageRequired')
      }
      const {
        mergeFinalVideoPrompt
      } = await import('../../../domain/videoPrep')
      const seconds =
        typeof payload.durationSeconds === 'number'
          ? payload.durationSeconds
          : 10
      const aspectRatio =
        payload.aspectRatio === '9:16' || payload.aspectRatio === '16:9'
          ? payload.aspectRatio
          : '16:9'
      // User already reviewed / edited the professional prompt — do not
      // re-LLM-polish (would overwrite their revisions). Merge extras only.
      // Entity hardRules (生成鐵則) always re-applied after user edit of pro prompt
      let videoHardRules: string | null = null
      try {
        if (payload.kind === 'character-intro' && payload.characterId) {
          const c = await characters().get(payload.characterId)
          videoHardRules = c?.hardRules ?? null
        } else if (payload.kind === 'scene-intro' && payload.sceneId) {
          const s = await scenes().get(payload.sceneId)
          videoHardRules = s?.hardRules ?? null
        } else if (payload.kind === 'prop-intro' && payload.propId) {
          const pr = await props().get(payload.propId)
          videoHardRules = pr?.hardRules ?? null
        } else if (payload.kind === 'action-intro' && payload.actionId) {
          const a = await actions().get(payload.actionId)
          videoHardRules = a?.hardRules ?? null
        } else if (payload.kind === 'costume-intro' && payload.costumeId) {
          const cos = await costumes().get(payload.costumeId)
          videoHardRules = cos?.hardRules ?? null
        } else if (payload.kind === 'comic-intro' && payload.pageId) {
          const page = await comics().getPage(payload.pageId)
          const comic = await comics().getById(page.comicId)
          videoHardRules = [page.hardRules, comic.hardRules]
            .filter((x): x is string => Boolean(x?.trim()))
            .join('\n')
        } else if (
          payload.kind === 'timeline-clip' &&
          payload.storyId &&
          payload.entryId
        ) {
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
          type EntryLike = {
            characterId?: string | null
            sceneId?: string | null
            propId?: string | null
            actionId?: string | null
            characterIds?: string[]
            sceneIds?: string[]
            propIds?: string[]
            actionIds?: string[]
          }
          const entry = (
            entryRaw
              ? hydrateTimelineBindings(entryRaw as never)
              : null
          ) as EntryLike | null
          const charIds = [
            entry?.characterId,
            ...(entry?.characterIds ?? [])
          ].filter(Boolean) as string[]
          const sceneIds = [
            entry?.sceneId,
            ...(entry?.sceneIds ?? [])
          ].filter(Boolean) as string[]
          const propIds = [
            entry?.propId,
            ...(entry?.propIds ?? [])
          ].filter(Boolean) as string[]
          const actionIds = [
            entry?.actionId,
            ...(entry?.actionIds ?? [])
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
          videoHardRules = collectTimelineHardRules(
            {
              story,
              characters: chars,
              scenes: scns,
              props: prps,
              actions: acts
            },
            { uiLocale: payload.locale ?? 'zh-HK' }
          )
        }
      } catch {
        /* v8 ignore next */
        void 0
        /* v8 ignore next */
      }
      const finalPrompt = mergeFinalVideoPrompt(
        payload.professionalPrompt,
        payload.userExtraPrompt,
        videoHardRules,
        payload.locale ?? 'zh-HK'
      )
      if (!finalPrompt) {
        throw new AppError('VALIDATION', 'errors.ideaOrDraftRequired')
      }

      const store = generation().getMediaStore()
      store.ensureLibraryDirs()
      let outPath = store.tmpImagePath('video_out', '.mp4').replace(
        /\.png$/i,
        '.mp4'
      )
      let comicVideoId: string | null = null
      let lastFramePath: string | undefined
      let clipRefPath = stillPath
      // Prefer library video paths by kind
      if (payload.kind === 'character-intro' && payload.characterId) {
        outPath = store.characterVideoPath(
          payload.characterId,
          'intro',
          '.mp4'
        )
      } else if (payload.kind === 'scene-intro' && payload.sceneId) {
        outPath = store.sceneVideoPath(payload.sceneId, 'intro', '.mp4')
      } else if (payload.kind === 'prop-intro' && payload.propId) {
        outPath = store.propVideoPath(payload.propId, 'intro', '.mp4')
      } else if (payload.kind === 'costume-intro' && payload.costumeId) {
        outPath = store.costumeVideoPath(payload.costumeId, 'intro', '.mp4')
      } else if (payload.kind === 'action-intro' && payload.actionId) {
        outPath = store.actionVideoPath(payload.actionId, 'intro', '.mp4')
      } else if (
        payload.kind === 'comic-intro' &&
        payload.pageId &&
        payload.storyId
      ) {
        const { newComicPageVideoId } = await import(
          '../../../domain/comicPageVideos'
        )
        store.ensureStoryDirs(payload.storyId)
        comicVideoId = newComicPageVideoId()
        outPath = store.comicPageVideoPath
          ? store.comicPageVideoPath(
              payload.storyId,
              payload.pageId,
              comicVideoId,
              '.mp4'
            )
          : store.comicPagePath(payload.storyId, payload.pageId, '.mp4')
      } else if (
        payload.kind === 'timeline-clip' &&
        payload.storyId &&
        payload.entryId
      ) {
        outPath = store.clipPath(payload.storyId, payload.entryId, '.mp4')
        try {
          await timeline().setMedia(payload.entryId, {
            mediaStatus: 'GENERATING',
            mediaError: null
          })
        } catch {
          /* v8 ignore next */
          void 0
        /* v8 ignore next */
        }
        try {
          const { buildClipContinuityContext } = await import(
            '../../../domain/clipContinuityContext'
          )
          const { getPreviousTimelineEntry } = await import(
            '../../../domain/promptContinuity'
          )
          const { sortTimelineEntries } = await import(
            '../../../domain/timeline'
          )
          const { hydrateTimelineBindings } = await import(
            '../../../domain/timelineBindings'
          )
          const rows = await host.getPrisma().timelineEntry.findMany({
            where: { storyId: payload.storyId }
          })
          const entries = sortTimelineEntries(
            (Array.isArray(rows) ? rows : []).map((r) =>
              hydrateTimelineBindings(r as never)
            )
          )
          const prevEntry = getPreviousTimelineEntry(entries, payload.entryId)
          let previousContinuityPath: string | null = null
          if (prevEntry) {
            const contPath = store.clipContinuityStillPath(
              payload.storyId,
              prevEntry.id
            )
            if (contPath && existsSync(contPath)) {
              previousContinuityPath = contPath
            }
          }
          const cont = buildClipContinuityContext({
            entries,
            currentId: payload.entryId,
            previousContinuityPath,
            ownStillPath: stillPath,
            continuityMode: ctx.settings.continuityMode,
            motionPriority: ctx.settings.motionPriority,
            locale: payload.locale ?? 'zh-HK',
            pathExists: (p) => existsSync(p)
          })
          lastFramePath = cont.lastFramePath ?? undefined
          if (cont.editBase) clipRefPath = cont.editBase
        } catch {
          /* keep still as first frame */
        }
      }

      let result: {
        outputPath: string
        polished?: boolean
        promptUsed?: string
        jobId?: string
        degraded?: boolean
      }
      try {
        const video = await ctx.aiClient.generateVideo!({
          prompt: finalPrompt,
          durationSeconds: seconds,
          refImagePath: clipRefPath,
          lastFramePath,
          generateAudio: ctx.settings.generateAudio === true,
          voices:
            ctx.settings.generateAudio === true
              ? [
                  (
                    await import('../../../domain/grokVideoVoices')
                  ).coerceGrokVideoVoice(ctx.settings.grokVideoVoice)
                ]
              : undefined,
          outputPath: outPath,
          aspectRatio
        })
        if (video.voicesDropped) {
          const { auditGrokVoicesDropped } = await import(
            '../../../domain/generationAudit'
          )
          activity.append({
            kind: 'generation',
            message: auditGrokVoicesDropped({
              entryId: payload.entryId
            }).message,
            level: 'info',
            storyId: payload.storyId,
            meta: { reason: 'grok-voices-dropped', entryId: payload.entryId }
          })
        }
        result = {
          outputPath: video.outputPath,
          polished: false,
          promptUsed: finalPrompt,
          jobId: video.jobId,
          degraded: Boolean(video.degraded)
        }
      } catch (err) {
        if (payload.kind === 'timeline-clip' && payload.entryId) {
          try {
            await timeline().setMedia(payload.entryId, {
              mediaStatus: 'FAILED',
              mediaError:
                err instanceof Error ? err.message : String(err)
            })
          } catch {
            /* ignore */
          }
        }
        throw err
      }

      // Attach intro video to gallery when applicable
      if (payload.kind === 'character-intro' && payload.characterId) {
        const row = await characters().get(payload.characterId)
        const {
          parseCharacterGallery,
          serializeCharacterGallery,
          setGalleryIntroVideo,
          appendGalleryItem
        } = await import('../../../domain/characterGallery')
        let next = parseCharacterGallery(row.refGalleryJson, {
          refImagePath: row.refImagePath,
          refSheetPath: row.refSheetPath
        })
        const source = payload.sourceImagePath?.trim() || null
        // Always keep keyframe still in gallery
        if (!next.some((g) => g.path === stillPath)) {
          next = appendGalleryItem(next, {
            path: stillPath,
            kind: 'gen',
            label: 'Video still'
          })
        }
        // Bind video onto the image the user started from (if still in gallery)
        if (source && next.some((g) => g.path === source)) {
          next = setGalleryIntroVideo(next, source, result.outputPath)
        }
        // And onto the keyframe still
        next = setGalleryIntroVideo(next, stillPath, result.outputPath)
        const updated = await characters().update(payload.characterId, {
          refGalleryJson: serializeCharacterGallery(next),
          refImagePath: row.refImagePath || source || stillPath
        })
        activity.append({
          kind: 'character',
          message: 'videoPrepConfirm',
          meta: {
            characterId: payload.characterId,
            path: result.outputPath,
            stillPath,
            sourceImagePath: source
          }
        })
        return {
          path: result.outputPath,
          gallery: next,
          entity: updated,
          polished: result.polished,
          promptUsed: result.promptUsed
        }
      }

      if (payload.kind === 'scene-intro' && payload.sceneId) {
        const row = await scenes().get(payload.sceneId)
        const {
          parseSceneGallery,
          serializeSceneGallery,
          setSceneGalleryIntroVideo,
          appendSceneGalleryItem
        } = await import('../../../domain/sceneGallery')
        let next = parseSceneGallery(row.refGalleryJson, {
          refImagePath: row.refImagePath
        })
        const source = payload.sourceImagePath?.trim() || null
        if (!next.some((g) => g.path === stillPath)) {
          next = appendSceneGalleryItem(next, {
            path: stillPath,
            kind: 'gen',
            label: 'Video still'
          })
        }
        if (source && next.some((g) => g.path === source)) {
          next = setSceneGalleryIntroVideo(next, source, result.outputPath)
        }
        next = setSceneGalleryIntroVideo(next, stillPath, result.outputPath)
        const updated = await scenes().update(payload.sceneId, {
          refGalleryJson: serializeSceneGallery(next),
          refImagePath: row.refImagePath || source || stillPath
        })
        return {
          path: result.outputPath,
          gallery: next,
          entity: updated,
          polished: result.polished,
          promptUsed: result.promptUsed
        }
      }

      if (payload.kind === 'prop-intro' && payload.propId) {
        const row = await props().get(payload.propId)
        const {
          parseSceneGallery,
          serializeSceneGallery,
          setSceneGalleryIntroVideo,
          appendSceneGalleryItem
        } = await import('../../../domain/sceneGallery')
        let next = parseSceneGallery(row.refGalleryJson, {
          refImagePath: row.refImagePath
        })
        const source = payload.sourceImagePath?.trim() || null
        if (!next.some((g) => g.path === stillPath)) {
          next = appendSceneGalleryItem(next, {
            path: stillPath,
            kind: 'gen',
            label: 'Video still'
          })
        }
        if (source && next.some((g) => g.path === source)) {
          next = setSceneGalleryIntroVideo(next, source, result.outputPath)
        }
        next = setSceneGalleryIntroVideo(next, stillPath, result.outputPath)
        const updated = await props().update(payload.propId, {
          refGalleryJson: serializeSceneGallery(next),
          refImagePath: row.refImagePath || source || stillPath
        })
        return {
          path: result.outputPath,
          gallery: next,
          entity: updated,
          polished: result.polished,
          promptUsed: result.promptUsed
        }
      }

      if (payload.kind === 'costume-intro' && payload.costumeId) {
        const row = await costumes().get(payload.costumeId)
        const {
          parseCharacterGallery,
          serializeCharacterGallery,
          setGalleryIntroVideo,
          appendGalleryItem
        } = await import('../../../domain/characterGallery')
        let next = parseCharacterGallery(row.refGalleryJson, {
          refImagePath: row.refImagePath
        })
        const source = payload.sourceImagePath?.trim() || null
        if (!next.some((g) => g.path === stillPath)) {
          next = appendGalleryItem(next, {
            path: stillPath,
            kind: 'gen',
            label: 'Video still'
          })
        }
        if (source && next.some((g) => g.path === source)) {
          next = setGalleryIntroVideo(next, source, result.outputPath)
        }
        next = setGalleryIntroVideo(next, stillPath, result.outputPath)
        const updated = await costumes().update(payload.costumeId, {
          refGalleryJson: serializeCharacterGallery(next),
          refImagePath: row.refImagePath || source || stillPath
        })
        return {
          path: result.outputPath,
          gallery: next,
          entity: updated,
          polished: result.polished,
          promptUsed: result.promptUsed
        }
      }

      if (payload.kind === 'action-intro' && payload.actionId) {
        const row = await actions().get(payload.actionId)
        const {
          parseActionGallery,
          serializeActionGallery,
          setActionGalleryIntroVideo,
          appendActionGalleryItem
        } = await import('../../../domain/actionGallery')
        let next = parseActionGallery(row.refGalleryJson, {
          refImagePath: row.refImagePath
        })
        const source = payload.sourceImagePath?.trim() || null
        if (!next.some((g) => g.path === stillPath)) {
          next = appendActionGalleryItem(next, {
            path: stillPath,
            kind: 'gen',
            label: 'Video still'
          })
        }
        if (source && next.some((g) => g.path === source)) {
          next = setActionGalleryIntroVideo(next, source, result.outputPath)
        }
        next = setActionGalleryIntroVideo(next, stillPath, result.outputPath)
        const updated = await actions().update(payload.actionId, {
          refGalleryJson: serializeActionGallery(next),
          refImagePath: row.refImagePath || source || stillPath
        })
        return {
          path: result.outputPath,
          gallery: next,
          entity: updated,
          polished: result.polished,
          promptUsed: result.promptUsed
        }
      }

      if (payload.kind === 'comic-intro' && payload.pageId) {
        if (result.degraded) {
          return {
            path: result.outputPath,
            entity: await comics().getPage(payload.pageId),
            polished: result.polished,
            promptUsed: result.promptUsed
          }
        }
        const {
          newComicPageVideoId,
          parseComicPageVideos,
          prependComicPageVideo,
          serializeComicPageVideos
        } = await import('../../../domain/comicPageVideos')
        const { coerceComicVideoScheme } = await import(
          '../../../domain/comicPageLayouts'
        )
        const page = await comics().getPage(payload.pageId)
        const videoId = comicVideoId || newComicPageVideoId()
        const next = prependComicPageVideo(
          parseComicPageVideos(page.videoGalleryJson, {
            videoPath: page.videoPath
          }),
          {
            id: videoId,
            path: result.outputPath,
            scheme: coerceComicVideoScheme(payload.comicVideoScheme),
            createdAt: new Date().toISOString()
          }
        )
        const updated = await comics().updatePage(payload.pageId, {
          videoPath: result.outputPath,
          videoGalleryJson: serializeComicPageVideos(next)
        })
        return {
          path: result.outputPath,
          entity: updated,
          gallery: next,
          polished: result.polished,
          promptUsed: result.promptUsed
        }
      }

      if (payload.kind === 'timeline-clip' && payload.entryId) {
        // End-frame continuity for next-beat lock (fallback: prep still copy).
        if (payload.storyId) {
          try {
            const { writeClipContinuityStillFromVideo } = await import(
              '../../../application/video/writeClipContinuityStill'
            )
            const { FfmpegService } = await import(
              '../../../infrastructure/ffmpeg/FfmpegService'
            )
            await writeClipContinuityStillFromVideo({
              ffmpeg: new FfmpegService(),
              store,
              storyId: payload.storyId,
              entryId: payload.entryId,
              videoPath: result.outputPath,
              fallbackStillPath: stillPath,
              skipIfUserCleared: true
            })
          } catch {
            /* best-effort continuity write */
            try {
              store.ensureStoryDirs(payload.storyId)
              const contPath = store.clipContinuityStillPath(
                payload.storyId,
                payload.entryId,
                '.png'
              )
              if (stillPath !== contPath && existsSync(stillPath)) {
                copyFileSync(stillPath, contPath)
              }
            } catch {
              /* ignore */
            }
          }
        }
        await timeline().setMedia(payload.entryId, {
          mediaPath: result.degraded ? null : result.outputPath,
          mediaStatus: result.degraded ? 'FAILED' : 'READY',
          mediaError: result.degraded ? 'STUB_PLACEHOLDER' : null
        })
        return {
          path: result.outputPath,
          polished: result.polished,
          promptUsed: result.promptUsed,
          degraded: result.degraded
        }
      }

      return {
        path: result.outputPath,
        polished: result.polished,
        promptUsed: result.promptUsed
      }
    }
  )
)
}
