import { describe, expect, it } from 'vitest'
import { mapHttpStatusToVideoError, mapVideoHttpMessage } from './errors'

describe('video error mapping', () => {
  it('maps feature disabled', () => {
    const m = mapVideoHttpMessage('Video API is disabled (videoApi)')
    expect(m?.code).toBe('VIDEO_FEATURE_OFF')
  })

  it('maps agent key requirement', () => {
    const m = mapVideoHttpMessage('requires agent-mode or admin API key')
    expect(m?.code).toBe('VIDEO_KEY_MODE')
  })

  it('maps http 401', () => {
    const e = mapHttpStatusToVideoError(401, 'unauthorized')
    expect(e.code).toBe('VIDEO_UNAUTHORIZED')
  })

  it('maps timeout', () => {
    const m = mapVideoHttpMessage('Video job timed out after 300s')
    expect(m?.code).toBe('VIDEO_TIMEOUT')
  })
})
