import { describe, expect, it } from 'vitest'
import {
  applyPhotoDefaults,
  applyVideoDefaults,
  aspectFromImageSize,
  DEFAULT_SETTINGS,
  imageSizeForSheetVariant,
  mergeSettings
} from './settings'

describe('settings defaults', () => {
  it('fills missing photo + video fields from defaults', () => {
    const m = mergeSettings({
      videoPath: '',
      aspectRatio: '',
      videoConcurrency: 0,
      // old file without photo keys
    } as Partial<typeof DEFAULT_SETTINGS>)
    expect(m.videoPath).toBe(DEFAULT_SETTINGS.videoPath)
    expect(m.aspectRatio).toBe(DEFAULT_SETTINGS.aspectRatio)
    expect(m.videoConcurrency).toBe(DEFAULT_SETTINGS.videoConcurrency)
    expect(m.imageSizeWide).toBe('1792x1024')
    expect(m.imageSizeSquare).toBe('1024x1024')
    expect(m.imageSizeTall).toBe('1024x1792')
    expect(m.imageEnhance).toBe(true)
    expect(m.imageTimeoutMs).toBe(180_000)
    expect(m.videoPollMs).toBe(2000)
    expect(m.videoTimeoutSec).toBe(300)
  })

  it('applyVideoDefaults / applyPhotoDefaults reset groups', () => {
    const dirty = {
      ...DEFAULT_SETTINGS,
      videoMode: 'stub' as const,
      videoConcurrency: 4,
      imageEnhance: false,
      imageSizeWide: '1024x1024' as const
    }
    expect(applyVideoDefaults(dirty).videoMode).toBe(DEFAULT_SETTINGS.videoMode)
    expect(applyVideoDefaults(dirty).videoConcurrency).toBe(
      DEFAULT_SETTINGS.videoConcurrency
    )
    expect(applyPhotoDefaults(dirty).imageEnhance).toBe(true)
    expect(applyPhotoDefaults(dirty).imageSizeWide).toBe('1792x1024')
  })

  it('maps sheet variants to sizes', () => {
    expect(
      imageSizeForSheetVariant(DEFAULT_SETTINGS, 'bible')
    ).toBe('1792x1024')
    expect(
      imageSizeForSheetVariant(DEFAULT_SETTINGS, 'expression')
    ).toBe('1024x1024')
    expect(
      imageSizeForSheetVariant(DEFAULT_SETTINGS, 'hero')
    ).toBe('1024x1792')
    expect(
      imageSizeForSheetVariant(DEFAULT_SETTINGS, 'face_id')
    ).toBe('1024x1024')
    expect(aspectFromImageSize('1024x1792')).toBe('9:16')
  })

  it('backfills multi-channel provider and uiLanguage', () => {
    const m = mergeSettings({
      llmProvider: 'openai',
      baseUrl: 'https://api.openai.com/v1'
    } as Partial<typeof DEFAULT_SETTINGS>)
    expect(m.imageProvider).toBe('same-as-llm')
    expect(m.imageBaseUrl).toBe('')
    expect(m.imageApiKey).toBe('')
    expect(m.videoProvider).toBe('same-as-llm')
    expect(m.videoBaseUrl).toBe('')
    expect(m.videoApiKey).toBe('')
    expect(m.uiLanguage).toBe('zh-HK')
    expect(m.colorScheme).toBe('system')
  })

  it('accepts colorScheme light/dark/system', () => {
    expect(mergeSettings({ colorScheme: 'light' }).colorScheme).toBe('light')
    expect(mergeSettings({ colorScheme: 'dark' }).colorScheme).toBe('dark')
    expect(
      mergeSettings({ colorScheme: 'nope' as unknown as 'system' }).colorScheme
    ).toBe('system')
  })

  it('accepts all ten UI languages', () => {
    for (const id of [
      'en',
      'zh-HK',
      'zh-CN',
      'es',
      'hi',
      'ar',
      'pt-BR',
      'fr',
      'ja',
      'ru'
    ] as const) {
      expect(mergeSettings({ uiLanguage: id }).uiLanguage).toBe(id)
    }
  })

  it('preserves explicit image/video channels', () => {
    const m = mergeSettings({
      imageProvider: 'openai',
      imageBaseUrl: 'https://api.openai.com/v1',
      imageApiKey: 'sk-x',
      videoProvider: 'stub',
      uiLanguage: 'en'
    })
    expect(m.imageProvider).toBe('openai')
    expect(m.imageApiKey).toBe('sk-x')
    expect(m.videoProvider).toBe('stub')
    expect(m.uiLanguage).toBe('en')
  })

  it('accepts image/video-capable presets', () => {
    const m = mergeSettings({
      imageProvider: 'xai',
      videoProvider: 'openai'
    })
    expect(m.imageProvider).toBe('xai')
    expect(m.videoProvider).toBe('openai')
  })

  it('rejects chat-only providers on image/video channels', () => {
    const m = mergeSettings({
      imageProvider: 'openrouter',
      videoProvider: 'ollama'
    })
    expect(m.imageProvider).toBe(DEFAULT_SETTINGS.imageProvider)
    expect(m.videoProvider).toBe(DEFAULT_SETTINGS.videoProvider)
  })

  it('rejects unknown videoProvider strings', () => {
    const m = mergeSettings({
      videoProvider: 'runway-xyz' as never
    })
    expect(m.videoProvider).toBe(DEFAULT_SETTINGS.videoProvider)
  })
})
