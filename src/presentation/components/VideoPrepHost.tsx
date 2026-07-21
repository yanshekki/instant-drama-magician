/**
 * Owns video-prep wizard lifecycle:
 * open immediately → staged extract/polish/still → review → confirm → success / next.
 * Loading phases lock the UI; emergency exit aborts in-flight work.
 */
import { shouldAutoCreateVideoPrep, patchIfRequestIdMatch } from '../../domain/residualLabels'
import { useCallback, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import type {
  StartVideoPrepInput,
  VideoPrepDraftPayload,
  VideoPrepSession
} from '../../domain/videoPrep'
import { buildVideoPrepDraftKey } from '../../domain/videoPrep'
import { getApi } from '../../lib/api'
import { formatIpcError } from '../../lib/ipc'
import { getAiLocale } from '../../lib/aiLocale'
import { useAiJobs } from '../context/AiJobsContext'
import { useDialog } from '../context/DialogContext'
import { useToast } from '../context/ToastContext'
import { VideoPrepModal } from './VideoPrepModal'

function newRequestId(): string {
  return `vp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

function sleep(ms: number, signal: { cancelled: boolean }): Promise<void> {
  return new Promise((resolve) => {
    const t = window.setTimeout(resolve, ms)
    const iv = window.setInterval(() => {
      if (signal.cancelled) {
        window.clearTimeout(t)
        window.clearInterval(iv)
        resolve()
      }
    }, 50)
    window.setTimeout(() => window.clearInterval(iv), ms + 100)
  })
}

export function VideoPrepHost(): JSX.Element | null {
  const { t, i18n } = useTranslation()
  const toast = useToast()
  const dialog = useDialog()
  const {
    videoPrepSession,
    setVideoPrepSession,
    registerStartVideoPrep,
    upsertSavedVideoPrepDraft,
    removeSavedVideoPrepDraft
  } = useAiJobs()

  const runningCreateRef = useRef<string | null>(null)
  const abortFlagRef = useRef({ cancelled: false })

  const patchSession = useCallback(
    (patch: Partial<VideoPrepSession>): void => {
      setVideoPrepSession((prev) => (prev ? { ...prev, ...patch } : prev))
    },
    [setVideoPrepSession]
  )

  const openSession = useCallback(
    (input: StartVideoPrepInput): void => {
      abortFlagRef.current = { cancelled: false }
      if (input.resumeDraft) {
        const d = input.resumeDraft
        setVideoPrepSession({
          requestId: newRequestId(),
          phase: 'review',
          draft: {
            ...d,
            queueIndex: input.queueIndex ?? d.queueIndex,
            queueTotal: input.queueTotal ?? d.queueTotal
          },
          request: input,
          queueRemaining: input.queueRemaining ?? []
        })
        return
      }
      setVideoPrepSession({
        requestId: newRequestId(),
        phase: 'loading-extract',
        draft: null,
        request: input,
        queueRemaining: input.queueRemaining ?? []
      })
    },
    [setVideoPrepSession]
  )

  useEffect(() => {
    registerStartVideoPrep(openSession)
    return () => registerStartVideoPrep(null)
  }, [openSession, registerStartVideoPrep])

  // Staged create once per requestId (do not re-run on phase patches — would abort).
  useEffect(() => {
    const session = videoPrepSession
    if (!session) return
    if (
      !shouldAutoCreateVideoPrep(
        session.phase,
        Boolean(session.request.resumeDraft)
      )
    ) {
      return
    }
    if (runningCreateRef.current === session.requestId) return
    runningCreateRef.current = session.requestId
    const req = session.request
    const requestId = session.requestId
    const signal = { cancelled: false }
    abortFlagRef.current = signal

    void (async () => {
      try {
        patchSession({ phase: 'loading-extract' })
        // Prefer openFromStill when timeline still is already on disk
        let r: {
          kind?: string
          entityIds?: Record<string, string | undefined>
          professionalPrompt: string
          userExtraPrompt?: string
          stillPath: string
          sourceImagePath?: string | null
          durationSeconds: number
          aspectRatio: string
          materialsSummary?: string
          stillPromptUsed?: string
          skippedStill?: boolean
        } | null = null

        if (
          req.kind === 'timeline-clip' &&
          req.entityIds.storyId &&
          req.entityIds.entryId &&
          (req.skipStillIfExists || !req.stillOnly)
        ) {
          try {
            if (req.skipStillIfExists) {
              patchSession({ phase: 'loading-extract' })
              r = await getApi().videoPrep.openFromStill({
                storyId: req.entityIds.storyId,
                entryId: req.entityIds.entryId,
                locale: req.locale ?? getAiLocale(i18n.language)
              })
            }
          } catch {
            r = null
          }
        }

        if (!r) {
          const createPromise = getApi().videoPrep.create({
            kind: req.kind,
            characterId: req.entityIds.characterId,
            sceneId: req.entityIds.sceneId,
            propId: req.entityIds.propId,
            costumeId: req.entityIds.costumeId,
            actionId: req.entityIds.actionId,
            storyId: req.entityIds.storyId,
            entryId: req.entityIds.entryId,
            sourceImagePath: req.sourceImagePath,
            durationSeconds: req.durationSeconds,
            locale: req.locale ?? getAiLocale(i18n.language),
            skipStillIfExists: req.skipStillIfExists,
            stillOnly: req.stillOnly
          })

          await sleep(700, signal)
          if (signal.cancelled) return
          patchSession({ phase: 'loading-polish' })

          await sleep(900, signal)
          if (signal.cancelled) return
          patchSession({ phase: 'loading-still' })

          r = await createPromise
        }
        if (signal.cancelled || !r) return

        const draft: VideoPrepDraftPayload = {
          kind: req.kind,
          entityIds: {
            ...req.entityIds,
            characterId: r.entityIds?.characterId ?? req.entityIds.characterId,
            sceneId: r.entityIds?.sceneId ?? req.entityIds.sceneId,
            propId: r.entityIds?.propId ?? req.entityIds.propId,
            costumeId: r.entityIds?.costumeId ?? req.entityIds.costumeId,
            actionId: r.entityIds?.actionId ?? req.entityIds.actionId,
            storyId: r.entityIds?.storyId ?? req.entityIds.storyId,
            entryId: r.entityIds?.entryId ?? req.entityIds.entryId
          },
          professionalPrompt: r.professionalPrompt,
          userExtraPrompt:
            req.userExtraPrompt?.trim() || r.userExtraPrompt || '',
          stillPath: r.stillPath,
          sourceImagePath: r.sourceImagePath ?? req.sourceImagePath ?? null,
          durationSeconds: r.durationSeconds,
          aspectRatio: r.aspectRatio,
          materialsSummary: r.materialsSummary,
          stillPromptUsed: r.stillPromptUsed,
          queueIndex: req.queueIndex,
          queueTotal: req.queueTotal
        }
        setVideoPrepSession((prev) =>
          patchIfRequestIdMatch(prev, requestId, {
            phase: 'review',
            draft,
            errorMessage: undefined
          })
        )
        toast.success(
          r.skippedStill ? t('videoPrep.stillReused') : t('videoPrep.stillOk')
        )
      } catch (e) {
        if (signal.cancelled) return
        setVideoPrepSession((prev) =>
          patchIfRequestIdMatch(prev, requestId, {
            phase: 'error',
            errorMessage: formatIpcError(e)
          })
        )
      } finally {
        if (runningCreateRef.current === requestId) {
          runningCreateRef.current = null
        }
      }
    })()

    return () => {
      // Abort only when requestId changes or host unmounts
      signal.cancelled = true
      if (runningCreateRef.current === requestId) {
        runningCreateRef.current = null
      }
    }
    // Intentionally only requestId — phase patches must not re-trigger create
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoPrepSession?.requestId])

  const draftKeyFor = (draft: VideoPrepDraftPayload): string =>
    buildVideoPrepDraftKey(
      draft.kind,
      draft.entityIds,
      draft.sourceImagePath
    )

  const handleConfirm = async (
    draft: VideoPrepDraftPayload
  ): Promise<void> => {
    abortFlagRef.current.cancelled = false
    patchSession({ phase: 'loading-video', draft })
    try {
      const r = await getApi().videoPrep.confirm({
        kind: draft.kind,
        professionalPrompt: draft.professionalPrompt,
        userExtraPrompt: draft.userExtraPrompt,
        stillPath: draft.stillPath,
        sourceImagePath: draft.sourceImagePath,
        characterId: draft.entityIds.characterId,
        sceneId: draft.entityIds.sceneId,
        propId: draft.entityIds.propId,
        costumeId: draft.entityIds.costumeId,
        actionId: draft.entityIds.actionId,
        storyId: draft.entityIds.storyId,
        entryId: draft.entityIds.entryId,
        durationSeconds: draft.durationSeconds,
        aspectRatio: draft.aspectRatio,
        locale: getAiLocale(i18n.language)
      })
      if (abortFlagRef.current.cancelled) return
      removeSavedVideoPrepDraft(draftKeyFor(draft))
      const degraded = Boolean(
        (r as { degraded?: boolean }).degraded
      )
      patchSession({
        phase: 'success',
        resultPath: r.path,
        draft
      })
      if (degraded) {
        toast.error(t('pipeline.clipDoneStub'))
      } else {
        toast.success(t('videoPrep.videoOk'))
      }
      window.dispatchEvent(
        new CustomEvent('idm:video-prep-done', {
          detail: {
            kind: draft.kind,
            entityIds: draft.entityIds,
            degraded,
            path: r.path,
            gallery: r.gallery
          }
        })
      )
    } catch (e) {
      if (abortFlagRef.current.cancelled) return
      patchSession({
        phase: 'error',
        errorMessage: formatIpcError(e),
        draft
      })
    }
  }

  const handleSaveDraft = (draft: VideoPrepDraftPayload): void => {
    const remaining = videoPrepSession?.queueRemaining ?? []
    const key = draftKeyFor(draft)
    try {
      upsertSavedVideoPrepDraft(key, draft, remaining)
      toast.success(t('videoPrep.draftSaved'))
    } catch {
      toast.error(t('common.error'))
      return
    }
    setVideoPrepSession(null)
    window.dispatchEvent(
      new CustomEvent('idm:video-prep-dismiss', {
        detail: {
          kind: draft.kind,
          entityIds: draft.entityIds,
          reason: 'save-draft',
          draftKey: key,
          queueIndex: draft.queueIndex,
          queueTotal: draft.queueTotal
        }
      })
    )
  }

  const closeWithReason = (
    reason: 'abandon' | 'emergency-exit'
  ): void => {
    abortFlagRef.current.cancelled = true
    const session = videoPrepSession
    setVideoPrepSession(null)
    runningCreateRef.current = null
    const kind = session?.draft?.kind ?? session?.request.kind
    const entityIds =
      session?.draft?.entityIds ?? session?.request.entityIds
    if (kind && entityIds) {
      window.dispatchEvent(
        new CustomEvent('idm:video-prep-dismiss', {
          detail: {
            kind,
            entityIds,
            reason,
            queueIndex:
              session?.draft?.queueIndex ?? session?.request.queueIndex,
            queueTotal:
              session?.draft?.queueTotal ?? session?.request.queueTotal
          }
        })
      )
    }
  }

  const handleAbandon = async (): Promise<void> => {
    const ok = await dialog.confirm({
      message: t('videoPrep.abandonConfirm'),
      confirmLabel: t('videoPrep.abandon'),
      variant: 'danger'
    })
    if (!ok) return
    closeWithReason('abandon')
  }

  const handleEmergencyExit = async (): Promise<void> => {
    const ok = await dialog.confirm({
      message: t('videoPrep.emergencyExitConfirm'),
      confirmLabel: t('videoPrep.emergencyExit'),
      variant: 'danger'
    })
    if (!ok) return
    closeWithReason('emergency-exit')
    toast.info(t('videoPrep.emergencyExitDone'))
  }

  const handleFinish = (): void => {
    setVideoPrepSession(null)
  }

  const handleNextClip = (): void => {
    const session = videoPrepSession
    if (!session) return
    const remaining = [...session.queueRemaining]
    const nextId = remaining.shift()
    if (!nextId || !session.request.entityIds.storyId) {
      setVideoPrepSession(null)
      return
    }
    const total = session.request.queueTotal ?? session.draft?.queueTotal ?? 1
    const nextIndex =
      (session.request.queueIndex ?? session.draft?.queueIndex ?? 1) + 1
    openSession({
      kind: 'timeline-clip',
      entityIds: {
        storyId: session.request.entityIds.storyId,
        entryId: nextId
      },
      durationSeconds: session.request.durationSeconds,
      locale: session.request.locale ?? getAiLocale(i18n.language),
      queueIndex: nextIndex,
      queueTotal: total,
      queueRemaining: remaining,
      skipStillIfExists: session.request.skipStillIfExists
    })
  }

  const handleRetry = (): void => {
    const session = videoPrepSession
    if (!session) return
    if (session.draft && session.phase === 'error') {
      patchSession({ phase: 'review', errorMessage: undefined })
      return
    }
    openSession(session.request)
  }

  const handleDraftPatch = (next: VideoPrepDraftPayload): void => {
    patchSession({ draft: next })
  }

  if (!videoPrepSession) return null

  return (
    <VideoPrepModal
      open
      phase={videoPrepSession.phase}
      draft={videoPrepSession.draft}
      errorMessage={videoPrepSession.errorMessage}
      resultPath={videoPrepSession.resultPath}
      queueIndex={
        videoPrepSession.request.queueIndex ??
        videoPrepSession.draft?.queueIndex
      }
      queueTotal={
        videoPrepSession.request.queueTotal ??
        videoPrepSession.draft?.queueTotal
      }
      hasNextInQueue={videoPrepSession.queueRemaining.length > 0}
      onAbandon={() => void handleAbandon()}
      onEmergencyExit={() => void handleEmergencyExit()}
      onSaveDraft={handleSaveDraft}
      onConfirm={handleConfirm}
      onFinish={handleFinish}
      onNextClip={handleNextClip}
      onRetry={handleRetry}
      onDraftPatch={handleDraftPatch}
      onPhaseChange={(phase) => patchSession({ phase })}
    />
  )
}
