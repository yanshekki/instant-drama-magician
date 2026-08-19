import { describe, expect, it } from 'vitest'
import { collageFilterComplex } from './identityCollageLayout'

describe('identityCollageLayout', () => {
  it('returns null for fewer than two stills', () => {
    expect(collageFilterComplex(0)).toBeNull()
    expect(collageFilterComplex(1)).toBeNull()
  })

  it('builds hstack / 2x2 filters', () => {
    expect(collageFilterComplex(2)).toMatch(/hstack=inputs=2/)
    expect(collageFilterComplex(3)).toMatch(/vstack=inputs=2/)
    expect(collageFilterComplex(4)).toMatch(/hstack=inputs=2\[top\]/)
  })
})
