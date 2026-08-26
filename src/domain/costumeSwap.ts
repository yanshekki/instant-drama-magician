/**
 * Costume-swap pipeline: dress a body/base reference with a new outer wardrobe
 * via image_edit, keeping face/body identity locked.
 */
import type { CharacterGalleryItem } from './characterGallery'
import { artStylePrompt, getArtStyle, type ArtStyleId } from './characterArtStyles'
import { AppError } from '../types/errors'
import {
  isLikelyMinorAge,
  type WardrobeLayer
} from './characterSheetVariants'
import { PromptCatalog } from '../prompts'
import type { PromptCopyKey } from '../prompts/copy/keys'
import { appendHardRules } from './promptHardRules'

export type CostumeSwapPose =
  | 'hero_front'
  | 'turnaround'
  | 'three_quarter'
  | 'bust'
  | 'profile'
  | 'back'
  | 'detail_fabric'

/** Image canvas class for generateDressed size pick. */
export type CostumePoseSizeClass = 'tall' | 'wide' | 'square'

export type CostumePoseGroup = 'fullbody' | 'multi' | 'detail'

export interface CostumeSwapPoseDef {
  id: CostumeSwapPose
  /** i18n under characters.* (legacy) or costumes.* */
  labelKey: string
  /** Short aspect badge e.g. 9:16 */
  aspectBadge: string
  sizeClass: CostumePoseSizeClass
  group: CostumePoseGroup
  /** One-line layout instruction for the image model */
  layout: string
}

export const COSTUME_SWAP_POSES: CostumeSwapPoseDef[] = [
  {
    id: 'hero_front',
    labelKey: 'swapPoseHero',
    aspectBadge: '9:16',
    sizeClass: 'tall',
    group: 'fullbody',
    layout:
      'Tall 9:16 SINGLE full-body front standing pose, head-to-toe visible, neutral hero stance, arms relaxed, feet planted. One character only.'
  },
  {
    id: 'three_quarter',
    labelKey: 'swapPoseThreeQuarter',
    aspectBadge: '1:1',
    sizeClass: 'square',
    group: 'fullbody',
    layout:
      'Square 1:1 SINGLE three-quarter (~45°) full-body portrait, head-to-toe preferred, readable new costume silhouette.'
  },
  {
    id: 'profile',
    labelKey: 'swapPoseProfile',
    aspectBadge: '9:16',
    sizeClass: 'tall',
    group: 'fullbody',
    layout:
      'Tall 9:16 SINGLE full-body true profile (90° side view), head-to-toe, neutral stance, costume silhouette and side seams fully readable. One character only.'
  },
  {
    id: 'back',
    labelKey: 'swapPoseBack',
    aspectBadge: '9:16',
    sizeClass: 'tall',
    group: 'fullbody',
    layout:
      'Tall 9:16 SINGLE full-body rear view, head-to-toe, arms slightly away from body so back of coat/dress/hair and rear silhouette are clear. One character only.'
  },
  {
    id: 'bust',
    labelKey: 'swapPoseBust',
    aspectBadge: '3:4',
    sizeClass: 'tall',
    group: 'detail',
    layout:
      'Tall 3:4 SINGLE upper-body bust portrait (chest up), collar, neckline, shoulders, outer layers and face jewelry readable; not a full-body crop. One character only.'
  },
  {
    id: 'detail_fabric',
    labelKey: 'swapPoseDetailFabric',
    aspectBadge: '1:1',
    sizeClass: 'square',
    group: 'detail',
    layout:
      'Square 1:1 costume DETAIL board: close-ups of fabric weave, buttons, zippers, embroidery, belt hardware, and material transitions of the NEW outer costume only; no full scene, no second character.'
  },
  {
    id: 'turnaround',
    labelKey: 'swapPoseTurnaround',
    aspectBadge: '16:9',
    sizeClass: 'wide',
    group: 'multi',
    layout:
      'Wide 16:9 turnaround with EXACTLY FOUR full-body figures same scale: front, left 90°, back, right 90°. Neutral A-pose, complete new costume on every view.'
  }
]

export function getCostumeSwapPose(
  id?: string | null
): CostumeSwapPoseDef {
  return COSTUME_SWAP_POSES.find((p) => p.id === id) ?? COSTUME_SWAP_POSES[0]
}

