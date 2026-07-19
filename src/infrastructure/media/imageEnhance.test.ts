import { describe, expect, it } from 'vitest'
import * as Mod from './imageEnhance'

describe('imageEnhance', () => {
  it('exports enhance helpers', () => {
    expect(Object.keys(Mod).length).toBeGreaterThan(0)
  })
})
