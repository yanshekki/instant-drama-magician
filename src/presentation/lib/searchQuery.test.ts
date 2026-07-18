import { describe, expect, it } from 'vitest'
import { matchesSearchQuery, splitSearchTokens } from './searchQuery'

describe('splitSearchTokens', () => {
  it('returns empty for blank', () => {
    expect(splitSearchTokens('')).toEqual([])
    expect(splitSearchTokens('   ')).toEqual([])
  })

  it('splits on spaces and fullwidth space', () => {
    expect(splitSearchTokens('雨 夜')).toEqual(['雨', '夜'])
    expect(splitSearchTokens('雨　夜')).toEqual(['雨', '夜'])
  })

  it('splits on | and fullwidth ｜', () => {
    expect(splitSearchTokens('雨|夜')).toEqual(['雨', '夜'])
    expect(splitSearchTokens('雨｜夜')).toEqual(['雨', '夜'])
  })

  it('splits on commas ，、', () => {
    expect(splitSearchTokens('PVC,金屬')).toEqual(['pvc', '金屬'])
    expect(splitSearchTokens('PVC，金屬')).toEqual(['pvc', '金屬'])
    expect(splitSearchTokens('a、b')).toEqual(['a', 'b'])
  })

  it('mixed separators', () => {
    expect(splitSearchTokens('雨 夜|便利,店')).toEqual([
      '雨',
      '夜',
      '便利',
      '店'
    ])
  })
})

describe('matchesSearchQuery', () => {
  const hay = '城中舊區街角便利店 雨夜 透明PVC傘'

  it('empty query matches all', () => {
    expect(matchesSearchQuery(hay, '')).toBe(true)
  })

  it('single token', () => {
    expect(matchesSearchQuery(hay, '便利')).toBe(true)
    expect(matchesSearchQuery(hay, '公園')).toBe(false)
  })

  it('AND across tokens', () => {
    expect(matchesSearchQuery(hay, '雨 便利')).toBe(true)
    expect(matchesSearchQuery(hay, '雨|PVC')).toBe(true)
    expect(matchesSearchQuery(hay, '雨 公園')).toBe(false)
  })

  it('case insensitive for latin', () => {
    expect(matchesSearchQuery(hay, 'pvc')).toBe(true)
    expect(matchesSearchQuery(hay, 'PVC')).toBe(true)
  })
})
