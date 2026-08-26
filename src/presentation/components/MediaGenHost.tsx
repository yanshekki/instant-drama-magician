/**
 * Global host: one MediaGenPrepModal for the whole app (image + video).
 * Video completes inside the shell — never jumps to VideoPrepModal mid-flow.
 * Drafts share VideoPrep localStorage keys so “Continue video” still works.
 */
import { useCallback, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useAiJobs } from '../context/AiJobsContext'
import { useToast } from '../context/ToastContext'
import {
  MediaGenPrepModal,
  type MediaGenPrepOpenRequest,
  type MediaGenPrepResult
} from './MediaGenPrepModal'
import { mediaGenMode } from '../../domain/mediaGenPrep'
import {
  mediaGenDraftStorageKey,
  resolveMediaGenQueueHandoff
} from '../../domain/mediaGenFromVideoPrep'
import type { VideoPrepDraftPayload } from '../../domain/videoPrep'
import { buildIntroMediaGenRequest, buildPhotoBookClipMediaGenRequest } from '../lib/startIntroMediaGen'

export function MediaGenHost(): JSX.Element | null {
  const { t } = useTranslation()
  const toast = useToast()
  const {
    mediaGenRequest,
    setMediaGenRequest,
    startJob,
    startMediaGen,
    registerStartMediaGen,
    upsertSavedVideoPrepDraft,
    removeSavedVideoPrepDraft
  } = useAiJobs()

  /** Keep latest request for queue handoff after close */
  const requestRef = useRef(mediaGenRequest)
  requestRef.current = mediaGenRequest
  const pendingQueueRef = useRef<{
    kind: 'timeline-clip' | 'character-photoshoot-clip'
    storyId?: string
    characterId?: string
    remaining: string[]
    queueIndex: number
    queueTotal: number
    /** B4: preserve batch skip-still policy for subsequent clips */
    skipStillIfExists: boolean
    /** B1: entryId → revision / user extra */
    userExtraByEntryId: Record<string, string>
    /** R1: entryId → snap'd duration seconds */
    durationSecondsByEntryId: Record<string, number>
    introTemplateId?: string | null
    introTemplateByEntryId?: Record<string, string | null | undefined>
    artStyle?: string | null
    locale?: string
    durationSeconds?: number
    shotById?: Record<
      string,
      {
        stillPath: string
        sceneId: string
        actionId?: string
        propIds: string[]
        notes?: string
      }
    >
    identityPaths?: string[]
    advancedIdentity?: boolean
    identityCollage?: boolean
  } | null>(null)

  useEffect(() => {
    registerStartMediaGen((req: MediaGenPrepOpenRequest) => {
      setMediaGenRequest(req)
    })
    return () => registerStartMediaGen(null)
  }, [registerStartMediaGen, setMediaGenRequest])

  const close = useCallback((): void => {
    setMediaGenRequest(null)
    // Start next queued clip after modal unmounts
    const pending = pendingQueueRef.current
    pendingQueueRef.current = null
    if (!pending?.remaining.length) return
    const [nextId, ...rest] = pending.remaining
    if (
      pending.kind === 'character-photoshoot-clip' &&
      pending.characterId &&
      nextId
    ) {
      const shot = pending.shotById?.[nextId]
      if (!shot?.stillPath?.trim() || !shot.sceneId) return
      void (async () => {
        const req = await buildPhotoBookClipMediaGenRequest({
          characterId: pending.characterId!,
          shotId: nextId,
          shot,
          identityPaths: pending.identityPaths,
          introTemplateId: pending.introTemplateId,
          artStyle: pending.artStyle,
          locale: pending.locale,
          durationSeconds: pending.durationSeconds,
          advancedIdentity: pending.advancedIdentity,
          identityCollage: pending.identityCollage,
          queueIndex: pending.queueIndex + 1,
          queueTotal: pending.queueTotal,
          queueRemaining: rest,
          queueShotById: pending.shotById
        })
        startMediaGen(req)
      })()
      return
    }
    if (!pending.storyId || pending.kind !== 'timeline-clip') return
    const handoff = resolveMediaGenQueueHandoff({
      nextEntryId: nextId,
      skipStillIfExists: pending.skipStillIfExists,
      userExtraByEntryId: pending.userExtraByEntryId,
      durationSecondsByEntryId: pending.durationSecondsByEntryId
    })
    void (async () => {
      const req = await buildIntroMediaGenRequest({
        kind: 'timeline-clip',
        sourceImagePath: '',
        storyId: pending.storyId,
        entryId: nextId,
        skipStillIfExists: handoff.skipStillIfExists,
        userExtraPrompt: handoff.userExtraPrompt,
        durationSeconds: handoff.durationSeconds,
        introTemplateId:
          pending.introTemplateByEntryId?.[nextId] ?? pending.introTemplateId
      })
      startMediaGen({
        ...req,
        durationSeconds: handoff.durationSeconds,
        queueIndex: pending.queueIndex + 1,
        queueTotal: pending.queueTotal,
        queueRemaining: rest,
        queueSkipStillIfExists: pending.skipStillIfExists,
        queueUserExtraByEntryId: pending.userExtraByEntryId,
        queueDurationSecondsByEntryId: pending.durationSecondsByEntryId,
        queueIntroTemplateId:
          pending.introTemplateByEntryId?.[nextId] ?? pending.introTemplateId,
        queueIntroTemplateIdByEntryId: pending.introTemplateByEntryId
      })
    })()
  }, [setMediaGenRequest, startMediaGen])

  const onSaveDraft = useCallback(
    (payload: {
      kind: string
      polishedPrompt: string
      videoPrompt: string
      stillPath: string
      userExtraPrompt: string
      durationSeconds: number
      aspectRatio: string
      sourceImagePath?: string | null
      queueIndex?: number
      queueTotal?: number
      queueRemaining?: string[]
    }): void => {
      const req = requestRef.current
      if (!req) return
      const key = mediaGenDraftStorageKey({
        kind: payload.kind,
        characterId: req.characterId,
        sceneId: req.sceneId,
        propId: req.propId,
        costumeId: req.costumeId,
        actionId: req.actionId,
        storyId: req.storyId,
        entryId: req.entryId,
        shotId: req.shotId,
        sourceImagePath: payload.sourceImagePath
      })
      const draft: VideoPrepDraftPayload = {
        kind: payload.kind as VideoPrepDraftPayload['kind'],
        entityIds: {
          characterId: req.characterId,
          sceneId: req.sceneId,
          propId: req.propId,
          costumeId: req.costumeId,
          actionId: req.actionId,
          storyId: req.storyId,
          entryId: req.entryId,
          shotId: req.shotId
        },
        professionalPrompt: payload.videoPrompt || payload.polishedPrompt,
        userExtraPrompt: payload.userExtraPrompt,
        stillPath: payload.stillPath,
        sourceImagePath: payload.sourceImagePath ?? null,
        durationSeconds: payload.durationSeconds,
        aspectRatio: payload.aspectRatio,
        stillPromptUsed: payload.polishedPrompt,
        queueIndex: payload.queueIndex ?? req.queueIndex,
        queueTotal: payload.queueTotal ?? req.queueTotal
      }
      try {
        upsertSavedVideoPrepDraft(
          key,
          draft,
          payload.queueRemaining ?? req.queueRemaining ?? []
        )
        toast.success(t('videoPrep.draftSaved'))
        setMediaGenRequest(null)
      } catch {
        toast.error(t('common.error'))
      }
    },
    [setMediaGenRequest, toast, t, upsertSavedVideoPrepDraft]
  )

  const onVideoDone = useCallback(
    (detail: {
      kind: string
      path: string
      stillPath: string | null
      queueRemaining?: string[]
      queueIndex?: number
      queueTotal?: number
      introTemplateId?: string | null
    }): void => {
      const req = requestRef.current
      if (!req) return
      // Clear draft for this entity
      try {
        const key = mediaGenDraftStorageKey({
          kind: req.kind,
          characterId: req.characterId,
          sceneId: req.sceneId,
          propId: req.propId,
          costumeId: req.costumeId,
          actionId: req.actionId,
          storyId: req.storyId,
          entryId: req.entryId,
          shotId: req.shotId,
          sourceImagePath: req.sourceImagePath || req.galleryIdentityPaths?.[0]
        })
        removeSavedVideoPrepDraft(key)
      } catch {
        /* ignore */
      }
      const remaining = detail.queueRemaining ?? req.queueRemaining ?? []
      if (
        detail.kind === 'timeline-clip' &&
        req.storyId &&
        remaining.length > 0
      ) {
        pendingQueueRef.current = {
          kind: 'timeline-clip',
          storyId: req.storyId,
          remaining: [...remaining],
          queueIndex: detail.queueIndex ?? req.queueIndex ?? 1,
          queueTotal: detail.queueTotal ?? req.queueTotal ?? remaining.length + 1,
          // B4: preserve batch policy (false when user force-regens stills)
          skipStillIfExists:
            req.queueSkipStillIfExists ?? req.skipStillIfExists === true,
          // B1: carry per-entry revisions for the rest of the queue
          userExtraByEntryId: { ...(req.queueUserExtraByEntryId ?? {}) },
          // R1: per-entry durations for auto-advanced clips
          durationSecondsByEntryId: {
            ...(req.queueDurationSecondsByEntryId ?? {})
          },
          introTemplateId:
            req.queueIntroTemplateIdByEntryId?.[remaining[0] ?? ''] ??
            detail.introTemplateId ??
            req.introTemplateId ??
            req.queueIntroTemplateId,
          introTemplateByEntryId: {
            ...(req.queueIntroTemplateIdByEntryId ?? {})
          }
        }
        toast.info(
          t('videoPrep.queueProgress', {
            current: (detail.queueIndex ?? 1) + 1,
            total: detail.queueTotal ?? remaining.length + 1
          })
        )
      } else if (
        detail.kind === 'character-photoshoot-clip' &&
        req.characterId &&
        remaining.length > 0
      ) {
        pendingQueueRef.current = {
          kind: 'character-photoshoot-clip',
          characterId: req.characterId,
          remaining: [...remaining],
          queueIndex: detail.queueIndex ?? req.queueIndex ?? 1,
          queueTotal: detail.queueTotal ?? req.queueTotal ?? remaining.length + 1,
          skipStillIfExists: true,
          userExtraByEntryId: {},
          durationSecondsByEntryId: {},
          introTemplateId:
            detail.introTemplateId ??
            req.introTemplateId ??
            req.queueIntroTemplateId,
          artStyle: req.queueArtStyle ?? req.artStyle,
          locale: req.queueLocale,
          durationSeconds: req.durationSeconds,
          shotById: req.queueShotById,
          identityPaths: req.queueIdentityPaths ?? req.galleryIdentityPaths,
          advancedIdentity: req.advancedIdentity,
          identityCollage: req.identityCollage
        }
        toast.info(
          t('videoPrep.queueProgress', {
            current: (detail.queueIndex ?? 1) + 1,
            total: detail.queueTotal ?? remaining.length + 1
          })
        )
      }
    },
    [removeSavedVideoPrepDraft, t, toast]
  )

  /** Image path: user accepted result in shell → open AiDraft / gallery job. */
  const onGenerated = useCallback(
    (result: MediaGenPrepResult): void => {
      const req = mediaGenRequest
      setMediaGenRequest(null)
      if (!req) return

      // Video kinds finish via handleConfirmVideo → onVideoDone + idm:video-prep-done.
      // Do not treat accept as image draft (R2/B3: no dead timeline-still-done here).
      if (mediaGenMode(req.kind as never) === 'video') {
        return
      }

      if (
        req.kind === 'comic-page' &&
        result.path
      ) {
        window.dispatchEvent(
          new CustomEvent('idm:comic-page-done', {
            detail: {
              storyId: req.storyId,
              pageId: req.pageId,
              path: result.path,
              kind: req.kind
            }
          })
        )
        toast.success(t('comics.generateOk'))
        return
      }

      if (req.kind === 'key-art' && result.path) {
        window.dispatchEvent(
          new CustomEvent('idm:key-art-done', {
            detail: {
              storyId: req.storyId,
              pageId: req.pageId,
              path: result.path,
              kind: req.kind
            }
          })
        )
        toast.success(t('keyArt.generateOk'))
        return
      }

      if (req.kind === 'character-photoshoot' && result.path) {
        window.dispatchEvent(
          new CustomEvent('idm:character-photoshoot-done', {
            detail: {
              characterId: req.characterId,
              shotId: req.shotId,
              path: result.path,
              kind: req.kind
            }
          })
        )
        toast.success(t('characters.photoBookStillOk'))
        return
      }

      if (
        req.kind === 'timeline-still' &&
        req.storyId &&
        req.entryId &&
        result.path
      ) {
        window.dispatchEvent(
          new CustomEvent('idm:timeline-still-done', {
            detail: {
              storyId: req.storyId,
              entryId: req.entryId,
              path: result.path,
              kind: req.kind
            }
          })
        )
        toast.success(t('timeline.advanced.stillGenOk'))
        return
      }

      const scope = {
        characterId: req.characterId,
        sceneId: req.sceneId,
        propId: req.propId,
        costumeId: req.costumeId,
        actionId: req.actionId,
        storyId: req.storyId,
        entryId: req.entryId
      }
      const label =
        t(`mediaGen.kind.${req.kind}`, {
          defaultValue: t('mediaGen.generateImage')
        }) || t('mediaGen.generateImage')

      toast.info(t('aiJobs.startedBackground'))
      startJob({
        kind: jobKindForMediaGen(req.kind),
        label,
        scope,
        run: async ({ setProgress }) => {
          setProgress(100, 'done')
          return draftPayloadFor(req, result, label) as never
        }
      })
    },
    [mediaGenRequest, setMediaGenRequest, startJob, t, toast]
  )

  return (
    <MediaGenPrepModal
      open={Boolean(mediaGenRequest)}
      request={mediaGenRequest}
      onClose={close}
      onGenerated={onGenerated}
      onSaveDraft={onSaveDraft}
      onVideoDone={onVideoDone}
    />
  )
}

