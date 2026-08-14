import { describe, expect, it } from 'vitest'
import {
  NATIVE_COPY,
  NATIVE_COPY_KEYS,
  coerceNativeLang,
  nativeT
} from './nativeCopy'

describe('nativeCopy', () => {
  it('has every key in all ten languages', () => {
    for (const id of Object.keys(NATIVE_COPY) as Array<keyof typeof NATIVE_COPY>) {
      for (const key of NATIVE_COPY_KEYS) {
        expect(NATIVE_COPY[id][key], `${id} ${key}`).toBeTypeOf('string')
        expect(NATIVE_COPY[id][key].length, `${id} ${key}`).toBeGreaterThan(0)
      }
    }
  })

  it('does not collapse ja / fr / ar to English menu copy', () => {
    expect(nativeT('ja', 'file')).toBe('ファイル')
    expect(nativeT('ja', 'file')).not.toBe(nativeT('en', 'file'))
    expect(nativeT('fr', 'exportComplete')).toMatch(/Export|terminé/i)
    expect(nativeT('fr', 'exportComplete')).not.toBe(nativeT('en', 'exportComplete'))
    expect(nativeT('ar', 'ok')).not.toBe(nativeT('en', 'ok'))
    expect(nativeT('zh-CN', 'file')).toMatch(/档/)
  })

  it('interpolates and maps aliases', () => {
    expect(coerceNativeLang('ja-JP')).toBe('ja')
    expect(coerceNativeLang(null)).toBe('zh-HK')
    expect(nativeT('en', 'exportSaved', { path: '/tmp/a.zip' })).toContain(
      '/tmp/a.zip'
    )
    expect(nativeT('zh-HK', 'updateStatus', { status: 'ok', channel: 'dev' })).toMatch(
      /ok/
    )
  })
})
