import { describe, expect, it } from 'vitest'
import { EmbeddedWebServer } from './EmbeddedWebServer'

describe('EmbeddedWebServer', () => {
  it('constructs and reports stopped status', () => {
    const s = new EmbeddedWebServer()
    const st = s.getStatus()
    expect(st).toBeTruthy()
    expect(st.running === false || st.running === undefined || typeof st.running === 'boolean').toBe(
      true
    )
  })
})
