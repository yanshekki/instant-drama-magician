/**
 * Shared “external reference stills” block (Characters-page pattern).
 * Parent owns gallery paths; this only renders pick / list / use-toggle.
 */
import { useTranslation } from 'react-i18next'
import { Button } from './ui'
import { LocalMediaImage } from './LocalMediaImage'

export type ExternalRefItem = {
  id: string
  path: string
  label?: string
}

export function ExternalRefSection({
  items,
  useExternalRef,
  onUseExternalChange,
  onAdd,
  onRemove,
  disabled
}: {
  items: ExternalRefItem[]
  useExternalRef: boolean
  onUseExternalChange: (v: boolean) => void
  onAdd: () => void | Promise<void>
  onRemove?: (id: string) => void
  disabled?: boolean
}): JSX.Element {
  const { t } = useTranslation()
  return (
    <section className="space-y-2 rounded-xl border border-ink-800 bg-ink-900/40 p-3">
      <div>
        <h4 className="text-xs font-semibold text-ink-100">
          {t('characters.externalRefTitle')}
        </h4>
        <p className="mt-0.5 text-[11px] text-ink-500">
          {t('characters.externalRefHint')}
        </p>
      </div>
      {items.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {items.map((g) => (
            <div
              key={g.id}
              className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-ink-700"
            >
              <LocalMediaImage
                filePath={g.path}
                alt={g.label ?? t('characters.externalRefLabel')}
                variant="thumb"
                maxHeightClass="h-full max-h-none"
                objectFit="cover"
                className="border-0 rounded-none"
                showActions={false}
                enableZoom={false}
                hoverZoom={false}
              />
              {onRemove ? (
                <button
                  type="button"
                  className="absolute right-0.5 top-0.5 rounded bg-black/70 px-1 text-[9px] text-white"
                  onClick={() => onRemove(g.id)}
                  disabled={disabled}
                >
                  ×
                </button>
              ) : null}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-[11px] text-ink-500">
          {t('characters.externalRefEmpty')}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="secondary"
          className="!text-xs"
          disabled={disabled}
          onClick={() => void onAdd()}
        >
          {t('characters.externalRefTitle')}
        </Button>
        <label
          className={[
            'flex cursor-pointer items-start gap-2 text-[11px]',
            items.length === 0 ? 'opacity-50' : ''
          ].join(' ')}
        >
          <input
            type="checkbox"
            className="mt-0.5 rounded border-ink-600"
            checked={useExternalRef && items.length > 0}
            disabled={disabled || items.length === 0}
            onChange={(e) => onUseExternalChange(e.target.checked)}
          />
          <span>
            <span className="font-medium text-ink-200">
              {t('characters.useExternalRef')}
            </span>
            <span className="mt-0.5 block text-ink-500">
              {t('characters.useExternalRefHint')}
            </span>
          </span>
        </label>
      </div>
    </section>
  )
}
