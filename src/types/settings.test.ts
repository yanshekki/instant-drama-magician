import { describe, expect, it } from 'vitest'
import {
  applyPhotoDefaults,
  applyVideoDefaults,
  aspectFromImageSize,
  DEFAULT_SETTINGS,
  imageSizeForPropPlate,
  imageSizeForScenePlate,
  imageSizeForSheetVariant,
  mergeSettings,
  pickDefaults,
  VIDEO_SETTING_KEYS,
  PHOTO_SETTING_KEYS
} from './settings'

describe('settings defaults', () => {
  it('pickDefaults copies DEFAULT_SETTINGS keys', () => {
    const p = pickDefaults(['videoMode', 'apiKey'] as const)
    expect(p.videoMode).toBe(DEFAULT_SETTINGS.videoMode)
    expect(p.apiKey).toBe(DEFAULT_SETTINGS.apiKey)
  })

  it('fills missing photo + video fields from defaults', () => {
    const m = mergeSettings({
      videoPath: '',
      aspectRatio: '',
      videoConcurrency: 0
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

  it('mergeSettings null/undefined and corrupt fields', () => {
    expect(mergeSettings(null).llmProvider).toBe(DEFAULT_SETTINGS.llmProvider)
    expect(mergeSettings(undefined).baseUrl).toBe(DEFAULT_SETTINGS.baseUrl)

    const m = mergeSettings({
      chatTimeoutMs: 10,
      llmProvider: '' as never,
      imageProvider: 'not-a-provider' as never,
      videoProvider: 'nope' as never,
      imageBaseUrl: null as never,
      imageApiKey: null as never,
      imageModel: null as never,
      videoBaseUrl: null as never,
      videoApiKey: null as never,
      videoModel: null as never,
      uiLanguage: 'xx' as never,
      colorScheme: 'weird' as never,
      videoPath: '   ',
      baseUrl: '',
      videoMode: '' as never,
      aspectRatio: '',
      videoConcurrency: 0,
      videoMaxRetries: -1 as never,
      videoPollMs: 50,
      videoTimeoutSec: 1,
      defaultMaxClipSeconds: 9,
      imageSizeWide: 'bad' as never,
      imageSizeSquare: 1 as never,
      imageSizeTall: null as never,
      imageEnhance: 'yes' as never,
      imageEnhanceMaxEdge: 100,
      imageEnhanceScale: 0,
      imageTimeoutMs: 100,
      webServerEnabled: 'x' as never,
      webServerPort: 99999,
      webServerHost: '  ',
      webServerAuthToken: null as never
    })
    expect(m.chatTimeoutMs).toBe(DEFAULT_SETTINGS.chatTimeoutMs)
    expect(m.llmProvider).toBe(DEFAULT_SETTINGS.llmProvider)
    expect(m.imageProvider).toBe(DEFAULT_SETTINGS.imageProvider)
    expect(m.videoProvider).toBe(DEFAULT_SETTINGS.videoProvider)
    expect(m.imageBaseUrl).toBe('')
    expect(m.videoApiKey).toBe('')
    expect(m.defaultMaxClipSeconds).toBe(10)
    expect(m.imageSizeWide).toBe(DEFAULT_SETTINGS.imageSizeWide)
    expect(m.imageEnhance).toBe(DEFAULT_SETTINGS.imageEnhance)
    expect(m.imageEnhanceMaxEdge).toBe(DEFAULT_SETTINGS.imageEnhanceMaxEdge)
    expect(m.imageEnhanceScale).toBe(DEFAULT_SETTINGS.imageEnhanceScale)
    expect(m.imageTimeoutMs).toBe(DEFAULT_SETTINGS.imageTimeoutMs)
    expect(m.webServerEnabled).toBe(DEFAULT_SETTINGS.webServerEnabled)
    expect(m.webServerPort).toBe(DEFAULT_SETTINGS.webServerPort)
    expect(m.webServerHost).toBe(DEFAULT_SETTINGS.webServerHost)
    expect(m.webServerAuthToken).toBe('')
    expect(m.legalAcceptedVersion).toBeNull()
    expect(m.legalAcceptedAt).toBeNull()
  })

  it('defaultMaxClipSeconds clamps 6/10 only', () => {
    expect(mergeSettings({ defaultMaxClipSeconds: 6 }).defaultMaxClipSeconds).toBe(
      6
    )
    expect(mergeSettings({ defaultMaxClipSeconds: 10 }).defaultMaxClipSeconds).toBe(
      10
    )
    expect(mergeSettings({ defaultMaxClipSeconds: 3 }).defaultMaxClipSeconds).toBe(
      DEFAULT_SETTINGS.defaultMaxClipSeconds
    )
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
    expect(VIDEO_SETTING_KEYS.length).toBeGreaterThan(0)
    expect(PHOTO_SETTING_KEYS.length).toBeGreaterThan(0)
  })

  it('maps sheet / scene / prop variants to sizes', () => {
    expect(imageSizeForSheetVariant(DEFAULT_SETTINGS, 'bible')).toBe('1792x1024')
    expect(imageSizeForSheetVariant(DEFAULT_SETTINGS, 'expression')).toBe(
      '1024x1024'
    )
    expect(imageSizeForSheetVariant(DEFAULT_SETTINGS, 'hero')).toBe('1024x1792')
    expect(imageSizeForSheetVariant(DEFAULT_SETTINGS, 'face_id')).toBe(
      '1024x1024'
    )
    expect(imageSizeForScenePlate(DEFAULT_SETTINGS, 'establishing')).toBeTruthy()
    expect(imageSizeForScenePlate(DEFAULT_SETTINGS, 'identity_lock')).toBeTruthy()
    expect(imageSizeForPropPlate(DEFAULT_SETTINGS, 'hero')).toBeTruthy()
    expect(imageSizeForPropPlate(DEFAULT_SETTINGS, 'detail')).toBeTruthy()
    // force size classes via known variants if available
    expect(aspectFromImageSize('1024x1792')).toBe('9:16')
    expect(aspectFromImageSize('1024x1024')).toBe('1:1')
    expect(aspectFromImageSize('1792x1024')).toBe('16:9')
    expect(aspectFromImageSize('other')).toBe('16:9')
  })

  it('backfills multi-channel provider and uiLanguage', () => {
    const m = mergeSettings({
      llmProvider: 'openai',
      baseUrl: 'https://api.openai.com/v1'
    } as Partial<typeof DEFAULT_SETTINGS>)
    expect(m.imageProvider).toBe('same-as-llm')
    expect(m.imageBaseUrl).toBe('')
  })
})
