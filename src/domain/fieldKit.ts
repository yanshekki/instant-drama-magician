/**
 * Shared modular field kit: one template per part, assembled into an existing
 * textarea. Selection IDs persist under profileJson[spec.key] when the entity
 * has that bag. Image/video handlers still consume the assembled text column.
 */
import { coerceUiLanguage } from './uiLanguages'

export const FIELD_KIT_PAGE_SIZE = 12

export function paginateItems<T>(
  items: readonly T[],
  page: number,
  pageSize = FIELD_KIT_PAGE_SIZE
): { page: number; totalPages: number; items: T[] } {
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize))
  const p = Math.min(Math.max(1, page), totalPages)
  const start = (p - 1) * pageSize
  return {
    page: p,
    totalPages,
    items: items.slice(start, start + pageSize)
  }
}

export type FieldKitSelection = {
  notes?: string
} & Record<string, string | undefined>

export interface FieldKitTemplate {
  id: string
  part: string
  labelZh: string
  labelEn: string
  keywordsZh: readonly string[]
  keywordsEn: readonly string[]
  structureZh: string
  structureEn: string
  promptBlock: string
}

export type FieldKitPartCopy = { zhHK: string; zhCN: string; en: string }

export type FieldKitRow = [
  id: string,
  labelZh: string,
  labelEn: string,
  keywordsZh: string,
  keywordsEn: string,
  structureZh: string,
  structureEn: string,
  promptBlock: string
]

export type FieldKitAssembleMode = 'clause' | 'rules'

export interface FieldKitSpec<P extends string = string> {
  key: string
  parts: readonly P[]
  partLabels: Record<P, FieldKitPartCopy>
  extraLabels?: Record<string, FieldKitPartCopy>
  templates: readonly FieldKitTemplate[]
  skipAssemble?: (def: FieldKitTemplate) => boolean
  assembleMode?: FieldKitAssembleMode
  includeAura?: boolean
  /** For rules mode: which parts are MUST vs MUST NOT */
  ruleKind?: Partial<Record<P, 'must' | 'mustNot'>>
}

export function isChineseLocale(locale?: string | null): boolean {
  const id = coerceUiLanguage(locale)
  return id === 'zh-HK' || id === 'zh-CN'
}

export function packFieldKitRows(
  part: string,
  rows: readonly FieldKitRow[]
): FieldKitTemplate[] {
  return rows.map(
    ([id, labelZh, labelEn, kz, ke, structureZh, structureEn, promptBlock]) => ({
      id,
      part,
      labelZh,
      labelEn,
      keywordsZh: kz.split('、').filter(Boolean),
      keywordsEn: ke.split(', ').filter(Boolean),
      structureZh,
      structureEn,
      promptBlock
    })
  )
}

export function indexFieldKitTemplates(
  spec: FieldKitSpec
): Record<string, FieldKitTemplate[]> {
  const by: Record<string, FieldKitTemplate[]> = {}
  for (const part of spec.parts) by[part] = []
  for (const def of spec.templates) {
    if (!by[def.part]) by[def.part] = []
    by[def.part].push(def)
  }
  return by
}

const INDEX = new WeakMap<FieldKitSpec, Record<string, FieldKitTemplate[]>>()

function byPart(spec: FieldKitSpec): Record<string, FieldKitTemplate[]> {
  let idx = INDEX.get(spec)
  if (!idx) {
    idx = indexFieldKitTemplates(spec)
    INDEX.set(spec, idx)
  }
  return idx
}

function copyFor(
  spec: FieldKitSpec,
  part: string,
  locale?: string | null
): FieldKitPartCopy | undefined {
  return (
    spec.partLabels[part as keyof typeof spec.partLabels] ??
    spec.extraLabels?.[part]
  )
}

export function fieldKitPartLabel(
  spec: FieldKitSpec,
  part: string,
  locale?: string | null
): string {
  const copy = copyFor(spec, part, locale)
  if (!copy) return part
  const id = coerceUiLanguage(locale)
  if (id === 'zh-CN') return copy.zhCN
  if (id === 'zh-HK') return copy.zhHK
  return copy.en
}

