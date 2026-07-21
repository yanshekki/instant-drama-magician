import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { mockClient, mockExit } from './cliTestUtils'

vi.mock('../client', () => ({
  resolveClient: vi.fn()
}))

import { resolveClient } from '../client'
import { cmdAi, cmdApp, cmdSettings, cmdStories } from './sugar'

const g = {
  json: true,
  pretty: false,
  yes: true,
  help: false,
  local: true
} as never

describe('cli sugar commands', () => {
  beforeEach(() => {
    mockExit()
    vi.mocked(resolveClient).mockResolvedValue(mockClient() as never)
  })
  afterEach(() => vi.restoreAllMocks())

  it('stories branches', async () => {
    await cmdStories(g, [], {})
    await cmdStories(g, ['list'], {})
    await cmdStories(g, ['get', 'id1'], {})
    await cmdStories(g, ['create'], { title: 'T' })
    await cmdStories(g, ['create', 'Named'], {})
    await cmdStories(g, ['delete', 'id1'], {})
    await cmdStories(g, ['seed-demo'], {})
    await cmdStories(g, ['seedDemo', 'en'], {})
    await expect(cmdStories(g, ['get'], {})).rejects.toThrow(/process.exit/)
    await expect(cmdStories(g, ['delete'], {})).rejects.toThrow(/process.exit/)
    await expect(
      cmdStories({ ...g, yes: false } as never, ['delete', 'x'], {})
    ).rejects.toThrow(/process.exit/)
    await expect(cmdStories(g, ['nope'], {})).rejects.toThrow(/process.exit/)
  })

  it('settings ai app', async () => {
    await cmdSettings(g, [], {})
    await cmdSettings(g, ['get'], {})
    await cmdSettings(g, ['set'], { json: '{"uiLanguage":"en"}' })
    await cmdSettings(g, ['set', 'uiLanguage', 'en'], {})
    await cmdSettings(g, ['set', 'n', '1'], {})
    await expect(cmdSettings(g, ['set', 'only'], {})).rejects.toThrow(
      /process.exit/
    )
    await expect(cmdSettings(g, ['bad'], {})).rejects.toThrow(/process.exit/)

    await cmdAi(g, [])
    await cmdAi(g, ['status'])
    await cmdAi(g, ['models'])
    await cmdAi(g, ['list-models'])
    await cmdAi(g, ['test-chat'])
    await cmdAi(g, ['testChat'])
    await expect(cmdAi(g, ['nope'])).rejects.toThrow(/process.exit/)

    await cmdApp(g, [])
    await cmdApp(g, ['info'])
    await expect(cmdApp(g, ['nope'])).rejects.toThrow(/process.exit/)
  })

  it('run failure path', async () => {
    vi.mocked(resolveClient).mockResolvedValue(
      mockClient({
        invoke: vi.fn().mockRejectedValue(new Error('boom'))
      }) as never
    )
    await expect(cmdStories(g, ['list'], {})).rejects.toThrow(/process.exit/)
  })
})
