/**
 * Atmosphere swap: keep location geometry, replace time/weather/lighting.
 */
import type { SceneGalleryItem } from './sceneGallery'
import { inferSceneGalleryLayer } from './sceneGallery'
import { getArtStyle } from './characterArtStyles'
import { appendHardRules } from './promptHardRules'

export type AtmospherePose = 'wide' | 'hero' | 'detail'

export const ATMOSPHERE_POSES: {
  id: AtmospherePose
  labelKey: string
  layout: string
}[] = [
  {
    id: 'wide',
    labelKey: 'atmoPoseWide',
    layout:
      'Wide 16:9 full location frame matching source composition as closely as possible.'
  },
  {
    id: 'hero',
    labelKey: 'atmoPoseHero',
    layout:
      'Wide 16:9 hero location still, same architecture, updated atmosphere only.'
  },
  {
    id: 'detail',
    labelKey: 'atmoPoseDetail',
    layout:
      'Square 1:1 atmospheric detail of wet surfaces / practical lights / sky, still recognizable as the same set.'
  }
]

export function getAtmospherePose(
  id?: string | null
): (typeof ATMOSPHERE_POSES)[number] {
  return ATMOSPHERE_POSES.find((p) => p.id === id) ?? ATMOSPHERE_POSES[0]
}

export function pickBestSceneBaseImage(
  gallery: SceneGalleryItem[],
  preferredPath?: string | null
): { item: SceneGalleryItem | null; reason: string } {
  if (gallery.length === 0) return { item: null, reason: 'none' }
  if (preferredPath) {
    const pref = gallery.find((g) => g.path === preferredPath)
    if (pref) return { item: pref, reason: 'manual' }
  }
  const withL = gallery.map((item) => ({
    item,
    layer: item.layer ?? inferSceneGalleryLayer(item)
  }))
  for (const layer of ['hero', 'establishing', 'identity', 'interior'] as const) {
    const hit = withL.find((x) => x.layer === layer)
    if (hit) return { item: hit.item, reason: layer }
  }
  return { item: gallery[0], reason: 'any' }
}

export function buildAtmosphereSwapPrompt(input: {
  title?: string
  description: string
  atmosphereDescription: string
  artStyle?: string | null
  pose?: AtmospherePose | string | null
  setDressing?: string | null
  visualTags?: string | null
  hardRules?: string | null
}): string {
  const style = getArtStyle(input.artStyle ?? undefined)
  const pose = getAtmospherePose(input.pose)
  const atmo = input.atmosphereDescription.trim()
  if (!atmo) throw new Error('errors.atmosphereRequired')

  const body = [
    'IMAGE EDIT / ATMOSPHERE SWAP TASK (highest priority):',
    style.promptBlock,
    `Repeat: medium MUST be style id "${style.id}" (${style.family}).`,
    'Keep LOCATION IDENTITY from the source: building massing, walls, floor plan cues, signage, furniture layout, camera angle.',
    'REPLACE completely: time of day, weather, sky, practical lighting color, wetness, fog, neon intensity as described.',
    `NEW ATMOSPHERE (must match exactly): ${atmo}`,
    'FORBIDDEN: changing architecture into a different place, adding hero faces, watermarks, text captions.',
    input.title ? `Location: ${input.title}` : '',
    `Base place: ${input.description}`,
    input.setDressing ? `Set dressing lock: ${input.setDressing}` : '',
    input.visualTags ? `Tags: ${input.visualTags}` : '',
    `LAYOUT: ${pose.layout}`,
    `Final checklist: same place geometry; only atmosphere changed; medium ${style.id}; no hero faces.`
  ]
    .filter(Boolean)
    .join(' ')
  return appendHardRules(body, input.hardRules)
}

export function atmosphereGalleryLabel(description: string): string {
  const short = description.trim().slice(0, 40).replace(/\s+/g, ' ')
  return short ? `Atmosphere · ${short}` : 'Atmosphere swap'
}
