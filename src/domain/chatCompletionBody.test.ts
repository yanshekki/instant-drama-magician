import { describe, expect, it } from 'vitest'
import {
  buildChatCompletionBody,
  rewriteVisionContentForGrokGateway,
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

  it('rewrites OpenAI image_url data URLs to Grok ACP image blocks when omitSampling', () => {
    const dataUrl = 'data:image/png;base64,aaaBBB'
    const body = buildChatCompletionBody({
      model: 'grok-4.5',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'describe' },
            { type: 'image_url', image_url: { url: dataUrl } }
          ]
        }
      ],
      max_tokens: 64,
      omitSampling: true
    })
    const parts = body.messages[0].content as Array<Record<string, unknown>>
    expect(parts[0]).toEqual({ type: 'text', text: 'describe' })
    expect(parts[1]).toEqual({
      type: 'image',
      mimeType: 'image/png',
      data: 'aaaBBB'
    })
  })

  it('keeps OpenAI image_url when not omitSampling', () => {
    const dataUrl = 'data:image/png;base64,xyz'
    const body = buildChatCompletionBody({
      model: 'gpt-4o',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'hi' },
            { type: 'image_url', image_url: { url: dataUrl } }
          ]
        }
      ],
      omitSampling: false
    })
    expect(body.messages[0].content).toEqual([
      { type: 'text', text: 'hi' },
      { type: 'image_url', image_url: { url: dataUrl } }
    ])
  })

  it('rewriteVisionContentForGrokGateway handles plain string', () => {
    expect(rewriteVisionContentForGrokGateway('plain')).toBe('plain')
  })

  it('shouldOmitSampling for localhost legacy port and invalid url', () => {
    expect(
      shouldOmitSamplingForProvider('custom', 'http://localhost:39281/v1')
    ).toBe(true)
    expect(shouldOmitSamplingForProvider(undefined, 'not-a-url')).toBe(false)
  })

  it('rewrite drops invalid image_url data', () => {
    const parts = rewriteVisionContentForGrokGateway([
      { type: 'text', text: 't' },
      { type: 'image_url', image_url: { url: 'http://example.com/a.png' } },
      { type: 'image_url', image_url: { url: 'data:image/png;base64,xx' } }
    ] as never)
    expect(Array.isArray(parts)).toBe(true)
    if (!Array.isArray(parts)) return
    expect(parts.some((p) => p.type === 'image')).toBe(true)
  })

  it('includes top_p and stop when not omitting', () => {
    const body = buildChatCompletionBody({
      model: 'm',
      messages,
      top_p: 0.8,
      stop: ['END'],
      omitSampling: false
    })
    expect(body.top_p).toBe(0.8)
    expect(body.stop).toEqual(['END'])
  })
})
