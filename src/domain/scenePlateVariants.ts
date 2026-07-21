/**
 * Professional location / scene plate layouts for Grok Imagine.
 * Empty-set friendly: lock architecture & lighting, avoid hero faces.
 */

import { getArtStyle } from './characterArtStyles'
import { appendHardRules } from './promptHardRules'

export type SceneSizeClass = 'wide' | 'square' | 'tall'

export type ScenePlateLayer =
  | 'identity'
  | 'hero'
  | 'establishing'
  | 'interior'
  | 'detail'
  | 'atmosphere'
  | 'time'

export type SceneGroupKey =
  | 'sceneGroupCore'
  | 'sceneGroupAngles'
  | 'sceneGroupAtmosphere'
  | 'sceneGroupDetail'

export type ScenePlateVariantId =
  | 'establishing'
  | 'hero_plate'
  | 'three_quarter_space'
  | 'identity_lock'
  | 'low_angle'
  | 'high_angle'
  | 'pov_enter'
  | 'over_shoulder_empty'
  | 'day_clear'
  | 'golden_hour'
  | 'night_neon'
  | 'rain_wet'
  | 'fog_mood'
  | 'set_dressing'
  | 'material_board'
  | 'signage_prop'
  | 'lighting_ref'

export interface ScenePlateVariantDef {
  id: ScenePlateVariantId
  labelKey: string
  galleryLabel: string
  sizeClass: SceneSizeClass
  groupKey: SceneGroupKey
  plateLayer: ScenePlateLayer
  layout: string
}

const EMPTY_SET =
  'EMPTY LOCATION PLATE for short-drama continuity: NO hero character faces, NO named actors, ' +
  'at most tiny distant silhouettes if needed for scale. Preserve architecture, materials, signage, key set dressing.'