export function costumePosesByGroup(): Record<
  CostumePoseGroup,
  CostumeSwapPoseDef[]
> {
  const out: Record<CostumePoseGroup, CostumeSwapPoseDef[]> = {
    fullbody: [],
    multi: [],
    detail: []
  }
  for (const p of COSTUME_SWAP_POSES) {
    out[p.group].push(p)
  }
  return out
}

/**
 * Infer wardrobe layer from explicit field or gallery label heuristics.
 * Older gallery items only have English galleryLabel from sheet variants.
 */
export function inferGalleryLayer(
  item: Pick<CharacterGalleryItem, 'label' | 'layer' | 'kind'>
): WardrobeLayer | null {
  if (item.layer) return item.layer
  const label = (item.label ?? '').toLowerCase()
  if (
    /body nude|body bare|body plate|body half-bare|body upper half-bare|body lower half-bare|body full-bare|nude body|nude turnaround|nude front|nude t-pose|nude a-pose|bare turnaround|bare front|bare t-pose|half-bare|full-bare|上半身半裸|下半身半裸|半裸|全裸|裸身|裸體|體型板|體型/.test(
      label
    )
  ) {
    return 'nude'
  }
  if (/base layer|base under|undergarment|底衫|底衣|底層/.test(label)) {
    return 'base'
  }
  if (
    /costume detail|costume hero|costume turnaround|full costume|戲服|wardrobe/.test(
      label
    )
  ) {
    return 'costume'
  }
  if (/identity lock|face id|identity/.test(label)) return 'identity'
  if (/feet|shoes|accessories|silhouette|hands|detail/.test(label)) {
    return 'detail'
  }
  // Generic sheet/upload — treat as costume identity source
  if (item.kind === 'sheet' || item.kind === 'upload' || item.kind === 'gen') {
    return 'costume'
  }
  return null
}

export interface PickBaseResult {
  item: CharacterGalleryItem | null
  reason: 'manual' | 'nude' | 'base' | 'costume' | 'any' | 'none'
}

/**
 * Prefer body nude → base layer → costume sheet → any image.
 * Minors: skip nude bases.
 */
export function pickBestBaseImage(
  gallery: CharacterGalleryItem[],
  opts?: {
    ageRange?: string | null
    preferredPath?: string | null
  }
): PickBaseResult {
  if (gallery.length === 0) return { item: null, reason: 'none' }

  const minor = isLikelyMinorAge(opts?.ageRange)
  const preferredPath = opts?.preferredPath?.trim() || null

  if (preferredPath) {
    const pref = gallery.find((g) => g.path === preferredPath)
    // If preferred is not in this gallery list (e.g. filtered to existing files
    // only and the pick was a deleted path), fall through to auto.
    if (pref) {
      const layer = inferGalleryLayer(pref)
      if (minor && layer === 'nude') {
        // fall through to auto pick safe base
      } else {
        return { item: pref, reason: 'manual' }
      }
    }
  }

  const withLayer = gallery.map((item) => ({
    item,
    layer: inferGalleryLayer(item)
  }))

  const pickLayer = (layer: WardrobeLayer): CharacterGalleryItem | null => {
    const hit = withLayer.find((x) => x.layer === layer)
    return hit?.item ?? null
  }

  if (!minor) {
    const nude = pickLayer('nude')
    if (nude) return { item: nude, reason: 'nude' }
  }

  const base = pickLayer('base')
  if (base) return { item: base, reason: 'base' }

  const costume = pickLayer('costume')
  if (costume) return { item: costume, reason: 'costume' }

  // newest first is gallery order
  return { item: gallery[0], reason: 'any' }
}

export function costumeSwapLayoutPrompt(
  id?: CostumeSwapPose | string | null,
  locale?: string | null
): string {
  const pose = getCostumeSwapPose(id)
  return PromptCatalog.t(
    locale,
    `swap.costume.layout.${pose.id}` as PromptCopyKey
  )
}

