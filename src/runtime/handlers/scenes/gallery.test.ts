import { describe, expect, it, vi } from 'vitest'
import {
  makeHandlerContext,
  invokeRegistered
} from '../../../test/handlerTestUtils'
import { registerScenesGallery } from './gallery'

describe('registerScenesGallery', () => {
  it('registers expected channels', () => {
    const ctx = makeHandlerContext()
    registerScenesGallery(ctx)
    const handlers = (ctx as { handlers: Map<string, unknown> }).handlers
    expect(handlers.has('scenes:copyGalleryFrom')).toBe(true)
  })

  it('copies gallery from source scene', async () => {
    const gallery = [
      {
        id: 'g1',
        path: '/src.png',
        kind: 'sheet',
        label: 'Establishing',
        createdAt: '2020-01-01'
      }
    ]
    const source = {
      id: 'src',
      title: 'Pier',
      locationKey: 'pier',
      refImagePath: '/src.png',
      refGalleryJson: JSON.stringify(gallery)
    }
    const target = {
      id: 'tgt',
      title: 'Copy',
      locationKey: null,
      refImagePath: null,
      refGalleryJson: null
    }
    const update = vi.fn(async (id: string, data: unknown) => ({
      ...target,
      id,
      ...(data as object)
    }))
    const append = vi.fn()
    const ctx = makeHandlerContext({
      scenes: () =>
        ({
          get: vi.fn(async (id: string) =>
            id === 'src' ? source : target
          ),
          update
        }) as never,
      activity: {
        append,
        readRecent: vi.fn(),
        query: vi.fn(),
        clear: vi.fn(),
        kinds: vi.fn(),
        path: '/l'
      } as never
    })
    registerScenesGallery(ctx)
    const h = (ctx as { handlers: Map<string, unknown> }).handlers
    const r = (await invokeRegistered(h as never, 'scenes:copyGalleryFrom', {
      targetSceneId: 'tgt',
      sourceSceneId: 'src'
    })) as { gallery: unknown[]; scene: { refGalleryJson: string } }
    expect(r.gallery).toHaveLength(1)
    expect(update).toHaveBeenCalledWith(
      'tgt',
      expect.objectContaining({
        locationKey: 'pier'
      })
    )
    expect(append).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'copyGalleryFrom' })
    )
  })

  it('throws when source has no gallery', async () => {
    const ctx = makeHandlerContext({
      scenes: () =>
        ({
          get: vi.fn(async () => ({
            id: 's',
            refGalleryJson: null,
            refImagePath: null
          })),
          update: vi.fn()
        }) as never
    })
    registerScenesGallery(ctx)
    const h = (ctx as { handlers: Map<string, unknown> }).handlers
    await expect(
      invokeRegistered(h as never, 'scenes:copyGalleryFrom', {
        targetSceneId: 'a',
        sourceSceneId: 'b'
      })
    ).rejects.toMatchObject({ message: 'errors.sourceSceneNoGallery' })
  })
})
