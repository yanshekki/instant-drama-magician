import { describe, expect, it } from 'vitest'
import { parseIpcError } from './ipc'

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
          message: 'bad'
        })}`
      )
    )
    expect(body.code).toBe('VALIDATION')
  })

  it('falls back for free text', () => {
    const body = parseIpcError(new Error('something exploded'))
    expect(body.message).toBeTruthy()
  })
})
