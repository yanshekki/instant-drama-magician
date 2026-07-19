import { describe, expect, it } from 'vitest'
import * as Mod from './generateVideoStill'

describe('generateVideoStill', () => {
  it('exports helpers', () => {
    expect(Object.keys(Mod).length).toBeGreaterThan(0)
  })
})
