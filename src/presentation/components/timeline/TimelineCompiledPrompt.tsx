import { useTranslation } from 'react-i18next'
import { Button, Textarea } from '../ui'

interface TimelineCompiledPromptProps {
  text: string
  locked: boolean
  draft: string
  onDraftChange: (v: string) => void
  onLock: () => void
  onRevert: () => void
}

export function TimelineCompiledPrompt({
  text,
  locked,
  draft,
  onDraftChange,
  onLock,
  onRevert
}: TimelineCompiledPromptProps): JSX.Element {
  const { t } = useTranslation()
  return (
    <div
      className="flex min-h-0 flex-col gap-2"
      data-testid="compiled-prompt"
    >
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-[11px] font-semibold uppercase tracking-wide text-ink-400">
          {locked
            ? t('timeline.desk.handWritten')
            : t('timeline.desk.compiledPrompt')}
        </h4>
        <div className="flex gap-1">
          {locked ? (
            <Button
              variant="ghost"
              className="!h-7 !px-2 !py-0 !text-[10px]"
              onClick={onRevert}
            >
              {t('timeline.desk.revertPrompt')}
            </Button>
          ) : (
            <Button
              variant="ghost"
              className="!h-7 !px-2 !py-0 !text-[10px]"
              onClick={onLock}
              disabled={!text.trim()}
            >
              {t('timeline.desk.lockPrompt')}
            </Button>
          )}
        </div>
      </div>
      <p className="text-[10px] leading-relaxed text-ink-500">
        {t('timeline.desk.compiledHint')}
      </p>
      {locked ? (
        <Textarea
          value={draft}
          onChange={(e) => onDraftChange(e.target.value)}
          className="min-h-[8rem] font-mono text-[11px]"
          aria-label={t('timeline.desk.handWritten')}
        />
      ) : (
        <pre className="max-h-48 min-h-[6rem] overflow-auto whitespace-pre-wrap rounded-xl border border-ink-800 bg-ink-950/70 p-2 font-mono text-[11px] leading-relaxed text-ink-200">
          {text.trim() || '—'}
        </pre>
      )}
    </div>
  )
}
