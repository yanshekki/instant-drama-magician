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