export function fieldKitTemplateLabel(
  def: FieldKitTemplate,
  locale?: string | null
): string {
  return isChineseLocale(locale) ? def.labelZh : def.labelEn
}

export function fieldKitTemplateStructure(
  def: FieldKitTemplate,
  locale?: string | null
): string {
  return isChineseLocale(locale) ? def.structureZh : def.structureEn
}

export function fieldKitTemplateKeywords(
  def: FieldKitTemplate,
  locale?: string | null
): readonly string[] {
  return isChineseLocale(locale) ? def.keywordsZh : def.keywordsEn
}

export function fieldKitSearchHaystack(
  def: FieldKitTemplate,
  locale?: string | null
): string {
  const label = fieldKitTemplateLabel(def, locale)
  const kws = fieldKitTemplateKeywords(def, locale).join(' ')
  const structure = fieldKitTemplateStructure(def, locale)
  return [def.id, def.labelZh, def.labelEn, label, kws, structure, def.promptBlock].join(
    ' '
  )
}

export function listFieldKitTemplates(
  spec: FieldKitSpec,
  part: string
): readonly FieldKitTemplate[] {
  return byPart(spec)[part] ?? []
}

export function getFieldKitTemplate(
  spec: FieldKitSpec,
  part: string,
  id: string | null | undefined
): FieldKitTemplate | undefined {
  if (!id) return undefined
  return listFieldKitTemplates(spec, part).find((d) => d.id === id)
}

export function emptyFieldKit(): FieldKitSelection {
  return {}
}

export function fieldKitHasSelection(
  spec: FieldKitSpec,
  kit: FieldKitSelection | null | undefined
): boolean {
  if (!kit) return false
  if (kit.notes?.trim()) return true
  return spec.parts.some((part) => Boolean(kit[part]))
}

export function countFieldKitParts(
  spec: FieldKitSpec,
  kit: FieldKitSelection | null | undefined
): number {
  if (!kit) return 0
  return spec.parts.filter((part) => Boolean(kit[part])).length
}

export function sanitizeFieldKit(
  spec: FieldKitSpec,
  raw: unknown
): FieldKitSelection {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const o = raw as Record<string, unknown>
  const out: FieldKitSelection = {}
  for (const part of spec.parts) {
    const id = typeof o[part] === 'string' ? o[part].trim() : ''
    if (id && getFieldKitTemplate(spec, part, id)) out[part] = id
  }
  if (typeof o.notes === 'string' && o.notes.trim()) {
    out.notes = o.notes.trim()
  }
  return out
}

export function parseFieldKit(
  spec: FieldKitSpec,
  json: string | null | undefined
): FieldKitSelection {
  if (!json?.trim()) return {}
  try {
    const parsed = JSON.parse(json) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {}
    }
    const obj = parsed as Record<string, unknown>
    return sanitizeFieldKit(spec, obj[spec.key])
  } catch {
    return {}
  }
}

function parseProfileObject(
  existing: string | null | undefined
): Record<string, unknown> {
  if (!existing?.trim()) return {}
  try {
    const parsed = JSON.parse(existing) as unknown
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return { ...(parsed as Record<string, unknown>) }
    }
  } catch {
    /* start empty */
  }
  return {}
}

export function mergeFieldKitIntoProfileJson(
  existing: string | null | undefined,
  spec: FieldKitSpec,
  kit: FieldKitSelection
): string | null {
  return mergeFieldKitsIntoProfileJson(existing, [{ spec, kit }])
}

export function mergeFieldKitsIntoProfileJson(
  existing: string | null | undefined,
  entries: readonly { spec: FieldKitSpec; kit: FieldKitSelection }[]
): string | null {
  const obj = parseProfileObject(existing)
  for (const { spec, kit } of entries) {
    const clean = sanitizeFieldKit(spec, kit)
    if (fieldKitHasSelection(spec, clean)) {
      obj[spec.key] = clean
    } else {
      delete obj[spec.key]
    }
  }
  if (Object.keys(obj).length === 0) return null
  return JSON.stringify(obj)
}

