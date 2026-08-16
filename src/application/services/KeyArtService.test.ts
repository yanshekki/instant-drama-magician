import { describe, expect, it, vi } from 'vitest'
import {
  KeyArtService,
  ensureKeyArtSchema,
  resetKeyArtSchemaFlag
} from './KeyArtService'
import { createMockPrisma } from '../../test/mockPrisma'

describe('KeyArtService', () => {
  it('ensureKeyArtSchema creates tables when findFirst throws', async () => {
    resetKeyArtSchemaFlag()
    const prisma = createMockPrisma({
      story: { id: 's1', title: 'Drama' }
    })
    ;(prisma.keyArt.findFirst as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error('no such table: KeyArt')
    )
    prisma.$executeRawUnsafe = vi.fn().mockResolvedValue(0)
    await ensureKeyArtSchema(prisma as never)
    expect(prisma.$executeRawUnsafe).toHaveBeenCalled()
    await ensureKeyArtSchema(prisma as never)
    expect(prisma.$executeRawUnsafe).toHaveBeenCalledTimes(4)
  })

  it('getOrCreate requires story and recovers unique race', async () => {
    resetKeyArtSchemaFlag()
    const prisma = createMockPrisma({
      story: { id: 's1', title: 'Drama', artStyle: 'photo_cinematic' }
    })
    const svc = new KeyArtService(prisma as never)
    await expect(svc.getOrCreate('  ')).rejects.toMatchObject({
      code: 'VALIDATION'
    })
    ;(prisma.story.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      null
    )
    await expect(svc.getOrCreate('missing')).rejects.toMatchObject({
      code: 'NOT_FOUND'
    })
    ;(prisma.keyArt.upsert as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      id: 'k1',
      storyId: 's1'
    })
    expect((await svc.getOrCreate('s1')).id).toBe('k1')
    ;(prisma.keyArt.upsert as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error('Unique constraint failed')
    )
    ;(prisma.keyArt.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      id: 'k-exist',
      storyId: 's1'
    })
    expect((await svc.getOrCreate('s1')).id).toBe('k-exist')
  })

  it('addShot / update / versions / set cover', async () => {
    const prisma = createMockPrisma({
      story: { id: 's1', title: 'Drama' },
      keyArt: { id: 'k1', storyId: 's1', pageFormat: 'wide', artStyle: null }
    })
    ;(prisma.keyArt.upsert as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'k1',
      storyId: 's1',
      pageFormat: 'wide',
      artStyle: null
    })
    ;(prisma.keyArt.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'k1',
      storyId: 's1'
    })
    ;(prisma.keyArtShot.aggregate as ReturnType<typeof vi.fn>).mockResolvedValue({
      _max: { order: 0 }
    })
    ;(prisma.keyArtShot.create as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'sh1',
      shotType: 'headshot'
    })
    ;(prisma.keyArtShot.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'sh1',
      keyArtId: 'k1',
      shotType: 'cover',
      imagePath: '/a.png',
      imageGalleryJson: JSON.stringify([
        { id: 'v1', path: '/a.png', method: 'fresh', createdAt: 't' },
        { id: 'v2', path: '/b.png', method: 'edit', createdAt: 't2' }
      ])
    })
    ;(prisma.keyArtShot.update as ReturnType<typeof vi.fn>).mockImplementation(
      async ({ data }: { data: Record<string, unknown> }) => ({
        id: 'sh1',
        ...data
      })
    )
    ;(prisma.story.update as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 's1',
      coverPath: '/a.png'
    })
    const svc = new KeyArtService(prisma as never)
    const added = await svc.addShot('s1', { shotType: 'headshot' })
    expect(added.shotType).toBe('headshot')
    await svc.updateShot('sh1', {
      brief: '  look  ',
      characterIds: ['c1'],
      pageFormat: 'square'
    })
    const del = await svc.deleteShotImage('sh1', 'v2')
    expect(del.removedPath).toBe('/b.png')
    const pin = await svc.setShotImagePrimary('sh1', 'v1')
    expect(pin.imagePath).toBe('/a.png')
    const cover = await svc.setAsStoryCover('sh1')
    expect(cover.coverPath).toBe('/a.png')
    expect(svc.parseCharacterIds('["c1","c2"]')).toEqual(['c1', 'c2'])
    expect(svc.parseCharacterIds('nope')).toEqual([])
    await expect(svc.updateShot('  ', {})).rejects.toMatchObject({
      code: 'VALIDATION'
    })
    ;(prisma.keyArtShot.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      null
    )
    await expect(svc.getShot('missing')).rejects.toMatchObject({
      code: 'NOT_FOUND'
    })
    ;(prisma.keyArt.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      null
    )
    await expect(svc.getById('missing')).rejects.toMatchObject({
      code: 'NOT_FOUND'
    })
    ;(prisma.keyArtShot.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      {
        id: 'sh1',
        keyArtId: 'k1',
        imagePath: '/a.png',
        imageGalleryJson: null
      }
    )
    const gone = await svc.deleteShot('sh1')
    expect(gone.ok).toBe(true)
    ;(prisma.keyArtShot.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      { id: 'sh1', imagePath: null, keyArtId: 'k1' }
    )
    await expect(svc.setAsStoryCover('sh1')).rejects.toMatchObject({
      code: 'VALIDATION'
    })
    await expect(svc.deleteShotImage('sh1', 'nope')).rejects.toMatchObject({
      code: 'VALIDATION'
    })
    await expect(svc.deleteShotImage('', 'v1')).rejects.toMatchObject({
      code: 'VALIDATION'
    })
    await expect(svc.deleteShotImage('sh1', '')).rejects.toMatchObject({
      code: 'VALIDATION'
    })
    await expect(svc.setShotImagePrimary('', 'v1')).rejects.toMatchObject({
      code: 'VALIDATION'
    })
    await expect(svc.setShotImagePrimary('sh1', '')).rejects.toMatchObject({
      code: 'VALIDATION'
    })
    await expect(svc.setShotImagePrimary('sh1', 'nope')).rejects.toMatchObject({
      code: 'VALIDATION'
    })
  })

  it('updates book and every shot field', async () => {
    resetKeyArtSchemaFlag()
    const prisma = createMockPrisma({
      story: { id: 's1', title: 'Drama' },
      keyArt: { id: 'k1', storyId: 's1', pageFormat: 'wide', artStyle: 'anime' }
    })
    ;(prisma.keyArt.upsert as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'k1',
      storyId: 's1',
      pageFormat: 'wide',
      artStyle: 'anime'
    })
    ;(prisma.keyArt.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'k1',
      storyId: 's1'
    })
    ;(prisma.keyArt.update as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'k1',
      pageFormat: 'tall'
    })
    ;(prisma.keyArtShot.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(
      []
    )
    ;(prisma.keyArtShot.aggregate as ReturnType<typeof vi.fn>).mockResolvedValue({
      _max: { order: null }
    })
    ;(prisma.keyArtShot.create as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'sh0',
      shotType: 'cover',
      order: 0
    })
    ;(prisma.keyArtShot.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'sh1',
      keyArtId: 'k1',
      shotType: 'cover',
      characterIdsJson: '["old"]',
      imagePath: '/a.png',
      imageGalleryJson: null
    })
    ;(prisma.keyArtShot.update as ReturnType<typeof vi.fn>).mockImplementation(
      async ({ data }: { data: Record<string, unknown> }) => ({
        id: 'sh1',
        ...data
      })
    )
    const svc = new KeyArtService(prisma as never)
    const pack = await svc.getWithShots('s1')
    expect(pack.book.id).toBe('k1')
    await svc.updateBook('s1', {
      title: '  夜巴  ',
      artStyle: 'photo_cinematic',
      hardRules: '  no logo  ',
      pageFormat: 'tall'
    })
    const added = await svc.addShot('s1')
    expect(added.order).toBe(0)
    const row = await svc.updateShot('sh1', {
      shotType: 'promo',
      makeMethod: 'identity',
      pageFormat: 'square',
      artStyle: '  manhwa  ',
      brief: '  look  ',
      characterIds: null,
      characterIdsJson: '["c9"]',
      sceneId: '  sc1  ',
      timelineEntryId: '  e1  ',
      comicPageId: '  pg1  ',
      imagePath: '  /x.png  ',
      imageGalleryJson: '  []  ',
      mediaStatus: 'READY',
      mediaError: '  oops  ',
      seedPrompt: '  seed  ',
      hardRules: '  lock  ',
      order: 3
    })
    expect((row as { shotType: string }).shotType).toBe('promo')
    expect((row as { makeMethod: string }).makeMethod).toBe('identity')
    expect((row as { order: number }).order).toBe(3)
    await svc.updateShot('sh1', { characterIdsJson: '  ["z"]  ' })
    expect(svc.parseCharacterIds(null)).toEqual([])
    expect(svc.parseCharacterIds('{"a":1}')).toEqual([])
  })
})
