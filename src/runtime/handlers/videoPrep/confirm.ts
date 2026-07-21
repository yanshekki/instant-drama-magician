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
        durationSeconds?: number
        aspectRatio?: string
        locale?: 'zh-HK' | 'en'
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
          videoHardRules = collectTimelineHardRules({
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
      const finalPrompt = mergeFinalVideoPrompt(
        payload.professionalPrompt,
        payload.userExtraPrompt,
        videoHardRules
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
          /* best-effort status */
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
          refImagePath: stillPath,
          outputPath: outPath,
          aspectRatio
        })
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

      if (payload.kind === 'timeline-clip' && payload.entryId) {
        // Persist keyframe for next-beat image lock (prep still → continuity path).
        if (payload.storyId) {
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
            /* best-effort continuity write */
          }
        }
        await timeline().setMedia(payload.entryId, {
          mediaPath: result.outputPath,
          mediaStatus: 'READY',
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