export const SCENE_PLATE_VARIANTS: ScenePlateVariantDef[] = [
  {
    id: 'establishing',
    labelKey: 'plateEstablishing',
    galleryLabel: 'Establishing',
    sizeClass: 'wide',
    groupKey: 'sceneGroupCore',
    plateLayer: 'establishing',
    layout:
      EMPTY_SET +
      ' Wide 16:9 establishing shot of the FULL location exterior or master volume, readable landmarks, horizon or ceiling line stable, cinematic depth.'
  },
  {
    id: 'hero_plate',
    labelKey: 'plateHero',
    galleryLabel: 'Hero plate',
    sizeClass: 'wide',
    groupKey: 'sceneGroupCore',
    plateLayer: 'hero',
    layout:
      EMPTY_SET +
      ' Wide 16:9 HERO location still — the definitive cover frame of this set. Strong composition, clear stage floor or street for future blocking.'
  },
  {
    id: 'three_quarter_space',
    labelKey: 'plateThreeQuarter',
    galleryLabel: '¾ space',
    sizeClass: 'wide',
    groupKey: 'sceneGroupCore',
    plateLayer: 'interior',
    layout:
      EMPTY_SET +
      ' Wide 16:9 three-quarter space with foreground frame, midground performance zone, background depth. Ideal dialogue stage empty of faces.'
  },
  {
    id: 'identity_lock',
    labelKey: 'plateIdentityLock',
    galleryLabel: 'Identity lock',
    sizeClass: 'wide',
    groupKey: 'sceneGroupCore',
    plateLayer: 'identity',
    layout:
      EMPTY_SET +
      ' Wide 16:9 with EXACTLY TWO equal panels of the SAME location: (1) frontal key angle (2) ~45° three-quarter. Same materials, signage, palette.'
  },
  {
    id: 'low_angle',
    labelKey: 'plateLowAngle',
    galleryLabel: 'Low angle',
    sizeClass: 'tall',
    groupKey: 'sceneGroupAngles',
    plateLayer: 'establishing',
    layout:
      EMPTY_SET +
      ' Tall 9:16 low-angle looking up at architecture / ceiling / canopy for drama scale. No faces.'
  },
  {
    id: 'high_angle',
    labelKey: 'plateHighAngle',
    galleryLabel: 'High angle',
    sizeClass: 'wide',
    groupKey: 'sceneGroupAngles',
    plateLayer: 'establishing',
    layout:
      EMPTY_SET +
      ' Wide 16:9 high-angle layout of floor plan / street geometry for blocking reference. Empty of faces.'
  },
  {
    id: 'pov_enter',
    labelKey: 'platePovEnter',
    galleryLabel: 'Enter POV',
    sizeClass: 'wide',
    groupKey: 'sceneGroupAngles',
    plateLayer: 'interior',
    layout:
      EMPTY_SET +
      ' Wide 16:9 first-person enter POV through doorway or alley mouth into the location. Empty set beyond threshold.'
  },
  {
    id: 'over_shoulder_empty',
    labelKey: 'plateOtsEmpty',
    galleryLabel: 'OTS empty',
    sizeClass: 'wide',
    groupKey: 'sceneGroupAngles',
    plateLayer: 'interior',
    layout:
      EMPTY_SET +
      ' Wide 16:9 over-the-shoulder empty frame: soft anonymous shoulder silhouette only, sharp background of the LOCATION for dialogue blocking.'
  },
  {
    id: 'day_clear',
    labelKey: 'plateDayClear',
    galleryLabel: 'Day clear',
    sizeClass: 'wide',
    groupKey: 'sceneGroupAtmosphere',
    plateLayer: 'time',
    layout:
      EMPTY_SET +
      ' Wide 16:9 same location under clear daytime light, natural sun direction, readable shadows, dry surfaces.'
  },
  {
    id: 'golden_hour',
    labelKey: 'plateGoldenHour',
    galleryLabel: 'Golden hour',
    sizeClass: 'wide',
    groupKey: 'sceneGroupAtmosphere',
    plateLayer: 'atmosphere',
    layout:
      EMPTY_SET +
      ' Wide 16:9 same location at golden hour: warm long shadows, amber rim light, romantic short-drama mood, empty of faces.'
  },
  {
    id: 'night_neon',
    labelKey: 'plateNightNeon',
    galleryLabel: 'Night neon',
    sizeClass: 'wide',
    groupKey: 'sceneGroupAtmosphere',
    plateLayer: 'atmosphere',
    layout:
      EMPTY_SET +
      ' Wide 16:9 same location at night with practicals / neon / street lamps, cyan-magenta spill optional, wet optional, empty of faces.'
  },
  {
    id: 'rain_wet',
    labelKey: 'plateRainWet',
    galleryLabel: 'Rain wet',
    sizeClass: 'wide',
    groupKey: 'sceneGroupAtmosphere',
    plateLayer: 'atmosphere',
    layout:
      EMPTY_SET +
      ' Wide 16:9 same location in rain: wet asphalt/reflections, rain streaks, cooler grade, umbrellas only as distant props, no faces.'
  },
  {
    id: 'fog_mood',
    labelKey: 'plateFogMood',
    galleryLabel: 'Fog mood',
    sizeClass: 'wide',
    groupKey: 'sceneGroupAtmosphere',
    plateLayer: 'atmosphere',
    layout:
      EMPTY_SET +
      ' Wide 16:9 same location in fog/smoke: soft depth layers, muted palette, mystery mood, architecture still readable, no faces.'
  },
  {
    id: 'set_dressing',
    labelKey: 'plateSetDressing',
    galleryLabel: 'Set dressing',
    sizeClass: 'square',
    groupKey: 'sceneGroupDetail',
    plateLayer: 'detail',
    layout:
      EMPTY_SET +
      ' Square 1:1 table / counter / shelf set-dressing board of key props for this location, no people.'
  },
  {
    id: 'material_board',
    labelKey: 'plateMaterialBoard',
    galleryLabel: 'Materials',
    sizeClass: 'square',
    groupKey: 'sceneGroupDetail',
    plateLayer: 'detail',
    layout:
      'Square 1:1 material continuity board: wall, floor, metal/wood, fabric of THIS location. Close detail, no faces, no full body characters.'
  },
  {
    id: 'signage_prop',
    labelKey: 'plateSignage',
    galleryLabel: 'Signage',
    sizeClass: 'square',
    groupKey: 'sceneGroupDetail',
    plateLayer: 'detail',
    layout:
      'Square 1:1 readable signage / landmark prop close-up for location identity lock. Sharp text-like shapes (may be invented glyphs if needed). No faces.'
  },
  {
    id: 'lighting_ref',
    labelKey: 'plateLighting',
    galleryLabel: 'Lighting ref',
    sizeClass: 'wide',
    groupKey: 'sceneGroupDetail',
    plateLayer: 'detail',
    layout:
      EMPTY_SET +
      ' Wide 16:9 lighting reference of the empty set: clear key light direction, fill, practicals, no characters.'
  }
]

