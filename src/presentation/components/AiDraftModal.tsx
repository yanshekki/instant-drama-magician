import { useTranslation } from 'react-i18next'
import { useAiJobs } from '../context/AiJobsContext'
import { LocalMediaImage } from './LocalMediaImage'
import { Button } from './ui'

/**
 * Modal when an AI job finishes with a draft awaiting user confirm.
 */
export function AiDraftModal(): JSX.Element | null {
  const { t } = useTranslation()
  const {
    jobs,
    reviewingJobId,
    setReviewingJobId,
    acceptDraft,
    discardDraft
  } = useAiJobs()

  const job = jobs.find((j) => j.id === reviewingJobId)
  if (!job?.draft) return null
  const draft = job.draft

  const close = (): void => setReviewingJobId(null)

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-overlay/70 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={t('aiJobs.draftTitle')}
      onClick={close}
    >
      <div
        className="max-h-[min(90vh,52rem)] w-full max-w-lg overflow-y-auto rounded-2xl border border-ink-700 bg-ink-950 p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-ink-50">
          {t('aiJobs.draftTitle')}
        </h2>
        <p className="mt-1 text-sm text-ink-400">{job.label}</p>

        <div className="mt-4 space-y-3">
          {draft.type === 'character-profile' && (
            <div className="space-y-2 rounded-xl border border-ink-800 bg-ink-900/50 p-3 text-sm text-ink-200">
              <Row k={t('characters.name')} v={draft.profile.name} />
              <Row
                k={t('characters.description')}
                v={draft.profile.description}
              />
              {draft.profile.appearance && (
                <Row
                  k={t('characters.appearance')}
                  v={draft.profile.appearance}
                />
              )}
              {draft.profile.voiceDesc && (
                <Row k={t('characters.voiceDesc')} v={draft.profile.voiceDesc} />
              )}
              {Array.isArray(draft.profile.spokenLanguages) &&
                draft.profile.spokenLanguages.length > 0 && (
                  <Row
                    k={t('characters.spokenLanguages')}
                    v={draft.profile.spokenLanguages.join(', ')}
                  />
                )}
              {draft.profile.mannerisms && (
                <Row
                  k={t('characters.mannerisms')}
                  v={draft.profile.mannerisms}
                />
              )}
              <p className="pt-1 text-[11px] text-ink-500">
                {t('aiJobs.profileDraftHint')}
              </p>
            </div>
          )}

          {(draft.type === 'character-sheet' ||
            draft.type === 'story-cover') && (
            <div className="overflow-hidden rounded-xl border border-ink-800">
              <LocalMediaImage
                filePath={draft.path}
                alt={draft.label}
                maxHeightClass="max-h-[40vh]"
                showActions={false}
                enableZoom
                showMeta
              />
              <p className="border-t border-ink-800 px-3 py-2 text-[11px] text-ink-500">
                {draft.type === 'story-cover'
                  ? t('aiJobs.storyCoverDraftHint')
                  : t('aiJobs.sheetDraftHint')}
                {'usedEdit' in draft && draft.usedEdit === true
                  ? ` · ${t('aiJobs.sheetModeEdit')}`
                  : 'usedEdit' in draft && draft.usedEdit === false
                    ? ` · ${t('aiJobs.sheetModeGenerate')}`
                    : ''}
              </p>
            </div>
          )}

          {(draft.type === 'pipeline' || draft.type === 'clip') && (
            <div className="rounded-xl border border-ink-800 bg-ink-900/50 p-3">
              <p
                className={
                  draft.success ? 'text-sm text-emerald-300' : 'text-sm text-rose-300'
                }
              >
                {draft.success
                  ? t('aiJobs.pipelineOk')
                  : t('aiJobs.pipelineFail')}
              </p>
              <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap text-[11px] text-ink-400">
                {draft.summary}
              </pre>
              <p className="mt-2 text-[11px] text-ink-500">
                {t('aiJobs.pipelineDraftHint')}
              </p>
            </div>
          )}

          {draft.type === 'wardrobe-suggest' && (
            <div className="space-y-2 rounded-xl border border-ink-800 bg-ink-900/50 p-3 text-sm text-ink-200">
              <Row k={t('characters.costumeLibName')} v={draft.suggestion.name} />
              <Row
                k={t('characters.swapCostumeDesc')}
                v={draft.suggestion.costume}
              />
              <Row
                k={t('characters.artStyle')}
                v={draft.suggestion.artStyle}
              />
              {draft.suggestion.rationale && (
                <Row
                  k={t('characters.suggestRationale')}
                  v={draft.suggestion.rationale}
                />
              )}
              <p className="pt-1 text-[11px] text-ink-500">
                {t('aiJobs.wardrobeDraftHint')}
              </p>
            </div>
          )}

          {draft.type === 'scene-profile' && (
            <div className="space-y-2 rounded-xl border border-ink-800 bg-ink-900/50 p-3 text-sm text-ink-200">
              {draft.profile.title && (
                <Row k={t('scenes.locationTitle')} v={draft.profile.title} />
              )}
              <Row
                k={t('scenes.description')}
                v={draft.profile.description}
              />
              {draft.profile.mood && (
                <Row k={t('scenes.mood')} v={draft.profile.mood} />
              )}
              {draft.profile.script && (
                <Row k={t('scenes.script')} v={draft.profile.script} />
              )}
              <p className="pt-1 text-[11px] text-ink-500">
                {t('aiJobs.sceneProfileDraftHint')}
              </p>
            </div>
          )}

          {draft.type === 'scene-plate' && (
            <div className="overflow-hidden rounded-xl border border-ink-800">
              <LocalMediaImage
                filePath={draft.path}
                alt={draft.label}
                maxHeightClass="max-h-[40vh]"
                showActions={false}
                enableZoom
                showMeta
              />
              <p className="border-t border-ink-800 px-3 py-2 text-[11px] text-ink-500">
                {t('aiJobs.scenePlateDraftHint')}
              </p>
            </div>
          )}

          {draft.type === 'prop-profile' && (
            <div className="space-y-2 rounded-xl border border-ink-800 bg-ink-900/50 p-3 text-sm text-ink-200">
              <Row k={t('props.name')} v={draft.profile.name} />
              <Row
                k={t('props.description')}
                v={draft.profile.description}
              />
              {draft.profile.material && (
                <Row k={t('props.material')} v={draft.profile.material} />
              )}
              <p className="pt-1 text-[11px] text-ink-500">
                {t('aiJobs.propProfileDraftHint')}
              </p>
            </div>
          )}

          {draft.type === 'prop-plate' && (
            <div className="overflow-hidden rounded-xl border border-ink-800">
              <LocalMediaImage
                filePath={draft.path}
                alt={draft.label}
                maxHeightClass="max-h-[40vh]"
                showActions={false}
                enableZoom
                showMeta
              />
              <p className="border-t border-ink-800 px-3 py-2 text-[11px] text-ink-500">
                {t('aiJobs.propPlateDraftHint')}
              </p>
            </div>
          )}
        </div>

        <div className="mt-5 flex flex-wrap justify-end gap-2">
          {draft.type === 'character-profile' ||
          draft.type === 'character-sheet' ||
          draft.type === 'wardrobe-suggest' ||
          draft.type === 'scene-profile' ||
          draft.type === 'scene-plate' ||
          draft.type === 'prop-profile' ||
          draft.type === 'prop-plate' ? (
            <>
              <Button
                variant="ghost"
                onClick={() => void discardDraft(job.id)}
              >
                {t('aiJobs.discard')}
              </Button>
              <Button onClick={() => void acceptDraft(job.id)}>
                {draft.type === 'character-sheet' ||
                draft.type === 'scene-plate' ||
                draft.type === 'prop-plate'
                  ? t('aiJobs.saveToGallery')
                  : draft.type === 'wardrobe-suggest'
                    ? t('aiJobs.applyWardrobe')
                    : t('aiJobs.applyAndSave')}
              </Button>
            </>
          ) : (
            <Button onClick={() => void acceptDraft(job.id)}>
              {t('aiJobs.acknowledge')}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

function Row({ k, v }: { k: string; v: string }): JSX.Element {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-ink-500">{k}</div>
      <div className="line-clamp-3 text-ink-100">{v}</div>
    </div>
  )
}
