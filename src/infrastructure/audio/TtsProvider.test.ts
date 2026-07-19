import { describe, expect, it } from 'vitest'
import * as Mod from './TtsProvider'

describe('TtsProvider', () => {
  it('exports provider', () => {
    expect(Object.keys(Mod).length).toBeGreaterThan(0)
  })
})
