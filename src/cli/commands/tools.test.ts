import { describe, expect, it } from 'vitest'
import { DESKTOP_CHANNEL_NAMES, toOpenAiTools } from '../../runtime/channelManifest'

describe('tools schema source', () => {
  it('openai tools cover all desktop channels', () => {
    const tools = toOpenAiTools(DESKTOP_CHANNEL_NAMES)
    expect(tools.length).toBe(137)
    const names = new Set(tools.map((t) => t.function.name))
    expect(names.size).toBe(137)
  })
})
