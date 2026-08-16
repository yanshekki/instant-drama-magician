import { describe, expect, it, vi } from 'vitest'
import {
  invokeRegistered,
  makeHandlerContext
} from '../../test/handlerTestUtils'
import { registerKeyArtHandlers } from './keyArt'

describe('registerKeyArtHandlers', () => {
  it('covers book/shot CRUD, versions, and cover', async () => {
    const svc = {
      getWithShots: vi.fn(async () => ({
        book: { id: 'k1', storyId: 's1' },
        shots: []
      })),
      addShot: vi.fn(async () => ({ id: 'sh1', shotType: 'cover' })),
      updateBook: vi.fn(async () => ({ id: 'k1', pageFormat: 'tall' })),
      updateShot: vi.fn(async () => ({ id: 'sh1', brief: 'x' })),
      deleteShot: vi.fn(async () => ({
        ok: true,
        id: 'sh1',
        imagePath: '/a.png',
        imageGalleryJson: JSON.stringify([
          { id: 'v1', path: '/a.png', method: 'fresh', createdAt: 't' }
        ])
      })),
      deleteShotImage: vi.fn(async () => ({
        ok: true,
        removedPath: '/b.png',
        imagePath: '/a.png',
        images: []
      })),
      setShotImagePrimary: vi.fn(async () => ({
        ok: true,
        imagePath: '/a.png'
      })),
      setAsStoryCover: vi.fn(async () => ({
        ok: true,
        storyId: 's1',
        coverPath: '/a.png'
      }))
    }
    const deleteIfExists = vi.fn()
    const ctx = makeHandlerContext({
      keyArt: () => svc as never,
      generation: () =>
        ({
          getMediaStore: () => ({ deleteIfExists })
        }) as never
    })
    registerKeyArtHandlers(ctx)
    const h = (ctx as { handlers: Map<string, unknown> }).handlers
    await expect(invokeRegistered(h as never, 'keyArt:get', '')).rejects.toMatchObject(
      { message: 'errors.storyIdRequired' }
    )
    const pack = await invokeRegistered(h as never, 'keyArt:get', 's1')
    expect((pack as { book: { id: string } }).book.id).toBe('k1')
    await invokeRegistered(h as never, 'keyArt:update', 's1', { pageFormat: 'tall' })
    const shot = await invokeRegistered(h as never, 'keyArt:addShot', 's1', {
      shotType: 'headshot'
    })
    expect((shot as { id: string }).id).toBe('sh1')
    await expect(
      invokeRegistered(h as never, 'keyArt:updateShot', '', {})
    ).rejects.toMatchObject({ message: 'errors.keyArtShotIdRequired' })
    await invokeRegistered(h as never, 'keyArt:updateShot', 'sh1', {
      brief: 'look'
    })
    await expect(
      invokeRegistered(h as never, 'keyArt:deleteShot', '')
    ).rejects.toMatchObject({ message: 'errors.keyArtShotIdRequired' })
    await invokeRegistered(h as never, 'keyArt:deleteShot', 'sh1')
    expect(deleteIfExists).toHaveBeenCalled()
    deleteIfExists.mockImplementation(() => {
      throw new Error('busy')
    })
    await invokeRegistered(h as never, 'keyArt:deleteShot', 'sh1')
    await invokeRegistered(h as never, 'keyArt:deleteShotImage', 'sh1', 'v1')
    await expect(
      invokeRegistered(h as never, 'keyArt:deleteShotImage', '', 'v1')
    ).rejects.toMatchObject({ message: 'errors.keyArtShotIdRequired' })
    await expect(
      invokeRegistered(h as never, 'keyArt:deleteShotImage', 'sh1', '')
    ).rejects.toMatchObject({ message: 'errors.keyArtImageNotFound' })
    await invokeRegistered(h as never, 'keyArt:deleteShotImage', 'sh1', 'v1')
    await expect(
      invokeRegistered(h as never, 'keyArt:setShotImagePrimary', '', 'v1')
    ).rejects.toMatchObject({ message: 'errors.keyArtShotIdRequired' })
    await expect(
      invokeRegistered(h as never, 'keyArt:setShotImagePrimary', 'sh1', '')
    ).rejects.toMatchObject({ message: 'errors.keyArtImageNotFound' })
    await invokeRegistered(h as never, 'keyArt:setShotImagePrimary', 'sh1', 'v1')
    await expect(
      invokeRegistered(h as never, 'keyArt:setAsStoryCover', '')
    ).rejects.toMatchObject({ message: 'errors.keyArtShotIdRequired' })
    const cover = await invokeRegistered(h as never, 'keyArt:setAsStoryCover', 'sh1')
    expect((cover as { coverPath: string }).coverPath).toBe('/a.png')
    expect(svc.updateBook).toHaveBeenCalled()
    expect(svc.addShot).toHaveBeenCalled()
  })
})
