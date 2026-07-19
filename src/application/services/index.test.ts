import { describe, expect, it } from 'vitest'
import * as services from './index'

describe('services index', () => {
  it('re-exports core services', () => {
    expect(services.StoryService).toBeTruthy()
    expect(services.CharacterService).toBeTruthy()
    expect(services.GenerationService).toBeTruthy()
  })
})
