import { dragOverMove, consumeMovedClick } from './uiResidualPure'
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { LocalMediaImage } from './LocalMediaImage'

export interface GalleryThumbItem {
  id: string
  path: string
  label: string
}

interface GalleryThumbStripProps {
  items: GalleryThumbItem[]
  /** Primary selection (large preview only). */
  selectedId: string | null
  /**
   * Multi-select ids for identity-lock generation.
   * Toggled only via the dedicated checkbox — not by clicking the thumb.
   */
  selectedIds?: string[]
  coverPath?: string | null
  /** Primary path when coverPath empty */
  fallbackCoverPath?: string | null
  /** Switch large preview to this item. */
  onSelect: (id: string) => void
  /** Multi-select toggle (checkbox only). */
  onToggleSelect?: (id: string) => void
  /** When true, show multi-select checkboxes. */
  multiSelect?: boolean
  /** Drop fromId onto toId (arrayMove semantics). */
  onReorder: (fromId: string, toId: string) => void
  /** Optional: render label under thumb */
  labelOf?: (item: GalleryThumbItem) => string
  reorderHintKey?: string
}

/**
 * Gallery strip: click thumb = preview only; checkbox = multi-select for gen.
 * Drag-reorder + ← → on the previewed item.
 */
export function GalleryThumbStrip({
  items,
  selectedId,
  selectedIds,
  coverPath,
  fallbackCoverPath,
  onSelect,
  onToggleSelect,
  multiSelect,
  onReorder,
  labelOf,
  reorderHintKey = 'common.galleryReorderHint'
}: GalleryThumbStripProps): JSX.Element | null {
  const { t } = useTranslation()
  const dragIdRef = useRef<string | null>(null)
  const movedRef = useRef(false)
  const [dragOverId, setDragOverId] = useState<string | null>(null)

  if (items.length === 0) return null

  const multi = multiSelect ?? Boolean(onToggleSelect)
  const multiSet = new Set(selectedIds ?? [])

  const effectiveSelected =
    selectedId && items.some((i) => i.id === selectedId)
      ? selectedId
      : items[0]?.id ?? null

  const shift = (id: string, delta: -1 | 1): void => {
    const idx = items.findIndex((i) => i.id === id)
    const peer = items[idx + delta]
    if (!peer) return
    onReorder(id, peer.id)
  }

  return (
    <div className="space-y-2">
      <p className="text-[10px] leading-snug text-ink-600">
        {t(reorderHintKey)}
        {multi ? ` ${t('common.galleryMultiSelectHint')}` : ''}
      </p>
      <div className="flex items-center gap-1.5">
        {effectiveSelected && items.length > 1 ? (
          <button
            type="button"
            className="flex h-20 w-7 shrink-0 items-center justify-center rounded-lg border border-ink-700 bg-ink-900 text-sm text-ink-200 hover:border-brand-500 disabled:opacity-40"
            disabled={items[0]?.id === effectiveSelected}
            onClick={() => shift(effectiveSelected, -1)}
            title={t('common.galleryMoveLeft')}
            aria-label={t('common.galleryMoveLeft')}
          >
            ←
          </button>
        ) : null}
        <div
          className="flex min-w-0 flex-1 gap-2 overflow-x-auto pb-1"
          onDragOver={dragOverMove}
        >
          {items.map((g) => {
            const viewing = effectiveSelected === g.id
            const multiOn = multiSet.has(g.id)
            const isCover =
              coverPath === g.path ||
              (!coverPath && fallbackCoverPath === g.path)
            const isDropTarget = dragOverId === g.id
            const label = labelOf ? labelOf(g) : g.label
            return (
              <div
                key={g.id}
                role="button"
                tabIndex={0}
                draggable
                className={[
                  'relative h-20 w-20 shrink-0 cursor-grab overflow-hidden rounded-lg border-2 transition active:cursor-grabbing',
                  isDropTarget
                    ? 'border-brand-400 ring-2 ring-brand-500/50'
                    : viewing
                      ? 'border-sky-400 ring-2 ring-sky-400/35'
                      : multiOn
                        ? 'border-brand-600/70'
                        : isCover
                          ? 'border-amber-500/80'
                          : 'border-ink-700 opacity-90 hover:opacity-100'
                ].join(' ')}
                onClick={() => {
                  if (consumeMovedClick(movedRef.current)) {
                    movedRef.current = false
                    return
                  }
                  // Thumb body = preview only (never toggles multi-check)
                  onSelect(g.id)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    onSelect(g.id)
                  }
                }}
                onDragStart={(e) => {
                  dragIdRef.current = g.id
                  movedRef.current = false
                  e.dataTransfer.setData('text/plain', g.id)
                  e.dataTransfer.effectAllowed = 'move'
                  try {
                    e.dataTransfer.setDragImage(e.currentTarget, 40, 40)
                  } catch {
                    /* ignore */
                  }
                }}
                onDragEnd={() => {
                  dragIdRef.current = null
                  setDragOverId(null)
                }}
                onDragEnter={(e) => {
                  e.preventDefault()
                  setDragOverId(g.id)
                }}
                onDragOver={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  e.dataTransfer.dropEffect = 'move'
                  if (dragOverId !== g.id) setDragOverId(g.id)
                }}
                onDragLeave={() => {
                  setDragOverId((cur) => (cur === g.id ? null : cur))
                }}
                onDrop={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  const fromId =
                    dragIdRef.current || e.dataTransfer.getData('text/plain')
                  setDragOverId(null)
                  dragIdRef.current = null
                  if (fromId && fromId !== g.id) {
                    movedRef.current = true
                    onReorder(fromId, g.id)
                  }
                }}
                title={t('common.galleryPreviewTitle', {
                  label,
                  defaultValue: `Preview: ${label}`
                })}
              >
                <div className="pointer-events-none absolute inset-0">
                  <LocalMediaImage
                    filePath={g.path}
                    alt={label}
                    variant="thumb"
                    objectFit="cover"
                    className="border-0"
                    showActions={false}
                    enableZoom={false}
                    hoverZoom={false}
                  />
                </div>

                {/* Dedicated multi-select control — separate from preview click */}
                {multi && onToggleSelect ? (
                  <button
                    type="button"
                    className={[
                      'absolute left-0.5 top-0.5 z-[8] flex h-5 w-5 items-center justify-center rounded border shadow-sm transition',
                      multiOn
                        ? 'border-brand-400 bg-brand-500 text-white'
                        : 'border-ink-500 bg-ink-950/90 text-transparent hover:border-brand-400 hover:text-ink-400'
                    ].join(' ')}
                    aria-label={
                      multiOn
                        ? t('common.galleryUncheckForGen', {
                            defaultValue: 'Uncheck for generation'
                          })
                        : t('common.galleryCheckForGen', {
                            defaultValue: 'Check for generation'
                          })
                    }
                    aria-pressed={multiOn}
                    title={
                      multiOn
                        ? t('common.galleryUncheckForGen', {
                            defaultValue: 'Uncheck for generation'
                          })
                        : t('common.galleryCheckForGen', {
                            defaultValue: 'Check for generation'
                          })
                    }
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      onToggleSelect(g.id)
                    }}
                    onPointerDown={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                  >
                    <span className="text-[11px] font-bold leading-none">
                      {multiOn ? '✓' : ''}
                    </span>
                  </button>
                ) : null}

                {isCover && (
                  <span className="pointer-events-none absolute right-0.5 top-0.5 z-[6] rounded bg-amber-600/95 px-1 py-0.5 text-[8px] font-semibold text-white">
                    {t('common.coverBadge')}
                  </span>
                )}

                {viewing ? (
                  <span className="pointer-events-none absolute inset-x-0 bottom-0 z-[5] bg-sky-600/90 px-0.5 py-0.5 text-center text-[8px] font-semibold text-white">
                    {t('common.galleryViewing', { defaultValue: 'Preview' })}
                  </span>
                ) : (
                  <span className="pointer-events-none absolute inset-x-0 bottom-0 z-[5] truncate bg-black/65 px-0.5 py-0.5 text-center text-[9px] text-white">
                    {label}
                  </span>
                )}
              </div>
            )
          })}
        </div>
        {effectiveSelected && items.length > 1 ? (
          <button
            type="button"
            className="flex h-20 w-7 shrink-0 items-center justify-center rounded-lg border border-ink-700 bg-ink-900 text-sm text-ink-200 hover:border-brand-500 disabled:opacity-40"
            disabled={items[items.length - 1]?.id === effectiveSelected}
            onClick={() => shift(effectiveSelected, 1)}
            title={t('common.galleryMoveRight')}
            aria-label={t('common.galleryMoveRight')}
          >
            →
          </button>
        ) : null}
      </div>
    </div>
  )
}
