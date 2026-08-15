import { describe, expect, it, vi } from 'vitest'
import {
  ComicService,
  ensureComicSchema,
  resetComicSchemaFlag
} from './ComicService'
import { createMockPrisma } from '../../test/mockPrisma'

describe('ComicService', () => {
  it('ensureComicSchema creates tables when findFirst throws', async () => {
    resetComicSchemaFlag()
    const prisma = createMockPrisma({
      story: { id: 's1', title: 'Drama' }
    })
    ;(prisma.comic.findFirst as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error('no such table: Comic')
    )
    prisma.$executeRawUnsafe = vi.fn().mockResolvedValue(0)
    await ensureComicSchema(prisma as never)
    expect(prisma.$executeRawUnsafe).toHaveBeenCalled()
    await ensureComicSchema(prisma as never)
    expect(prisma.$executeRawUnsafe).toHaveBeenCalledTimes(8)
  })

  it('getOrCreate requires storyId and creates when missing', async () => {
    resetComicSchemaFlag()
    const prisma = createMockPrisma({
      story: { id: 's1', title: 'Drama', artStyle: 'manhwa', hardRules: null }
    })
    const svc = new ComicService(prisma as never)
    await expect(svc.getOrCreate('  ')).rejects.toMatchObject({
      code: 'VALIDATION'
    })
    ;(prisma.story.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      null
    )
    await expect(svc.getOrCreate('missing')).rejects.toMatchObject({
      code: 'NOT_FOUND'
    })
    ;(prisma.comic.upsert as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      id: 'c1',
      storyId: 's1'
    })
    const created = await svc.getOrCreate('s1')
    expect(created.id).toBe('c1')
    expect(prisma.comic.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { storyId: 's1' },
        create: expect.objectContaining({
          storyId: 's1',
          title: 'Drama',
          artStyle: 'manhwa'
        })
      })
    )
  })

  it('getOrCreate returns existing book via upsert', async () => {
    const prisma = createMockPrisma({
      story: { id: 's1', title: 'Drama' }
    })
    ;(prisma.comic.upsert as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'c1',
      storyId: 's1'
    })
    const svc = new ComicService(prisma as never)
    const row = await svc.getOrCreate('s1')
    expect(row.id).toBe('c1')
    expect(prisma.comic.create).not.toHaveBeenCalled()
  })

  it('getOrCreate recovers when unique race hits', async () => {
    const prisma = createMockPrisma({
      story: { id: 's1', title: 'Drama' }
    })
    ;(prisma.comic.upsert as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error('Unique constraint failed on the fields: (`storyId`)')
    )
    ;(prisma.comic.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      id: 'c-existing',
      storyId: 's1'
    })
    const svc = new ComicService(prisma as never)
    expect((await svc.getOrCreate('s1')).id).toBe('c-existing')
  })

  it('getOrCreate rethrows when race recover finds nothing', async () => {
    const prisma = createMockPrisma({
      story: { id: 's1', title: 'Drama' }
    })
    ;(prisma.comic.upsert as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error('Unique constraint failed')
    )
    ;(prisma.comic.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      null
    )
    const svc = new ComicService(prisma as never)
    await expect(svc.getOrCreate('s1')).rejects.toThrow('Unique constraint failed')
  })

  it('getWithPages / getById / getPage / update / add / delete', async () => {
    const prisma = createMockPrisma({
      story: { id: 's1', title: 'Drama', artStyle: 'donghua', hardRules: 'hr' }
    })
    ;(prisma.comic.upsert as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'c1',
      storyId: 's1',
      artStyle: 'donghua'
    })
    ;(prisma.comic.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'c1',
      storyId: 's1',
      artStyle: 'donghua'
    })
    ;(prisma.comicPage.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: 'p1', order: 0 }
    ])
    ;(prisma.comicPage.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
      {
        id: 'p1',
        comicId: 'c1',
        panelLayout: 'grid-2x2',
        panelScriptJson: '[]',
        imagePath: '/x.png'
      }
    )
    ;(prisma.comicPage.aggregate as ReturnType<typeof vi.fn>).mockResolvedValue({
      _max: { order: 0 }
    })
    ;(prisma.comicPage.create as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'p2',
      panelLayout: 'yonkoma'
    })
    ;(prisma.comic.update as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'c1',
      hardRules: 'no watermark'
    })
    ;(prisma.comicPage.update as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'p1',
      panelLayout: 'strip-3'
    })
    const svc = new ComicService(prisma as never)
    const pack = await svc.getWithPages('s1')
    expect(pack.pages).toHaveLength(1)
    expect((await svc.getById('c1')).id).toBe('c1')
    ;(prisma.comic.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      null
    )
    await expect(svc.getById('nope')).rejects.toMatchObject({ code: 'NOT_FOUND' })
    expect((await svc.getPage('p1')).id).toBe('p1')
    ;(prisma.comicPage.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      null
    )
    await expect(svc.getPage('missing')).rejects.toMatchObject({
      code: 'NOT_FOUND'
    })
    ;(prisma.comicPage.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'p1',
      comicId: 'c1',
      panelLayout: 'grid-2x2',
      panelScriptJson: '[]',
      imagePath: '/x.png'
    })
    await svc.updateComic('s1', {
      title: '  Book  ',
      artStyle: '  manhwa  ',
      hardRules: '  no watermark  '
    })
    await svc.updateComic('s1', { title: 'Only title', pageFormat: 'wide' })
    expect(prisma.comic.update).toHaveBeenCalled()
    await svc.addPage('s1')
    await svc.addPage('s1', { panelLayout: 'yonkoma' })
    expect(prisma.comicPage.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          panelLayout: 'yonkoma',
          order: 1
        })
      })
    )
    await svc.updatePage('p1', {
      panelScriptJson: JSON.stringify([{ caption: 'ok' }]),
      refGalleryJson: '[]'
    })
    await svc.updatePage('p1', {
      panelScriptJson: '',
      refGalleryJson: null
    })
    await svc.updatePage('p1', {
      panelLayout: 'strip-3',
      panelScriptJson: '{not-json',
      artStyle: '  ',
      imagePath: '  ',
      mediaError: '  ',
      seedPrompt: '  ',
      hardRules: '  '
    })
    await svc.updatePage('p1', {
      panelLayout: 'strip-3',
      panelScript: [{ caption: 'hello' }],
      pageFormat: 'square',
      artStyle: 'comic_western',
      imagePath: '/y.png',
      mediaStatus: 'READY',
      mediaError: null,
      seedPrompt: 'prompt',
      hardRules: 'rule',
      order: 2
    })
    expect(prisma.comicPage.update).toHaveBeenCalled()
    const del = await svc.deletePage('p1')
    expect(del.ok).toBe(true)
    expect(del.imagePath).toBe('/x.png')
  })

  it('updatePage resizes slots when only layout changes', async () => {
    const prisma = createMockPrisma({
      story: { id: 's1', title: 'D' }
    })
    ;(prisma.comicPage.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'p1',
      panelLayout: 'grid-2x2',
      panelScriptJson: JSON.stringify([
        { caption: 'a' },
        { caption: 'b' },
        { caption: 'c' },
        { caption: 'd' }
      ])
    })
    const svc = new ComicService(prisma as never)
    await svc.updatePage('p1', { panelLayout: 'strip-2' })
    const data = (prisma.comicPage.update as ReturnType<typeof vi.fn>).mock
      .calls[0][0].data
    expect(JSON.parse(data.panelScriptJson)).toHaveLength(2)
  })

  it('autoPaginateFromTimeline chunks unbound beats', async () => {
    const prisma = createMockPrisma({
      story: { id: 's1', title: 'D', artStyle: 'manhwa' }
    })
    ;(prisma.comic.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'c1',
      storyId: 's1',
      artStyle: 'manhwa'
    })
    ;(prisma.timelineEntry.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(
      [
        { id: 'e1', dialogue: 'Hi', beatContentJson: null, sceneId: 'sc1', propId: null, actionId: null },
        { id: 'e2', dialogue: '', beatContentJson: JSON.stringify({ units: [{ type: 'action', text: 'run' }] }), sceneId: null, propId: null, actionId: null },
        { id: 'e3', dialogue: 'Bye', beatContentJson: null, sceneId: null, propId: null, actionId: null }
      ]
    )
    ;(prisma.comicPage.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        panelLayout: 'splash-1',
        panelScriptJson: JSON.stringify([{ timelineEntryId: 'e1', caption: 'Hi' }])
      }
    ])
    ;(prisma.comicPage.aggregate as ReturnType<typeof vi.fn>).mockResolvedValue({
      _max: { order: 0 }
    })
    ;(prisma.comicPage.create as ReturnType<typeof vi.fn>).mockImplementation(
      async ({ data }: { data: unknown }) => data
    )
    const svc = new ComicService(prisma as never)
    const r = await svc.autoPaginateFromTimeline('s1', 'strip-2')
    expect(r.created).toBe(1)
    expect(r.layout).toBe('strip-2')
    expect(prisma.comicPage.create).toHaveBeenCalledTimes(1)
  })

  it('autoPaginate errors when no timeline or all bound', async () => {
    const prisma = createMockPrisma({
      story: { id: 's1', title: 'D' }
    })
    ;(prisma.comic.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'c1',
      storyId: 's1'
    })
    const svc = new ComicService(prisma as never)
    await expect(svc.autoPaginateFromTimeline('  ')).rejects.toMatchObject({
      code: 'VALIDATION'
    })
    ;(prisma.timelineEntry.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(
      []
    )
    await expect(svc.autoPaginateFromTimeline('s1')).rejects.toMatchObject({
      message: 'errors.comicsNoTimeline'
    })
    ;(prisma.timelineEntry.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(
      [{ id: 'e1', dialogue: 'x' }]
    )
    ;(prisma.comicPage.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        panelLayout: 'splash-1',
        panelScriptJson: JSON.stringify([{ timelineEntryId: 'e1' }])
      }
    ])
    await expect(svc.autoPaginateFromTimeline('s1')).rejects.toMatchObject({
      message: 'errors.comicsNoUnboundBeats'
    })
  })

  it('deletes a page video and retargets the primary', async () => {
    const prisma = createMockPrisma({ story: { id: 's1', title: 'D' } })
    const page = {
      id: 'p1',
      comicId: 'c1',
      panelLayout: 'grid-2x2',
      panelScriptJson: '[]',
      videoPath: '/b.mp4',
      videoGalleryJson: JSON.stringify([
        {
          id: 'v2',
          path: '/b.mp4',
          scheme: 'drama',
          createdAt: '2026-01-02T00:00:00.000Z'
        },
        {
          id: 'v1',
          path: '/a.mp4',
          scheme: 'page',
          createdAt: '2026-01-01T00:00:00.000Z'
        }
      ])
    }
    ;(prisma.comicPage.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
      page
    )
    ;(prisma.comicPage.update as ReturnType<typeof vi.fn>).mockImplementation(
      async ({ data }: { data: Record<string, unknown> }) => ({
        ...page,
        ...data
      })
    )
    const svc = new ComicService(prisma as never)
    const del = await svc.deletePageVideo('p1', 'v2')
    expect(del.removedPath).toBe('/b.mp4')
    expect(del.videoPath).toBe('/a.mp4')
    expect(del.videos).toHaveLength(1)
    const pin = await svc.setPageVideoPrimary('p1', 'v1')
    expect(pin.videoPath).toBe('/a.mp4')
    await expect(svc.deletePageVideo('', 'v1')).rejects.toMatchObject({
      message: 'errors.comicPageIdRequired'
    })
    await expect(svc.deletePageVideo('p1', '')).rejects.toMatchObject({
      message: 'errors.comicVideoNotFound'
    })
    await expect(svc.deletePageVideo('p1', 'nope')).rejects.toMatchObject({
      message: 'errors.comicVideoNotFound'
    })
    await expect(svc.setPageVideoPrimary('p1', 'nope')).rejects.toMatchObject({
      message: 'errors.comicVideoNotFound'
    })
  })
})
