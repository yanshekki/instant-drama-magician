import { describe, expect, it } from 'vitest'
import * as mod from './i18n'

describe('i18n module', () => {
  it('exports i18n instance or setup', () => {
    expect(Object.keys(mod).length).toBeGreaterThan(0)
  })
})
