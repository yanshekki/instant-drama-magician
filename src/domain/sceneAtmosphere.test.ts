import { describe, expect, it } from 'vitest'
import {
  buildAtmosphereSwapPrompt,
  pickBestSceneBaseImage
} from './sceneAtmosphere'
import type { SceneGalleryItem } from './sceneGallery'

describe('sceneAtmosphere', () => {
  it('picks hero before any', () => {
    const g: SceneGalleryItem[] = [
      {
        id: '1',
        path: '/a.png',
        kind: 'sheet',
        label: 'Detail',
        createdAt: '1',
        layer: 'detail'
      },
      {
        id: '2',
        path: '/h.png',
        kind: 'sheet',
        label: 'Hero plate',
        createdAt: '2',
        layer: 'hero'
      }
    ]
    expect(pickBestSceneBaseImage(g).item?.path).toBe('/h.png')
  })

  it('builds atmosphere swap prompt', () => {
    const p = buildAtmosphereSwapPrompt({
      description: 'alley',
      atmosphereDescription: 'heavy rain night neon',
      artStyle: 'anime_modern'
    })
    expect(p).toMatch(/ATMOSPHERE SWAP/i)
    expect(p).toMatch(/heavy rain/i)
    expect(p).toMatch(/LOCATION IDENTITY/i)
  })
})
