import { describe, expect, it } from 'vitest'
import {
  buildChatCompletionBody,
  shouldOmitSamplingForProvider
} from './chatCompletionBody'

describe('chatCompletionBody (Grok Gateway strictSampling)', () => {
  const messages = [{ role: 'user' as const, content: 'hi' }]

  it('omits temperature/top_p/stop when omitSampling', () => {
    const body = buildChatCompletionBody({
      model: 'grok-4.5',
      messages,
      max_tokens: 32,
      temperature: 0.7,
      top_p: 0.9,
      stop: 'END',
      omitSampling: true
    })
    expect(body).toEqual({
      model: 'grok-4.5',
      messages,
      max_tokens: 32
    })
    expect('temperature' in body).toBe(false)
    expect('top_p' in body).toBe(false)
    expect('stop' in body).toBe(false)
  })

  it('includes temperature when not omitting', () => {
    const body = buildChatCompletionBody({
      model: 'gpt-4o-mini',
      messages,
      temperature: 0.5,
      max_tokens: 100,
      omitSampling: false
    })
    expect(body.temperature).toBe(0.5)
    expect(body.max_tokens).toBe(100)
  })

  it('shouldOmitSampling for grok-gateway and local :3847', () => {
    expect(shouldOmitSamplingForProvider('grok-gateway', 'http://x/v1')).toBe(
      true
    )
    expect(
      shouldOmitSamplingForProvider('custom', 'http://127.0.0.1:3847/v1')
    ).toBe(true)
    expect(
      shouldOmitSamplingForProvider('openai', 'https://api.openai.com/v1')
    ).toBe(false)
  })
})
