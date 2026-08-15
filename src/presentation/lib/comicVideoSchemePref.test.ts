import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  COMIC_VIDEO_SCHEME_KEY,
  readComicVideoScheme,
  writeComicVideoScheme
} from './comicVideoSchemePref'

describe('comicVideoSchemePref', () => {
  const mem: Record<string, string> = {}

  afterEach(() => {
    for (const k of Object.keys(mem)) delete mem[k]
    vi.unstubAllGlobals()
  })

  it('defaults to page and persists drama', () => {
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => mem[k] ?? null,
      setItem: (k: string, v: string) => {
        mem[k] = v
      },
      removeItem: (k: string) => {
        delete mem[k]
      }
    })
    expect(readComicVideoScheme()).toBe('page')
    writeComicVideoScheme('drama')
    expect(mem[COMIC_VIDEO_SCHEME_KEY]).toBe('drama')
    expect(readComicVideoScheme()).toBe('drama')
    writeComicVideoScheme('page')
    expect(readComicVideoScheme()).toBe('page')
  })

  it('falls back when localStorage is missing or throws', () => {
    vi.stubGlobal('localStorage', undefined)
    expect(readComicVideoScheme()).toBe('page')
    writeComicVideoScheme('drama')
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {
        throw new Error('blocked')
      }
    })
    expect(readComicVideoScheme()).toBe('page')
    writeComicVideoScheme('drama')
  })
})
