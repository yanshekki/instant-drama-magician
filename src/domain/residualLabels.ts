/**
 * Pure locale/label helpers extracted for residual 100% line coverage.
 */

export function sceneLinkLabel(
  locale: string,
  sceneNumber: number,
  title: string | null | undefined,
  description: string
): string {
  const short = title || description.slice(0, 40)
  return locale === 'en'
    ? `Scene ${sceneNumber}: ${short}`
    : `第 ${sceneNumber} 場：${short}`
}

export function beatSegmentLabel(
  locale: string,
  order: number,
  who: string,
  where: string
): string {
  const tail = where ? ` @ ${where}` : ''
  return locale === 'en'
    ? `Beat ${order + 1} · ${who}${tail}`
    : `段落 ${order + 1} · ${who}${tail}`
}

export function unknownCharacterName(locale: string): string {
  return locale === 'en' ? 'Unknown' : '未指定'
}

export function defaultStoryTitle(locale: string): string {
  return locale === 'en' ? 'Story' : '故事'
}

export function whereFromScene(scene: {
  title?: string | null
  description?: string | null
} | null | undefined): string {
  return (
    scene?.title ||
    scene?.description?.slice(0, 40) ||
    ''
  )
}

export function locationSnippet(
  hasSceneDesc: boolean,
  description: string
): string {
  return hasSceneDesc ? `Location: ${description}` : ''
}

export function imageSizeForClass(
  sizeClass: string,
  sizes: { tall: string; square: string; wide: string }
): string {
  if (sizeClass === 'tall') return sizes.tall
  if (sizeClass === 'square') return sizes.square
  return sizes.wide
}

export function imageSizeForAspect(
  aspectRatio: string,
  sizes: { tall: string; wide: string }
): string {
  return aspectRatio === '9:16' ? sizes.tall : sizes.wide
}

export function defaultDuration(seconds: number | null | undefined): number {
  return seconds != null ? seconds : 6
}

export function draftHasNameOrDescription(draft: {
  name?: string | null
  description?: string | null
}): boolean {
  return Boolean(
    (draft.name && draft.name.trim()) ||
      (draft.description && draft.description.trim())
  )
}

export function mergeCostumeRaw(
  text: string,
  costumeRaw: string | null | undefined
): string {
  return costumeRaw ? `${text}\n---missing-fill---\n${costumeRaw}` : text
}

export function aspectOrDefault(
  aspectRatio: string | null | undefined
): string {
  return aspectRatio ? aspectRatio : '16:9'
}

export function multiActionBoundNote(
  actionsBound: Array<{ name: string }>
): string | null {
  return actionsBound.length
    ? `Motion / action library (perform as instructed): ${actionsBound.map((a) => a.name).join(', ')}.`
    : null
}

export function errorMessageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export function squareOrDefault(size: string | null | undefined): string {
  return size || '1024x1024'
}

export function clipEndSeconds(d: {
  startSeconds: number
  endSeconds?: number | null
}): number {
  return d.endSeconds ?? d.startSeconds + 4
}

export function multiSubjectClipNote(opts: {
  charNames: string[]
  sceneLabels: string[]
  propNames: string[]
}): string | null {
  const { charNames, sceneLabels, propNames } = opts
  if (charNames.length <= 1 && sceneLabels.length <= 1 && propNames.length <= 1) {
    return null
  }
  return [
    'MULTI-SUBJECT CLIP:',
    charNames.length
      ? `Characters (primary first): ${charNames.join(', ')}.`
      : null,
    sceneLabels.length > 1 ? `Locations: ${sceneLabels.join(' | ')}.` : null,
    propNames.length > 1 ? `Props: ${propNames.join(', ')}.` : null,
    'Keep all listed subjects visible/consistent; primary character is the action focus.'
  ]
    .filter(Boolean)
    .join(' ')
}

export function appearanceOrDescription(
  appearance: string | null | undefined,
  description: string | null | undefined
): string | undefined {
  return (appearance ?? description) || undefined
}

export function onlineChipClass(online: boolean): string {
  return online
    ? 'bg-emerald-950/80 text-emerald-200 ring-1 ring-emerald-700/40'
    : 'bg-ink-800 text-ink-500 ring-1 ring-ink-700/60'
}

export function dragTransition(active: boolean): string {
  return active ? 'none' : 'transform 0.08s ease-out'
}

export function providerTitle(
  provider: string,
  sameAsLlm: string,
  llmTitle: string
): string {
  return provider === sameAsLlm ? llmTitle : provider
}

export function llmPresetTitle(
  isCustom: boolean,
  presetTitle: string,
  customLabel: string
): string {
  return isCustom ? customLabel : presetTitle
}

/** Continuity badge key from materials summary, or null. */
export function continuityBadgeKey(
  materialsSummary: string
): 'locked' | 'textOnly' | 'firstBeat' | null {
  if (/continuity:\s*LOCKED/i.test(materialsSummary)) return 'locked'
  if (/continuity:\s*text only/i.test(materialsSummary)) return 'textOnly'
  if (/continuity:\s*first beat/i.test(materialsSummary)) return 'firstBeat'
  return null
}

export function shouldAutoCreateVideoPrep(
  phase: string,
  resumeDraft?: boolean
): boolean {
  if (resumeDraft) return false
  return phase === 'loading-extract' || phase === 'loading-materials'
}

export function patchIfRequestIdMatch<T extends { requestId: string }>(
  prev: T | null,
  requestId: string,
  patch: Partial<T>
): T | null {
  return prev && prev.requestId === requestId ? { ...prev, ...patch } : prev
}

/** Throw if export output file is missing after ffmpeg run. */
export function assertFfmpegOutputExists(
  outputPath: string,
  exists: (p: string) => boolean,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  AppErrorCtor: new (code: any, key: string) => Error
): void {
  if (!exists(outputPath)) {
    throw new AppErrorCtor('FFMPEG_FAILED', 'errors.ffmpegExportMissing')
  }
}

/** System theme callback: only sync when preference is system. */
export function onSystemSchemeChange(
  pref: string,
  syncTheme: () => void
): void {
  if (pref === 'system') syncTheme()
}


/** Empty catch body for residual-safe defensive catches. */
export function swallow(_e?: unknown): void {
  void _e
}


export function maybeAppendMultiRef(
  prompt: string,
  refList: unknown[],
  locale: string,
  append: (p: string, refs: unknown[], loc: string) => string
): string {
  if (refList.length > 1) return append(prompt, refList, locale)
  return prompt
}
