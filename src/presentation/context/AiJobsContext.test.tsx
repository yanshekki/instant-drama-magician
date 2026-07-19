import { describe, expect, it } from 'vitest'
import * as Mod from './AiJobsContext'

describe('AiJobsContext module', () => {
  it('exports provider symbols', () => {
    expect(Object.keys(Mod).length).toBeGreaterThan(0)
  })
})
