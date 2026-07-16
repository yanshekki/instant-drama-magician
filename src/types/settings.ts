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
}

export const DEFAULT_SETTINGS: AppSettings = {
  videoMode: 'auto',
  baseUrl: 'http://127.0.0.1:39281/v1',
  videoPath: 'http://127.0.0.1:39281/v1/video/generations',
  apiKey: 'grok-cli',
  model: 'grok-cli',
  defaultMaxClipSeconds: 10,
  burnSubtitles: true,
  includeSilentAudio: true,
  exportProfile: 'balanced'
}

export function mergeSettings(partial?: Partial<AppSettings> | null): AppSettings {
  return { ...DEFAULT_SETTINGS, ...(partial ?? {}) }
}
