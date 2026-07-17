import type {
  CreateCharacterInput,
  CreatePropInput,
  CreateSceneInput,
  CreateStoryInput,
  CreateTimelineEntryInput,
  MediaStatus,
  UpdateTimelineEntryInput
} from './domain'
import type { AppSettings } from './settings'

/** Renderer-facing Electron IPC API (mirrors preload bridge). */
export interface ElectronApi {
  stories: {
    list: () => Promise<unknown>
    get: (id: string) => Promise<unknown>
    create: (input: CreateStoryInput) => Promise<{ id: string }>
    update: (id: string, data: { title?: string; status?: string }) => Promise<unknown>
    delete: (id: string) => Promise<{ ok: boolean }>
    seedDemo: (locale?: 'zh-HK' | 'en') => Promise<{ storyId: string; title: string }>
  }
  characters: {
    list: (storyId: string) => Promise<unknown>
    create: (input: CreateCharacterInput) => Promise<unknown>
    update: (
      id: string,
      data: Partial<
        Pick<CreateCharacterInput, 'name' | 'description' | 'soulMdPath' | 'refImagePath'>
      >
    ) => Promise<unknown>
    delete: (id: string) => Promise<{ ok: boolean }>
    importSoulMd: () => Promise<{ filePath: string; content: string } | null>
    importSoulMdUrl: (url: string) => Promise<{
      url: string
      content: string
      name: string | null
      description: string
      parsed: unknown
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
  }
  project: {
    exportBackup: (storyId: string) => Promise<{ filePath: string } | null>
    importBackup: () => Promise<{ storyId: string; title: string } | null>
  }
}
