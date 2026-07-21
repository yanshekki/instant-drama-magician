import { describe, expect, it } from 'vitest'
import {
  formatIpcError,
  invokeSafe,
  isRateLimitError,
  parseIpcError
} from './ipc'

describe('parseIpcError', () => {
  it('parses direct JSON body', () => {
    const body = parseIpcError(
      new Error(JSON.stringify({ code: 'NOT_FOUND', message: 'gone' }))
    )
    expect(body.code).toBe('NOT_FOUND')
    expect(body.message).toBe('gone')
  })

  it('parses electron wrapper message', () => {
    const body = parseIpcError(
      new Error(
        `Error invoking remote method 'x': Error: ${JSON.stringify({
          code: 'VALIDATION',
          message: 'bad',
          details: 'd'
        })}`
      )
    )
    expect(body.code).toBe('VALIDATION')
    expect(body.message).toBe('bad')
  })

  it('accepts plain string and maps rate limit', () => {
    expect(parseIpcError('429 rate limit').code).toBe('AI_RATE_LIMIT')
    expect(parseIpcError(42).message).toContain('42')
  })

  it('falls back for free text and strips prefix', () => {
    const body = parseIpcError(
      new Error(`Error invoking remote method 'foo': Error: something exploded`)
    )
    expect(body.code).toBe('INTERNAL')
    expect(body.message).toContain('something exploded')
  })

  it('formatIpcError includes details', () => {
    expect(
      formatIpcError(
        new Error(
          JSON.stringify({
            code: 'AI_FAILED',
            message: 'msg',
            details: 'hint'
          })
        )
      )
    ).toBe('msg — hint')
    expect(
      formatIpcError(
        new Error(JSON.stringify({ code: 'IO', message: 'only' }))
      )
    ).toBe('only')
  })

  it('isRateLimitError', () => {
    expect(
      isRateLimitError(
        new Error(JSON.stringify({ code: 'AI_RATE_LIMIT', message: 'x' }))
      )
    ).toBe(true)
    expect(isRateLimitError(new Error('nope'))).toBe(false)
  })

  it('invokeSafe ok and error', async () => {
    await expect(invokeSafe(async () => 7)).resolves.toEqual({
      ok: true,
      data: 7
    })
    const fail = await invokeSafe(async () => {
      throw new Error(JSON.stringify({ code: 'NOT_FOUND', message: 'x' }))
    })
    expect(fail.ok).toBe(false)
    if (!fail.ok) expect(fail.error.code).toBe('NOT_FOUND')
  })
})
