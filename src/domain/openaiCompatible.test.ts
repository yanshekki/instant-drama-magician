import { describe, expect, it } from 'vitest'
import {
  LLM_PRESET_CATALOG,
  OPENAI_API_BASE_URL,
  applyLlmPreset,
  coerceLlmProviderPreset,
  inferLlmPreset,
  providerCaps
} from './openaiCompatible'
import { GROK_GATEWAY_BASE_URL } from './gatewayDefaults'

describe('openaiCompatible presets', () => {
  const base = {
    llmProvider: 'custom' as const,
    baseUrl: 'http://example/v1',
    videoPath: 'http://example/v1/videos',
    model: 'x'
  }

  it('catalog has recommended + cloud + local + custom', () => {
    const ids = LLM_PRESET_CATALOG.map((p) => p.id)
    expect(ids).toContain('grok-gateway')
    expect(ids).toContain('openai')
    expect(ids).toContain('openrouter')
    expect(ids).toContain('groq')
    expect(ids).toContain('deepseek')
    expect(ids).toContain('ollama')
    expect(ids).toContain('custom')
    expect(ids.length).toBeGreaterThanOrEqual(10)
  })

  it('applies every non-custom preset with base URL + model', () => {
    for (const def of LLM_PRESET_CATALOG) {
      if (def.id === 'custom') continue
      const s = applyLlmPreset({ ...base, model: '' }, def.id)
      expect(s.llmProvider).toBe(def.id)
      expect(s.baseUrl).toBe(def.baseUrl)
      expect(s.model).toBe(def.defaultModel)
    }
  })

  it('applies openai preset and resets grok model', () => {
    const s = applyLlmPreset({ ...base, model: 'grok-4.5' }, 'openai')
    expect(s.baseUrl).toBe(OPENAI_API_BASE_URL)
    expect(s.model).toBe('gpt-4o-mini')
  })

  it('custom keeps urls', () => {
    const s = applyLlmPreset(base, 'custom')
    expect(s.baseUrl).toBe(base.baseUrl)
    expect(s.llmProvider).toBe('custom')
  })

  it('infers preset from base url', () => {
    expect(inferLlmPreset(GROK_GATEWAY_BASE_URL)).toBe('grok-gateway')
    expect(inferLlmPreset(OPENAI_API_BASE_URL)).toBe('openai')
    expect(inferLlmPreset('https://openrouter.ai/api/v1')).toBe('openrouter')
    expect(inferLlmPreset('https://api.groq.com/openai/v1')).toBe('groq')
    expect(inferLlmPreset('http://127.0.0.1:11434/v1')).toBe('ollama')
    expect(inferLlmPreset('http://127.0.0.1:9000/v1')).toBe('custom')
  })

  it('coerces unknown ids via base url', () => {
    expect(coerceLlmProviderPreset('not-a-real-id', OPENAI_API_BASE_URL)).toBe(
      'openai'
    )
    expect(coerceLlmProviderPreset('openai')).toBe('openai')
  })

  it('caps match app HTTP clients (images + /videos)', () => {
    expect(providerCaps('grok-gateway')).toEqual({
      chat: true,
      image: true,
      video: true
    })
    expect(providerCaps('openai')).toEqual({
      chat: true,
      image: true,
      video: true
    })
    expect(providerCaps('xai')).toEqual({
      chat: true,
      image: true,
      video: false
    })
    expect(providerCaps('together').image).toBe(true)
    expect(providerCaps('together').video).toBe(false)
    expect(providerCaps('openrouter').image).toBe(false)
    expect(providerCaps('ollama').video).toBe(false)
  })
})
