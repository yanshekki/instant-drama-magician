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
  const raw = label.trim()
  const key = CHAR_LABEL_TO_KEY.get(raw.toLowerCase())
  if (key) return t(`characters.${key}`)
  // Partial: "Bible sheet · rain" / stored with suffix
  for (const [enLabel, labelKey] of CHAR_LABEL_TO_KEY) {
    if (
      raw.toLowerCase() === enLabel ||
      raw.toLowerCase().startsWith(`${enLabel} `) ||
      raw.toLowerCase().startsWith(`${enLabel}·`) ||
      raw.toLowerCase().startsWith(`${enLabel} ·`)
    ) {
      return t(`characters.${labelKey}`)
    }
  }
  // costume swap / freeform labels
  if (/^costume swap/i.test(raw)) {
    const rest = raw
      .replace(/^costume\s+swap\s*[·•\-—:]?\s*/i, '')
      .trim()
    return rest
      ? `${t('characters.swapCostume')} · ${rest}`
      : t('characters.swapCostume')
  }
  // Dressed look from costumes page (any UI language stored as that locale's string)
  if (
    /^generate dressed/i.test(raw) ||
    raw === t('costumes.generateDressed')
  ) {
    return t('costumes.generateDressed')
  }
  if (
    /^external ref/i.test(raw) ||
    raw === t('characters.externalRefLabel')
  ) {
    return t('characters.externalRefLabel')
  }
  // Legacy single-image fallback label
  if (/^reference$/i.test(raw)) {
    return t('characters.photoFallback')
  }
  return raw
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
