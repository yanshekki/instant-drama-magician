import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from './ui'
import { libraryToolbar } from './libraryToolbar'

export type LibraryActiveChip = {
  id: string
  label: string
  onRemove: () => void
}

function SearchIcon(): JSX.Element {
  return (
    <svg
      className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-500"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden
    >
      <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M10.5 10.5 14 14"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  )
}

/**
 * Professional library toolbar: search + labeled filter grid + clear.
 * All controls share h-10; filters sit in a responsive equal grid.
 */
export function LibraryBrowseBar({
  q,
  onQueryChange,
  placeholder,
  filters,
  activeChips,
  onClearFilters,
  hasActiveFilters
}: {
  q: string
  onQueryChange: (v: string) => void
  placeholder?: string
  /** Prefer a fragment of {@link LibraryFilterSelect} items */
  filters?: ReactNode
  activeChips?: LibraryActiveChip[]
  onClearFilters?: () => void
  hasActiveFilters?: boolean
}): JSX.Element {
  const { t } = useTranslation()
  const showClear =
    Boolean(onClearFilters) &&
    (hasActiveFilters || Boolean(q.trim()) || (activeChips?.length ?? 0) > 0)

  return (
    <div className={['mb-5', libraryToolbar.panel].join(' ')}>
      {/* Row A: search + clear — same height */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative min-w-0 flex-1">
          <SearchIcon />
          <input
            value={q}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder={placeholder ?? t('library.searchPlaceholder')}
            className={libraryToolbar.searchInput}
            aria-label={t('library.search')}
          />
        </div>
        {onClearFilters ? (
          <button
            type="button"
            disabled={!showClear}
            onClick={() => onClearFilters()}
            className={[
              libraryToolbar.clearBtn,
              showClear ? libraryToolbar.clearBtnActive : ''
            ]
              .filter(Boolean)
              .join(' ')}
          >
            {t('library.clearFilters')}
          </button>
        ) : null}
      </div>

      {/* Row B: filter grid */}
      {filters ? (
        <div className={['mt-3', libraryToolbar.filterGrid].join(' ')}>
          {filters}
        </div>
      ) : null}

      {activeChips && activeChips.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-1.5 border-t border-ink-800/60 pt-3">
          {activeChips.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={c.onRemove}
              className="inline-flex h-7 items-center gap-1.5 rounded-full border border-brand-500/40 bg-brand-950 px-2.5 text-[11px] font-medium text-brand-100 transition hover:border-brand-400"
              title={t('library.removeFilter')}
            >
              <span className="max-w-[11rem] truncate">{c.label}</span>
              <span className="text-brand-300" aria-hidden>
                ×
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}

/**
 * Scroll body for library pages: fills remaining viewport height so
 * {@link LibraryPagination} can sit at the true bottom when the grid is short.
 */
export function LibraryPageBody({
  children,
  footer
}: {
  children: ReactNode
  footer?: ReactNode
}): JSX.Element {
  return (
    <div className="flex min-h-full flex-col">
      <div className="min-w-0 flex-1">{children}</div>
      {footer ? (
        <div className="mt-auto shrink-0 pt-6">{footer}</div>
      ) : null}
    </div>
  )
}

/**
 * Bottom footer for library grids: total/filtered count + page controls.
 */
export function LibraryPagination({
  page,
  totalPages,
  onPageChange,
  filteredCount,
  totalCount,
  disabled,
  alwaysShowControls = true
}: {
  page: number
  totalPages: number
  onPageChange: (page: number) => void
  filteredCount: number
  totalCount: number
  disabled?: boolean
  alwaysShowControls?: boolean
}): JSX.Element {
  const { t } = useTranslation()
  const countLabel =
    filteredCount !== totalCount
      ? t('library.showingFiltered', {
          shown: filteredCount,
          total: totalCount
        })
      : t('library.showingTotal', { total: totalCount })
  const showControls = alwaysShowControls || totalPages > 1

  return (
    <div className="mt-2 flex flex-col items-center gap-3 border-t border-ink-800/60 pb-1 pt-4 sm:flex-row sm:justify-between">
      <p className="min-w-0 text-[12px] tabular-nums text-ink-400">
        {countLabel}
      </p>
      {showControls ? (
        <div className="flex flex-wrap items-center justify-center gap-2 text-sm text-ink-300">
          <Button
            variant="ghost"
            className="!h-9 !rounded-xl !px-3 !py-0 !text-xs"
            disabled={disabled || page <= 1 || totalPages <= 1}
            onClick={() => onPageChange(page - 1)}
          >
            ← {t('library.prevPage')}
          </Button>
          <span className="min-w-[4.5rem] text-center tabular-nums text-xs text-ink-400">
            {t('library.pageOf', { page, total: Math.max(1, totalPages) })}
          </span>
          <Button
            variant="ghost"
            className="!h-9 !rounded-xl !px-3 !py-0 !text-xs"
            disabled={disabled || page >= totalPages || totalPages <= 1}
            onClick={() => onPageChange(page + 1)}
          >
            {t('library.nextPage')} →
          </Button>
        </div>
      ) : null}
      {showControls ? (
        <span className="hidden min-w-[5rem] sm:block" aria-hidden />
      ) : null}
    </div>
  )
}
