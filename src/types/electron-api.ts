import type {
  CharacterProfileFields,
  CreateCharacterInput,
  CreatePropInput,
  CreateSceneInput,
  CreateStoryInput,
  CreateTimelineEntryInput,
  MediaStatus,
  UpdateCharacterInput,
  UpdateTimelineEntryInput
} from './domain'
import type { AppSettings } from './settings'

/** Renderer-facing Electron IPC API (mirrors preload bridge). */
export interface ElectronApi {
  stories: {
    list: () => Promise<unknown>
    get: (id: string) => Promise<unknown>
    create: (input: CreateStoryInput) => Promise<{ id: string }>
    update: (
      id: string,
      data: { title?: string; status?: string; styleNote?: string | null }
    ) => Promise<unknown>
    delete: (id: string) => Promise<{ ok: boolean }>
    seedDemo: (locale?: 'zh-HK' | 'en') => Promise<{ storyId: string; title: string }>
  }
  characters: {
    list: (storyId: string) => Promise<unknown>
    create: (input: CreateCharacterInput) => Promise<unknown>
    update: (id: string, data: UpdateCharacterInput) => Promise<unknown>
    delete: (id: string) => Promise<{ ok: boolean }>
    importSoulMd: () => Promise<{ filePath: string; content: string } | null>
    importSoulMdUrl: (url: string) => Promise<{
      url: string
      content: string
      name: string | null
      description: string
      parsed: unknown
    }>
    aiFill: (payload: {
      idea: string
      storyId?: string
      locale?: 'zh-HK' | 'en'
    }) => Promise<{
      profile: CharacterProfileFields
      profileJson: string
      raw: string
    }>
    generateSheet: (payload: {
      characterId: string
      variant?: 'bible' | 'turnaround' | 'expression' | 'costume'
    }) => Promise<{
      character: unknown
      path: string
      size?: string
      aspect?: string
      gallery?: Array<{
        id: string
        path: string
        kind: string
        label: string
        createdAt: string
      }>
    }>
  }
  souls: {
    list: (opts?: {
      page?: number
      limit?: number
      q?: string
      role?: string
    }) => Promise<{
      success: boolean
      count: number
      total_count?: number
      current_page?: number
      total_pages?: number
      data: Array<{
        id: number
        title: string
        description: string
        role: string | null
        domain: string | null
        role_icon?: string | null
      }>
    }>
    get: (id: number) => Promise<{
      id: number
      title: string
      description: string
      content: string
      contentFlat: string
      file_type?: string
      role?: string | null
      domain?: string | null
    }>
    categories: () => Promise<
      Array<{ id: number; name: string; slug: string; icon: string }>
    >
    ensureIndex: (force?: boolean) => Promise<{
      fromCache: boolean
      pages: number
      count: number
      builtAt: string
      suggestions: Array<{ kind: string; label: string; count?: number }>
    }>
    suggestions: () => Promise<
      Array<{ kind: string; label: string; count?: number }>
    >
    searchLocal: (
      q: string,
      limit?: number
    ) => Promise<{
      items: Array<{
        id: number
        title: string
        description: string
        role: string | null
        domain: string | null
      }>
      fromCache: boolean
    }>
  }
  scenes: {
    list: (storyId: string) => Promise<unknown>
    create: (input: CreateSceneInput) => Promise<unknown>
    update: (
      id: string,
      data: Partial<
        Pick<CreateSceneInput, 'sceneNumber' | 'description' | 'script' | 'status'>
      >
    ) => Promise<unknown>
    delete: (id: string) => Promise<{ ok: boolean }>
  }
  props: {
    list: (storyId: string) => Promise<unknown>
    create: (input: CreatePropInput) => Promise<unknown>
    update: (
      id: string,
      data: Partial<Pick<CreatePropInput, 'name' | 'description'>>
    ) => Promise<unknown>
    delete: (id: string) => Promise<{ ok: boolean }>
  }
  timeline: {
    list: (storyId: string) => Promise<unknown>
    create: (input: CreateTimelineEntryInput) => Promise<unknown>
    update: (id: string, data: UpdateTimelineEntryInput) => Promise<unknown>
    delete: (id: string) => Promise<{ ok: boolean }>
    reorder: (storyId: string, orderedIds: string[]) => Promise<unknown>
    setMedia: (
      id: string,
      data: {
        mediaPath?: string | null
        mediaStatus: MediaStatus
        mediaError?: string | null
      }
    ) => Promise<unknown>
  }
  generation: {
    run: (
      storyId: string,
      opts?: { onlyFailedVideos?: boolean }
    ) => Promise<unknown>
    runClip: (
      storyId: string,
      entryId: string
    ) => Promise<{
      entryId: string
      mediaPath: string
      jobId?: string
      degraded?: boolean
    }>
    cancel: () => Promise<{ ok: boolean }>
    onProgress: (
      callback: (payload: {
        storyId: string
        step: string
        index: number
        total: number
        result?: { step: string; success: boolean; output?: string; error?: string }
        entryId?: string
        mediaStatus?: string
        jobId?: string
      }) => void
    ) => () => void
  }
  ai: {
    status: () => Promise<unknown>
    probeVideo: () => Promise<{ id: string; available: boolean; message: string }>
    probeChat: () => Promise<{
      available: boolean
      message: string
      models?: Array<{ id: string; ownedBy?: string }>
      latencyMs?: number
      healthOk?: boolean
    }>
    listModels: () => Promise<Array<{ id: string; ownedBy?: string }>>
    testChat: (prompt?: string) => Promise<{
      ok: boolean
      latencyMs: number
      model: string
      replyPreview: string
      message: string
    }>
    applyLlmPreset: (
      preset: 'grok-gateway' | 'openai' | 'custom'
    ) => Promise<AppSettings>
    /** @deprecated use applyLlmPreset('grok-gateway') */
    applyGrokDefaults: () => Promise<AppSettings>
  }
  diagnostics: {
    full: () => Promise<{
      chat: { available: boolean; message: string }
      chatProbe?: {
        available: boolean
        message: string
        models?: Array<{ id: string }>
        latencyMs?: number
        healthOk?: boolean
      }
      video: { available: boolean; message: string }
      ffmpeg: { available: boolean; message: string }
      videoMode: string
      tips: string[]
      app?: {
        version: string
        name: string
        isPackaged: boolean
        userData: string
        mediaRoot: string
      }
    }>
  }
  app: {
    getInfo: () => Promise<{
      version: string
      name: string
      electron: string
      userData: string
      mediaRoot: string
      isPackaged: boolean
      platform: string
    }>
  }
  updates: {
    status: () => Promise<{
      status: string
      currentVersion: string
      latestVersion?: string
      progress?: number
      message?: string
      releaseNotes?: string | null
    }>
    check: () => Promise<{
      status: string
      currentVersion: string
      latestVersion?: string
      progress?: number
      message?: string
      releaseNotes?: string | null
    }>
    download: () => Promise<{
      status: string
      currentVersion: string
      latestVersion?: string
      progress?: number
      message?: string
    }>
    install: () => Promise<{ ok: boolean; message?: string }>
    onState: (
      callback: (state: {
        status: string
        currentVersion: string
        latestVersion?: string
        progress?: number
        message?: string
        releaseNotes?: string | null
      }) => void
    ) => () => void
  }
  activity: {
    recent: (limit?: number) => Promise<
      Array<{
        ts: string
        kind: string
        message: string
        storyId?: string
        meta?: Record<string, string | number | boolean | null>
      }>
    >
  }
  support: {
    exportReport: () => Promise<{ filePath: string } | null>
  }
  settings: {
    get: () => Promise<AppSettings>
    set: (partial: Partial<AppSettings>) => Promise<AppSettings>
  }
  shell: {
    openExternal: (url: string) => Promise<{ ok: boolean }>
    openPath: (filePath: string) => Promise<{ ok: boolean }>
    showItemInFolder: (filePath: string) => Promise<{ ok: boolean }>
  }
  media: {
    pickRefImage: () => Promise<{ filePath: string; originalName?: string } | null>
    pickBgm: () => Promise<{ filePath: string } | null>
    exportStoryboard: (storyId: string) => Promise<{ outputPath: string }>
    exportConcat: (storyId: string) => Promise<{ outputPath: string }>
    exportFinal: (storyId: string) => Promise<{ outputPath: string }>
    importClip: (
      storyId: string,
      entryId: string
    ) => Promise<{ filePath: string } | null>
    openClip: (filePath: string) => Promise<{ ok: boolean }>
    toPreviewUrl: (filePath: string) => Promise<{ url: string; filePath: string }>
    checkFfmpeg: () => Promise<{ available: boolean; message: string }>
    exportPreflight: (storyId: string) => Promise<{
      ffmpeg: boolean
      ffmpegMessage: string
      readyClips: number
      totalClips: number
      willUseFallback: boolean
      warnings: string[]
      canExport: boolean
    }>
  }
  project: {
    exportBackup: (storyId: string) => Promise<{ filePath: string } | null>
    importBackup: () => Promise<{ storyId: string; title: string } | null>
  }
}
