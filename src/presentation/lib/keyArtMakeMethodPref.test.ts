import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  KEY_ART_MAKE_METHOD_KEY,
  readKeyArtMakeMethod,
  writeKeyArtMakeMethod
} from './keyArtMakeMethodPref'

describe('keyArtMakeMethodPref', () => {
  const mem: Record<string, string> = {}
  afterEach(() => {
    for (const k of Object.keys(mem)) delete mem[k]
    vi.unstubAllGlobals()
  })

  it('defaults to fresh and persists edit', () => {
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => mem[k] ?? null,
      setItem: (k: string, v: string) => {
        mem[k] = v
      }
    })
    expect(readKeyArtMakeMethod()).toBe('fresh')
    writeKeyArtMakeMethod('edit')
    expect(mem[KEY_ART_MAKE_METHOD_KEY]).toBe('edit')
    expect(readKeyArtMakeMethod()).toBe('edit')
  })

  it('falls back when storage throws', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {
        throw new Error('blocked')
      }
    })
    expect(readKeyArtMakeMethod()).toBe('fresh')
    writeKeyArtMakeMethod('edit')
  })

  it('treats missing localStorage as fresh', () => {
    vi.stubGlobal('localStorage', undefined)
    expect(readKeyArtMakeMethod()).toBe('fresh')
    writeKeyArtMakeMethod('identity')
  })

  it('returns fresh when reading localStorage throws', () => {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get() {
        throw new Error('denied')
      }
    })
    expect(readKeyArtMakeMethod()).toBe('fresh')
    writeKeyArtMakeMethod('continue')
  })
})
