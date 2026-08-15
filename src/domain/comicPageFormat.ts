import type { ComicPageLayoutDef } from './comicPageLayouts'

export type ComicPageFormat = 'tall' | 'square' | 'wide'

export const COMIC_PAGE_FORMATS: ComicPageFormat[] = [
  'tall',
  'square',
  'wide'
]

export function coerceComicPageFormat(
  v?: string | null
): ComicPageFormat | null {
  if (v === 'tall' || v === 'square' || v === 'wide') return v
  return null
}

/** Page override → book default → template recommendation. */
export function effectiveComicPageFormat(opts: {
  pageFormat?: string | null
  bookFormat?: string | null
  layout: Pick<ComicPageLayoutDef, 'sizeClass'>
}): ComicPageFormat {
  return (
    coerceComicPageFormat(opts.pageFormat) ??
    coerceComicPageFormat(opts.bookFormat) ??
    (opts.layout.sizeClass === 'square'
      ? 'square'
      : opts.layout.sizeClass === 'wide'
        ? 'wide'
        : 'tall')
  )
}

export function aspectForComicFormat(
  format: ComicPageFormat
): '9:16' | '1:1' | '16:9' {
  if (format === 'tall') return '9:16'
  if (format === 'square') return '1:1'
  return '16:9'
}

/** Video models only take 9:16 or 16:9 — square pages use 9:16. */
export function videoAspectForComicFormat(
  format: ComicPageFormat
): '9:16' | '16:9' {
  return format === 'wide' ? '16:9' : '9:16'
}

export function imageSizeForComicFormat(
  format: ComicPageFormat,
  sizes: { tall: string; square: string; wide: string }
): string {
  if (format === 'tall') return sizes.tall
  if (format === 'square') return sizes.square
  return sizes.wide
}

export function comicFormatLabelKey(
  format: ComicPageFormat
): 'formatTall' | 'formatSquare' | 'formatWide' {
  if (format === 'tall') return 'formatTall'
  if (format === 'square') return 'formatSquare'
  return 'formatWide'
}

export function comicFormatLockKey(
  format: ComicPageFormat
):
  | 'comic.formatLockTall'
  | 'comic.formatLockSquare'
  | 'comic.formatLockWide' {
  if (format === 'tall') return 'comic.formatLockTall'
  if (format === 'square') return 'comic.formatLockSquare'
  return 'comic.formatLockWide'
}
