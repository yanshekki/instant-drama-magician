/**
 * Shared library showcase card layout (stories / characters / costumes / scenes / props).
 * Caps card width so large app windows do not produce huge tiles.
 */

/** Grid: equal-width columns, max ~20rem per card, auto-fill more columns when wide. */
export const libraryGridClass =
  'grid w-full justify-start gap-5 [grid-template-columns:repeat(auto-fill,minmax(16rem,20rem))]'

/** Outer article shell — same on every library page. */
export const libraryCardClass =
  'group flex w-full max-w-[20rem] flex-col overflow-hidden rounded-2xl border border-ink-800 bg-ink-900 shadow-theme-sm transition hover:border-brand-500/45 hover:shadow-theme-md'

/** Cover / media region — fixed aspect so all pages match. */
export const libraryMediaClass =
  'relative aspect-[4/3] w-full shrink-0 overflow-hidden bg-ink-950'

/**
 * Count / status pill on photo (always light-on-dark — sits on imagery).
 * Do not use text-ink-* here: light theme ink-100 is dark and becomes unreadable.
 */
export const libraryMediaBadgeClass =
  'pointer-events-none absolute right-2 top-2 z-10 rounded-full bg-black/65 px-2 py-0.5 text-[10px] font-medium text-white shadow-sm backdrop-blur-sm'

/** Text + actions body under the media. */
export const libraryBodyClass = 'flex min-h-0 flex-1 flex-col p-4'

/** Footer row for Edit / Delete on library cards (every asset page). */
export const libraryCardActionsRowClass =
  'mt-auto flex items-center gap-2 pt-4'

/**
 * Equal-width compact card action button (secondary Edit, ghost Delete).
 * Overrides Button h-10 so library grids stay dense and consistent.
 */
export const libraryCardActionBtnClass =
  'min-w-0 flex-1 !h-8 !min-h-8 !py-0 text-xs'

/** Delete / danger text on ghost card button */
export const libraryCardActionDeleteClass =
  `${libraryCardActionBtnClass} text-rose-300`
