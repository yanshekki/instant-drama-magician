import { SHEET_VARIANTS } from './characterSheetVariants'
import { SCENE_PLATE_VARIANTS } from './scenePlateVariants'
import { PROP_PLATE_VARIANTS } from './propPlateVariants'

/**
 * Map stored English galleryLabel → i18n key under characters.* / scenes.* / props.*
 */
const CHAR_LABEL_TO_KEY = new Map(
  SHEET_VARIANTS.map((v) => [v.galleryLabel.toLowerCase(), v.labelKey])
)
const SCENE_LABEL_TO_KEY = new Map(
  SCENE_PLATE_VARIANTS.map((v) => [v.galleryLabel.toLowerCase(), v.labelKey])
)
const PROP_LABEL_TO_KEY = new Map(
  PROP_PLATE_VARIANTS.map((v) => [v.galleryLabel.toLowerCase(), v.labelKey])
)

export function translateCharacterGalleryLabel(
  label: string | undefined | null,
  t: (key: string) => string
): string {
  if (!label?.trim()) return t('characters.photoFallback')
  const key = CHAR_LABEL_TO_KEY.get(label.trim().toLowerCase())
  if (key) return t(`characters.${key}`)
  // costume swap / freeform labels
  if (/^costume swap/i.test(label)) return t('characters.swapCostume')
  if (
    /^external ref/i.test(label) ||
    label === t('characters.externalRefLabel')
  ) {
    return t('characters.externalRefLabel')
  }
  return label
}

export function translateSceneGalleryLabel(
  label: string | undefined | null,
  t: (key: string) => string
): string {
  if (!label?.trim()) return t('scenes.photoFallback')
  const key = SCENE_LABEL_TO_KEY.get(label.trim().toLowerCase())
  if (key) return t(`scenes.${key}`)
  return label
}

export function translatePropGalleryLabel(
  label: string | undefined | null,
  t: (key: string) => string
): string {
  if (!label?.trim()) return t('props.photoFallback')
  const key = PROP_LABEL_TO_KEY.get(label.trim().toLowerCase())
  if (key) return t(`props.${key}`)
  return label
}
