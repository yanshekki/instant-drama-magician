import { describe, expect, it } from 'vitest'
import {
  mapChatHttpStatus,
  mapChatMessage,
  mapHttpStatusToVideoError,
  mapVideoHttpMessage
} from './errors'

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

describe('chat error mapping (Grok Gateway)', () => {
  it('maps unauthorized', () => {
    const e = mapChatHttpStatus(401, 'invalid api key')
    expect(e.code).toBe('AI_UNAUTHORIZED')
  })

  it('maps rate limit', () => {
    const e = mapChatHttpStatus(429, 'too many')
    expect(e.code).toBe('AI_RATE_LIMIT')
  })

  it('maps connection refused message', () => {
    const m = mapChatMessage('fetch failed: ECONNREFUSED')
    expect(m?.code).toBe('AI_UNAVAILABLE')
  })

  it('maps strictSampling validation', () => {
    const m = mapChatMessage(
      'Sampling parameters (temperature/top_p/stop) are not supported by Grok CLI'
    )
    expect(m?.code).toBe('AI_FAILED')
    expect(m?.details).toMatch(/strictSampling/i)
  })
})
