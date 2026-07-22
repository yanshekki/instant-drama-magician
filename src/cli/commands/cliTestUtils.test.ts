import { describe, expect, it, vi, afterEach } from 'vitest'
import { mockClient, mockExit } from './cliTestUtils'

describe('cliTestUtils', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('mockExit throws process.exit codes', () => {
    const spy = mockExit()
    expect(() => process.exit(2)).toThrow(/process\.exit:2/)
    expect(spy).toHaveBeenCalledWith(2)
  })

  it('mockClient provides invoke and channels', async () => {
    const c = mockClient()
    expect(c.mode).toBe('local')
    await expect(c.invoke('stories:list', [])).resolves.toEqual({ ok: true })
    await expect(c.channels()).resolves.toContain('stories:list')
    expect(c.describe().mode).toBe('local')
    c.dispose()
    expect(c.dispose).toHaveBeenCalled()
  })

  it('mockClient accepts overrides', async () => {
    const invoke = vi.fn().mockResolvedValue({ custom: 1 })
    const c = mockClient({ invoke, mode: 'remote' })
    expect(c.mode).toBe('remote')
    await expect(c.invoke('x', [])).resolves.toEqual({ custom: 1 })
  })
})