export const DEFAULT_SCENE_PLATE: ScenePlateVariantId = 'establishing'

const BY_ID = new Map(SCENE_PLATE_VARIANTS.map((v) => [v.id, v]))

export function isScenePlateVariantId(v: unknown): v is ScenePlateVariantId {
  return typeof v === 'string' && BY_ID.has(v as ScenePlateVariantId)
}

export function getScenePlateVariant(
  id: string | undefined | null
): ScenePlateVariantDef {
  if (id && BY_ID.has(id as ScenePlateVariantId)) {
    return BY_ID.get(id as ScenePlateVariantId)!
  }
  return BY_ID.get(DEFAULT_SCENE_PLATE)!
}

export function scenePlatesByGroup(): Record<
  SceneGroupKey,
  ScenePlateVariantDef[]
> {
  const out: Record<SceneGroupKey, ScenePlateVariantDef[]> = {
    sceneGroupCore: [],
    sceneGroupAngles: [],
    sceneGroupAtmosphere: [],
    sceneGroupDetail: []
  }
  for (const v of SCENE_PLATE_VARIANTS) out[v.groupKey].push(v)
  return out
}

export function buildSceneIdentityLock(profile: {
  title?: string
  description: string
  locationType?: string
  timeOfDay?: string
  weather?: string
  mood?: string
  lighting?: string
  colorPalette?: string
  setDressing?: string
  visualTags?: string
}): string {
  return [
    'Create a LOCATION REFERENCE still for AI short-drama video continuity.',
    'CRITICAL SPACE IDENTITY LOCK: same architecture, materials, signage, and layout language across all panels.',
    'FORBIDDEN: recognizable celebrity faces, named cast portraits, crowded hero close-ups, watermarks, UI text overlays.',
    'Quality: sharp materials, stable verticals, professional production design photography / concept art fidelity.',
    profile.title ? `Location name: ${profile.title}` : '',
    `Place description: ${profile.description}`,
    profile.locationType ? `Space type: ${profile.locationType}` : '',
    profile.timeOfDay ? `Time of day: ${profile.timeOfDay}` : '',
    profile.weather ? `Weather: ${profile.weather}` : '',
    profile.mood ? `Mood: ${profile.mood}` : '',
    profile.lighting ? `Lighting design: ${profile.lighting}` : '',
    profile.colorPalette ? `Color palette: ${profile.colorPalette}` : '',
    profile.setDressing ? `Set dressing: ${profile.setDressing}` : '',
    profile.visualTags ? `Visual tags: ${profile.visualTags}` : ''
  ]
    .filter(Boolean)
    .join(' ')
}

export function buildScenePlateImagePrompt(
  profile: {
    title?: string
    description: string
    locationType?: string
    timeOfDay?: string
    weather?: string
    mood?: string
    lighting?: string
    colorPalette?: string
    setDressing?: string
    visualTags?: string
    hardRules?: string
  },
  variant: string = 'establishing',
  artStyle: string = 'photo_cinematic'
): string {
  const style = getArtStyle(artStyle)
  const def = getScenePlateVariant(variant)
  const body = [
    style.promptBlock,
    `Repeat: medium MUST be style id "${style.id}" (${style.family}).`,
    buildSceneIdentityLock(profile),
    `Plate layer: ${def.plateLayer}.`,
    `LAYOUT: ${def.layout}`,
    `Final check: correct medium ${style.id}; empty of hero faces; location identity locked.`
  ].join(' ')
  return appendHardRules(body, profile.hardRules)
}

export function buildScenePlateEditPrompt(
  profile: {
    title?: string
    description: string
    locationType?: string
    timeOfDay?: string
    weather?: string
    mood?: string
    lighting?: string
    colorPalette?: string
    setDressing?: string
    visualTags?: string
    hardRules?: string
  },
  variant: string = 'establishing',
  artStyle: string = 'photo_cinematic'
): string {
  const style = getArtStyle(artStyle)
  const body = buildScenePlateImagePrompt(profile, variant, artStyle)
  return [
    'IMAGE EDIT / LOCATION RESTYLE TASK (highest priority):',
    style.promptBlock,
    'Keep LOCATION IDENTITY from the source: architecture massing, materials, signage, key set dressing layout.',
    'Change medium and/or camera layout as required by the plate package below.',
    'DO NOT invent a different place. DO NOT add hero character faces.',
    body
  ].join(' ')
}
