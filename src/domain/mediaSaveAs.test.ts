import { describe, expect, it } from 'vitest'
import {
  buildMediaDownloadResult,
  isImagePath,
  isVideoPath,
  mediaSaveAsKind,
  saveAsDialogFilters
} from './mediaSaveAs'

describe('mediaSaveAs', () => {
  it('classifies image and video paths', () => {
    expect(isImagePath('/a/b/c.png')).toBe(true)
    expect(isVideoPath('/a/b/c.mp4')).toBe(true)
    expect(mediaSaveAsKind('/x/y.webp')).toBe('image')
    expect(mediaSaveAsKind('/x/y.webm')).toBe('video')
    expect(mediaSaveAsKind('/x/y.bin')).toBe('file')
  })

  it('builds download URL for web/headless', () => {
    const r = buildMediaDownloadResult('/data/media/char/still.png')
    expect(r.fileName).toBe('still.png')
    expect(r.kind).toBe('image')
    expect(r.downloadUrl).toContain('/api/download?p=')
    expect(r.downloadUrl).toContain(encodeURIComponent('/data/media/char/still.png'))
  })

  it('dialog filters include video extensions', () => {
    const f = saveAsDialogFilters('intro.mp4')
    expect(f[0]?.name).toBe('Videos')
    expect(f[0]?.extensions).toContain('mp4')
  })
})
