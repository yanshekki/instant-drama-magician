/**
 * Prop reference plates for short-drama continuity.
 */
import { artStylePrompt, getArtStyle } from './characterArtStyles'
import { PromptCatalog } from '../prompts'
import type { PromptCopyKey } from '../prompts/copy/keys'
import { appendHardRules } from './promptHardRules'

export type PropPlateVariantId =
  | 'hero'
  | 'three_quarter'
  | 'detail'
  | 'material'
  | 'in_hand_scale'

export interface PropPlateVariantDef {
  id: PropPlateVariantId
  labelKey: string
  galleryLabel: string
  sizeClass: 'wide' | 'square' | 'tall'
  layout: string
}

export const PROP_PLATE_VARIANTS: PropPlateVariantDef[] = [
  {
    id: 'hero',
    labelKey: 'propPlateHero',
    galleryLabel: 'Prop hero',
    sizeClass: 'square',
    layout:
      'Square 1:1 single hero product still of the prop, centered, clean seamless gray cyclorama, sharp materials, no people faces, full object visible.'
  },
  {
    id: 'three_quarter',
    labelKey: 'propPlateThreeQuarter',
    galleryLabel: 'Prop ¾',
    sizeClass: 'square',
    layout:
      'Square 1:1 three-quarter view of the SAME prop, studio light, readable silhouette, no hands unless needed for scale.'
  },
  {
    id: 'detail',
    labelKey: 'propPlateDetail',
    galleryLabel: 'Prop detail',
    sizeClass: 'square',
    layout:
      'Square 1:1 extreme close-up of the prop signature detail (engrave, clasp, screen, wear). No faces.'
  },
  {
    id: 'material',
    labelKey: 'propPlateMaterial',
    galleryLabel: 'Prop material',
    sizeClass: 'square',
    layout:
      'Square 1:1 material fidelity plate of the prop surface: metal/wood/fabric texture, no full body people.'
  },
  {
    id: 'in_hand_scale',
    labelKey: 'propPlateScale',
    galleryLabel: 'Prop scale',
    sizeClass: 'wide',
    layout:
      'Wide 16:9 scale reference: anonymous hand OR silhouette holding the prop for size. Face out of frame or fully anonymous. Prop is the hero.'
  }
]

export const DEFAULT_PROP_PLATE: PropPlateVariantId = 'hero'
const BY_ID = new Map(PROP_PLATE_VARIANTS.map((v) => [v.id, v]))

export function getPropPlateVariant(
  id?: string | null
): PropPlateVariantDef {
  if (id && BY_ID.has(id as PropPlateVariantId)) {
    return BY_ID.get(id as PropPlateVariantId)!
  }
  return BY_ID.get(DEFAULT_PROP_PLATE)!
}

export function propPlateLayoutPrompt(
  id: PropPlateVariantId | string,
  locale?: string | null
): string {
  const def = getPropPlateVariant(id)
  return PromptCatalog.t(locale, `plate.prop.layout.${def.id}` as PromptCopyKey)
}

export function buildPropPlateImagePrompt(
  profile: {
    name: string
    description: string
    material?: string
    sizeNotes?: string
    condition?: string
    visualTags?: string
    hardRules?: string
  },
  variant: string = 'hero',
  artStyle: string = 'photo_cinematic',
  locale: string = 'zh-HK'
): string {
  const style = getArtStyle(artStyle)
  const def = getPropPlateVariant(variant)
  const body = [
    artStylePrompt(style.id, locale),
    PromptCatalog.t(locale, 'plate.prop.scaffold.repeatMedium', {
      id: style.id
    }),
    PromptCatalog.t(locale, 'plate.prop.lock.lead'),
    PromptCatalog.t(locale, 'plate.prop.lock.name', { name: profile.name }),
    PromptCatalog.t(locale, 'plate.prop.lock.desc', { desc: profile.description }),
    profile.material
      ? PromptCatalog.t(locale, 'plate.prop.lock.material', {
          material: profile.material
        })
      : '',
    profile.sizeNotes
      ? PromptCatalog.t(locale, 'plate.prop.lock.size', {
          size: profile.sizeNotes
        })
      : '',
    profile.condition
      ? PromptCatalog.t(locale, 'plate.prop.lock.condition', {
          condition: profile.condition
        })
      : '',
    profile.visualTags
      ? PromptCatalog.t(locale, 'plate.prop.lock.tags', {
          tags: profile.visualTags
        })
      : '',
    PromptCatalog.t(locale, 'plate.prop.lock.forbidden'),
    PromptCatalog.t(locale, 'sheet.scaffold.layoutLead', {
      layout: propPlateLayoutPrompt(def.id, locale)
    }),
    PromptCatalog.t(locale, 'plate.prop.scaffold.finalCheck', {
      style: style.id
    })
  ]
    .filter(Boolean)
    .join(' ')
  return appendHardRules(body, profile.hardRules)
}

export function buildPropPlateEditPrompt(
  profile: {
    name: string
    description: string
    material?: string
    sizeNotes?: string
    condition?: string
    visualTags?: string
    hardRules?: string
  },
  variant: string = 'hero',
  artStyle: string = 'photo_cinematic',
  locale: string = 'zh-HK'
): string {
  const style = getArtStyle(artStyle)
  const body = buildPropPlateImagePrompt(profile, variant, artStyle, locale)
  return [
    PromptCatalog.t(locale, 'plate.prop.edit.task'),
    artStylePrompt(style.id, locale),
    PromptCatalog.t(locale, 'plate.prop.edit.keep'),
    PromptCatalog.t(locale, 'plate.prop.edit.change'),
    body
  ].join(' ')
}
