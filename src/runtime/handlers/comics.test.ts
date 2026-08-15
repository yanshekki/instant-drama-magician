import { afterEach, describe, expect, it, vi } from 'vitest'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { makeHandlerContext, invokeRegistered } from '../../test/handlerTestUtils'
import { registerComicsHandlers } from './comics'

describe('registerComicsHandlers', () => {
  let dir: string | undefined
  afterEach(() => {
    if (dir) {
      rmSync(dir, { recursive: true, force: true })
      dir = undefined
    }
  })

  it('registers CRUD and paginate channels', async () => {
    const svc = {
      getWithPages: vi.fn(async () => ({ comic: { id: 'c1' }, pages: [] })),
      updateComic: vi.fn(async () => ({ id: 'c1', artStyle: 'manhwa' })),
      addPage: vi.fn(async () => ({ id: 'p1', panelLayout: 'grid-2x2' })),
      updatePage: vi.fn(async () => ({ id: 'p1', panelLayout: 'yonkoma' })),
      deletePage: vi.fn(async () => ({ ok: true, id: 'p1', imagePath: null })),
      deletePageVideo: vi.fn(async () => ({
        ok: true,
        removedPath: '/v.mp4',
        videoPath: null,
        videos: []
      })),
      setPageVideoPrimary: vi.fn(async () => ({
        ok: true,
        videoPath: '/v.mp4'
      })),
      autoPaginateFromTimeline: vi.fn(async () => ({
        pages: [{}],
        created: 1,
        layout: 'grid-2x2'
      })),
      getPage: vi.fn(),
      getById: vi.fn()
    }
    const ctx = makeHandlerContext({ comics: () => svc as never })
    registerComicsHandlers(ctx)
    const h = (ctx as { handlers?: Map<string, unknown> }).handlers!
    await expect(invokeRegistered(h as never, 'comics:get', '')).rejects.toMatchObject({
      code: 'VALIDATION'
    })
    await invokeRegistered(h as never, 'comics:get', 's1')
    await invokeRegistered(h as never, 'comics:update', 's1', { artStyle: 'manhwa' })
    await invokeRegistered(h as never, 'comics:addPage', 's1', {
      panelLayout: 'yonkoma'
    })
    await expect(
      invokeRegistered(h as never, 'comics:updatePage', '', {})
    ).rejects.toMatchObject({ code: 'VALIDATION' })
    await invokeRegistered(h as never, 'comics:updatePage', 'p1', {
      panelLayout: 'strip-2'
    })
    await invokeRegistered(h as never, 'comics:deletePage', 'p1')
    await invokeRegistered(h as never, 'comics:deletePageVideo', 'p1', 'v1')
    await invokeRegistered(h as never, 'comics:setPageVideoPrimary', 'p1', 'v1')
    await expect(
      invokeRegistered(h as never, 'comics:deletePageVideo', '', 'v1')
    ).rejects.toMatchObject({ code: 'VALIDATION' })
    await expect(
      invokeRegistered(h as never, 'comics:deletePageVideo', 'p1', '')
    ).rejects.toMatchObject({ code: 'VALIDATION' })
    await expect(
      invokeRegistered(h as never, 'comics:setPageVideoPrimary', '', 'v1')
    ).rejects.toMatchObject({ code: 'VALIDATION' })
    await expect(
      invokeRegistered(h as never, 'comics:setPageVideoPrimary', 'p1', '')
    ).rejects.toMatchObject({ code: 'VALIDATION' })
    await invokeRegistered(h as never, 'comics:autoPaginate', 's1', 'grid-2x2')
    await expect(
      invokeRegistered(h as never, 'comics:autoPaginate', '')
    ).rejects.toMatchObject({ code: 'VALIDATION' })
    expect(svc.getWithPages).toHaveBeenCalled()
    expect(svc.addPage).toHaveBeenCalled()
  })

  it('importToTimeline copies page onto bound beats', async () => {
    dir = mkdtempSync(join(tmpdir(), 'idm-comic-'))
    const src = join(dir, 'page.png')
    writeFileSync(src, 'png')
    const destDir = join(dir, 'clips')
    mkdirSync(destDir, { recursive: true })
    const dest = join(destDir, 'e1_continuity.png')
    const store = {
      ensureStoryDirs: vi.fn(),
      clipContinuityStillPath: vi.fn(() => dest),
      clearEntryStillUserCleared: vi.fn(),
      deleteIfExists: vi.fn()
    }
    const svc = {
      getPage: vi.fn(async () => ({
        id: 'p1',
        comicId: 'c1',
        panelLayout: 'strip-2',
        panelScriptJson: JSON.stringify([
          { caption: 'a', timelineEntryId: 'e1' },
          { caption: 'b', timelineEntryId: 'e1' }
        ]),
        imagePath: src
      })),
      getById: vi.fn(async () => ({ id: 'c1', storyId: 's1' })),
      deletePage: vi.fn(async () => ({ ok: true, id: 'p1', imagePath: src }))
    }
    const ctx = makeHandlerContext({
      comics: () => svc as never,
      generation: () =>
        ({
          getMediaStore: () => store
        }) as never
    })
    registerComicsHandlers(ctx)
    const h = (ctx as { handlers?: Map<string, unknown> }).handlers!
    const r = (await invokeRegistered(h as never, 'comics:importToTimeline', 'p1')) as {
      imported: number
      entryIds: string[]
    }
    expect(r.imported).toBe(1)
    expect(r.entryIds).toEqual(['e1'])
    expect(store.clearEntryStillUserCleared).toHaveBeenCalledWith('s1', 'e1')

    store.clipContinuityStillPath = vi.fn(() => dir!)
    const skipped = (await invokeRegistered(
      h as never,
      'comics:importToTimeline',
      'p1'
    )) as { imported: number }
    expect(skipped.imported).toBe(0)

    await expect(
      invokeRegistered(h as never, 'comics:importToTimeline', '')
    ).rejects.toMatchObject({ code: 'VALIDATION' })
    svc.getPage.mockResolvedValueOnce({
      id: 'p2',
      comicId: 'c1',
      panelLayout: 'splash-1',
      panelScriptJson: '[]',
      imagePath: null
    })
    await expect(
      invokeRegistered(h as never, 'comics:importToTimeline', 'p2')
    ).rejects.toMatchObject({ message: 'errors.comicsNeedImage' })

    store.deleteIfExists.mockImplementationOnce(() => {
      throw new Error('unlink')
    })
    await invokeRegistered(h as never, 'comics:deletePage', 'p1')
    expect(store.deleteIfExists).toHaveBeenCalledWith(src)
    store.deleteIfExists.mockReset()
    store.deleteIfExists.mockImplementation(() => undefined)
    await invokeRegistered(h as never, 'comics:deletePage', 'p1')
    await expect(
      invokeRegistered(h as never, 'comics:deletePage', '')
    ).rejects.toMatchObject({ code: 'VALIDATION' })
  })
})
