import type {
  CreateCharacterInput,
  CreatePropInput,
  CreateSceneInput,
  CreateStoryInput,
  CreateTimelineEntryInput,
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
      data: Partial<Pick<CreateCharacterInput, 'name' | 'description' | 'soulMdPath' | 'refImagePath'>>
    ) => Promise<unknown>
    delete: (id: string) => Promise<{ ok: boolean }>
    importSoulMd: () => Promise<{ filePath: string; content: string } | null>
  }
  scenes: {
    list: (storyId: string) => Promise<unknown>
    create: (input: CreateSceneInput) => Promise<unknown>
    update: (
      id: string,
      data: Partial<Pick<CreateSceneInput, 'sceneNumber' | 'description' | 'script'>>
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
  }
  generation: {
    run: (storyId: string) => Promise<unknown>
  }
  ai: {
    status: () => Promise<unknown>
  }
  shell: {
    openExternal: (url: string) => Promise<{ ok: boolean }>
  }
}
