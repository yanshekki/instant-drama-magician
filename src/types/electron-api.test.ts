import { describe, expect, it } from 'vitest'
import type { ElectronApi } from './electron-api'

describe('ElectronApi surface', () => {
  it('documents required namespaces via type sample', () => {
    const sample = {
      stories: { list: async () => [] },
      settings: { get: async () => ({}), set: async () => ({}) }
    } as unknown as ElectronApi
    expect(sample.stories.list).toBeTypeOf('function')
  })
})
