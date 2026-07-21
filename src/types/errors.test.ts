import { describe, expect, it } from 'vitest'
import {
  AppError,
  isAppErrorBody,
  mapChatHttpStatus,
  mapChatMessage,
  mapHttpStatusToVideoError,
  mapVideoHttpMessage,
  toAppError
} from './errors'

describe('AppError', () => {
  it('serializes toJSON and toAppError paths', () => {
    const e = new AppError('VALIDATION', 'bad', 'more')
    expect(e.toJSON()).toEqual({
      code: 'VALIDATION',
      message: 'bad',
      details: 'more'
    })
    expect(toAppError(e)).toEqual(e.toJSON())
    expect(toAppError(new Error('Video API is disabled'))).toMatchObject({
      code: 'VIDEO_FEATURE_OFF'
    })
    expect(toAppError(new Error('ECONNREFUSED'))).toMatchObject({
      code: 'AI_UNAVAILABLE'
    })
    expect(toAppError(new Error('plain boom'))).toEqual({
      code: 'INTERNAL',
      message: 'plain boom'
    })
    expect(toAppError(123)).toEqual({ code: 'INTERNAL', message: '123' })
  })

  it('isAppErrorBody type guard', () => {
    expect(isAppErrorBody({ code: 'IO', message: 'x' })).toBe(true)
    expect(isAppErrorBody(null)).toBe(false)
    expect(isAppErrorBody({})).toBe(false)
    expect(isAppErrorBody({ code: 1, message: 'x' })).toBe(false)
  })
})

describe('video error mapping', () => {
  it('maps feature disabled', () => {
    const m = mapVideoHttpMessage('Video API is disabled (videoApi)')
    expect(m?.code).toBe('VIDEO_FEATURE_OFF')
    expect(m?.message).toBe('errors.videoFeatureOff')
  })

  it('maps agent key requirement', () => {
    const m = mapVideoHttpMessage('requires agent-mode or admin API key')
    expect(m?.code).toBe('VIDEO_KEY_MODE')
    expect(m?.message).toBe('errors.videoKeyMode')
  })

  it('maps cancelled / aborted', () => {
    expect(mapVideoHttpMessage('cancelled')?.code).toBe('CANCELLED')
    expect(mapVideoHttpMessage('user cancelled')?.code).toBe('CANCELLED')
    expect(mapVideoHttpMessage('aborted')?.code).toBe('CANCELLED')
  })

  it('maps rate limit, timeout, job failed, gateway', () => {
    expect(mapVideoHttpMessage('429 rate limit')?.code).toBe('VIDEO_RATE_LIMIT')
    expect(mapVideoHttpMessage('Video job timed out after 300s')?.code).toBe(
      'VIDEO_TIMEOUT'
    )
    expect(mapVideoHttpMessage('status failed job failed')?.code).toBe(
      'VIDEO_JOB_FAILED'
    )
    expect(mapVideoHttpMessage('cannot reach gateway')?.code).toBe('AI_FAILED')
    expect(mapVideoHttpMessage('video http 500')?.code).toBe('AI_FAILED')
    expect(mapVideoHttpMessage('nothing special')).toBeNull()
  })

  it('maps http 401 and status codes via mapHttpStatusToVideoError', () => {
    const e = mapHttpStatusToVideoError(401, 'unauthorized')
    expect(e.code).toBe('VIDEO_UNAUTHORIZED')
    expect(e.message).toBe('errors.videoUnauthorized')

    // Body has no heuristic match — exercise raw status===401 branch
    const e401 = mapHttpStatusToVideoError(401, 'token rejected by peer')
    expect(e401.code).toBe('VIDEO_UNAUTHORIZED')
    expect(e401.details).toContain('token rejected')

    expect(mapHttpStatusToVideoError(403, 'nope').code).toBe('VIDEO_KEY_MODE')
    expect(
      mapHttpStatusToVideoError(403, 'requires agent-mode').code
    ).toBe('VIDEO_KEY_MODE')
    expect(mapHttpStatusToVideoError(429, 'slow').code).toBe('VIDEO_RATE_LIMIT')
    expect(mapHttpStatusToVideoError(500, 'weird').code).toBe('AI_FAILED')
    // message path wins
    expect(
      mapHttpStatusToVideoError(500, 'Video API is disabled').code
    ).toBe('VIDEO_FEATURE_OFF')

    // No body/status heuristics and prefixed message does not match either
    // (avoid "video http" / gateway / timeout tokens).
    const generic = mapHttpStatusToVideoError(418, 'teapot body only')
    expect(generic.code).toBe('AI_FAILED')
    expect(generic.message).toBe('errors.videoHttpFailed')
    expect(String(generic.details)).toMatch(/418/)
  })
})

describe('chat error mapping (Grok Gateway)', () => {
  it('maps unauthorized / 403 / 429 status', () => {
    expect(mapChatHttpStatus(401, 'invalid api key').code).toBe('AI_UNAUTHORIZED')
    expect(mapChatHttpStatus(403, 'forbidden').code).toBe('AI_KEY_MODE')
    expect(mapChatHttpStatus(429, 'too many').code).toBe('AI_RATE_LIMIT')
  })

  it('maps 502 Grok CLI / no_image_in_sandbox', () => {
    const e = mapChatHttpStatus(
      502,
      'Grok finished but no image file was found in the sandbox. The image generation or edit tool may have failed or been blocked. (no_image_in_sandbox)'
    )
    expect(e.code).toBe('AI_FAILED')
    expect(e.message).toBe('errors.imageNoSandbox')

    const cli = mapChatHttpStatus(
      502,
      JSON.stringify({ error: { message: 'Grok CLI exited with code 1' } })
    )
    expect(cli.message).toBe('errors.grokCliFailed')

    const e2big = mapChatHttpStatus(500, 'produced no stdout e2big')
    expect(e2big.message).toBe('errors.grokCliFailed')
  })

  it('maps message heuristics', () => {
    expect(mapChatMessage('No API key — create gk_live_…')?.message).toBe(
      'errors.noApiKey'
    )
    expect(mapChatMessage('fetch failed: ECONNREFUSED')?.code).toBe(
      'AI_UNAVAILABLE'
    )
    expect(mapChatMessage('401 unauthorized')?.code).toBe('AI_UNAUTHORIZED')
    expect(mapChatMessage('403 forbidden safe mode')?.code).toBe('AI_KEY_MODE')
    expect(mapChatMessage('429 rate limit')?.code).toBe('AI_RATE_LIMIT')
    expect(mapChatMessage('Grok CLI exited')?.message).toBe('errors.grokCliFailed')
    expect(
      mapChatMessage(
        'Sampling parameters (temperature/top_p/stop) are not supported by Grok CLI'
      )?.message
    ).toBe('errors.strictSamplingFailed')
    expect(mapChatMessage('imagesApi is disabled')?.message).toBe(
      'errors.imageApiDisabled'
    )
    expect(mapChatMessage('request timed out')?.message).toBe(
      'errors.chatTimedOut'
    )
    expect(mapChatMessage('Chat HTTP 500 validation_error')?.message).toBe(
      'errors.aiRequestFailed'
    )
    expect(mapChatMessage('unrelated')).toBeNull()
  })

  it('mapChatHttpStatus falls through to generic', () => {
    const e = mapChatHttpStatus(418, 'teapot')
    expect(e.code).toBe('AI_FAILED')
    // may be generic requestFailedHttp or mapped aiRequestFailed via body text
    expect(e.message).toMatch(/errors\./)
  })
})
