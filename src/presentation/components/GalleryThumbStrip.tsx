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
  selectedId: string | null
  coverPath?: string | null
  /** Primary path when coverPath empty */
  fallbackCoverPath?: string | null
  onSelect: (id: string) => void
  /** Drop fromId onto toId (arrayMove semantics). */
  onReorder: (fromId: string, toId: string) => void
  /** Optional: render label under thumb */
  labelOf?: (item: GalleryThumbItem) => string
  reorderHintKey?: string
}

/**
 * Shared gallery thumbnail strip: drag-reorder (Electron-safe) + ← → on selection.
 */
export function GalleryThumbStrip({
  items,
  selectedId,
  coverPath,
  fallbackCoverPath,
  onSelect,
  onReorder,
  labelOf,
  reorderHintKey = 'common.galleryReorderHint'
}: GalleryThumbStripProps): JSX.Element | null {
  const { t } = useTranslation()
  const dragIdRef = useRef<string | null>(null)
  const movedRef = useRef(false)
  const [dragOverId, setDragOverId] = useState<string | null>(null)

  if (items.length === 0) return null

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
      <p className="text-[10px] leading-snug text-ink-600">{t(reorderHintKey)}</p>
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
          onDragOver={(e) => {
            e.preventDefault()
            e.dataTransfer.dropEffect = 'move'
          }}
        >
        {items.map((g) => {
          const active = effectiveSelected === g.id
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
                  : active
                    ? 'border-brand-500'
                    : isCover
                      ? 'border-amber-500/80'
                      : 'border-ink-700 opacity-85 hover:opacity-100'
              ].join(' ')}
              onClick={() => {
                if (movedRef.current) {
                  movedRef.current = false
                  return
                }
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
              title={label}
            >
              <LocalMediaImage
                filePath={g.path}
                alt={label}
                maxHeightClass="h-full max-h-none"
                objectFit="cover"
                className="pointer-events-none h-full border-0 rounded-none"
                showActions={false}
                enableZoom={false}
                hoverZoom={false}
              />
              {isCover && (
                <span className="pointer-events-none absolute left-0.5 top-0.5 z-[6] rounded bg-amber-600/95 px-1 py-0.5 text-[8px] font-semibold text-white">
                  {t('common.coverBadge')}
                </span>
              )}
              <span className="pointer-events-none absolute inset-x-0 bottom-0 z-[5] truncate bg-black/65 px-0.5 py-0.5 text-center text-[9px] text-ink-100">
                {label}
              </span>
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
