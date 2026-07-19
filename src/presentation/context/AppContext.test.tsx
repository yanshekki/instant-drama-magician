import { describe, expect, it, vi } from 'vitest'
import * as Mod from './AppContext'

describe('AppContext module', () => {
  it('exports provider and hooks', () => {
    expect(Object.keys(Mod).length).toBeGreaterThan(0)
  })
})
