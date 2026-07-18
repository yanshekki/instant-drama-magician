import {
  GROK_GATEWAY_BASE_URL,
  GROK_GATEWAY_VIDEO_PATH
} from '../domain/gatewayDefaults'
import {
  isImageCapableProvider,
  isVideoCapableProvider,
  type LlmProviderPreset
} from '../domain/openaiCompatible'
import {
  coerceColorScheme,
  type ColorSchemePref
} from '../domain/colorScheme'
import {
  coerceUiLanguage,
  type UiLanguage
} from '../domain/uiLanguages'
import { getSheetVariant } from '../domain/characterSheetVariants'
import { getScenePlateVariant } from '../domain/scenePlateVariants'
import { getPropPlateVariant } from '../domain/propPlateVariants'

export type VideoMode = 'auto' | 'http' | 'stub'
export type ExportProfile = 'fast' | 'balanced'
export type TransitionMode = 'cut' | 'fade'
/** OpenAI-compat sizes accepted by Grok Gateway OPENAI_IMAGE_SIZES */
export type ImagePixelSize = '1024x1024' | '1792x1024' | '1024x1792'
export type { LlmProviderPreset }
export type { UiLanguage }
export type { ColorSchemePref }
export { UI_LANGUAGES, isUiLanguage, coerceUiLanguage } from '../domain/uiLanguages'
export {
  COLOR_SCHEME_PREFS,
  coerceColorScheme,
  isColorSchemePref
} from '../domain/colorScheme'

/** Image channel may share LLM endpoint or use its own. */
export type ImageProviderMode = 'same-as-llm' | LlmProviderPreset
/**
 * Video channel: inherit chat, stub placeholders, or any OpenAI-compatible preset.
 */
export type VideoProviderMode = 'same-as-llm' | 'stub' | LlmProviderPreset

export interface AppSettings {
  videoMode: VideoMode
  /**
   * LLM (chat) OpenAI-compatible preset.
   */
  llmProvider: LlmProviderPreset
  /** Chat base, e.g. http://127.0.0.1:3847/v1 */
  baseUrl: string
  videoPath: string
  apiKey: string
  model: string
  /** Chat completion timeout (ms) */
  chatTimeoutMs: number

  /** Image generation endpoint (empty base/key → inherit LLM) */
  imageProvider: ImageProviderMode
  imageBaseUrl: string
  imageApiKey: string

  /** Video generation endpoint */
  videoProvider: VideoProviderMode
  videoBaseUrl: string
  videoApiKey: string

  defaultMaxClipSeconds: number
  burnSubtitles: boolean
  includeSilentAudio: boolean
  exportProfile: ExportProfile
  /** Video HTTP client */
  videoPollMs: number
  videoTimeoutSec: number
  videoMaxRetries: number
  videoConcurrency: number
  /** Audio */
  bgmPath: string | null
  bgmVolume: number
  /** Dialogue TTS level when mixed into final export (0–1) */
  dialogueVolume: number
  /** BGM multiplier while dialogue TTS plays (0–1) */
  duckRatio: number
  ttsEnabled: boolean
  ttsVoice: string
  ttsHttpUrl: string
  /** After export, reveal file in folder manager */
  openExportFolder: boolean
  /** UX */
  snapEnabled: boolean
  snapGridSec: number
  /** UI language (synced with i18n) */
  uiLanguage: UiLanguage
  /** Appearance: system (OS) | light | dark */
  colorScheme: ColorSchemePref
  /** Grok video clip aspect_ratio */
  aspectRatio: string
  /** Final export clip transition */
  transitionMode: TransitionMode
  transitionSec: number
  /** First-run UX */
  firstRunSeen: boolean
  /** Last generation used stub/degraded clips */
  lastGenerationDegraded: boolean

  // ── Photo / Image (Grok Imagine via /v1/images/*) ─────────
  /** Requested pixel size for bible / turnaround sheets (maps → 16:9) */
  imageSizeWide: ImagePixelSize
  /** Expression sheets (maps → 1:1) */
  imageSizeSquare: ImagePixelSize
  /** Costume / tall sheets (maps → 9:16) */
  imageSizeTall: ImagePixelSize
  /** 2× Lanczos + unsharp after gen (Grok native ~720p/1K) */
  imageEnhance: boolean
  /** Upscale only when longest edge is below this */
  imageEnhanceMaxEdge: number
  imageEnhanceScale: number
  /** Image gen / edit HTTP timeout (ms) */
  imageTimeoutMs: number
}

/** Gateway-allowed OpenAI-style sizes (pixel request; Grok maps to aspect). */
export const IMAGE_PIXEL_SIZES: ImagePixelSize[] = [
  '1024x1024',
  '1792x1024',
  '1024x1792'
]

export const VIDEO_ASPECT_RATIOS = ['16:9', '9:16', '1:1', '4:3', '3:4'] as const

