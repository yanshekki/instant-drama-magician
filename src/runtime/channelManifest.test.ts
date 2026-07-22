import { describe, expect, it } from 'vitest'
import {
  DESKTOP_CHANNEL_NAMES,
  CORE_CHANNELS,
  specFor,
  toOpenAiTools
} from './channelManifest'

describe('channelManifest', () => {
  it('has 157 desktop channels unique', () => {
    expect(DESKTOP_CHANNEL_NAMES.length).toBe(157)
    expect(new Set(DESKTOP_CHANNEL_NAMES).size).toBe(157)
  })

  it('specFor returns description', () => {
    const s = specFor('stories:list')
    expect(s.channel).toBe('stories:list')
    expect(s.description.length).toBeGreaterThan(0)
  })

  it('toOpenAiTools produces tools for channels', () => {
    const tools = toOpenAiTools(['stories:list', 'ai:status'])
    expect(tools).toHaveLength(2)
    expect(tools[0].type).toBe('function')
    expect(tools[0].function.name).toMatch(/^idm_/)
  })

  it('CORE_CHANNELS are subset of desktop names', () => {
    const set = new Set(DESKTOP_CHANNEL_NAMES)
    for (const c of CORE_CHANNELS) {
      expect(set.has(c.channel)).toBe(true)
    }
  })

  it('specFor falls back for unknown channel', () => {
    const s = specFor('totally:unknown:channel')
    expect(s.channel).toBe('totally:unknown:channel')
    expect(s.description).toContain('totally:unknown:channel')
    expect(s.argsHint).toBe('[...args]')
  })
})
