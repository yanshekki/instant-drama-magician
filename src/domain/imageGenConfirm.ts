/**
 * Shared helpers for reference-image generation confirm flow.
 * Multi-select paths: first path is identity edit base (API limit 1).
 */

export function resolveIdentityPaths(options: {
  useIdentityRef: boolean
  /** Ordered selected gallery paths (multi-select) */
  selectedPaths: string[]
}): { paths: string[]; primaryPath: string | null; useEdit: boolean } {
  const cleaned = options.selectedPaths
    .map((p) => (typeof p === 'string' ? p.trim() : ''))
    .filter(Boolean)
  if (!options.useIdentityRef || cleaned.length === 0) {
    return { paths: [], primaryPath: null, useEdit: false }
  }
  return {
    paths: cleaned,
    primaryPath: cleaned[0] ?? null,
    useEdit: true
  }
}

/** Append multi-ref note when more than one still selected for identity. */
export function appendMultiRefNote(
  prompt: string,
  paths: string[],
  locale: string = 'zh-HK'
): string {
  if (paths.length <= 1) return prompt
  const note =
    locale === 'en'
      ? `Additional identity stills selected (${paths.length - 1} more): keep object/subject identity consistent with all selected references; primary edit base is the first still.`
      : `另有 ${paths.length - 1} 張已選參考圖：主編輯底圖為第一張，其餘作身份一致輔助，勿換成另一物件／主體。`
  return `${prompt}\n\n${note}`
}

export function pickPrimaryRefPath(
  referenceImagePath?: string | null,
  referenceImagePaths?: string[] | null
): string | null {
  if (Array.isArray(referenceImagePaths)) {
    for (const p of referenceImagePaths) {
      const t = typeof p === 'string' ? p.trim() : ''
      if (t) return t
    }
  }
  if (typeof referenceImagePath === 'string' && referenceImagePath.trim()) {
    return referenceImagePath.trim()
  }
  return null
}

export function allRefPaths(
  referenceImagePath?: string | null,
  referenceImagePaths?: string[] | null
): string[] {
  const out: string[] = []
  if (typeof referenceImagePath === 'string' && referenceImagePath.trim()) {
    out.push(referenceImagePath.trim())
  }
  if (Array.isArray(referenceImagePaths)) {
    for (const p of referenceImagePaths) {
      const t = typeof p === 'string' ? p.trim() : ''
      if (t && !out.includes(t)) out.push(t)
    }
  }
  return out
}

/** Toggle id in multi-select list (primary becomes last toggled on). */
export function toggleGallerySelection(
  selectedIds: string[],
  id: string,
  opts?: { multi?: boolean }
): string[] {
  const multi = opts?.multi !== false
  if (!multi) return [id]
  if (selectedIds.includes(id)) {
    return selectedIds.filter((x) => x !== id)
  }
  return [...selectedIds, id]
}
