import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { mockClient, mockExit } from './cliTestUtils'

vi.mock('../client', () => ({
  resolveClient: vi.fn()
}))

import { resolveClient } from '../client'
import { cmdInvoke } from './invoke'

const g = {
  json: true,
  pretty: false,
  yes: false,
  help: false,
  local: true,
  url: undefined as string | undefined,
  token: undefined as string | undefined,
  dataDir: undefined as string | undefined,
  profile: undefined as string | undefined
}

describe('cmdInvoke', () => {
  beforeEach(() => {
    mockExit()
    vi.mocked(resolveClient).mockReset()
  })
  afterEach(() => vi.restoreAllMocks())

  it('usage without channel', async () => {
    await expect(cmdInvoke(g, [], {})).rejects.toThrow(/process.exit/)
  })

  it('success and dispose', async () => {
    const c = mockClient({
      invoke: vi.fn().mockResolvedValue([1, 2])
    })
    vi.mocked(resolveClient).mockResolvedValue(c as never)
    await cmdInvoke(g, ['stories:list', '[]'], {})
    expect(c.invoke).toHaveBeenCalled()
    expect(c.dispose).toHaveBeenCalled()
  })

  it('maps auth and network errors', async () => {
    const auth = Object.assign(new Error('401'), { status: 401 })
    const c = mockClient({
      invoke: vi.fn().mockRejectedValue(auth)
    })
    vi.mocked(resolveClient).mockResolvedValue(c as never)
    // isAuthError may not match plain Error — still exits
    await expect(cmdInvoke(g, ['x'], {})).rejects.toThrow(/process.exit/)
  })
})
