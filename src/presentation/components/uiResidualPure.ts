/**
 * Pure helpers for sticky UI residual branches (Gallery, Language, ImageGen, VideoPrep).
 */

export function dragOverMove(e: {
  preventDefault: () => void
  dataTransfer: { dropEffect: string }
}): void {
  e.preventDefault()
  e.dataTransfer.dropEffect = 'move'
}

/** After drag, ignore the synthetic click. Returns whether to ignore. */
export function consumeMovedClick(moved: boolean): boolean {
  return moved
}

export function toggleLanguageCode(
  value: string[],
  code: string
): string[] {
  if (value.includes(code)) return value.filter((c) => c !== code)
  return [...value, code]
}

export function shouldCancelModal(key: string, busy: boolean): boolean {
  return key === 'Escape' && !busy
}

export function shouldCancelOnBackdropClick(busy: boolean): boolean {
  return !busy
}

export function canSubmitRegenNotes(
  notes: string,
  hasDraft: boolean
): boolean {
  return Boolean(notes.trim() && hasDraft)
}

export function attachPlayStart(opts: {
  readyState: number
  start: () => void
  addEventListener: (ev: string, cb: () => void) => void
  removeEventListener: (ev: string, cb: () => void) => void
  load: () => void
}): (() => void) | undefined {
  if (opts.readyState >= 2) {
    opts.start()
    return undefined
  }
  const onCanPlay = (): void => {
    opts.removeEventListener('canplay', onCanPlay)
    opts.start()
  }
  opts.addEventListener('canplay', onCanPlay)
  opts.load()
  return () => opts.removeEventListener('canplay', onCanPlay)
}

export function emptyStringBranch(cond: boolean): string {
  return cond ? 'yes' : ''
}

export function noIntroVideoToast(): 'noIntro' {
  return 'noIntro'
}

export function showMetaDims(
  showMeta: boolean,
  dims: string | null
): string | null {
  return showMeta && dims ? dims : null
}


export function wheelZoomDelta(deltaY: number, step = 0.25): number {
  return deltaY > 0 ? -step : step
}

export function preventWheel(e: {
  preventDefault: () => void
  stopPropagation: () => void
}): void {
  e.preventDefault()
  e.stopPropagation()
}
