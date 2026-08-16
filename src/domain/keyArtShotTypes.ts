import type { ComicPageFormat } from './comicPageFormat'

export type KeyArtShotTypeId =
  | 'cover'
  | 'poster'
  | 'still'
  | 'promo'
  | 'social'
  | 'headshot'
  | 'bust'
  | 'group'

export type KeyArtShotTypeDef = {
  id: KeyArtShotTypeId
  labelKey: string
  hintKey: string
  sizeClass: ComicPageFormat
  /** PromptCatalog layout lock */
  lockKey: string
}

export const KEY_ART_SHOT_TYPES: KeyArtShotTypeDef[] = [
  {
    id: 'cover',
    labelKey: 'typeCover',
    hintKey: 'typeCoverHint',
    sizeClass: 'wide',
    lockKey: 'keyArt.lockCover'
  },
  {
    id: 'poster',
    labelKey: 'typePoster',
    hintKey: 'typePosterHint',
    sizeClass: 'tall',
    lockKey: 'keyArt.lockPoster'
  },
  {
    id: 'still',
    labelKey: 'typeStill',
    hintKey: 'typeStillHint',
    sizeClass: 'wide',
    lockKey: 'keyArt.lockStill'
  },
  {
    id: 'promo',
    labelKey: 'typePromo',
    hintKey: 'typePromoHint',
    sizeClass: 'wide',
    lockKey: 'keyArt.lockPromo'
  },
  {
    id: 'social',
    labelKey: 'typeSocial',
    hintKey: 'typeSocialHint',
    sizeClass: 'tall',
    lockKey: 'keyArt.lockSocial'
  },
  {
    id: 'headshot',
    labelKey: 'typeHeadshot',
    hintKey: 'typeHeadshotHint',
    sizeClass: 'square',
    lockKey: 'keyArt.lockHeadshot'
  },
  {
    id: 'bust',
    labelKey: 'typeBust',
    hintKey: 'typeBustHint',
    sizeClass: 'tall',
    lockKey: 'keyArt.lockBust'
  },
  {
    id: 'group',
    labelKey: 'typeGroup',
    hintKey: 'typeGroupHint',
    sizeClass: 'wide',
    lockKey: 'keyArt.lockGroup'
  }
]

const TYPE_IDS = new Set<string>(KEY_ART_SHOT_TYPES.map((t) => t.id))

export function coerceKeyArtShotType(
  v?: string | null
): KeyArtShotTypeId {
  if (v && TYPE_IDS.has(v)) return v as KeyArtShotTypeId
  return 'cover'
}

export function getKeyArtShotType(
  v?: string | null
): KeyArtShotTypeDef {
  const id = coerceKeyArtShotType(v)
  return KEY_ART_SHOT_TYPES.find((t) => t.id === id)!
}

export function keyArtTypeFormatLockKey(
  format: ComicPageFormat
):
  | 'keyArt.formatLockTall'
  | 'keyArt.formatLockSquare'
  | 'keyArt.formatLockWide' {
  if (format === 'tall') return 'keyArt.formatLockTall'
  if (format === 'square') return 'keyArt.formatLockSquare'
  return 'keyArt.formatLockWide'
}
