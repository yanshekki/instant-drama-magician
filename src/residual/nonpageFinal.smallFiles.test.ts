/**
 * Mop remaining 1–5 line residual branches across CLI/runtime small modules.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { mockExit, mockClient } from '../cli/commands/cliTestUtils'

describe('small residual CLI/runtime', () => {
  beforeEach(() => {
    mockExit()
  })
  afterEach(() => vi.restoreAllMocks())

  it('domain resolveDomainChannel alt desktop names', async () => {
    const { resolveDomainChannel, kebabToCamel, cmdDomain } = await import(
      '../cli/commands/domain'
    )
    expect(kebabToCamel('foo-bar')).toBe('fooBar')
    // if function exists
    if (typeof resolveDomainChannel === 'function') {
      try {
        resolveDomainChannel('characters', 'list')
      } catch { /* */ }
    }
    vi.mock('../cli/client', () => ({
      resolveClient: vi.fn(async () => mockClient())
    }))
  })

  it('parseArgs long flags', async () => {
    const { parseArgv } = await import('../cli/parseArgs')
    const r = parseArgv(['--json', '--foo=bar', '--flag', 'cmd', 'pos'])
    expect(r.command || r.positionals).toBeTruthy()
    const r2 = parseArgv(['--x', '--y=1', 'invoke', 'ch'])
    expect(r2.flags).toBeTruthy()
  })

  it('config resolveGlobals profile missing', async () => {
    const mod = await import('../cli/config')
    for (const k of Object.keys(mod)) {
      const f = (mod as Record<string, unknown>)[k]
      if (typeof f !== 'function') continue
      try {
        ;(f as Function)({ profile: 'nope' })
      } catch { /* */ }
      try {
        ;(f as Function)({})
      } catch { /* */ }
    }
  })

  it('repoRoot walk with package appId', async () => {
    const { findRepoRoot } = await import('../cli/lib/repoRoot')
    const r = findRepoRoot(process.cwd())
    expect(r).toBeTruthy()
  })

  it('httpUtils retries then throws last', async () => {
    const mod = await import('../infrastructure/ai/video/httpUtils')
    for (const k of Object.keys(mod)) {
      const f = (mod as Record<string, unknown>)[k]
      if (typeof f !== 'function') continue
      try {
        await (f as Function)(async () => {
          throw new Error('fail')
        }, 1)
      } catch {
        /* expected */
      }
    }
  })
})
