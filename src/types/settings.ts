export type VideoMode = 'auto' | 'http' | 'stub'
export type ExportProfile = 'fast' | 'balanced'

export interface AppSettings {
  videoMode: VideoMode
  baseUrl: string
  videoPath: string
  apiKey: string
  model: string
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
  ttsEnabled: boolean
  ttsVoice: string
  ttsHttpUrl: string
  /** UX */
  snapEnabled: boolean
  snapGridSec: number
  /** Grok video */
  aspectRatio: string
  /** First-run UX */
  firstRunSeen: boolean
  /** Last generation used stub/degraded clips */
  lastGenerationDegraded: boolean
}

export const DEFAULT_SETTINGS: AppSettings = {
  videoMode: 'auto',
  baseUrl: 'http://127.0.0.1:39281/v1',
  videoPath: 'http://127.0.0.1:39281/v1/videos',
  apiKey: 'grok-cli',
  model: 'grok-cli',
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
  ttsEnabled: false,
  ttsVoice: 'default',
  ttsHttpUrl: '',
  snapEnabled: true,
  snapGridSec: 0.5,
  aspectRatio: '16:9',
  firstRunSeen: false,
  lastGenerationDegraded: false
}

export function mergeSettings(partial?: Partial<AppSettings> | null): AppSettings {
  return { ...DEFAULT_SETTINGS, ...(partial ?? {}) }
}