export const DEFAULT_SETTINGS: AppSettings = {
  videoMode: 'auto',
  llmProvider: 'grok-gateway',
  baseUrl: GROK_GATEWAY_BASE_URL,
  videoPath: GROK_GATEWAY_VIDEO_PATH,
  /** Placeholder — paste key for selected provider */
  apiKey: '',
  model: 'grok-4.5',
  chatTimeoutMs: 120_000,
  imageProvider: 'same-as-llm',
  imageBaseUrl: '',
  imageApiKey: '',
  videoProvider: 'same-as-llm',
  videoBaseUrl: '',
  videoApiKey: '',
  defaultMaxClipSeconds: 6,
  burnSubtitles: true,
  includeSilentAudio: true,
  exportProfile: 'balanced',
  videoPollMs: 2000,
  videoTimeoutSec: 300,
  videoMaxRetries: 3,
  videoConcurrency: 1,
  bgmPath: null,
  bgmVolume: 0.25,
  dialogueVolume: 1,
  duckRatio: 0.35,
  ttsEnabled: false,
  ttsVoice: 'default',
  ttsHttpUrl: '',
  openExportFolder: true,
  snapEnabled: true,
  snapGridSec: 0.5,
  uiLanguage: 'zh-HK',
  colorScheme: 'system',
  aspectRatio: '16:9',
  transitionMode: 'fade',
  transitionSec: 0.3,
  firstRunSeen: false,
  lastGenerationDegraded: false,
  // Photo defaults — max supported sizes per layout
  imageSizeWide: '1792x1024',
  imageSizeSquare: '1024x1024',
  imageSizeTall: '1024x1792',
  imageEnhance: true,
  imageEnhanceMaxEdge: 1600,
  imageEnhanceScale: 2,
  imageTimeoutMs: 180_000
}

/** Keys that belong to the Video settings card (for “reset defaults”). */
export const VIDEO_SETTING_KEYS = [
  'videoMode',
  'videoPath',
  'aspectRatio',
  'videoConcurrency',
  'videoMaxRetries',
  'videoPollMs',
  'videoTimeoutSec',
  'defaultMaxClipSeconds'
] as const satisfies ReadonlyArray<keyof AppSettings>

/** Keys that belong to the Photo settings card. */
export const PHOTO_SETTING_KEYS = [
  'imageSizeWide',
  'imageSizeSquare',
  'imageSizeTall',
  'imageEnhance',
  'imageEnhanceMaxEdge',
  'imageEnhanceScale',
  'imageTimeoutMs'
] as const satisfies ReadonlyArray<keyof AppSettings>

export function pickDefaults<K extends keyof AppSettings>(
  keys: readonly K[]
): Pick<AppSettings, K> {
  const out = {} as Pick<AppSettings, K>
  for (const k of keys) {
    out[k] = DEFAULT_SETTINGS[k]
  }
  return out
}

export function applyVideoDefaults(s: AppSettings): AppSettings {
  return { ...s, ...pickDefaults(VIDEO_SETTING_KEYS) }
}

export function applyPhotoDefaults(s: AppSettings): AppSettings {
  return { ...s, ...pickDefaults(PHOTO_SETTING_KEYS) }
}

const VALID_IMAGE_SIZES = new Set<string>(IMAGE_PIXEL_SIZES)

function clampImageSize(
  v: unknown,
  fallback: ImagePixelSize
): ImagePixelSize {
  if (typeof v === 'string' && VALID_IMAGE_SIZES.has(v)) {
    return v as ImagePixelSize
  }
  return fallback
}

