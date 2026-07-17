import {
  GROK_GATEWAY_BASE_URL,
  GROK_GATEWAY_VIDEO_PATH
} from '../domain/gatewayDefaults'
import type { LlmProviderPreset } from '../domain/openaiCompatible'

export type VideoMode = 'auto' | 'http' | 'stub'
export type ExportProfile = 'fast' | 'balanced'
export type TransitionMode = 'cut' | 'fade'
export type { LlmProviderPreset }

export interface AppSettings {
  videoMode: VideoMode
  /**
   * Which OpenAI-compatible endpoint preset is selected.
   * All presets use the same chat/completions client.
   */
  llmProvider: LlmProviderPreset
  /** OpenAI-compatible base, e.g. http://127.0.0.1:3847/v1 */
  baseUrl: string
  videoPath: string
  apiKey: string
  model: string
  /** Chat completion timeout (ms) */
  chatTimeoutMs: number
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
  /** Grok video */
  aspectRatio: string
  /** Final export clip transition */
  transitionMode: TransitionMode
  transitionSec: number
  /** First-run UX */
  firstRunSeen: boolean
  /** Last generation used stub/degraded clips */
  lastGenerationDegraded: boolean
}

export const DEFAULT_SETTINGS: AppSettings = {
  videoMode: 'auto',
  llmProvider: 'grok-gateway',
  baseUrl: GROK_GATEWAY_BASE_URL,
  videoPath: GROK_GATEWAY_VIDEO_PATH,
  /** Placeholder — paste key for selected provider */
  apiKey: '',
  model: 'grok-cli',
  chatTimeoutMs: 120_000,
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
  aspectRatio: '16:9',
  transitionMode: 'fade',
  transitionSec: 0.3,
  firstRunSeen: false,
  lastGenerationDegraded: false
}

export function mergeSettings(partial?: Partial<AppSettings> | null): AppSettings {
  const merged = { ...DEFAULT_SETTINGS, ...(partial ?? {}) }
  // Backfill timeout if corrupt/empty from older settings files
  if (!merged.chatTimeoutMs || merged.chatTimeoutMs < 1000) {
    merged.chatTimeoutMs = DEFAULT_SETTINGS.chatTimeoutMs
  }
  if (!merged.llmProvider) {
    merged.llmProvider = DEFAULT_SETTINGS.llmProvider
  }
  return merged
}
