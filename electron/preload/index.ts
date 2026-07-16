import { contextBridge, ipcRenderer } from 'electron'
import type {
  CreateCharacterInput,
  CreatePropInput,
  CreateSceneInput,
  CreateStoryInput,
  CreateTimelineEntryInput,
  UpdateTimelineEntryInput
} from '../../src/types/domain'
import type { ElectronApi } from '../../src/types/electron-api'

const api: ElectronApi = {
  stories: {
    list: () => ipcRenderer.invoke('stories:list'),
    get: (id: string) => ipcRenderer.invoke('stories:get', id),
    create: (input: CreateStoryInput) => ipcRenderer.invoke('stories:create', input),
    update: (id: string, data: { title?: string; status?: string }) =>
      ipcRenderer.invoke('stories:update', id, data),
    delete: (id: string) => ipcRenderer.invoke('stories:delete', id)
  },
  characters: {
    list: (storyId: string) => ipcRenderer.invoke('characters:list', storyId),
    create: (input: CreateCharacterInput) => ipcRenderer.invoke('characters:create', input),
    update: (
      id: string,
      data: Partial<Pick<CreateCharacterInput, 'name' | 'description' | 'soulMdPath' | 'refImagePath'>>
    ) => ipcRenderer.invoke('characters:update', id, data),
    delete: (id: string) => ipcRenderer.invoke('characters:delete', id),
    importSoulMd: () =>
      ipcRenderer.invoke('characters:importSoulMd') as Promise<{
        filePath: string
        content: string
      } | null>
  },
  scenes: {
    list: (storyId: string) => ipcRenderer.invoke('scenes:list', storyId),
    create: (input: CreateSceneInput) => ipcRenderer.invoke('scenes:create', input),
    update: (
      id: string,
      data: Partial<Pick<CreateSceneInput, 'sceneNumber' | 'description' | 'script'>>
    ) => ipcRenderer.invoke('scenes:update', id, data),
    delete: (id: string) => ipcRenderer.invoke('scenes:delete', id)
  },
  props: {
    list: (storyId: string) => ipcRenderer.invoke('props:list', storyId),
    create: (input: CreatePropInput) => ipcRenderer.invoke('props:create', input),
    update: (id: string, data: Partial<Pick<CreatePropInput, 'name' | 'description'>>) =>
      ipcRenderer.invoke('props:update', id, data),
    delete: (id: string) => ipcRenderer.invoke('props:delete', id)
  },
  timeline: {
    list: (storyId: string) => ipcRenderer.invoke('timeline:list', storyId),
    create: (input: CreateTimelineEntryInput) => ipcRenderer.invoke('timeline:create', input),
    update: (id: string, data: UpdateTimelineEntryInput) =>
      ipcRenderer.invoke('timeline:update', id, data),
    delete: (id: string) => ipcRenderer.invoke('timeline:delete', id),
    reorder: (storyId: string, orderedIds: string[]) =>
      ipcRenderer.invoke('timeline:reorder', storyId, orderedIds)
  },
  generation: {
    run: (storyId: string) => ipcRenderer.invoke('generation:run', storyId)
  },
  ai: {
    status: () => ipcRenderer.invoke('ai:status')
  },
  shell: {
    openExternal: (url: string) => ipcRenderer.invoke('shell:openExternal', url)
  }
}

contextBridge.exposeInMainWorld('api', api)