export function setFieldKitPart(
  spec: FieldKitSpec,
  kit: FieldKitSelection,
  part: string,
  id: string | null | undefined
): FieldKitSelection {
  const next = { ...kit }
  if (!id || !getFieldKitTemplate(spec, part, id)) {
    delete next[part]
  } else {
    next[part] = id
  }
  return next
}

function collectAura(spec: FieldKitSpec, kit: FieldKitSelection, locale: string): string {
  const seen = new Set<string>()
  const words: string[] = []
  const zh = isChineseLocale(locale)
  for (const part of spec.parts) {
    const def = getFieldKitTemplate(spec, part, kit[part])
    if (!def || spec.skipAssemble?.(def)) continue
    const kws = zh ? def.keywordsZh : def.keywordsEn
    for (const k of kws) {
      if (seen.has(k)) continue
      seen.add(k)
      words.push(k)
      if (words.length >= 6) return words.join(zh ? '、' : ', ')
    }
  }
  return words.join(zh ? '、' : ', ')
}

function clauseFor(
  spec: FieldKitSpec,
  def: FieldKitTemplate,
  locale: string
): string | null {
  if (spec.skipAssemble?.(def)) return null
  const partLabel = fieldKitPartLabel(spec, def.part, locale)
  if (spec.assembleMode === 'rules') {
    const kind = spec.ruleKind?.[def.part as keyof typeof spec.ruleKind] ?? 'must'
    if (isChineseLocale(locale)) {
      const tag = kind === 'mustNot' ? '【禁止】' : '【必須】'
      const en = def.promptBlock.trim()
      return en
        ? `${tag}${partLabel}：${def.labelZh}，${def.structureZh}（${en}）`
        : `${tag}${partLabel}：${def.labelZh}，${def.structureZh}`
    }
    const tag = kind === 'mustNot' ? '[MUST NOT]' : '[MUST]'
    return `${tag} ${partLabel}: ${def.labelEn}, ${def.promptBlock || def.structureEn}`
  }
  if (isChineseLocale(locale)) {
    const en = def.promptBlock.trim()
    return en
      ? `${partLabel}：${def.labelZh}，${def.structureZh}（${en}）`
      : `${partLabel}：${def.labelZh}，${def.structureZh}`
  }
  return `${partLabel}: ${def.labelEn}, ${def.promptBlock || def.structureEn}`
}

export function assembleFieldKitPrompt(
  spec: FieldKitSpec,
  kit: FieldKitSelection,
  locale: string = 'zh-HK'
): string {
  const clean = sanitizeFieldKit(spec, kit)
  const loc = coerceUiLanguage(locale)
  const parts: string[] = []
  for (const part of spec.parts) {
    const def = getFieldKitTemplate(spec, part, clean[part])
    if (!def) continue
    const clause = clauseFor(spec, def, loc)
    if (clause) parts.push(clause)
  }
  if (spec.includeAura) {
    const aura = collectAura(spec, clean, loc)
    if (aura) {
      const label = fieldKitPartLabel(spec, 'aura', loc)
      parts.push(isChineseLocale(loc) ? `${label}：${aura}` : `${label}: ${aura}`)
    }
  }
  const notes = clean.notes?.trim()
  if (notes) {
    const label = fieldKitPartLabel(spec, 'notes', loc)
    const header = copyFor(spec, 'notes', loc)
      ? label
      : isChineseLocale(loc)
        ? '備註'
        : 'Notes'
    parts.push(isChineseLocale(loc) ? `${header}：${notes}` : `${header}: ${notes}`)
  }
  if (parts.length === 0) return ''
  if (spec.assembleMode === 'rules') {
    return parts.join('\n')
  }
  return isChineseLocale(loc) ? `${parts.join('。')}。` : `${parts.join('. ')}.`
}

export function defineFieldKit<P extends string>(
  spec: Omit<FieldKitSpec<P>, 'templates'> & {
    templates?: readonly FieldKitTemplate[]
    rows?: Record<P, readonly FieldKitRow[]>
  }
): FieldKitSpec<P> {
  const templates =
    spec.templates ??
    Object.entries(spec.rows ?? {}).flatMap(([part, rows]) =>
      packFieldKitRows(part, rows as FieldKitRow[])
    )
  return {
    ...spec,
    templates
  } as FieldKitSpec<P>
}
