/**
 * Prop reference plates for short-drama continuity.
 */
import { getArtStyle } from './characterArtStyles'

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

export function buildPropPlateImagePrompt(
  profile: {
    name: string
    description: string
    material?: string
    sizeNotes?: string
    condition?: string
    visualTags?: string
  },
  variant: string = 'hero',
  artStyle: string = 'photo_cinematic'
): string {
  const style = getArtStyle(artStyle)
  const def = getPropPlateVariant(variant)
  return [
    style.promptBlock,
    `Repeat: medium MUST be style id "${style.id}".`,
    'Create a PROP reference still for AI short-drama continuity.',
    `Prop name: ${profile.name}`,
    `Description (must match): ${profile.description}`,
    profile.material ? `Material: ${profile.material}` : '',
    profile.sizeNotes ? `Size notes: ${profile.sizeNotes}` : '',
    profile.condition ? `Condition/wear: ${profile.condition}` : '',
    profile.visualTags ? `Tags: ${profile.visualTags}` : '',
    'FORBIDDEN: celebrity faces, watermarks, extra unrelated props cluttering identity.',
    `LAYOUT: ${def.layout}`,
    `Final check: same prop identity; medium ${style.id}.`
  ]
    .filter(Boolean)
    .join(' ')
}

export function buildPropPlateEditPrompt(
  profile: {
    name: string
    description: string
    material?: string
    sizeNotes?: string
    condition?: string
    visualTags?: string
  },
  variant: string = 'hero',
  artStyle: string = 'photo_cinematic'
): string {
  const style = getArtStyle(artStyle)
  const body = buildPropPlateImagePrompt(profile, variant, artStyle)
  return [
    'IMAGE EDIT / PROP RESTYLE:',
    style.promptBlock,
    'Keep the SAME prop identity from the source image (silhouette, materials, markings).',
    'Change medium/camera as required. Do not invent a different object.',
    body
  ].join(' ')
}