function jobKindForMediaGen(
  kind: string
):
  | 'action-plate'
  | 'character-sheet'
  | 'scene-plate'
  | 'prop-plate'
  | 'story-cover'
  | 'costume-swap'
  | 'atmosphere-swap' {
  switch (kind) {
    case 'character-sheet':
      return 'character-sheet'
    case 'scene-plate':
      return 'scene-plate'
    case 'prop-plate':
      return 'prop-plate'
    case 'story-cover':
      return 'story-cover'
    case 'costume-dress':
    case 'costume-swap':
      return 'costume-swap'
    case 'atmosphere-swap':
      return 'atmosphere-swap'
    case 'action-plate':
    default:
      return 'action-plate'
  }
}

function draftPayloadFor(
  req: MediaGenPrepOpenRequest,
  result: MediaGenPrepResult,
  fallbackLabel: string
): Record<string, unknown> {
  const path = result.path
  const label = result.galleryLabel?.trim() || fallbackLabel
  switch (req.kind) {
    case 'character-sheet':
      return {
        type: 'character-sheet',
        characterId: req.characterId!,
        storyId: req.storyId ?? '',
        path,
        variant: result.sheetVariant || req.sheetVariant || 'bible',
        label,
        layer: result.layer
      }
    case 'scene-plate':
      return {
        type: 'scene-plate',
        sceneId: req.sceneId!,
        storyId: req.storyId ?? '',
        path,
        variant: result.plateVariant || req.plateVariant || 'establishing',
        label,
        layer: result.layer
      }
    case 'prop-plate':
      return {
        type: 'prop-plate',
        propId: req.propId!,
        storyId: req.storyId ?? '',
        path,
        variant: result.plateVariant || req.plateVariant || 'hero',
        label
      }
    case 'story-cover':
      return {
        type: 'story-cover',
        storyId: req.storyId!,
        path,
        label
      }
    case 'costume-dress':
    case 'costume-swap':
      return {
        type: 'character-sheet',
        characterId: req.characterId!,
        storyId: req.storyId ?? '',
        path,
        variant: 'costume_swap',
        label,
        layer: result.layer || 'costume',
        costumeDescription: req.costumeDescription
      }
    case 'atmosphere-swap':
      return {
        type: 'scene-plate',
        sceneId: req.sceneId!,
        storyId: req.storyId ?? '',
        path,
        variant: 'atmosphere_swap',
        label,
        layer: result.layer || 'atmosphere',
        atmosphereDescription: req.atmosphereDescription
      }
    case 'action-plate':
    default:
      return {
        type: 'action-plate',
        actionId: req.actionId!,
        storyId: req.storyId ?? '',
        path,
        panelLayout: result.panelLayout || req.panelLayout || 'grid-2x2',
        label
      }
  }
}
