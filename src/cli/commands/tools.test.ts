import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { mockClient, mockExit } from './cliTestUtils'

vi.mock('../client', () => ({
  resolveClient: vi.fn()
}))

import { resolveClient } from '../client'
import { cmdTools } from './tools'

const g = {
  json: false,
  pretty: true,
  yes: false,
  help: false,
  local: true
} as never

describe('cmdTools', () => {
  beforeEach(() => {
    mockExit()
    vi.mocked(resolveClient).mockResolvedValue(
      mockClient({
        channels: vi.fn().mockResolvedValue(['stories:list'])
      }) as never
    )
  })
  afterEach(() => vi.restoreAllMocks())

  it('schema human and json formats', async () => {
    await cmdTools(g, ['schema'], {})
    await cmdTools({ ...g, json: true } as never, [], {})
    await cmdTools(g, ['schema'], { openai: true })
    await cmdTools(g, ['schema'], { anthropic: true })
    await cmdTools(g, ['schema'], { hermes: true })
    vi.mocked(resolveClient).mockRejectedValue(new Error('x'))
    await cmdTools(g, ['schema'], {})
  })

  it('call tool', async () => {
    vi.mocked(resolveClient).mockResolvedValue(mockClient() as never)
    await cmdTools(g, ['call', 'idm_stories_list'], { args: '[]' })
    await cmdTools(g, ['call', 'stories_list'], {})
    await cmdTools(g, ['call', 'solo'], {})
    await expect(cmdTools(g, ['call'], {})).rejects.toThrow(/process.exit/)
    vi.mocked(resolveClient).mockResolvedValue(
      mockClient({
        invoke: vi.fn().mockRejectedValue(new Error('e'))
      }) as never
    )
    await expect(
      cmdTools(g, ['call', 'idm_stories_list'], {})
    ).rejects.toThrow(/process.exit/)
    await expect(cmdTools(g, ['nope'], {})).rejects.toThrow(/process.exit/)
  })
})
