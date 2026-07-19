import { describe, expect, it } from 'vitest'
import * as domain from './index'

describe('domain index', () => {
  it('re-exports symbols', () => {
    expect(Object.keys(domain).length).toBeGreaterThan(0)
  })
})
