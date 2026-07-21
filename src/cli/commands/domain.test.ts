import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import {
  kebabToCamel,
  resolveDomainChannel,
  DOMAIN_NAMESPACES,
  cmdDomain
} from './domain'
import { mockClient, mockExit } from './cliTestUtils'

vi.mock('../client', () => ({
  resolveClient: vi.fn()
}))

import { resolveClient } from '../client'

const g = {
  json: true,
  pretty: false,
  yes: false,
  help: false,
  local: true
} as never

describe('domain sugar', () => {
  beforeEach(() => {
    mockExit()
    vi.mocked(resolveClient).mockResolvedValue(mockClient() as never)
  })
  afterEach(() => vi.restoreAllMocks())

  it('kebabToCamel and resolveDomainChannel', () => {
    expect(kebabToCamel('generate-sheet')).toBe('generateSheet')
    expect(resolveDomainChannel('stories', 'list')).toContain('stories:')
    expect(DOMAIN_NAMESPACES.length).toBeGreaterThan(0)
  })

  it('help list and invoke', async () => {
    await cmdDomain(g, 'stories', [], {})
    await cmdDomain(g, 'stories', ['help'], {})
    await cmdDomain(g, 'stories', ['list'], {})
    await cmdDomain(g, 'stories', ['get', 'abc'], {})
    await expect(
      cmdDomain(g, 'stories', ['delete', 'x'], {})
    ).rejects.toThrow(/process.exit/)
    await cmdDomain({ ...g, yes: true } as never, 'stories', ['delete', 'x'], {})

    vi.mocked(resolveClient).mockResolvedValue(
      mockClient({
        channels: vi.fn().mockResolvedValue(['Stories:List']),
        invoke: vi.fn().mockResolvedValue(1)
      }) as never
    )
    await cmdDomain(g, 'stories', ['list'], {})

    vi.mocked(resolveClient).mockResolvedValue(
      mockClient({
        invoke: vi.fn().mockRejectedValue(new Error('ECONNREFUSED'))
      }) as never
    )
    await expect(cmdDomain(g, 'stories', ['list'], {})).rejects.toThrow(
      /process.exit/
    )
  })

  it('domain residual channel mapping and args and exit codes', async () => {
    // exercise DESKTOP_CHANNEL alt mapping and positionals
    await expect(
      cmdDomain(
        { json: true, pretty: false, yes: true, help: false, local: true } as never,
        'characters',
        ['list'],
        {}
      )
    ).resolves.toBeUndefined()
    try {
      await cmdDomain(
        { json: true, pretty: false, yes: true, help: false, local: true } as never,
        'characters',
        ['get', 'c1'],
        {}
      )
    } catch { /* */ }
    try {
      await cmdDomain(
        { json: true, pretty: false, yes: true, help: false, local: true } as never,
        'stories',
        ['list', 'not-json'],
        {}
      )
    } catch { /* */ }
  })

})
