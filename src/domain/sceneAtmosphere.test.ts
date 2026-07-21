import { describe, expect, it } from 'vitest'
import { AppError } from '../types/errors'
import {
  ATMOSPHERE_POSES,
  atmosphereGalleryLabel,
  buildAtmosphereSwapPrompt,
  getAtmospherePose,
  pickBestSceneBaseImage
} from './sceneAtmosphere'
import type { SceneGalleryItem } from './sceneGallery'

describe('sceneAtmosphere', () => {
  it('lists poses and getAtmospherePose fallback', () => {
    expect(ATMOSPHERE_POSES.length).toBeGreaterThanOrEqual(3)
    expect(getAtmospherePose('detail').id).toBe('detail')
    expect(getAtmospherePose(null).id).toBe('wide')
    expect(getAtmospherePose('nope').id).toBe('wide')
  })

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
    expect(pickBestSceneBaseImage(g).reason).toBe('hero')
  })

  it('pickBestSceneBaseImage preferred / empty / any', () => {
    expect(pickBestSceneBaseImage([]).reason).toBe('none')
    const g: SceneGalleryItem[] = [
      {
        id: '1',
        path: '/a.png',
        kind: 'sheet',
        label: 'Custom',
        createdAt: '1'
      },
      {
        id: '2',
        path: '/e.png',
        kind: 'sheet',
        label: 'Establishing wide',
        createdAt: '2'
      }
    ]
    expect(pickBestSceneBaseImage(g, '/a.png').reason).toBe('manual')
    expect(pickBestSceneBaseImage(g).reason).toMatch(/establish|any|hero/)
  })

  it('builds atmosphere swap prompt', () => {
    const p = buildAtmosphereSwapPrompt({
      title: 'Alley',
      description: 'alley',
      atmosphereDescription: 'heavy rain night neon',
      artStyle: 'anime_modern',
      pose: 'detail',
      setDressing: 'puddles',
      visualTags: 'wet',
      hardRules: 'NO logo'
    })
    expect(p).toMatch(/ATMOSPHERE SWAP/i)
    expect(p).toMatch(/heavy rain/i)
    expect(p).toMatch(/LOCATION IDENTITY/i)
    expect(p).toContain('Alley')
    expect(p).toMatch(/NO logo|logo/)
  })

  it('throws when atmosphere empty', () => {
    expect(() =>
      buildAtmosphereSwapPrompt({
        description: 'x',
        atmosphereDescription: '  '
      })
    ).toThrow(AppError)
  })

  it('atmosphereGalleryLabel truncates', () => {
    expect(atmosphereGalleryLabel('  rain  ')).toBe('Atmosphere · rain')
    expect(atmosphereGalleryLabel('')).toBe('Atmosphere swap')
    expect(atmosphereGalleryLabel('x'.repeat(100)).length).toBeLessThan(60)
  })
})
