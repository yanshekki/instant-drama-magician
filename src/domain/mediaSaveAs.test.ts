import { describe, expect, it } from 'vitest'
import {
  buildMediaDownloadResult,
  isImagePath,
  isVideoPath,
  mediaExt,
  mediaSaveAsKind,
  saveAsDialogFilters
} from './mediaSaveAs'

describe('mediaSaveAs', () => {
  it('classifies image and video paths', () => {
    expect(isImagePath('/a/b/c.png')).toBe(true)
    expect(isImagePath('/a/b/c.AVIF')).toBe(true)
    expect(isVideoPath('/a/b/c.mp4')).toBe(true)
    expect(isVideoPath('/a/b/c.mkv')).toBe(true)
    expect(mediaSaveAsKind('/x/y.webp')).toBe('image')
    expect(mediaSaveAsKind('/x/y.webm')).toBe('video')
    expect(mediaSaveAsKind('/x/y.bin')).toBe('file')
    expect(mediaExt('/x/y.PNG')).toBe('png')
    expect(mediaExt('/x/noext')).toBe('bin')
  })

  it('builds download URL for web/headless', () => {
    const r = buildMediaDownloadResult('/data/media/char/still.png')
    expect(r.fileName).toBe('still.png')
    expect(r.kind).toBe('image')
    expect(r.downloadUrl).toContain('/api/download?p=')
    expect(r.downloadUrl).toContain(encodeURIComponent('/data/media/char/still.png'))
  })

  it('dialog filters cover image, video, and generic files', () => {
    const vid = saveAsDialogFilters('intro.mp4')
    expect(vid[0]?.name).toBe('Videos')
    expect(vid[0]?.extensions).toContain('mp4')

    const img = saveAsDialogFilters('still.jpeg')
    expect(img[0]?.name).toBe('Images')
    expect(img[0]?.extensions).toContain('jpeg')

    const other = saveAsDialogFilters('notes.txt')
    expect(other[0]?.name).toBe('Media')
    expect(other[0]?.extensions).toContain('txt')
    expect(other[1]?.extensions).toContain('*')
  })
})
