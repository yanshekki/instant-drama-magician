import { describe, expect, it } from 'vitest'
import { StubVideoProvider } from './StubVideoProvider'

describe('StubVideoProvider', () => {
  it('probe reports available stub or unavailable with message', async () => {
    const p = new StubVideoProvider()
    const st = await p.probe()
    expect(st).toHaveProperty('available')
    expect(typeof st.message === 'string' || st.message === undefined).toBe(
      true
    )
  })
})
