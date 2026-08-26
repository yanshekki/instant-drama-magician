/**
 * Atmosphere swap: keep location geometry, replace time/weather/lighting.
 */
import type { SceneGalleryItem } from './sceneGallery'
import { inferSceneGalleryLayer } from './sceneGallery'
import { artStylePrompt, getArtStyle } from './characterArtStyles'
import { appendHardRules } from './promptHardRules'
import { AppError } from '../types/errors'
import { PromptCatalog } from '../prompts'
import type { PromptCopyKey } from '../prompts/copy/keys'

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

export function atmosphereLayoutPrompt(
  id?: AtmospherePose | string | null,
  locale?: string | null
): string {
  const pose = getAtmospherePose(id)
  return PromptCatalog.t(
    locale,
    `swap.atmosphere.layout.${pose.id}` as PromptCopyKey
  )
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
  locale?: string | null
}): string {
  const locale = input.locale ?? 'zh-HK'
  const style = getArtStyle(input.artStyle ?? undefined)
  const pose = getAtmospherePose(input.pose)
  const atmo = input.atmosphereDescription.trim()
  if (!atmo) throw new AppError('VALIDATION', 'errors.atmosphereRequired')

  const body = [
    PromptCatalog.t(locale, 'swap.atmosphere.task'),
    artStylePrompt(style.id, locale),
    PromptCatalog.t(locale, 'swap.atmosphere.repeatMedium', {
      id: style.id,
      family: style.family
    }),
    PromptCatalog.t(locale, 'swap.atmosphere.keep'),
    PromptCatalog.t(locale, 'swap.atmosphere.replace'),
    PromptCatalog.t(locale, 'swap.atmosphere.new', { atmo }),
    PromptCatalog.t(locale, 'swap.atmosphere.forbidden'),
    input.title
      ? PromptCatalog.t(locale, 'swap.atmosphere.location', {
          title: input.title
        })
      : '',
    PromptCatalog.t(locale, 'swap.atmosphere.place', {
      place: input.description
    }),
    input.setDressing
      ? PromptCatalog.t(locale, 'swap.atmosphere.set', { set: input.setDressing })
      : '',
    input.visualTags
      ? PromptCatalog.t(locale, 'swap.atmosphere.tags', {
          tags: input.visualTags
        })
      : '',
    PromptCatalog.t(locale, 'sheet.scaffold.layoutLead', {
      layout: atmosphereLayoutPrompt(pose.id, locale)
    }),
    PromptCatalog.t(locale, 'swap.atmosphere.checklist', { style: style.id })
  ]
    .filter(Boolean)
    .join(' ')
  return appendHardRules(body, input.hardRules)
}

export function atmosphereGalleryLabel(description: string): string {
  const short = description.trim().slice(0, 40).replace(/\s+/g, ' ')
  return short ? `Atmosphere · ${short}` : 'Atmosphere swap'
}
