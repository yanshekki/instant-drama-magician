import { describe, expect, it } from 'vitest'
import * as mod from './libraryToolbar'

describe('libraryToolbar', () => {
  it('exports tokens', () => {
    expect(Object.keys(mod).length).toBeGreaterThan(0)
  })
})
