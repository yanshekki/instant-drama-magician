import { describe, expect, it } from 'vitest'
import {
  extractDescriptionFromSoulMd,
  extractNameFromSoulMd,
  isSoulMdPath,
  parseSoulMd,
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

  it('parses frontmatter and tags', () => {
    const doc = parseSoulMd(
      '---\nname: "Ming"\ntags: hero, kind\n---\n# 阿明\n\nA vendor.'
    )
    expect(doc.frontmatter.name).toBe('Ming')
    expect(doc.tags).toEqual(['hero', 'kind'])
    expect(doc.title).toBe('阿明')
  })
})
