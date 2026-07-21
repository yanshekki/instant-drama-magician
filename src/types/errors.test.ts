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

  it('maps missing key distinctly from rejected key', () => {
    const m = mapChatMessage('No API key — create gk_live_…')
    expect(m?.code).toBe('AI_UNAUTHORIZED')
    expect(m?.message).toBe('No API key')
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

  it('maps no_image_in_sandbox (image tool blocked or empty)', () => {
    const e = mapChatHttpStatus(
      502,
      'Grok finished but no image file was found in the sandbox. The image generation or edit tool may have failed or been blocked. (no_image_in_sandbox)'
    )
    expect(e.code).toBe('AI_FAILED')
    expect(e.details).toMatch(/IMAGE_NO_SANDBOX|imagesApi|base-layer|底衫/i)
  })

  it('maps 502 Grok CLI exited to stable i18n keys', () => {
    const e = mapChatHttpStatus(
      502,
      JSON.stringify({
        error: {
          message: 'Grok CLI exited with code 1',
          code: 'grok_error'
        }
      })
    )
    expect(e.code).toBe('AI_FAILED')
    expect(e.message).toBe('errors.grokCliFailed')
    expect(e.details).toBe('errors.grokCliFailedHint')
  })

  it('maps grok_error body via mapChatMessage', () => {
    const m = mapChatMessage('Grok CLI produced no stdout')
    expect(m?.code).toBe('AI_FAILED')
    expect(m?.message).toBe('errors.grokCliFailed')
  })
})
