import { useTranslation } from 'react-i18next'
import { useAiJobs, type AiJob } from '../context/AiJobsContext'
import { tMediaStatus, tSceneStatus } from '../lib/statusLabels'

/**
 * Bottom-left global progress for background AI jobs.
 */
export function AiJobHud(): JSX.Element | null {
  const { t } = useTranslation()
  const {
    activeJobs,
    pendingDrafts,
    cancelJob,
    setReviewingJobId,
    dismissJob,
    jobs
  } = useAiJobs()

  const failed = jobs.filter((j) => j.status === 'failed').slice(0, 2)
  const visible = [...activeJobs, ...pendingDrafts.slice(0, 2), ...failed].slice(
    0,
    4
  )

  if (visible.length === 0) return null

  const formatError = (err?: string): string => {
    if (!err) return t('aiJobs.failed')
    if (err === 'interrupted_on_reload' || err.includes('interrupted')) {
      return t('aiJobs.interruptedReload')
    }
    const lower = err.toLowerCase()
    if (
      /no_image_in_sandbox|no image file was found in the sandbox|image_no_sandbox/.test(
        lower
      )
    ) {
      return t('aiJobs.errImageNoSandbox')
    }
    if (/imagesapi|image api is disabled|image_api_off/.test(lower)) {
      return t('aiJobs.errImageApiOff')
    }
    return err
  }

  /**
   * Progress tokens → locale.
   * Sources: setProgress('clip'|'image'|…), pipeline steps, or mediaStatus (GENERATING…).
   */
  const formatStep = (msg?: string): string => {
    if (!msg?.trim()) return ''
    const raw = msg.trim()
    // Media status codes from generation:progress (GENERATING, READY, …)
    const media = tMediaStatus(t, raw)
    if (media && media !== raw) return media
    const scene = tSceneStatus(t, raw)
    if (scene && scene !== raw) return scene
    // aiJobs.step.* (exact, then lower-case for safety)
    for (const token of [raw, raw.toLowerCase()]) {
      const key = `aiJobs.step.${token}`
      const translated = t(key)
      if (translated !== key) return translated
    }
    return raw
  }

  return (
    <div
      className="pointer-events-auto fixed bottom-4 left-4 z-[60] w-[min(22rem,calc(100vw-2rem))] space-y-2"
      aria-live="polite"
    >
      {visible.map((job) => (
        <JobCard
          key={job.id}
          job={job}
          errorText={formatError(job.error)}
          stepText={formatStep(job.message)}
          onCancel={() => void cancelJob(job.id)}
          onReview={() => setReviewingJobId(job.id)}
          onDismiss={() => dismissJob(job.id)}
          labels={{
            running: t('aiJobs.running'),
            pending: t('aiJobs.pendingConfirm'),
            failed: t('aiJobs.failed'),
            cancel: t('aiJobs.cancel'),
            review: t('aiJobs.review'),
            dismiss: t('aiJobs.dismiss')
          }}
        />
      ))}
    </div>
  )
}

function JobCard({
  job,
  errorText,
  stepText,
  onCancel,
  onReview,
  onDismiss,
  labels
}: {
  job: AiJob
  errorText: string
  stepText: string
  onCancel: () => void
  onReview: () => void
  onDismiss: () => void
  labels: {
    running: string
    pending: string
    failed: string
    cancel: string
    review: string
    dismiss: string
  }
}): JSX.Element {
  const isRunning = job.status === 'running' || job.status === 'queued'
  const isPending = job.status === 'succeeded' && Boolean(job.draft)
  const isFailed = job.status === 'failed'

  return (
    <div
      className={[
        'rounded-xl border px-3 py-2.5 shadow-xl backdrop-blur-md',
        isPending
          ? 'border-brand-500/50 bg-brand-950/90 animate-pulse'
          : isFailed
            ? 'border-rose-700/50 bg-rose-950/90'
            : 'border-ink-700 bg-ink-900/95'
      ].join(' ')}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-xs font-semibold text-ink-50">
            {job.label}
          </div>
          <div className="mt-0.5 text-[10px] text-ink-400">
            {isRunning && labels.running}
            {isPending && labels.pending}
            {isFailed && errorText}
            {stepText && isRunning ? ` · ${stepText}` : ''}
          </div>
        </div>
        <div className="flex shrink-0 gap-1">
          {isRunning && (
            <button
              type="button"
              onClick={onCancel}
              className="rounded border border-ink-600 px-1.5 py-0.5 text-[10px] text-ink-300 hover:bg-ink-800"
            >
              {labels.cancel}
            </button>
          )}
          {isPending && (
            <button
              type="button"
              onClick={onReview}
              className="rounded bg-brand-600 px-1.5 py-0.5 text-[10px] font-medium text-white hover:bg-brand-500"
            >
              {labels.review}
            </button>
          )}
          {isFailed && (
            <button
              type="button"
              onClick={onDismiss}
              className="rounded border border-rose-600/60 px-1.5 py-0.5 text-[10px] text-rose-200 hover:bg-rose-900/50"
            >
              {labels.dismiss}
            </button>
          )}
        </div>
      </div>
      {isRunning && (
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-ink-800">
          <div
            className="h-full rounded-full bg-brand-500 transition-all duration-300"
            style={{
              width: `${Math.max(job.progress, 6)}%`
            }}
          />
        </div>
      )}
      {isRunning && (
        <div className="mt-1 text-right font-mono text-[10px] text-ink-500">
          {Math.round(job.progress)}%
        </div>
      )}
    </div>
  )
}
