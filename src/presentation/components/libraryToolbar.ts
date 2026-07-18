/**
 * Shared visual tokens for library search + filter toolbars.
 * All interactive controls share a fixed 40px height for a professional, aligned look.
 */
export const libraryToolbar = {
  panel:
    'rounded-2xl border border-ink-800 bg-ink-900/90 p-3 shadow-theme-sm backdrop-blur-sm sm:p-4',
  /** All interactive controls: 40px */
  controlH: 'h-10',
  searchInput:
    'h-10 w-full min-w-[12rem] rounded-xl border border-ink-700 bg-ink-950 py-0 pl-10 pr-3 text-sm text-ink-50 shadow-theme-sm placeholder:text-ink-500 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30',
  select:
    'h-10 w-full min-w-0 cursor-pointer appearance-none rounded-xl border border-ink-700 bg-ink-950 py-0 pl-3 pr-8 text-sm text-ink-100 shadow-theme-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30',
  selectActive:
    'border-brand-500 bg-brand-950 text-brand-100 ring-1 ring-brand-500/35',
  label:
    'mb-1 block h-4 truncate text-[11px] font-medium leading-4 tracking-wide text-ink-500',
  sectionTitle:
    'mb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-500',
  filterGrid:
    'grid grid-cols-2 gap-x-3 gap-y-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5',
  clearBtn:
    'inline-flex h-10 shrink-0 items-center justify-center rounded-xl border border-ink-700 bg-ink-900 px-4 text-sm font-medium text-ink-200 transition hover:border-ink-500 hover:bg-ink-800 hover:text-ink-50 disabled:cursor-not-allowed disabled:opacity-40',
  clearBtnActive:
    'border-brand-500 bg-brand-950 text-brand-100 hover:border-brand-400 hover:bg-brand-900'
} as const
