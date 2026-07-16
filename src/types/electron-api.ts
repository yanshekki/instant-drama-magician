import type {
  CreateCharacterInput,
  CreatePropInput,
  CreateSceneInput,
  CreateStoryInput,
  CreateTimelineEntryInput,
  MediaStatus,
  UpdateTimelineEntryInput
} from './domain'

/** Renderer-facing Electron IPC API (mirrors preload bridge). */
export interface ElectronApi {
  stories: {
    list: () => Promise<unknown>
    get: (id: string) => Promise<unknown>
    create: (input: CreateStoryInput) => Promise<{ id: string }>
    update: (id: string, data: { title?: string; status?: string }) => Promise<unknown>
    delete: (id: string) => Promise<{ ok: boolean }>
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
      }) => void
    ) => () => void
  }
  ai: {
    status: () => Promise<unknown>
  }
  shell: {
    openExternal: (url: string) => Promise<{ ok: boolean }>
    openPath: (filePath: string) => Promise<{ ok: boolean }>
  }
  media: {
    pickRefImage: () => Promise<{ filePath: string; originalName?: string } | null>
    exportStoryboard: (storyId: string) => Promise<{ outputPath: string }>
    exportConcat: (storyId: string) => Promise<{ outputPath: string }>
    importClip: (
      storyId: string,
      entryId: string
    ) => Promise<{ filePath: string } | null>
    openClip: (filePath: string) => Promise<{ ok: boolean }>
  }
}
