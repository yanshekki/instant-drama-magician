import { describe, expect, it } from 'vitest'
import {
  DESKTOP_CHANNEL_NAMES,
  CORE_CHANNELS,
  specFor,
  toOpenAiTools
} from './channelManifest'

describe('channelManifest', () => {
  it('has 183 desktop channels unique', () => {
    expect(DESKTOP_CHANNEL_NAMES.length).toBe(183)
    expect(new Set(DESKTOP_CHANNEL_NAMES).size).toBe(183)
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

  it('scenes:aiFill argsHint documents plot-suggest fields', () => {
    const s = specFor('scenes:aiFill')
    expect(s.argsHint).toContain('suggestFromStory')
    expect(s.argsHint).toContain('segmentKeys')
    expect(s.argsHint).toContain('chapter:<id>')
    expect(s.argsHint).toContain('beat:<id>')
  })
})
