import { describe, expect, it } from 'vitest'
import {
  OPENAI_API_BASE_URL,
  applyLlmPreset,
  inferLlmPreset
} from './openaiCompatible'
import { GROK_GATEWAY_BASE_URL } from './gatewayDefaults'

describe('openaiCompatible presets', () => {
  const base = {
    llmProvider: 'custom' as const,
    baseUrl: 'http://example/v1',
    videoPath: 'http://example/v1/videos',
    model: 'x'
  }

  it('applies grok-gateway preset', () => {
    const s = applyLlmPreset(base, 'grok-gateway')
    expect(s.llmProvider).toBe('grok-gateway')
    expect(s.baseUrl).toBe(GROK_GATEWAY_BASE_URL)
    expect(s.videoPath).toContain('/videos')
  })

  it('applies openai preset', () => {
    const s = applyLlmPreset({ ...base, model: 'grok-4.5' }, 'openai')
    expect(s.baseUrl).toBe(OPENAI_API_BASE_URL)
    expect(s.model).toBe('gpt-4o-mini')
  })

  it('grok-gateway preset defaults model to grok-4.5', () => {
    const s = applyLlmPreset({ ...base, model: '' }, 'grok-gateway')
    expect(s.model).toBe('grok-4.5')
  })

  it('custom keeps urls', () => {
    const s = applyLlmPreset(base, 'custom')
    expect(s.baseUrl).toBe(base.baseUrl)
    expect(s.llmProvider).toBe('custom')
  })

  it('infers preset from base url', () => {
    expect(inferLlmPreset(GROK_GATEWAY_BASE_URL)).toBe('grok-gateway')
    expect(inferLlmPreset(OPENAI_API_BASE_URL)).toBe('openai')
    expect(inferLlmPreset('http://127.0.0.1:9000/v1')).toBe('custom')
  })
})