export function buildCostumeSwapPrompt(input: {
  name: string
  newCostume: string
  artStyle?: string | null
  pose?: CostumeSwapPose | string | null
  appearance?: string | null
  ageRange?: string | null
  gender?: string | null
  visualTags?: string | null
  mannerisms?: string | null
  hardRules?: string | null
  locale?: string | null
}): string {
  const locale = input.locale ?? 'zh-HK'
  const style = getArtStyle(input.artStyle ?? undefined)
  const pose = getCostumeSwapPose(input.pose)
  const costume = input.newCostume.trim()
  if (!costume) {
    throw new AppError('VALIDATION', 'errors.costumeDescRequired')
  }

  const body = [
    PromptCatalog.t(locale, 'swap.costume.task'),
    artStylePrompt(style.id, locale),
    PromptCatalog.t(locale, 'sheet.scaffold.repeatMedium', {
      id: style.id,
      family: style.family
    }),
    PromptCatalog.t(locale, 'swap.costume.sameCharacter'),
    PromptCatalog.t(locale, 'swap.costume.identity'),
    PromptCatalog.t(locale, 'swap.costume.pose'),
    PromptCatalog.t(locale, 'swap.costume.replace'),
    PromptCatalog.t(locale, 'swap.costume.paint'),
    PromptCatalog.t(locale, 'swap.costume.new', { costume }),
    PromptCatalog.t(locale, 'swap.costume.add'),
    PromptCatalog.t(locale, 'swap.costume.complete'),
    PromptCatalog.t(locale, 'swap.costume.edges'),
    PromptCatalog.t(locale, 'swap.costume.forbidden'),
    PromptCatalog.t(locale, 'swap.costume.nonHuman'),
    PromptCatalog.t(locale, 'swap.costume.subject', { name: input.name }),
    input.ageRange
      ? PromptCatalog.t(locale, 'swap.costume.age', { age: input.ageRange })
      : '',
    input.gender
      ? PromptCatalog.t(locale, 'swap.costume.gender', { gender: input.gender })
      : '',
    input.appearance
      ? PromptCatalog.t(locale, 'swap.costume.appearance', {
          appearance: input.appearance
        })
      : '',
    input.visualTags
      ? PromptCatalog.t(locale, 'swap.costume.tags', { tags: input.visualTags })
      : '',
    input.mannerisms
      ? PromptCatalog.t(locale, 'swap.costume.manner', {
          manner: input.mannerisms.slice(0, 160)
        })
      : '',
    PromptCatalog.t(locale, 'sheet.scaffold.layoutLead', {
      layout: costumeSwapLayoutPrompt(pose.id, locale)
    }),
    PromptCatalog.t(locale, 'swap.costume.checklist', { style: style.id })
  ]
    .filter(Boolean)
    .join(' ')
  return appendHardRules(body, input.hardRules)
}

export function costumeSwapGalleryLabel(costumeDescription: string): string {
  const short = costumeDescription.trim().slice(0, 40).replace(/\s+/g, ' ')
  return short ? `Costume swap · ${short}` : 'Costume swap'
}

/**
 * Template fallback for costume look intro video (LLM polish improves this).
 * Wardrobe identity must match the reference still.
 */
export function buildCostumeIntroVideoPrompt(
  profile: {
    name: string
    description: string
    artStyle?: string | null
    hardRules?: string | null
  },
  locale: string = 'zh-HK',
  skipDefaultCamera: boolean = false
): string {
  const name =
    profile.name.trim() ||
    profile.description.trim().slice(0, 32) ||
    PromptCatalog.t(locale, 'costumeIntro.fallbackName')
  const look = profile.description.trim() || name
  const art = profile.artStyle?.trim()

  return appendHardRules(
    [
      PromptCatalog.t(locale, 'costumeIntro.task'),
      PromptCatalog.t(locale, 'costumeIntro.wardrobeLock'),
      PromptCatalog.t(locale, 'costumeIntro.identityOrProduct'),
      PromptCatalog.t(locale, 'costumeIntro.name', { name }),
      PromptCatalog.t(locale, 'costumeIntro.desc', { look }),
      art ? PromptCatalog.t(locale, 'costumeIntro.art', { art }) : null,
      skipDefaultCamera
        ? null
        : PromptCatalog.t(locale, 'costumeIntro.camera'),
      PromptCatalog.t(locale, 'costumeIntro.beat'),
      PromptCatalog.t(locale, 'costumeIntro.forbid')
    ]
      .filter(Boolean)
      .join(' '),
    profile.hardRules
  )
}

export type { ArtStyleId }
