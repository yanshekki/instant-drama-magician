import { describe, expect, it } from 'vitest'
import type { HandlerHost } from './HandlerHost'

describe('HandlerHost type contract', () => {
  it('documents required fields via structural check', () => {
    const sample: Pick<
      HandlerHost,
      'mode' | 'userData' | 'mediaRoot' | 'appVersion'
    > = {
      mode: 'headless',
      userData: '/tmp',
      mediaRoot: '/tmp/m',
      appVersion: '1'
    }
    expect(sample.mode).toBe('headless')
  })
})
