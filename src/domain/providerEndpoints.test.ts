import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS, type AppSettings } from '../types/settings'
import {
  imageCapablePresets,
  videoCapablePresets
} from './openaiCompatible'
import {
  arkDefaultBaseUrl,
  arkIntlBaseUrl,
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
    expect(arkDefaultBaseUrl()).toContain('ark')
    expect(arkIntlBaseUrl()).toMatch(/byteplus|ark/i)
  })
})

describe('seedream / seedance and same-as-llm branches', () => {
  it('resolves seedream image with default model', () => {
    const ep = resolveImageEndpoint(
      s({
        imageProvider: 'seedream',
        imageBaseUrl: '',
        imageApiKey: 'ark-key',
        imageModel: ''
      })
    )
    expect(ep.baseUrl).toMatch(/ark|volc/i)
    expect(ep.apiKey).toBe('ark-key')
    expect(ep.model.length).toBeGreaterThan(0)
  })

  it('resolves seedance video marker path', () => {
    const ep = resolveVideoEndpoint(
      s({
        videoProvider: 'seedance',
        videoBaseUrl: '',
        videoApiKey: 'ark-v',
        videoModel: ''
      })
    )
    expect(ep.mode).toBe('http')
    expect(ep.videoPath).toMatch(/seedance/)
    expect(ep.apiKey).toBe('ark-v')
  })

  it('same-as-llm non-gateway keeps explicit http mode', () => {
    const ep = resolveVideoEndpoint(
      s({
        llmProvider: 'openai',
        baseUrl: 'https://api.openai.com/v1',
        apiKey: 'sk',
        videoProvider: 'same-as-llm',
        videoMode: 'http'
      })
    )
    expect(ep.mode).toBe('http')
    expect(ep.videoPath).toContain('/videos')
  })

  it('same-as-llm gateway respects stub videoMode', () => {
    const ep = resolveVideoEndpoint(
      s({
        llmProvider: 'grok-gateway',
        baseUrl: GROK_GATEWAY_BASE_URL,
        videoProvider: 'same-as-llm',
        videoMode: 'stub'
      })
    )
    expect(ep.mode).toBe('stub')
  })

  it('chat defaults when base/model empty', () => {
    const ep = resolveChatEndpoint(s({ baseUrl: '', model: '' }))
    expect(ep.baseUrl).toBe(GROK_GATEWAY_BASE_URL.replace(/\/+$/, '') || ep.baseUrl)
    expect(ep.model).toBeTruthy()
  })

  it('video preset keeps explicit path under base', () => {
    const ep = resolveVideoEndpoint(
      s({
        videoProvider: 'openai',
        videoBaseUrl: 'https://api.openai.com/v1',
        videoPath: 'https://api.openai.com/v1/videos/custom',
        videoApiKey: 'sk'
      })
    )
    expect(ep.videoPath).toContain('custom')
  })

  it('seedream inherits chat model when model contains seedream', () => {
    const ep = resolveImageEndpoint(
      s({
        imageProvider: 'seedream',
        model: 'doubao-seedream-custom',
        imageModel: '',
        imageApiKey: '',
        apiKey: 'k'
      })
    )
    expect(ep.model).toMatch(/seedream/i)
    expect(ep.apiKey).toBe('k')
  })

  it('image provider uses imageApiKey when preset matches llm', () => {
    const ep = resolveImageEndpoint(
      s({
        llmProvider: 'openai',
        apiKey: 'chat-k',
        imageProvider: 'openai',
        imageBaseUrl: '',
        imageApiKey: '',
        imageModel: 'gpt-image'
      })
    )
    expect(ep.apiKey).toBe('chat-k')
    expect(ep.model).toBe('gpt-image')
  })

  it('video same-as-llm non-gateway modes and seedance model inherit', () => {
    expect(
      resolveVideoEndpoint(
        s({
          llmProvider: 'openai',
          baseUrl: 'https://api.openai.com/v1',
          videoProvider: 'same-as-llm',
          videoMode: 'auto'
        })
      ).mode
    ).toBe('auto')
    expect(
      resolveVideoEndpoint(
        s({
          llmProvider: 'openai',
          baseUrl: 'https://api.openai.com/v1',
          videoProvider: 'same-as-llm',
          videoMode: 'stub'
        })
      ).mode
    ).toBe('stub')
    expect(
      resolveVideoEndpoint(
        s({
          llmProvider: 'openai',
          baseUrl: 'https://api.openai.com/v1',
          videoProvider: 'same-as-llm',
          videoMode: undefined as never
        })
      ).mode
    ).toBe('http')

    const seed = resolveVideoEndpoint(
      s({
        videoProvider: 'seedance',
        model: 'doubao-seedance-x',
        videoModel: '',
        videoApiKey: '',
        apiKey: 'ark'
      })
    )
    expect(seed.model).toMatch(/seedance/i)
  })

  it('grok-gateway video path override and mode http', () => {
    const ep = resolveVideoEndpoint(
      s({
        videoProvider: 'grok-gateway',
        videoBaseUrl: GROK_GATEWAY_BASE_URL,
        videoPath: `${GROK_GATEWAY_BASE_URL}/videos/extra`,
        videoMode: 'http',
        videoApiKey: 'gk'
      })
    )
    expect(ep.mode).toBe('http')
    expect(ep.videoPath).toContain('videos')
  })
})
