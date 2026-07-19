import { describe, expect, it } from 'vitest'
import { CompositeVideoProvider } from './CompositeVideoProvider'

describe('CompositeVideoProvider', () => {
  it('constructs and probes (stub path when offline)', async () => {
    const p = new CompositeVideoProvider(
      'auto',
      'http://127.0.0.1:1',
      '',
      'test-model'
    )
    const st = await p.probe()
    expect(st).toHaveProperty('available')
    expect(p.id).toBe('composite')
  }, 15_000)
})
