/**
 * Shared layout tokens for Web + desktop.
 * Mobile: one primary scroll axis; sticky CTAs; 100dvh + min-h-0 chains.
 */

/** Page root under Layout main — fills remaining height, no page-level scroll leak. */
export const pageRootClass =
  'flex h-full min-h-0 flex-col overflow-hidden bg-gradient-to-b from-ink-950 via-ink-950 to-ink-900'

/** Sole vertical scroll region for list/settings pages. */
export const pageScrollClass =
  'relative min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-3 py-3 sm:px-6 sm:py-5 md:px-8 md:py-6 [-webkit-overflow-scrolling:touch]'

/** Full-viewport mobile sheet shell (editor / heavy modals). */
export const mobileSheetOuterClass =
  'fixed inset-0 z-40 flex items-stretch justify-end bg-overlay/70 backdrop-blur-sm'

/** Inner panel: full screen on phone, side drawer on large. */
export const mobileSheetPanelClass = [
  'relative flex min-h-0 w-full flex-col bg-ink-950 shadow-2xl',
  'h-[100dvh] max-h-[100dvh]',
  'max-md:border-0',
  'md:h-full md:max-h-full md:border-l md:border-ink-800',
  'md:w-full md:max-w-[min(72rem,100vw)]',
  'pb-[env(safe-area-inset-bottom,0px)]'
].join(' ')

/** Sticky action footer inside sheets. */
export const stickyFooterClass =
  'flex shrink-0 flex-col-reverse gap-2 border-t border-ink-800 bg-ink-950/98 px-3 py-3 backdrop-blur-sm sm:flex-row sm:items-center sm:justify-end sm:gap-2 sm:px-6 sm:py-3.5'

/** Primary scroll body inside a sheet (single axis). */
export const sheetBodyScrollClass =
  'min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-y-contain px-3 py-4 sm:px-6 sm:py-5 [-webkit-overflow-scrolling:touch]'

/** Compact horizontal gallery strip above form on mobile. */
export const galleryStripClass =
  'shrink-0 border-b border-ink-800 bg-ink-950/90'

/** Timeline sticky bottom action bar (mobile). */
export const timelineBottomBarClass =
  'flex shrink-0 flex-wrap items-center justify-stretch gap-2 border-t border-ink-800 bg-ink-950/98 px-3 py-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))] backdrop-blur-md md:hidden'
