import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { LocalMediaImage } from './LocalMediaImage'
import {
  GalleryThumbStrip,
  type GalleryThumbItem
} from './GalleryThumbStrip'
import { Button } from './ui'

export type EntityGalleryAction = {
  label: string
  onClick: () => void
  variant?: 'primary' | 'secondary'
  disabled?: boolean
}

export type EntityGalleryPanelProps = {
  /** Aside title, e.g. gallery / cover library */
  title: string
  /** Right of title, e.g. "3/12" or "5" */
  countLabel?: string | null
  /** Layer filter chips (characters / scenes / props) */
  layerFilter?: ReactNode
  /** Put chips under preview (props) or above (default) */
  layerFilterPlacement?: 'above-preview' | 'below-preview'

  /** Large preview path; empty → empty state */
  previewPath?: string | null
  previewAlt?: string
  maxHeightClass?: string
  showMeta?: boolean
  objectFit?: 'contain' | 'cover'
  previewFrameClassName?: string

  introVideoBusy?: boolean
  introVideoPath?: string | null
  introVideoHasDraft?: boolean
  onIntroVideo?: () => void | Promise<void>
  isCover?: boolean
  onSetAsCover?: () => void
  onRemove?: () => void

  emptyIcon?: string
  emptyMessage: string
  emptyHint?: string | null
  emptyActions?: EntityGalleryAction[]

  items: GalleryThumbItem[]
  selectedId: string | null
  selectedIds?: string[]
  multiSelect?: boolean
  coverPath?: string | null
  fallbackCoverPath?: string | null
  onSelect: (id: string) => void
  onToggleSelect?: (id: string) => void
  onReorder: (fromId: string, toId: string) => void
  labelOf?: (item: GalleryThumbItem) => string
  reorderHintKey?: string

  /** Stories identity-lock checkbox */
  identityRef?: {
    checked: boolean
    onChange: (checked: boolean) => void
    disabled?: boolean
  } | null

  footerActions?: EntityGalleryAction[]
  /** Optional extra line under footer (strip already shows reorder hint). */
  footerHint?: string | null
}

/**
 * Unified editor-aside gallery: title · layer chips · large preview
 * (LocalMediaImage actions) · thumb strip · optional identity / footer CTAs.
 * All six library pages should only pass props — no hand-rolled media chrome.
 */
export function EntityGalleryPanel({
  title,
  countLabel,
  layerFilter,
  layerFilterPlacement = 'above-preview',
  previewPath,
  previewAlt = '',
  maxHeightClass = 'max-h-[min(36vh,400px)] lg:max-h-[min(48vh,480px)]',
  showMeta = true,
  objectFit = 'contain',
  previewFrameClassName = 'rounded-xl border border-ink-800 bg-ink-900/60',
  introVideoBusy,
  introVideoPath,
  introVideoHasDraft,
  onIntroVideo,
  isCover,
  onSetAsCover,
  onRemove,
  emptyIcon = '🖼',
  emptyMessage,
  emptyHint,
  emptyActions,
  items,
  selectedId,
  selectedIds,
  multiSelect = true,
  coverPath,
  fallbackCoverPath,
  onSelect,
  onToggleSelect,
  onReorder,
  labelOf,
  reorderHintKey,
  identityRef,
  footerActions,
  footerHint
}: EntityGalleryPanelProps): JSX.Element {
  const { t } = useTranslation()
  const hasPreview = Boolean(previewPath?.trim())

  const chips =
    layerFilter != null ? (
      <div className="flex flex-wrap gap-1">{layerFilter}</div>
    ) : null

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-400">
          {title}
        </h3>
        {countLabel != null && countLabel !== '' ? (
          <span className="text-[11px] text-ink-500">{countLabel}</span>
        ) : null}
      </div>

      {layerFilterPlacement === 'above-preview' ? chips : null}

      <div className={previewFrameClassName}>
        {hasPreview ? (
          <LocalMediaImage
            filePath={previewPath}
            alt={previewAlt}
            maxHeightClass={maxHeightClass}
            showMeta={showMeta}
            objectFit={objectFit}
            className="border-0 rounded-xl"
            actionsLayout="bar"
            introVideoBusy={introVideoBusy}
            introVideoPath={introVideoPath}
            introVideoHasDraft={introVideoHasDraft}
            onIntroVideo={onIntroVideo}
            isCover={isCover}
            onSetAsCover={onSetAsCover}
            onRemove={onRemove}
          />
        ) : (
          <div className="flex h-40 flex-col items-center justify-center gap-2 px-3 text-center text-xs text-ink-500">
            {emptyIcon ? (
              <span className="text-2xl opacity-40">{emptyIcon}</span>
            ) : null}
            <p>{emptyMessage}</p>
            {emptyHint ? (
              <p className="text-[11px] text-ink-600">{emptyHint}</p>
            ) : null}
            {emptyActions && emptyActions.length > 0 ? (
              <div className="mt-1 flex flex-wrap items-center justify-center gap-2">
                {emptyActions.map((a, i) => (
                  <Button
                    key={`${a.label}-${i}`}
                    variant={a.variant ?? (i === 0 ? 'primary' : 'secondary')}
                    disabled={a.disabled}
                    onClick={a.onClick}
                  >
                    {a.label}
                  </Button>
                ))}
              </div>
            ) : null}
          </div>
        )}
      </div>

      {layerFilterPlacement === 'below-preview' ? chips : null}

      <GalleryThumbStrip
        items={items}
        selectedId={selectedId}
        selectedIds={selectedIds}
        multiSelect={multiSelect}
        coverPath={coverPath}
        fallbackCoverPath={fallbackCoverPath}
        onSelect={onSelect}
        onToggleSelect={onToggleSelect}
        onReorder={onReorder}
        labelOf={labelOf}
        reorderHintKey={reorderHintKey}
      />

      {identityRef ? (
        <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-ink-800 bg-ink-950/40 px-3 py-2.5">
          <input
            type="checkbox"
            className="mt-0.5 rounded border-ink-600"
            checked={identityRef.checked}
            onChange={(e) => identityRef.onChange(e.target.checked)}
            disabled={identityRef.disabled}
          />
          <span className="text-[12px] leading-snug text-ink-300">
            <span className="font-medium text-ink-100">
              {t('common.useIdentityRef')}
            </span>
            <span className="mt-0.5 block text-[11px] text-ink-500">
              {t('common.useIdentityRefHint')}
            </span>
          </span>
        </label>
      ) : null}

      {footerActions && footerActions.length > 0 ? (
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          {footerActions.map((a, i) => (
            <Button
              key={`${a.label}-f-${i}`}
              variant={a.variant ?? 'secondary'}
              className={footerActions.length === 1 ? 'sm:flex-1' : undefined}
              disabled={a.disabled}
              onClick={a.onClick}
            >
              {a.label}
            </Button>
          ))}
        </div>
      ) : null}

      {footerHint ? (
        <p className="text-[11px] text-ink-500">{footerHint}</p>
      ) : null}
    </div>
  )
}

/** Shared layer-chip button for entity galleries. */
export function EntityGalleryLayerChip({
  active,
  label,
  onClick
}: {
  active: boolean
  label: string
  onClick: () => void
}): JSX.Element {
  return (
    <button
      type="button"
      className={[
        'rounded-full px-2 py-0.5 text-[10px] font-medium transition',
        active
          ? 'bg-brand-600 text-white'
          : 'bg-ink-800 text-ink-400 hover:bg-ink-700 hover:text-ink-200'
      ].join(' ')}
      onClick={onClick}
    >
      {label}
    </button>
  )
}
