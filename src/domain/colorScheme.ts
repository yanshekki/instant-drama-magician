/** UI appearance preference. Default follows the OS. */
export type ColorSchemePref = 'system' | 'light' | 'dark'
export type ResolvedColorScheme = 'light' | 'dark'

export const COLOR_SCHEME_PREFS: readonly ColorSchemePref[] = [
  'system',
  'light',
  'dark'
] as const

export function isColorSchemePref(v: unknown): v is ColorSchemePref {
  return v === 'system' || v === 'light' || v === 'dark'
}

export function coerceColorScheme(
  v: unknown,
  fallback: ColorSchemePref = 'system'
): ColorSchemePref {
  return isColorSchemePref(v) ? v : fallback
}

export function resolveColorScheme(
  pref: ColorSchemePref
): ResolvedColorScheme {
  if (pref === 'light' || pref === 'dark') return pref
  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light'
  }
  return 'dark'
}

/**
 * Apply theme classes on <html>. Always sets theme-light or theme-dark
 * so CSS variables resolve without relying on media queries after boot.
 */
export function applyColorScheme(pref: ColorSchemePref): ResolvedColorScheme {
  const resolved = resolveColorScheme(pref)
  if (typeof document === 'undefined') return resolved
  const root = document.documentElement
  root.classList.remove('theme-light', 'theme-dark', 'dark', 'light')
  root.classList.add(resolved === 'dark' ? 'theme-dark' : 'theme-light')
  // Tailwind darkMode class alias
  if (resolved === 'dark') root.classList.add('dark')
  root.dataset.colorScheme = pref
  root.dataset.resolvedScheme = resolved
  root.style.colorScheme = resolved
  return resolved
}

/** Listen for OS theme changes (only meaningful when pref is system). */
export function watchSystemColorScheme(onChange: () => void): () => void {
  if (
    typeof window === 'undefined' ||
    typeof window.matchMedia !== 'function'
  ) {
    return () => undefined
  }
  const mq = window.matchMedia('(prefers-color-scheme: dark)')
  const handler = (): void => onChange()
  if (typeof mq.addEventListener === 'function') {
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }
  // Safari / older
  mq.addListener(handler)
  return () => mq.removeListener(handler)
}
