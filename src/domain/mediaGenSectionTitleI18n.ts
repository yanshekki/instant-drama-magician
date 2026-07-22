/**
 * Localize MediaGen material card titles (layout package, art style, etc.).
 * Section.text stays English for the LLM; only display labels go through i18n.
 */
import { getActionPanelLayout, ACTION_PANEL_LAYOUTS } from './actionPlateVariants'
import { getArtStyle, isArtStyleId } from './characterArtStyles'
import { getSheetVariant, isSheetVariantId } from './characterSheetVariants'
import { getScenePlateVariant, isScenePlateVariantId } from './scenePlateVariants'
import {
  getPropPlateVariant,
  PROP_PLATE_VARIANTS
} from './propPlateVariants'
import {
  translateActionGalleryLabel,
  translateCharacterGalleryLabel,
  translatePropGalleryLabel,
  translateSceneGalleryLabel
} from './galleryLabelI18n'

export type MediaGenSectionTitleT = (
  key: string,
  opts?: Record<string, unknown>
) => string

/** First token before " · " / "·" — used as variant/art id. */
export function parseMediaGenTitleId(title: string | undefined | null): string {
  const raw = (title || '').trim()
  if (!raw) return ''
  const parts = raw.split(/\s*[·•|]\s*/)
  return (parts[0] || raw).trim()
}

function entityTypeLabel(
  t: MediaGenSectionTitleT,
  entityType?: string | null
): string {
  if (!entityType) return ''
  const key = `mediaGen.entity.${entityType}`
  const v = t(key)
  return v === key ? entityType : v
}

function localizeLayoutPackageId(
  id: string,
  t: MediaGenSectionTitleT
): string | null {
  if (!id) return null
  if (isSheetVariantId(id)) {
    const def = getSheetVariant(id)
    const label = t(`characters.${def.labelKey}`)
    return label === `characters.${def.labelKey}` ? def.galleryLabel : label
  }
  if (ACTION_PANEL_LAYOUTS.some((l) => l.id === id)) {
    const def = getActionPanelLayout(id)
    const label = t(`actions.${def.labelKey}`)
    return label === `actions.${def.labelKey}` ? def.galleryLabel : label
  }
  if (isScenePlateVariantId(id)) {
    const def = getScenePlateVariant(id)
    const label = t(`scenes.${def.labelKey}`)
    return label === `scenes.${def.labelKey}` ? def.galleryLabel : label
  }
  if (PROP_PLATE_VARIANTS.some((v) => v.id === id)) {
    const def = getPropPlateVariant(id)
    const label = t(`props.${def.labelKey}`)
    return label === `props.${def.labelKey}` ? def.galleryLabel : label
  }
  return null
}

function localizeArtId(id: string, t: MediaGenSectionTitleT): string | null {
  if (!id || !isArtStyleId(id)) return null
  const def = getArtStyle(id)
  const label = t(`characters.${def.labelKey}`)
  return label === `characters.${def.labelKey}` ? def.id : label
}

/**
 * Full heading for a materials row: e.g. "格位 · 半身胸像（對話用）".
 */
export function translateMediaGenSectionTitle(
  section: {
    title?: string
    entityType?: string | null
    id?: string
  },
  t: MediaGenSectionTitleT
): string {
  const typeLabel = entityTypeLabel(t, section.entityType)
  const title = (section.title || '').trim()
  const idHint = parseMediaGenTitleId(title)

  if (section.entityType === 'hardRules') {
    return t('mediaGen.hardRulesTitle')
  }

  if (section.entityType === 'gallery') {
    const n = translateCharacterGalleryLabel(title, t) || title
    // Prefer character map; also try action/scene/prop if still English-ish
    const n2 =
      n === title ? translateActionGalleryLabel(title, t) : n
    const n3 =
      n2 === title ? translateSceneGalleryLabel(title, t) : n2
    const n4 =
      n3 === title ? translatePropGalleryLabel(title, t) : n3
    return t('mediaGen.galleryBoard', { n: n4 || title || section.id || '' })
  }

  if (section.entityType === 'art') {
    const artLabel =
      localizeArtId(idHint, t) ||
      localizeArtId(title, t) ||
      title ||
      idHint
    return typeLabel ? `${typeLabel} · ${artLabel}` : artLabel
  }

  if (section.entityType === 'layout') {
    const loc =
      localizeLayoutPackageId(idHint, t) ||
      localizeLayoutPackageId(title, t)
    const idShow = loc || title || idHint
    return t('mediaGen.layoutTitle', { id: idShow })
  }

  // Profile / free text: keep user content, prefix entity when useful
  if (typeLabel && title) return `${typeLabel} · ${title}`
  return title || typeLabel || section.id || ''
}
