import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  COLOR_SCHEME_PREFS,
  applyColorScheme,
  coerceColorScheme,
  isColorSchemePref,
  resolveColorScheme,
  watchSystemColorScheme
} from './colorScheme'

describe('colorScheme', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    if (typeof document !== 'undefined') {
      document.documentElement.className = ''
      delete document.documentElement.dataset.colorScheme
      delete document.documentElement.dataset.resolvedScheme
      document.documentElement.style.colorScheme = ''
    }
  })

  it('lists prefs and type-guards', () => {
    expect(COLOR_SCHEME_PREFS).toEqual(['system', 'light', 'dark'])
    expect(isColorSchemePref('system')).toBe(true)
    expect(isColorSchemePref('light')).toBe(true)
    expect(isColorSchemePref('dark')).toBe(true)
    expect(isColorSchemePref('auto')).toBe(false)
    expect(isColorSchemePref(null)).toBe(false)
    expect(isColorSchemePref(1)).toBe(false)
  })

  it('coerces invalid to system (or custom fallback)', () => {
    expect(coerceColorScheme(undefined)).toBe('system')
    expect(coerceColorScheme('nope')).toBe('system')
    expect(coerceColorScheme('light')).toBe('light')
    expect(coerceColorScheme('dark')).toBe('dark')
    expect(coerceColorScheme('nope', 'dark')).toBe('dark')
  })

  it('resolves explicit prefs without media', () => {
    expect(resolveColorScheme('light')).toBe('light')
    expect(resolveColorScheme('dark')).toBe('dark')
  })

  it('resolves system via matchMedia when available', () => {
    vi.stubGlobal('window', {
      matchMedia: (q: string) => ({
        matches: q.includes('dark'),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn()
      })
    })
    expect(resolveColorScheme('system')).toBe('dark')

    vi.stubGlobal('window', {
      matchMedia: () => ({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn()
      })
    })
    expect(resolveColorScheme('system')).toBe('light')
  })

  it('falls back to dark when matchMedia missing', () => {
    vi.stubGlobal('window', {})
    expect(resolveColorScheme('system')).toBe('dark')
  })

  it('applyColorScheme sets document classes and datasets', () => {
    const classSet = new Set<string>()
    const root = {
      classList: {
        remove: (...names: string[]) => {
          for (const n of names) classSet.delete(n)
        },
        add: (...names: string[]) => {
          for (const n of names) classSet.add(n)
        },
        contains: (n: string) => classSet.has(n)
      },
      dataset: {} as Record<string, string>,
      style: { colorScheme: '' }
    }
    vi.stubGlobal('document', { documentElement: root })

    const resolved = applyColorScheme('dark')
    expect(resolved).toBe('dark')
    expect(root.classList.contains('theme-dark')).toBe(true)
    expect(root.classList.contains('dark')).toBe(true)
    expect(root.classList.contains('theme-light')).toBe(false)
    expect(root.dataset.colorScheme).toBe('dark')
    expect(root.dataset.resolvedScheme).toBe('dark')
    expect(root.style.colorScheme).toBe('dark')

    applyColorScheme('light')
    expect(root.classList.contains('theme-light')).toBe(true)
    expect(root.classList.contains('dark')).toBe(false)
    expect(root.dataset.resolvedScheme).toBe('light')
  })

  it('applyColorScheme returns resolved without document', () => {
    vi.stubGlobal('document', undefined)
    expect(applyColorScheme('light')).toBe('light')
  })

  it('watchSystemColorScheme uses addEventListener when present', () => {
    const addEventListener = vi.fn()
    const removeEventListener = vi.fn()
    vi.stubGlobal('window', {
      matchMedia: () => ({
        matches: false,
        addEventListener,
        removeEventListener,
        addListener: vi.fn(),
        removeListener: vi.fn()
      })
    })
    const onChange = vi.fn()
    const unsub = watchSystemColorScheme(onChange)
    expect(addEventListener).toHaveBeenCalledWith('change', expect.any(Function))
    const handler = addEventListener.mock.calls[0][1] as () => void
    handler()
    expect(onChange).toHaveBeenCalledTimes(1)
    unsub()
    expect(removeEventListener).toHaveBeenCalledWith('change', handler)
  })

  it('watchSystemColorScheme falls back to addListener (Safari)', () => {
    const addListener = vi.fn()
    const removeListener = vi.fn()
    vi.stubGlobal('window', {
      matchMedia: () => ({
        matches: true,
        addListener,
        removeListener
      })
    })
    const onChange = vi.fn()
    const unsub = watchSystemColorScheme(onChange)
    expect(addListener).toHaveBeenCalledWith(expect.any(Function))
    const handler = addListener.mock.calls[0][0] as () => void
    handler()
    expect(onChange).toHaveBeenCalledTimes(1)
    unsub()
    expect(removeListener).toHaveBeenCalledWith(handler)
  })

  it('watchSystemColorScheme no-ops without window/matchMedia', () => {
    vi.stubGlobal('window', undefined)
    const unsub = watchSystemColorScheme(() => undefined)
    expect(typeof unsub).toBe('function')
    unsub()
  })
})
