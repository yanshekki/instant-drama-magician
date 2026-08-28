import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { snapVideoSeconds } from '../../../domain/videoDuration'
import type { TimelineEntry } from '../../../types/domain'
import { Button } from '../ui'
import { TimelineCompiledPrompt } from './TimelineCompiledPrompt'

interface TimelineDirectorInspectorProps {
  entry: TimelineEntry | null
  compiledText: string
  compiledLocked: boolean
  compiledDraft: string
  onCompiledDraftChange: (v: string) => void
  onLockCompiled: () => void
  onRevertCompiled: () => void
  onDuration: (seconds: 6 | 10) => void
  onGenerate?: () => void
  onImport?: () => void
  onExport?: () => void
  onOpen?: () => void
  onDelete?: () => void
  generateLabel?: string
  generateDisabled?: boolean
  extra?: ReactNode
}

export function TimelineDirectorInspector({
  entry,
  compiledText,
  compiledLocked,
  compiledDraft,
  onCompiledDraftChange,
  onLockCompiled,
  onRevertCompiled,
  onDuration,
  onGenerate,
  onImport,
  onExport,
  onOpen,
  onDelete,
  generateLabel,
  generateDisabled,
  extra
}: TimelineDirectorInspectorProps): JSX.Element {
  const { t } = useTranslation()
  if (!entry) {
    return (
      <div
        className="flex h-full items-center justify-center px-4 text-center text-xs text-ink-500"
        data-testid="director-inspector"
      >
        {t('timeline.desk.noClip')}
      </div>
    )
  }
  const dur = snapVideoSeconds(entry.endTime - entry.startTime)
  return (
    <div
      className="flex h-full min-h-0 flex-col gap-3 overflow-y-auto p-3 text-sm"
      data-testid="director-inspector"
    >
      <h3 className="text-sm font-semibold text-ink-100">
        {t('timeline.desk.inspector')}
      </h3>
      <dl className="grid grid-cols-2 gap-x-2 gap-y-1 font-mono text-[11px] text-ink-300">
        <dt className="text-ink-500">{t('timeline.desk.start')}</dt>
        <dd>{entry.startTime.toFixed(2)}s</dd>
        <dt className="text-ink-500">{t('timeline.desk.end')}</dt>
        <dd>{entry.endTime.toFixed(2)}s</dd>
      </dl>
      <div className="inline-flex overflow-hidden rounded-md border border-ink-700">
        {([6, 10] as const).map((sec) => (
          <button
            key={sec}
            type="button"
            className={`h-7 flex-1 px-2 text-[10px] ${
              dur === sec
                ? 'bg-ink-700 text-ink-50'
                : 'text-ink-400 hover:bg-ink-800 hover:text-ink-200'
            }`}
            onClick={() => onDuration(sec)}
          >
            {sec}s
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-1">
        {onGenerate ? (
          <Button
            variant="secondary"
            className="!h-7 !px-2 !py-0 !text-[10px]"
            disabled={generateDisabled}
            onClick={onGenerate}
          >
            {generateLabel || t('timeline.generateClip')}
          </Button>
        ) : null}
        {onImport ? (
          <Button
            variant="ghost"
            className="!h-7 !px-2 !py-0 !text-[10px]"
            onClick={onImport}
          >
            {t('timeline.importClip')}
          </Button>
        ) : null}
        {entry.mediaPath && onOpen ? (
          <Button
            variant="ghost"
            className="!h-7 !px-2 !py-0 !text-[10px]"
            onClick={onOpen}
          >
            {t('timeline.openClip')}
          </Button>
        ) : null}
        {entry.mediaPath && onExport ? (
          <Button
            variant="secondary"
            className="!h-7 !px-2 !py-0 !text-[10px]"
            onClick={onExport}
          >
            {t('timeline.exportClip')}
          </Button>
        ) : null}
        {onDelete ? (
          <Button
            variant="danger"
            className="!h-7 !px-2 !py-0 !text-[10px]"
            onClick={onDelete}
          >
            {t('common.delete')}
          </Button>
        ) : null}
      </div>
      {extra}
      <TimelineCompiledPrompt
        text={compiledText}
        locked={compiledLocked}
        draft={compiledDraft}
        onDraftChange={onCompiledDraftChange}
        onLock={onLockCompiled}
        onRevert={onRevertCompiled}
      />
    </div>
  )
}
