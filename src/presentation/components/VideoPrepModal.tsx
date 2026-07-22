/**
 * Full-screen video-prep wizard.
 * Clear steps; only abandon / save-draft / confirm / next; loading locks UI.
 */
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  VIDEO_PREP_STEPS,
  isVideoPrepPhaseLocked,
  videoPrepPhaseToStepIndex,
  type VideoPrepDraftPayload,
  type VideoPrepPhase,
  type VideoPrepStepId
} from '../../domain/videoPrep'
import { getApi } from '../../lib/api'
import { formatIpcError } from '../../lib/ipc'
import { getAiLocale } from '../../lib/aiLocale'
import { continuityBadgeKey } from '../../domain/residualLabels'
import { canSubmitRegenNotes, handleRegenNotesGate, handleRegenCatch, onLockedEscape } from './uiResidualPure'
import { useToast } from '../context/ToastContext'
import { LocalMediaImage } from './LocalMediaImage'
import { Button, Label, Textarea } from './ui'

export function VideoPrepModal({
  open,
  phase,
  draft,
  errorMessage,
  resultPath,
  queueIndex,
  queueTotal,
  hasNextInQueue,
  onAbandon,
  onEmergencyExit,
  onSaveDraft,
  onConfirm,
  onFinish,
  onNextClip,
  onRetry,
  onDraftPatch,
  onPhaseChange
}: {
  open: boolean
  phase: VideoPrepPhase
  draft: VideoPrepDraftPayload | null
  errorMessage?: string
  resultPath?: string
  queueIndex?: number
  queueTotal?: number
  hasNextInQueue?: boolean
  onAbandon: () => void
  onEmergencyExit: () => void
  onSaveDraft: (draft: VideoPrepDraftPayload) => void
  onConfirm: (draft: VideoPrepDraftPayload) => void | Promise<void>
  onFinish: () => void
  onNextClip: () => void
  onRetry: () => void
  onDraftPatch: (next: VideoPrepDraftPayload) => void
  onPhaseChange: (phase: VideoPrepPhase) => void
}): JSX.Element | null {
  const { t, i18n } = useTranslation()
  const toast = useToast()
  const [professionalPrompt, setProfessionalPrompt] = useState('')
  const [userExtra, setUserExtra] = useState('')
  const [regenOpen, setRegenOpen] = useState(false)
  const [regenNotes, setRegenNotes] = useState('')
  const [confirmBusy, setConfirmBusy] = useState(false)

  useEffect(() => {
    if (!draft) return
    setProfessionalPrompt(draft.professionalPrompt)
    setUserExtra(draft.userExtraPrompt ?? '')
    setRegenOpen(false)
    setRegenNotes('')
  }, [draft?.stillPath, draft?.professionalPrompt, draft?.kind])

  if (!open) return null

  const locked = isVideoPrepPhaseLocked(phase) || confirmBusy
  const stepIndex = videoPrepPhaseToStepIndex(phase)
  const qi = queueIndex ?? draft?.queueIndex
  const qt = queueTotal ?? draft?.queueTotal

  const currentDraft = (): VideoPrepDraftPayload | null => {
    if (!draft) return null
    return {
      ...draft,
      professionalPrompt: professionalPrompt.trim(),
      userExtraPrompt: userExtra.trim()
    }
  }

  const handleRegen = async (): Promise<void> => {
    const notes = regenNotes.trim()
    if (
      !handleRegenNotesGate(canSubmitRegenNotes(notes, Boolean(draft)), () =>
        /* v8 ignore next */
        toast.info(t('videoPrep.regenNeedNotes'))
      )
    ) {
        /* v8 ignore next */
      return
        /* v8 ignore next */
    }
    onPhaseChange('loading-regen')
    setRegenOpen(false)
    try {
      if (!draft) return
      const d = draft
      const r = await getApi().videoPrep.regenStill({
        professionalPrompt: professionalPrompt.trim() || d.professionalPrompt,
        improvementNotes: notes,
        sourceImagePath: d.sourceImagePath,
        characterId: d.entityIds.characterId,
        sceneId: d.entityIds.sceneId,
        propId: d.entityIds.propId,
        costumeId: d.entityIds.costumeId,
        storyId: d.entityIds.storyId,
        entryId: d.entityIds.entryId,
        durationSeconds: d.durationSeconds,
        aspectRatio: d.aspectRatio,
        locale: getAiLocale(i18n.language)
      })
      const next = {
        ...d,
        professionalPrompt: r.professionalPrompt,
        stillPath: r.stillPath,
        stillPromptUsed: r.stillPromptUsed,
        userExtraPrompt: userExtra
      } as VideoPrepDraftPayload
      setProfessionalPrompt(r.professionalPrompt)
      onDraftPatch(next)
      onPhaseChange('review')
      setRegenNotes('')
      toast.success(t('videoPrep.stillOk'))
    } catch (e) {
        /* v8 ignore next */
      handleRegenCatch(
        /* v8 ignore next */
        () => onPhaseChange('review'),
        /* v8 ignore next */
        (msg) => toast.error(msg),
        /* v8 ignore next */
        e,
        /* v8 ignore next */
        formatIpcError
        /* v8 ignore next */
      )
        /* v8 ignore next */
    }
  }

  const handleConfirm = async (): Promise<void> => {
    const d = currentDraft()
    if (!d || !d.professionalPrompt.trim()) return
    setConfirmBusy(true)
    try {
      await onConfirm(d)
    } finally {
      setConfirmBusy(false)
    }
  }

  const stepLabel = (id: VideoPrepStepId): string => {
    const map: Record<VideoPrepStepId, string> = {
      extract: t('videoPrep.steps.extract'),
      polish: t('videoPrep.steps.polish'),
      still: t('videoPrep.steps.still'),
      review: t('videoPrep.steps.review'),
      video: t('videoPrep.steps.video')
    }
    return map[id]
  }

  const phaseMessage = (): string => {
    switch (phase) {
      case 'loading-materials':
      case 'loading-extract':
        return t('videoPrep.phase.loadingExtract')
      case 'loading-polish':
        return t('videoPrep.phase.loadingPolish')
      case 'loading-still':
        return t('videoPrep.phase.loadingStill')
      case 'loading-regen':
        return t('videoPrep.phase.loadingRegen')
      case 'loading-video':
        return t('videoPrep.phase.loadingVideo')
      default:
        return t('videoPrep.lockedHint')
    }
  }

  return (
    <div
      className="fixed inset-0 z-[110] flex items-stretch justify-center bg-ink-950/90 p-0 backdrop-blur-md sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-busy={locked}
      aria-label={t('videoPrep.title')}
      // Never dismiss via backdrop — only explicit footer actions
      onClick={(e) => e.stopPropagation()}
      onKeyDown={onLockedEscape}
    >
      <div className="flex h-[100dvh] max-h-[100dvh] w-full max-w-4xl flex-col overflow-hidden border-0 border-ink-600 bg-ink-950 shadow-2xl ring-1 ring-white/5 sm:h-auto sm:max-h-[min(94vh,58rem)] sm:rounded-2xl sm:border pb-[env(safe-area-inset-bottom,0px)]">
        <header className="shrink-0 border-b border-ink-800 px-5 py-3.5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-ink-50">
                {t('videoPrep.title')}
                {qt && qt > 1 && qi
                  ? ` · ${t('videoPrep.queueProgress', {
                      current: qi,
                      total: qt
                    })}`
                  : null}
              </h2>
              <p className="mt-0.5 text-xs text-ink-500">{t('videoPrep.hint')}</p>
            </div>
          </div>

          {/* Stepper — centered */}
          <ol className="mt-3 flex flex-wrap items-center justify-center gap-x-0.5 gap-y-1.5">
            {VIDEO_PREP_STEPS.map((id, i) => {
              const done = i < stepIndex || phase === 'success'
              const active = i === stepIndex && phase !== 'success'
              return (
                <li key={id} className="flex items-center justify-center">
                  <span
                    className={[
                      'inline-flex items-center justify-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium leading-none',
                      done
                        ? 'bg-emerald-900/50 text-emerald-200'
                        : active
                          ? 'bg-amber-900/50 text-amber-100 ring-1 ring-amber-600/40'
                          : 'bg-ink-900 text-ink-500'
                    ].join(' ')}
                  >
                    <span
                      className={[
                        'inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold leading-none',
                        done
                          ? 'bg-emerald-600 text-white'
                          : active
                            ? 'bg-amber-500 text-ink-950'
                            : 'bg-ink-700 text-ink-400'
                      ].join(' ')}
                    >
                      {done ? '✓' : i + 1}
                    </span>
                    <span className="hidden sm:inline leading-none">
                      {stepLabel(id)}
                    </span>
                  </span>
                  {i < VIDEO_PREP_STEPS.length - 1 ? (
                    <span
                      className={`mx-1.5 hidden h-px w-5 sm:block ${
                        i < stepIndex ? 'bg-emerald-700' : 'bg-ink-700'
                      }`}
                      aria-hidden
                    />
                  ) : null}
                </li>
              )
            })}
          </ol>
        </header>

        <div className="relative min-h-0 flex-1 overflow-y-auto p-5">
          {/* Loading lock overlay body */}
          {locked ? (
            <div className="flex min-h-[16rem] flex-col items-center justify-center gap-4 py-10">
              <div
                className="h-12 w-12 animate-spin rounded-full border-2 border-amber-500/30 border-t-amber-400"
                aria-hidden
              />
              <p className="text-center text-sm font-medium text-ink-100">
                {phaseMessage()}
              </p>
              <p className="max-w-sm text-center text-xs text-ink-500">
                {t('videoPrep.lockedHint')}
              </p>
            </div>
          ) : null}

          {phase === 'error' ? (
            <div className="flex min-h-[14rem] flex-col items-center justify-center gap-3 py-8">
              <p className="text-sm font-medium text-rose-300">
                {errorMessage || t('common.error')}
              </p>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={onRetry}>
                  {t('videoPrep.retry')}
                </Button>
                <Button variant="ghost" onClick={onAbandon}>
                  {t('videoPrep.abandon')}
                </Button>
              </div>
            </div>
          ) : null}

          {phase === 'success' ? (
            <div className="flex min-h-[14rem] flex-col items-center justify-center gap-3 py-8">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-900/50 text-2xl text-emerald-300">
                ✓
              </div>
              <p className="text-sm font-medium text-ink-100">
                {t('videoPrep.videoOk')}
              </p>
              {resultPath && (
                <p className="max-w-md truncate text-center text-[11px] text-ink-500">
                  {resultPath}
                </p>
              )}
            </div>
          ) : null}

          {phase === 'review' && draft ? (
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
              <div className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-400">
                  {t('videoPrep.stillTitle')}
                </h3>
                <LocalMediaImage
                  filePath={draft.stillPath}
                  alt={t('videoPrep.stillTitle')}
                  maxHeightClass="max-h-[min(40vh,360px)]"
                  objectFit="contain"
                  showActions={false}
                />
                <Button
                  variant="secondary"
                  onClick={() => setRegenOpen(true)}
                >
                  {t('videoPrep.regenStill')}
                </Button>
              </div>

              <div className="space-y-3">
                {draft.materialsSummary ? (
                  <div className="rounded-xl border border-ink-800 bg-ink-900/40 p-3">
                    <h3 className="text-xs font-semibold text-ink-300">
                      {t('videoPrep.materials')}
                    </h3>
                    {(() => {
                      const badge = continuityBadgeKey(draft.materialsSummary)
                      if (badge === 'locked') {
                        return (
                          <p className="mt-1.5 inline-flex items-center rounded-full border border-emerald-700/60 bg-emerald-950/50 px-2 py-0.5 text-[10px] font-medium text-emerald-300">
                            {t('videoPrep.continuityLocked')}
                          </p>
                        )
                      }
                      if (badge === 'textOnly') {
                        return (
                          <p className="mt-1.5 inline-flex items-center rounded-full border border-amber-700/60 bg-amber-950/40 px-2 py-0.5 text-[10px] font-medium text-amber-200">
                            {t('videoPrep.continuityTextOnly')}
                          </p>
                        )
                      }
                      if (badge === 'firstBeat') {
                        return (
                          <p className="mt-1.5 inline-flex items-center rounded-full border border-ink-600 bg-ink-900/60 px-2 py-0.5 text-[10px] font-medium text-ink-300">
                            {t('videoPrep.continuityFirstBeat')}
                          </p>
                        )
                      }
                      return null
                    })()}
                    <pre className="mt-1 max-h-24 overflow-y-auto whitespace-pre-wrap text-[11px] leading-relaxed text-ink-400">
                      {draft.materialsSummary}
                    </pre>
                  </div>
                ) : null}
                {draft.kind === 'timeline-clip' ? (
                  <p className="text-[10px] leading-relaxed text-ink-500">
                    {t('videoPrep.hintContinuity')}
                  </p>
                ) : null}

                <div>
                  <Label>{t('videoPrep.professionalPrompt')}</Label>
                  <p className="mb-1 text-[10px] text-ink-500">
                    {t('videoPrep.professionalPromptHint')}
                  </p>
                  <Textarea
                    size="lg"
                    className="font-mono text-[12px]"
                    value={professionalPrompt}
                    onChange={(e) => setProfessionalPrompt(e.target.value)}
                  />
                </div>

                <div>
                  <Label>{t('videoPrep.userExtra')}</Label>
                  <p className="mb-1 text-[10px] text-ink-500">
                    {t('videoPrep.userExtraHint')}
                  </p>
                  <Textarea
                    size="md"
                    value={userExtra}
                    onChange={(e) => setUserExtra(e.target.value)}
                    placeholder={t('videoPrep.userExtraPh')}
                  />
                </div>
              </div>
            </div>
          ) : null}
        </div>

        <footer className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-ink-800 px-5 py-3.5">
          {phase === 'review' ? (
            <>
              <Button variant="ghost" onClick={onAbandon}>
                {t('videoPrep.abandon')}
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  const d = currentDraft()
                  if (d) onSaveDraft(d)
                }}
              >
                {t('videoPrep.saveDraft')}
              </Button>
              <Button
                disabled={!professionalPrompt.trim()}
                loading={confirmBusy}
                onClick={() => void handleConfirm()}
              >
                {t('videoPrep.confirmVideo')}
              </Button>
            </>
          ) : null}

          {phase === 'success' ? (
            hasNextInQueue ? (
              <Button onClick={onNextClip}>{t('videoPrep.nextClip')}</Button>
            ) : (
              <Button onClick={onFinish}>{t('videoPrep.finish')}</Button>
            )
          ) : null}

          {locked ? (
            <>
              <p className="mr-auto text-[11px] text-ink-500">
                {t('videoPrep.lockedHint')}
              </p>
              <Button
                variant="ghost"
                className="text-rose-300 hover:bg-rose-950/40 hover:text-rose-200"
                onClick={onEmergencyExit}
              >
                {t('videoPrep.emergencyExit')}
              </Button>
            </>
          ) : null}
        </footer>
      </div>

      {regenOpen && phase === 'review' ? (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 p-4"
          onClick={(e) => e.stopPropagation()}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-ink-700 bg-ink-950 p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-semibold text-ink-50">
              {t('videoPrep.regenAsk')}
            </h3>
            <p className="mt-1 text-xs text-ink-500">
              {t('videoPrep.regenAskHint')}
            </p>
            <Textarea
              className="mt-3"
              size="md"
              value={regenNotes}
              onChange={(e) => setRegenNotes(e.target.value)}
              placeholder={t('videoPrep.regenPlaceholder')}
            />
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setRegenOpen(false)}>
                {t('common.cancel')}
              </Button>
              <Button
                disabled={!regenNotes.trim()}
                onClick={() => void handleRegen()}
              >
                {t('videoPrep.regenStill')}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
