import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  buildIntroMediaGenRequest,
  introLocaleFromI18n,
  resolveVideoAspectRatio
} from './startIntroMediaGen'

const settingsGet = vi.fn(async () => ({ aspectRatio: '9:16' }))

vi.mock('../../lib/api', () => ({
  getApi: () => ({
    settings: { get: settingsGet }
  })
}))

describe('startIntroMediaGen', () => {
  beforeEach(() => {
    settingsGet.mockClear()
    settingsGet.mockResolvedValue({ aspectRatio: '9:16' })
  })

  it('introLocaleFromI18n falls back when empty', () => {
    expect(introLocaleFromI18n('ja')).toBe('ja')
    expect(introLocaleFromI18n('')).toBe('zh-HK')
  })

  it('resolveVideoAspectRatio reads settings', async () => {
    await expect(resolveVideoAspectRatio()).resolves.toBe('9:16')
    settingsGet.mockResolvedValue({ aspectRatio: 'bad' })
    await expect(resolveVideoAspectRatio()).resolves.toBe('16:9')
  })

  it('buildIntroMediaGenRequest skips still when source set', async () => {
    const r = await buildIntroMediaGenRequest({
      kind: 'character-intro',
      sourceImagePath: '/tmp/c.png',
      characterId: 'c1',
      artStyle: 'anime',
      durationSeconds: 8
    })
    expect(r.kind).toBe('character-intro')
    expect(r.characterId).toBe('c1')
    expect(r.galleryIdentityPaths).toEqual(['/tmp/c.png'])
    expect(r.sourceImagePath).toBe('/tmp/c.png')
    expect(r.skipStillIfExists).toBe(true)
    expect(r.preferIdentityEdit).toBe(true)
    expect(r.durationSeconds).toBe(8)
    expect(r.aspectRatio).toBe('9:16')
  })

  it('buildIntroMediaGenRequest without source does not skip for intros', async () => {
    const r = await buildIntroMediaGenRequest({
      kind: 'character-intro',
      sourceImagePath: '  ',
      characterId: 'c1',
      skipStillIfExists: true
    })
    expect(r.skipStillIfExists).toBe(false)
    expect(r.galleryIdentityPaths).toEqual([])
  })

  it('comic-intro includes pageId and source still', async () => {
    const r = await buildIntroMediaGenRequest({
      kind: 'comic-intro',
      sourceImagePath: '/tmp/page.png',
      storyId: 's1',
      pageId: 'pg1',
      skipStillIfExists: true
    })
    expect(r.kind).toBe('comic-intro')
    expect(r.pageId).toBe('pg1')
    expect(r.storyId).toBe('s1')
    expect(r.sourceImagePath).toBe('/tmp/page.png')
    expect(r.skipStillIfExists).toBe(true)
  })

  it('comic-intro can lock video aspect to the page format', async () => {
    const r = await buildIntroMediaGenRequest({
      kind: 'comic-intro',
      sourceImagePath: '/tmp/page.png',
      storyId: 's1',
      pageId: 'pg1',
      aspectRatio: '9:16'
    })
    expect(r.aspectRatio).toBe('9:16')
  })

  it('comic-intro forwards the video scheme', async () => {
    const r = await buildIntroMediaGenRequest({
      kind: 'comic-intro',
      sourceImagePath: '/tmp/page.png',
      storyId: 's1',
      pageId: 'pg1',
      comicVideoScheme: 'drama'
    })
    expect(r.comicVideoScheme).toBe('drama')
  })

  it('timeline-clip can skip still without client source path', async () => {
    const r = await buildIntroMediaGenRequest({
      kind: 'timeline-clip',
      sourceImagePath: '',
      storyId: 's1',
      entryId: 'e1',
      skipStillIfExists: true,
      userExtraPrompt: '  more neon  '
    })
    expect(r.skipStillIfExists).toBe(true)
    expect(r.userExtraPrompt).toBe('more neon')
  })
})
