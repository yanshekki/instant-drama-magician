import { describe, expect, it } from 'vitest'
import {
  LLM_PRESET_CATALOG,
  OPENAI_API_BASE_URL,
  applyLlmPreset,
  coerceLlmProviderPreset,
  getLlmPresetDef,
  imageCapablePresets,
  inferLlmPreset,
  isImageCapableProvider,
  isLlmProviderPreset,
  isSpecialChannelProvider,
  isVideoCapableProvider,
  llmPresetHintKey,
  providerCaps,
  providerDocsUrl,
  providerKeyOptional,
  supportsLocalAdmin,
  supportsOpenAiVideosPath,
  videoCapablePresets
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

  it('isLlmProviderPreset and getLlmPresetDef', () => {
    expect(isLlmProviderPreset('openai')).toBe(true)
    expect(isLlmProviderPreset('seedream')).toBe(false)
    expect(getLlmPresetDef('openai')?.baseUrl).toBe(OPENAI_API_BASE_URL)
    expect(getLlmPresetDef('nope' as never)).toBeUndefined()
  })

  it('infers more hosts and coerce defaults', () => {
    expect(inferLlmPreset('https://api.x.ai/v1')).toBe('xai')
    expect(inferLlmPreset('https://api.deepseek.com/v1')).toBe('deepseek')
    expect(inferLlmPreset('https://api.mistral.ai/v1')).toBe('mistral')
    expect(inferLlmPreset('http://127.0.0.1:1234/v1')).toBe('lmstudio')
    expect(coerceLlmProviderPreset(null as unknown as string)).toBe(
      'grok-gateway'
    )
    expect(coerceLlmProviderPreset('custom')).toBe('custom')
  })

  it('admin / docs / key optional helpers', () => {
    expect(supportsLocalAdmin('grok-gateway')).toBe(true)
    expect(supportsLocalAdmin('openai')).toBe(false)
    expect(supportsOpenAiVideosPath('grok-gateway')).toBe(true)
    expect(supportsOpenAiVideosPath('custom')).toBe(true)
    expect(supportsOpenAiVideosPath('openai')).toBe(false)
    expect(providerDocsUrl('openai')).toMatch(/openai/)
    expect(providerKeyOptional('ollama')).toBe(true)
    expect(providerKeyOptional('openai')).toBe(false)
    expect(llmPresetHintKey('openai')).toBeTruthy()
  })

  it('image/video capable filters and special channels', () => {
    expect(imageCapablePresets().every((p) => p.caps.image)).toBe(true)
    expect(videoCapablePresets().every((p) => p.caps.video)).toBe(true)
    expect(isSpecialChannelProvider('seedance')).toBe(true)
    expect(isSpecialChannelProvider('openai')).toBe(false)
    expect(isImageCapableProvider('openai')).toBe(true)
    expect(isImageCapableProvider('seedream')).toBe(true)
    expect(isImageCapableProvider('openrouter')).toBe(false)
    expect(isVideoCapableProvider('seedance')).toBe(true)
    expect(isVideoCapableProvider('openai')).toBe(true)
    expect(isVideoCapableProvider('xai')).toBe(false)
  })

  it('applyLlmPreset keeps non-empty model when not grok for openai', () => {
    const s = applyLlmPreset(
      {
        llmProvider: 'custom',
        baseUrl: 'http://x',
        videoPath: 'http://x/videos',
        model: 'my-custom-model'
      },
      'deepseek'
    )
    expect(s.model).toBe('my-custom-model')
    expect(s.baseUrl).toMatch(/deepseek/)
  })

  it('modelLooksForeign resets foreign models for kimi/openai/ollama/xai', () => {
    expect(
      applyLlmPreset(
        {
          llmProvider: 'custom',
          baseUrl: 'x',
          videoPath: 'x',
          model: 'gpt-4o'
        },
        'kimi'
      ).model
    ).not.toBe('gpt-4o')
    expect(
      applyLlmPreset(
        {
          llmProvider: 'custom',
          baseUrl: 'x',
          videoPath: 'x',
          model: 'grok-4.5'
        },
        'openai'
      ).model
    ).toBe('gpt-4o-mini')
    expect(
      applyLlmPreset(
        {
          llmProvider: 'custom',
          baseUrl: 'x',
          videoPath: 'x',
          model: 'gpt-4o'
        },
        'ollama'
      ).model
    ).not.toBe('gpt-4o')
    expect(
      applyLlmPreset(
        {
          llmProvider: 'custom',
          baseUrl: 'x',
          videoPath: 'x',
          model: 'gpt-4o'
        },
        'xai'
      ).model
    ).not.toBe('gpt-4o')
  })

  it('providerCaps fallback for unknown preset id cast', () => {
    expect(providerCaps('not-real' as never)).toEqual({
      chat: true,
      image: false,
      video: false
    })
    expect(providerDocsUrl('custom')).toBeTruthy()
  })
})

