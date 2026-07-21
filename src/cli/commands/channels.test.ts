import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { mockClient, mockExit } from './cliTestUtils'

vi.mock('../client', () => ({
  resolveClient: vi.fn()
}))

import { resolveClient } from '../client'
import { cmdChannels } from './channels'

const g = {
  json: true,
  pretty: false,
  yes: false,
  help: false,
  local: true
} as never

describe('cmdChannels', () => {
  beforeEach(() => {
    mockExit()
    vi.mocked(resolveClient).mockReset()
  })
  afterEach(() => vi.restoreAllMocks())

  it('lists channels json and human', async () => {
    vi.mocked(resolveClient).mockResolvedValue(
      mockClient({
        channels: vi.fn().mockResolvedValue(['stories:list', 'ai:status'])
      }) as never
    )
    await cmdChannels(g, ['list'], {})
    await cmdChannels({ ...g, json: false } as never, [], { filter: 'stories' })
    await cmdChannels(g, [], { catalog: true, f: 'ai' })
  })

  it('describe channel', async () => {
    vi.mocked(resolveClient).mockResolvedValue(mockClient() as never)
    await cmdChannels(g, ['describe', 'stories:list'], {})
    await cmdChannels({ ...g, json: false } as never, ['describe', 'stories:list'], {})
    await expect(cmdChannels(g, ['describe'], {})).rejects.toThrow(/process.exit/)
  })

  it('catalog when client fails', async () => {
    vi.mocked(resolveClient).mockRejectedValue(new Error('down'))
    await cmdChannels(g, [], { catalog: true })
    await expect(cmdChannels(g, [], {})).rejects.toThrow(/process.exit/)
  })
})