export function mergeSettings(partial?: Partial<AppSettings> | null): AppSettings {
  const merged = { ...DEFAULT_SETTINGS, ...(partial ?? {}) }
  // Backfill corrupt/empty from older settings files
  if (!merged.chatTimeoutMs || merged.chatTimeoutMs < 1000) {
    merged.chatTimeoutMs = DEFAULT_SETTINGS.chatTimeoutMs
  }
  if (!merged.llmProvider) {
    merged.llmProvider = DEFAULT_SETTINGS.llmProvider
  }
  if (!merged.imageProvider || !isImageCapableProvider(String(merged.imageProvider))) {
    // Empty, unknown, or chat-only (no OpenAI /images/* for this app)
    merged.imageProvider = DEFAULT_SETTINGS.imageProvider
  }
  if (merged.imageBaseUrl == null) merged.imageBaseUrl = ''
  if (merged.imageApiKey == null) merged.imageApiKey = ''
  if (!merged.videoProvider || !isVideoCapableProvider(String(merged.videoProvider))) {
    // Empty, unknown, or no OpenAI-style /videos for this app’s video client
    merged.videoProvider = DEFAULT_SETTINGS.videoProvider
  }
  if (merged.videoBaseUrl == null) merged.videoBaseUrl = ''
  if (merged.videoApiKey == null) merged.videoApiKey = ''
  merged.uiLanguage = coerceUiLanguage(
    merged.uiLanguage,
    DEFAULT_SETTINGS.uiLanguage
  )
  merged.colorScheme = coerceColorScheme(
    merged.colorScheme,
    DEFAULT_SETTINGS.colorScheme
  )
  if (!merged.videoPath?.trim()) {
    merged.videoPath = DEFAULT_SETTINGS.videoPath
  }
  if (!merged.baseUrl?.trim()) {
    merged.baseUrl = DEFAULT_SETTINGS.baseUrl
  }
  if (!merged.videoMode) {
    merged.videoMode = DEFAULT_SETTINGS.videoMode
  }
  if (!merged.aspectRatio?.trim()) {
    merged.aspectRatio = DEFAULT_SETTINGS.aspectRatio
  }
  if (!merged.videoConcurrency || merged.videoConcurrency < 1) {
    merged.videoConcurrency = DEFAULT_SETTINGS.videoConcurrency
  }
  if (merged.videoMaxRetries == null || merged.videoMaxRetries < 0) {
    merged.videoMaxRetries = DEFAULT_SETTINGS.videoMaxRetries
  }
  if (!merged.videoPollMs || merged.videoPollMs < 200) {
    merged.videoPollMs = DEFAULT_SETTINGS.videoPollMs
  }
  if (!merged.videoTimeoutSec || merged.videoTimeoutSec < 10) {
    merged.videoTimeoutSec = DEFAULT_SETTINGS.videoTimeoutSec
  }
  if (
    !merged.defaultMaxClipSeconds ||
    ![6, 10].includes(merged.defaultMaxClipSeconds)
  ) {
    // Grok video only supports 6 or 10 seconds
    merged.defaultMaxClipSeconds =
      merged.defaultMaxClipSeconds && merged.defaultMaxClipSeconds >= 8
        ? 10
        : DEFAULT_SETTINGS.defaultMaxClipSeconds
  }
  merged.imageSizeWide = clampImageSize(
    merged.imageSizeWide,
    DEFAULT_SETTINGS.imageSizeWide
  )
  merged.imageSizeSquare = clampImageSize(
    merged.imageSizeSquare,
    DEFAULT_SETTINGS.imageSizeSquare
  )
  merged.imageSizeTall = clampImageSize(
    merged.imageSizeTall,
    DEFAULT_SETTINGS.imageSizeTall
  )
  if (typeof merged.imageEnhance !== 'boolean') {
    merged.imageEnhance = DEFAULT_SETTINGS.imageEnhance
  }
  if (!merged.imageEnhanceMaxEdge || merged.imageEnhanceMaxEdge < 512) {
    merged.imageEnhanceMaxEdge = DEFAULT_SETTINGS.imageEnhanceMaxEdge
  }
  if (!merged.imageEnhanceScale || merged.imageEnhanceScale < 1) {
    merged.imageEnhanceScale = DEFAULT_SETTINGS.imageEnhanceScale
  }
  if (!merged.imageTimeoutMs || merged.imageTimeoutMs < 10_000) {
    merged.imageTimeoutMs = DEFAULT_SETTINGS.imageTimeoutMs
  }
  return merged
}

/** Resolve OpenAI-style size → Grok aspect_ratio. */
export function aspectFromImageSize(size: string): string {
  if (size === '1024x1792') return '9:16'
  if (size === '1024x1024') return '1:1'
  return '16:9'
}

/** Character sheet variant → configured pixel size. */
export function imageSizeForSheetVariant(
  settings: Pick<
    AppSettings,
    'imageSizeWide' | 'imageSizeSquare' | 'imageSizeTall'
  >,
  variant: string
): ImagePixelSize {
  const cls = getSheetVariant(variant).sizeClass
  if (cls === 'square') return settings.imageSizeSquare
  if (cls === 'tall') return settings.imageSizeTall
  return settings.imageSizeWide
}

/** Scene plate variant → configured pixel size. */
export function imageSizeForScenePlate(
  settings: Pick<
    AppSettings,
    'imageSizeWide' | 'imageSizeSquare' | 'imageSizeTall'
  >,
  variant: string
): ImagePixelSize {
  const cls = getScenePlateVariant(variant).sizeClass
  if (cls === 'square') return settings.imageSizeSquare
  if (cls === 'tall') return settings.imageSizeTall
  return settings.imageSizeWide
}

/** Prop plate → pixel size. */
export function imageSizeForPropPlate(
  settings: Pick<
    AppSettings,
    'imageSizeWide' | 'imageSizeSquare' | 'imageSizeTall'
  >,
  variant: string
): ImagePixelSize {
  const cls = getPropPlateVariant(variant).sizeClass
  if (cls === 'square') return settings.imageSizeSquare
  if (cls === 'tall') return settings.imageSizeTall
  return settings.imageSizeWide
}
