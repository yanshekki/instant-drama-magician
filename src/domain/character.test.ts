import { describe, expect, it } from 'vitest'
import {
  extractDescriptionFromSoulMd,
  extractNameFromSoulMd,
  isSoulMdPath,
  validateCharacterName
} from './character'

describe('character domain', () => {
  it('extracts name from first heading', () => {
    expect(extractNameFromSoulMd('# 阿明\n\nA street vendor.')).toBe('阿明')
  })

  it('extracts description body', () => {
    const md = '# Name\n\nFirst paragraph here.\n\nSecond.'
    expect(extractDescriptionFromSoulMd(md)).toContain('First paragraph')
  })

  it('validates name', () => {
    expect(validateCharacterName('')).toMatch(/required/)
    expect(validateCharacterName('OK')).toBeNull()
  })

  it('checks soul.md path', () => {
    expect(isSoulMdPath('/tmp/soul.md')).toBe(true)
    expect(isSoulMdPath('/tmp/x.txt')).toBe(false)
  })
})
