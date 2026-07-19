import { describe, expect, it } from 'vitest'
import type { VideoProvider } from './types'

describe('video types', () => {
  it('VideoProvider structural type is usable', () => {
    const mock: VideoProvider = {
      id: 'x',
      name: 'X',
      probe: async () => ({ id: 'x', available: false, message: 'n' }),
      generate: async () => ({ outputPath: '/tmp/a.mp4', degraded: true })
    }
    expect(mock.id).toBe('x')
  })
})
