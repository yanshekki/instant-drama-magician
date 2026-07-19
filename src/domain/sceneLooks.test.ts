import { describe, expect, it } from 'vitest'
import { parseSceneLooks } from './sceneLooks'

describe('parseSceneLooks', () => {
  it('returns empty for blank', () => {
    expect(parseSceneLooks(null)).toEqual([])
    expect(parseSceneLooks('')).toEqual([])
    expect(parseSceneLooks('not-json')).toEqual([])
  })

  it('parses valid looks and skips empty descriptions', () => {
    const json = JSON.stringify([
      { id: 'a', name: 'Night', description: 'neon rain' },
      { description: '' },
      { description: '  dawn mist  ' }
    ])
    const looks = parseSceneLooks(json)
    expect(looks).toHaveLength(2)
    expect(looks[0].id).toBe('a')
    expect(looks[1].description).toBe('dawn mist')
  })
})
