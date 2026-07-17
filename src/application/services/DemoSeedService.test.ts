import { describe, expect, it } from 'vitest'
import { DemoSeedService } from './DemoSeedService'

/** Smoke: service constructs (DB tested manually / integration). */
describe('DemoSeedService', () => {
  it('is constructible', () => {
    const fake = {} as ConstructorParameters<typeof DemoSeedService>[0]
    expect(() => new DemoSeedService(fake)).not.toThrow()
  })
})
