import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { mockExit } from './cliTestUtils'
import { mkdtempSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

vi.mock('../config', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../config')>()
  return {
    ...actual,
    defaultConfigPath: () => join(tmpdir(), 'idm-cli-config-test.json'),
    loadConfigFile: vi.fn(() => ({ url: 'http://x' })),
    saveConfigFile: vi.fn((partial: object) => ({ ...partial }))
  }
})

import { cmdConfig } from './configCmd'

const g = { json: true, pretty: false, yes: false, help: false, local: true } as never

describe('cmdConfig', () => {
  let exitSpy: ReturnType<typeof mockExit>
  beforeEach(() => {
    exitSpy = mockExit()
  })
  afterEach(() => {
    exitSpy.mockRestore()
    vi.restoreAllMocks()
  })

  it('path get set and errors', async () => {
    await cmdConfig(g, ['path'])
    await cmdConfig({ ...g, json: false } as never, ['path'])
    await cmdConfig(g, ['get'])
    await cmdConfig({ ...g, json: false } as never, ['get'])
    await cmdConfig(g, ['set', 'url', 'http://y'])
    await cmdConfig({ ...g, json: false } as never, ['set', 'token', 't'])
    await expect(cmdConfig(g, ['set'])).rejects.toThrow(/process.exit/)
    await expect(cmdConfig(g, ['set', 'nope', 'x'])).rejects.toThrow(
      /process.exit/
    )
    await expect(cmdConfig(g, ['weird'])).rejects.toThrow(/process.exit/)
  })
})
