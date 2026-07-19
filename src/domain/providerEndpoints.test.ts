import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS, type AppSettings } from '../types/settings'
import {
  imageCapablePresets,
  videoCapablePresets
} from './openaiCompatible'
import {
  channelPresetBaseUrl,
  imageProviderOptions,
  resolveChatEndpoint,
  resolveImageEndpoint,
  resolveVideoEndpoint,
  videoProviderOptions
} from './providerEndpoints'
import { GROK_GATEWAY_BASE_URL, GROK_GATEWAY_VIDEO_PATH } from './gatewayDefaults'

function s(partial: Partial<AppSettings>): AppSettings {
  return { ...DEFAULT_SETTINGS, ...partial }
}

describe('resolveChatEndpoint', () => {
  it('uses baseUrl and apiKey from settings', () => {
    const ep = resolveChatEndpoint(
      s({ baseUrl: 'https://api.example.com/v1/', apiKey: 'k1', model: 'm1' })
    )
    expect(ep.baseUrl).toBe('https://api.example.com/v1')
    expect(ep.apiKey).toBe('k1')
    expect(ep.model).toBe('m1')
  })
})

describe('resolveImageEndpoint', () => {
  it('inherits chat when same-as-llm', () => {
    const chat = s({
      baseUrl: 'http://127.0.0.1:3847/v1',
      apiKey: 'gk',
      imageProvider: 'same-as-llm'
    })
    const ep = resolveImageEndpoint(chat)
    expect(ep.baseUrl).toBe(resolveChatEndpoint(chat).baseUrl)
    expect(ep.apiKey).toBe('gk')
  })

  it('uses dedicated image base and key', () => {
    const ep = resolveImageEndpoint(
      s({
        baseUrl: 'http://127.0.0.1:3847/v1',
        apiKey: 'chat-key',
        imageProvider: 'openai',
        imageBaseUrl: 'https://api.openai.com/v1',
        imageApiKey: 'sk-img'
      })
    )
    expect(ep.baseUrl).toBe('https://api.openai.com/v1')
    expect(ep.apiKey).toBe('sk-img')
  })

  it('fills OpenAI catalog base when imageBaseUrl empty', () => {
    const ep = resolveImageEndpoint(
      s({
        apiKey: 'sk-chat',
        imageProvider: 'openai',
        imageBaseUrl: '',
        imageApiKey: ''
      })
    )
    expect(ep.baseUrl).toBe('https://api.openai.com/v1')
    expect(ep.apiKey).toBe('sk-chat')
  })

  it('resolves xAI image preset (OpenAI-compat /images)', () => {
    const ep = resolveImageEndpoint(
      s({
        imageProvider: 'xai',
        imageBaseUrl: '',
        imageApiKey: 'xai-key'
      })
    )
    expect(ep.baseUrl).toBe('https://api.x.ai/v1')
    expect(ep.apiKey).toBe('xai-key')
  })

  it('resolves Together image preset', () => {
    const ep = resolveImageEndpoint(
      s({
        imageProvider: 'together',
        imageBaseUrl: '',
        imageApiKey: 'tg-key'
      })
    )
    expect(ep.baseUrl).toBe('https://api.together.xyz/v1')
    expect(ep.apiKey).toBe('tg-key')
  })
})

describe('resolveVideoEndpoint', () => {
  it('same-as-llm with grok gateway uses gateway path', () => {
    const ep = resolveVideoEndpoint(
      s({
        llmProvider: 'grok-gateway',
        baseUrl: GROK_GATEWAY_BASE_URL,
        apiKey: 'gk',
        videoProvider: 'same-as-llm',
        videoMode: 'auto'
      })
    )
    expect(ep.baseUrl).toBe(GROK_GATEWAY_BASE_URL)
    expect(ep.videoPath).toBe(GROK_GATEWAY_VIDEO_PATH)
    expect(ep.mode).toBe('auto')
    expect(ep.apiKey).toBe('gk')
  })

  it('stub forces stub mode', () => {
    const ep = resolveVideoEndpoint(s({ videoProvider: 'stub' }))
    expect(ep.mode).toBe('stub')
  })

  it('custom uses videoBaseUrl and http mode', () => {
    const ep = resolveVideoEndpoint(
      s({
        videoProvider: 'custom',
        videoBaseUrl: 'https://vid.example/v1/',
        videoApiKey: 'vk',
        videoMode: 'http'
      })
    )
    expect(ep.baseUrl).toBe('https://vid.example/v1')
    expect(ep.apiKey).toBe('vk')
    expect(ep.mode).toBe('http')
  })

  it('openai video channel uses OpenAI base', () => {
    const ep = resolveVideoEndpoint(
      s({
        videoProvider: 'openai',
        videoBaseUrl: '',
        videoApiKey: 'sk-v'
      })
    )
    expect(ep.baseUrl).toBe('https://api.openai.com/v1')
    expect(ep.apiKey).toBe('sk-v')
    expect(ep.mode).toBe('http')
    expect(ep.videoPath).toBe('https://api.openai.com/v1/videos')
  })
})

describe('provider option catalogs (capability-filtered)', () => {
  it('image tab lists same-as-llm + Seedream + image-capable presets', () => {
    const ids = imageProviderOptions().map((o) => o.id)
    expect(ids[0]).toBe('same-as-llm')
    expect(ids).toEqual([
      'same-as-llm',
      'seedream',
      ...imageCapablePresets().map((p) => p.id)
    ])
    // Chat-only must not appear
    expect(ids).not.toContain('openrouter')
    expect(ids).not.toContain('groq')
    expect(ids).not.toContain('deepseek')
    expect(ids).not.toContain('kimi')
    expect(ids).not.toContain('ollama')
    expect(ids).not.toContain('lmstudio')
    // Known image-capable
    expect(ids).toContain('seedream')
    expect(ids).toContain('grok-gateway')
    expect(ids).toContain('openai')
    expect(ids).toContain('xai')
    expect(ids).toContain('together')
    expect(ids).toContain('custom')
  })

  it('video tab lists same-as-llm + stub + Seedance + video-capable presets', () => {
    const ids = videoProviderOptions().map((o) => o.id)
    expect(ids).toEqual([
      'same-as-llm',
      'stub',
      'seedance',
      ...videoCapablePresets().map((p) => p.id)
    ])
    // xAI video uses /videos/generations — not our client
    expect(ids).not.toContain('xai')
    expect(ids).not.toContain('together')
    expect(ids).not.toContain('openrouter')
    expect(ids).not.toContain('kimi')
    expect(ids).not.toContain('ollama')
    // Known video-capable for this app
    expect(ids).toContain('seedance')
    expect(ids).toContain('grok-gateway')
    expect(ids).toContain('openai')
    expect(ids).toContain('custom')
    expect(ids).toContain('stub')
  })

  it('channelPresetBaseUrl returns catalog defaults', () => {
    expect(channelPresetBaseUrl('same-as-llm')).toBe('')
    expect(channelPresetBaseUrl('stub')).toBe('')
    expect(channelPresetBaseUrl('openai')).toBe('https://api.openai.com/v1')
    expect(channelPresetBaseUrl('grok-gateway')).toBe(GROK_GATEWAY_BASE_URL)
    expect(channelPresetBaseUrl('seedance')).toContain('ark')
    expect(channelPresetBaseUrl('seedream')).toContain('ark')
  })
})
