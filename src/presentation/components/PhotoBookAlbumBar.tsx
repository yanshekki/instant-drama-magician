import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { PhotoBookAlbum } from '../../domain/characterPhotoBook'

export function PhotoBookAlbumBar({
  albums,
  selectedId,
  onSelect,
  onAdd,
  onRename,
  onDelete,
  canDelete
}: {
  albums: PhotoBookAlbum[]
  selectedId: string
  onSelect: (id: string) => void
  onAdd: () => void
  onRename: (id: string, name: string) => void
  onDelete: (id: string) => void
  canDelete: boolean
}): JSX.Element {
  const { t } = useTranslation()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState('')

  useEffect(() => {
    setEditingId(null)
  }, [selectedId])

  const displayName = (album: PhotoBookAlbum, index: number): string => {
    const n = album.name.trim()
    if (n) return n
    return index === 0
      ? t('characters.photoBookDefaultAlbum')
      : t('characters.photoBookAlbumN', { n: index + 1 })
  }

  const startRename = (album: PhotoBookAlbum): void => {
    setDraft(album.name)
    setEditingId(album.id)
  }

  const commitRename = (): void => {
    if (!editingId) return
    onRename(editingId, draft)
    setEditingId(null)
  }

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-1">
      {albums.map((album, i) => {
        const active = album.id === selectedId
        const editing = editingId === album.id
        if (editing) {
          return (
            <input
              key={album.id}
              className="h-6 min-w-[5.5rem] max-w-[9rem] rounded-full border border-brand-500 bg-ink-950 px-2 text-[10px] text-ink-100 outline-none"
              value={draft}
              autoFocus
              aria-label={t('characters.photoBookRenameAlbum')}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commitRename}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  commitRename()
                }
                if (e.key === 'Escape') setEditingId(null)
              }}
            />
          )
        }
        return (
          <div
            key={album.id}
            className={[
              'inline-flex h-6 max-w-full items-center rounded-full text-[10px] font-medium transition',
              active
                ? 'bg-brand-600 text-white'
                : 'bg-ink-800 text-ink-400 hover:bg-ink-700 hover:text-ink-200'
            ].join(' ')}
          >
            <button
              type="button"
              className={[
                'max-w-[7.5rem] truncate px-2 py-0 leading-none',
                active ? 'pr-1' : ''
              ].join(' ')}
              onClick={() => onSelect(album.id)}
              onDoubleClick={() => {
                onSelect(album.id)
                startRename(album)
              }}
            >
              {displayName(album, i)}
            </button>
            {active ? (
              <span className="flex items-center pr-0.5">
                <button
                  type="button"
                  className="flex h-5 w-5 items-center justify-center rounded-full text-[11px] leading-none text-white/80 hover:bg-white/15 hover:text-white"
                  title={t('characters.photoBookRenameAlbum')}
                  aria-label={t('characters.photoBookRenameAlbum')}
                  onClick={(e) => {
                    e.stopPropagation()
                    startRename(album)
                  }}
                >
                  ✎
                </button>
                {canDelete ? (
                  <button
                    type="button"
                    className="flex h-5 w-5 items-center justify-center rounded-full text-[11px] leading-none text-white/80 hover:bg-rose-500/80 hover:text-white"
                    title={t('characters.photoBookDeleteAlbum')}
                    aria-label={t('characters.photoBookDeleteAlbum')}
                    onClick={(e) => {
                      e.stopPropagation()
                      onDelete(album.id)
                    }}
                  >
                    ×
                  </button>
                ) : null}
              </span>
            ) : null}
          </div>
        )
      })}
      <button
        type="button"
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-dashed border-ink-600 text-[13px] leading-none text-ink-400 hover:border-ink-400 hover:bg-ink-800 hover:text-ink-100"
        title={t('characters.photoBookAddAlbum')}
        aria-label={t('characters.photoBookAddAlbum')}
        onClick={onAdd}
      >
        +
      </button>
    </div>
  )
}
