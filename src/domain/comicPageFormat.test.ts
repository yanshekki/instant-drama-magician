import { describe, expect, it } from 'vitest'
import {
  aspectForComicFormat,
  coerceComicPageFormat,
  comicFormatLabelKey,
  comicFormatLockKey,
  effectiveComicPageFormat,
  imageSizeForComicFormat,
  videoAspectForComicFormat
} from './comicPageFormat'

const layout = { sizeClass: 'wide' as const }

describe('comicPageFormat', () => {
  it('coerces and prefers page then book then template', () => {
    expect(coerceComicPageFormat('nope')).toBeNull()
    expect(coerceComicPageFormat('tall')).toBe('tall')
    expect(
      effectiveComicPageFormat({
        pageFormat: 'square',
        bookFormat: 'tall',
        layout
      })
    ).toBe('square')
    expect(
      effectiveComicPageFormat({
        pageFormat: null,
        bookFormat: 'tall',
        layout
      })
    ).toBe('tall')
    expect(
      effectiveComicPageFormat({
        pageFormat: null,
        bookFormat: null,
        layout
      })
    ).toBe('wide')
    expect(
      effectiveComicPageFormat({
        pageFormat: null,
        bookFormat: null,
        layout: { sizeClass: 'tall' }
      })
    ).toBe('tall')
  })

  it('maps format to still and video aspect', () => {
    expect(aspectForComicFormat('tall')).toBe('9:16')
    expect(aspectForComicFormat('square')).toBe('1:1')
    expect(aspectForComicFormat('wide')).toBe('16:9')
    expect(videoAspectForComicFormat('tall')).toBe('9:16')
    expect(videoAspectForComicFormat('square')).toBe('9:16')
    expect(videoAspectForComicFormat('wide')).toBe('16:9')
    expect(
      imageSizeForComicFormat('tall', {
        tall: 'T',
        square: 'S',
        wide: 'W'
      })
    ).toBe('T')
    expect(
      imageSizeForComicFormat('wide', {
        tall: 'T',
        square: 'S',
        wide: 'W'
      })
    ).toBe('W')
    expect(comicFormatLabelKey('tall')).toBe('formatTall')
    expect(comicFormatLabelKey('square')).toBe('formatSquare')
    expect(comicFormatLabelKey('wide')).toBe('formatWide')
    expect(comicFormatLockKey('tall')).toBe('comic.formatLockTall')
    expect(comicFormatLockKey('square')).toBe('comic.formatLockSquare')
    expect(comicFormatLockKey('wide')).toBe('comic.formatLockWide')
  })
})
