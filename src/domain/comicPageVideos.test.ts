import { describe, expect, it } from 'vitest'
import {
  newComicPageVideoId,
  parseComicPageVideos,
  pickComicPagePrimary,
  prependComicPageVideo,
  serializeComicPageVideos
} from './comicPageVideos'

describe('comicPageVideos', () => {
  it('parses gallery and synthesizes a legacy videoPath', () => {
    expect(parseComicPageVideos(null)).toEqual([])
    expect(parseComicPageVideos('not-json', { videoPath: '  ' })).toEqual([])
    const legacy = parseComicPageVideos(null, { videoPath: '/old.mp4' })
    expect(legacy).toHaveLength(1)
    expect(legacy[0]).toMatchObject({
      id: 'legacy_primary',
      path: '/old.mp4',
      scheme: 'page'
    })
    const mixed = parseComicPageVideos(
      JSON.stringify([
        {
          id: 'v2',
          path: '/new.mp4',
          scheme: 'drama',
          createdAt: '2026-01-02T00:00:00.000Z',
          label: 'take 2'
        },
        { path: '/old.mp4', scheme: 'page' },
        { path: '' },
        null
      ]),
      { videoPath: '/old.mp4' }
    )
    expect(mixed.map((v) => v.path)).toEqual(['/new.mp4', '/old.mp4'])
    expect(mixed[0]!.scheme).toBe('drama')
    expect(mixed[0]!.label).toBe('take 2')
  })

  it('prepends without replacing older paths and picks primary', () => {
    const a = parseComicPageVideos(null, { videoPath: '/a.mp4' })
    const next = prependComicPageVideo(a, {
      id: 'v2',
      path: '/b.mp4',
      scheme: 'drama',
      createdAt: '2026-01-03T00:00:00.000Z'
    })
    expect(next.map((v) => v.path)).toEqual(['/b.mp4', '/a.mp4'])
    expect(a[0]!.path).toBe('/a.mp4')
    expect(pickComicPagePrimary(next, '/a.mp4')).toBe('/a.mp4')
    expect(pickComicPagePrimary(next, '/gone.mp4')).toBe('/b.mp4')
    expect(pickComicPagePrimary([], '/a.mp4')).toBeNull()
    const json = serializeComicPageVideos(next)
    expect(parseComicPageVideos(json)).toHaveLength(2)
    expect(newComicPageVideoId()).toMatch(/^cv_/)
  })
})
