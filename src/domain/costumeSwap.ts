/**
 * Costume-swap pipeline: dress a body/base reference with a new outer wardrobe
 * via image_edit, keeping face/body identity locked.
 */
import type { CharacterGalleryItem } from './characterGallery'
import { getArtStyle, type ArtStyleId } from './characterArtStyles'
import {
  isLikelyMinorAge,
  type WardrobeLayer
} from './characterSheetVariants'

export type CostumeSwapPose = 'hero_front' | 'turnaround' | 'three_quarter'

export const COSTUME_SWAP_POSES: {
  id: CostumeSwapPose
  labelKey: string
  layout: string
}[] = [
  {
    id: 'hero_front',
    labelKey: 'swapPoseHero',
    layout:
      'Tall 9:16 SINGLE full-body front standing pose, head-to-toe visible, neutral hero stance, arms relaxed, feet planted. One character only.'
  },
  {
    id: 'turnaround',
    labelKey: 'swapPoseTurnaround',
    layout:
      'Wide 16:9 turnaround with EXACTLY FOUR full-body figures same scale: front, left 90°, back, right 90°. Neutral A-pose, complete new costume on every view.'
  },
  {
    id: 'three_quarter',
    labelKey: 'swapPoseThreeQuarter',
    layout:
      'Square 1:1 SINGLE three-quarter (~45°) full-body portrait, head-to-toe preferred, readable new costume silhouette.'
  }
]

export function getCostumeSwapPose(id?: string | null): (typeof COSTUME_SWAP_POSES)[number] {
  return COSTUME_SWAP_POSES.find((p) => p.id === id) ?? COSTUME_SWAP_POSES[0]
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
}): string {
  const style = getArtStyle(input.artStyle ?? undefined)
  const pose = getCostumeSwapPose(input.pose)
  const costume = input.newCostume.trim()
  if (!costume) {
    throw new Error('Costume description is required for costume swap')
  }

  return [
    'IMAGE EDIT / COSTUME SWAP TASK (highest priority — read fully before painting):',
    style.promptBlock,
    `Repeat: output medium MUST be style id "${style.id}" (${style.family}).`,
    'You are dressing the SAME character from the source image in a NEW outer wardrobe only.',
    'IDENTITY LOCK (never change): face/head shape, eyes, hair color and cut, body proportions, species/body plan, skin or surface markings, age presentation.',
    'POSE LOCK: keep the same body pose and camera framing from the source unless the layout below requires a multi-view sheet.',
    'WARDROBE REPLACE (always): strip away ALL previous outer clothing, armor, coats, dresses, uniforms, outer gear, and mismatched shoes from the source.',
    'Then paint ONLY the new outer costume described below — full coverage, correct silhouette, readable materials, matching footwear and outer accessories.',
    `NEW OUTER COSTUME (must match exactly, high priority): ${costume}`,
    'If the source is nude or base-layer undergarments only: ADD the full outer costume on top while preserving anatomy and underlayer logic.',
    'If the source already wears a costume: COMPLETELY REPLACE it — do not blend, layer, or ghost the old outfit under the new one.',
    'Edges of clothing must sit correctly on shoulders, waist, wrists, ankles; no floating fabric, no fused limbs.',
    'FORBIDDEN: changing species, age, face identity, body shape, second character, erotic posing, watermarks, text captions, UI chrome.',
    'Non-human subjects: species-appropriate outer covering / gear matching the costume description.',
    `Subject: ${input.name}`,
    input.ageRange ? `Age / maturity: ${input.ageRange}` : '',
    input.gender ? `Gender / presentation: ${input.gender}` : '',
    input.appearance ? `Appearance lock: ${input.appearance}` : '',
    input.visualTags ? `Visual tags: ${input.visualTags}` : '',
    input.mannerisms
      ? `Mannerism hints only: ${input.mannerisms.slice(0, 160)}`
      : '',
    `LAYOUT: ${pose.layout}`,
    `Final checklist: (1) same face/body as source (2) ONLY the new costume visible (3) medium = ${style.id} (4) clean studio or neutral backdrop.`
  ]
    .filter(Boolean)
    .join(' ')
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
  },
  locale: 'zh-HK' | 'en' = 'zh-HK'
): string {
  const name =
    profile.name.trim() ||
    profile.description.trim().slice(0, 32) ||
    (locale === 'en' ? 'Look' : '造型')
  const look = profile.description.trim() || name
  const art = profile.artStyle?.trim()

  if (locale === 'en') {
    return [
      'IMAGE-TO-VIDEO: animate the exact wardrobe look in the reference still as a short costume intro clip for short-drama wardrobe library.',
      'WARDROBE LOCK: same silhouette, fabrics, colors, layers, accessories, and wear as the reference — do not invent a different outfit.',
      'If a person is in the still: IDENTITY LOCK on face/body while fabric may gently move; if mannequin or flat-lay: keep product framing.',
      `Look name: ${name}.`,
      `Costume description: ${look}.`,
      art ? `Art style: ${art}.` : null,
      'Camera: gentle push-in or subtle orbit; fashion-look lighting consistent with the still.',
      'Action beat: hold pose/still → fabric drape / sleeve hem micro-motion / light glint on hardware → settle.',
      'No new cast faces; no text overlays, logos, or erotic posing.',
      'Duration fits a 6–10s wardrobe intro clip.'
    ]
      .filter(Boolean)
      .join(' ')
  }
  return [
    '圖生影片：以參考靜幀中的同一戲服造型，拍一段短劇戲服庫用「造型介紹」短片。',
    '服裝鎖定：輪廓、布料、顏色、層次、配件與舊損必須與參考圖一致，不可換成另一套。',
    '若靜幀有人：鎖定臉與體型，布料可輕微擺動；若為人台／平鋪：保持產品構圖。',
    `造型名稱：${name}。`,
    `戲服描述：${look}。`,
    art ? `藝術風格：${art}。` : null,
    '運鏡：輕微推近或慢環繞；光線與靜幀一致。',
    '動作節奏：定格 → 布料垂墜／袖口微動／五金反光 → 定格。',
    '勿新增角色臉、字幕、logo 或色情姿勢。',
    '適合 6–10 秒造型介紹短片。'
  ]
    .filter(Boolean)
    .join(' ')
}

export type { ArtStyleId }
