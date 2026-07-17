import { contextBridge, ipcRenderer } from 'electron'
import type {
  CreateCharacterInput,
  CreatePropInput,
  CreateSceneInput,
  CreateStoryInput,
  CreateTimelineEntryInput,
  MediaStatus,
  UpdateTimelineEntryInput
} from '../../src/types/domain'
import type { ElectronApi } from '../../src/types/electron-api'

const api: ElectronApi = {
  stories: {
    list: () => ipcRenderer.invoke('stories:list'),
    get: (id: string) => ipcRenderer.invoke('stories:get', id),
    create: (input: CreateStoryInput) => ipcRenderer.invoke('stories:create', input),
    update: (
      id: string,
      data: { title?: string; status?: string; styleNote?: string | null }
    ) => ipcRenderer.invoke('stories:update', id, data),
    delete: (id: string) => ipcRenderer.invoke('stories:delete', id),
    seedDemo: (locale?: 'zh-HK' | 'en') =>
      ipcRenderer.invoke('stories:seedDemo', locale)
  },
  characters: {
    list: (storyId: string) => ipcRenderer.invoke('characters:list', storyId),
    create: (input: CreateCharacterInput) => ipcRenderer.invoke('characters:create', input),
    update: (
      id: string,
      data: Partial<
        Pick<CreateCharacterInput, 'name' | 'description' | 'soulMdPath' | 'refImagePath'>
      >
    ) => ipcRenderer.invoke('characters:update', id, data),
    delete: (id: string) => ipcRenderer.invoke('characters:delete', id),
    importSoulMd: () =>
      ipcRenderer.invoke('characters:importSoulMd') as Promise<{
        filePath: string
        content: string
      } | null>,
    importSoulMdUrl: (url: string) => ipcRenderer.invoke('characters:importSoulMdUrl', url)
  },
  scenes: {
    list: (storyId: string) => ipcRenderer.invoke('scenes:list', storyId),
    create: (input: CreateSceneInput) => ipcRenderer.invoke('scenes:create', input),
    update: (
      id: string,
      data: Partial<
        Pick<CreateSceneInput, 'sceneNumber' | 'description' | 'script' | 'status'>
      >
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
      ipcRenderer.invoke('timeline:reorder', storyId, orderedIds),
    setMedia: (
      id: string,
      data: {
        mediaPath?: string | null
        mediaStatus: MediaStatus
        mediaError?: string | null
      }
    ) => ipcRenderer.invoke('timeline:setMedia', id, data)
  },
  generation: {
    run: (storyId: string, opts?: { onlyFailedVideos?: boolean }) =>
      ipcRenderer.invoke('generation:run', storyId, opts),
    runClip: (storyId: string, entryId: string) =>
      ipcRenderer.invoke('generation:runClip', storyId, entryId),
    cancel: () => ipcRenderer.invoke('generation:cancel'),
    onProgress: (callback) => {
      const listener = (
        _event: Electron.IpcRendererEvent,
        payload: {
          storyId: string
          step: string
          index: number
          total: number
          result?: { step: string; success: boolean; output?: string; error?: string }
          entryId?: string
          mediaStatus?: string
        }
      ): void => {
        callback(payload)
      }
      ipcRenderer.on('generation:progress', listener)
      return () => {
        ipcRenderer.removeListener('generation:progress', listener)
      }
    }
  },
  ai: {
    status: () => ipcRenderer.invoke('ai:status'),
    probeVideo: () => ipcRenderer.invoke('ai:probeVideo'),
    probeChat: () => ipcRenderer.invoke('ai:probeChat'),
    listModels: () => ipcRenderer.invoke('ai:listModels'),
    testChat: (prompt?: string) => ipcRenderer.invoke('ai:testChat', prompt),
    applyLlmPreset: (preset: 'grok-gateway' | 'openai' | 'custom') =>
      ipcRenderer.invoke('ai:applyLlmPreset', preset),
    applyGrokDefaults: () => ipcRenderer.invoke('ai:applyGrokDefaults')
  },
  diagnostics: {
    full: () => ipcRenderer.invoke('diagnostics:full')
  },
  app: {
    getInfo: () => ipcRenderer.invoke('app:getInfo')
  },
  updates: {
    status: () => ipcRenderer.invoke('updates:status'),
    check: () => ipcRenderer.invoke('updates:check'),
    download: () => ipcRenderer.invoke('updates:download'),
    install: () => ipcRenderer.invoke('updates:install'),
    onState: (callback) => {
      const listener = (
        _event: Electron.IpcRendererEvent,
        state: {
          status: string
          currentVersion: string
          latestVersion?: string
          progress?: number
          message?: string
          releaseNotes?: string | null
        }
      ): void => {
        callback(state)
      }
      ipcRenderer.on('updates:state', listener)
      return () => {
        ipcRenderer.removeListener('updates:state', listener)
      }
    }
  },
  activity: {
    recent: (limit?: number) => ipcRenderer.invoke('activity:recent', limit)
  },
  support: {
    exportReport: () => ipcRenderer.invoke('support:exportReport')
  },
  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    set: (partial) => ipcRenderer.invoke('settings:set', partial)
  },
  shell: {
    openExternal: (url: string) => ipcRenderer.invoke('shell:openExternal', url),
    openPath: (filePath: string) => ipcRenderer.invoke('shell:openPath', filePath),
    showItemInFolder: (filePath: string) =>
      ipcRenderer.invoke('shell:showItemInFolder', filePath)
  },
  media: {
    pickRefImage: () => ipcRenderer.invoke('media:pickRefImage'),
    pickBgm: () => ipcRenderer.invoke('media:pickBgm'),
    exportStoryboard: (storyId: string) =>
      ipcRenderer.invoke('media:exportStoryboard', storyId),
    exportConcat: (storyId: string) => ipcRenderer.invoke('media:exportConcat', storyId),
    exportFinal: (storyId: string) => ipcRenderer.invoke('media:exportFinal', storyId),
    importClip: (storyId: string, entryId: string) =>
      ipcRenderer.invoke('media:importClip', storyId, entryId),
    openClip: (filePath: string) => ipcRenderer.invoke('media:openClip', filePath),
    toPreviewUrl: (filePath: string) => ipcRenderer.invoke('media:toPreviewUrl', filePath),
    checkFfmpeg: () => ipcRenderer.invoke('media:checkFfmpeg'),
    exportPreflight: (storyId: string) =>
      ipcRenderer.invoke('media:exportPreflight', storyId)
  },
  project: {
    exportBackup: (storyId: string) => ipcRenderer.invoke('project:exportBackup', storyId),
    importBackup: () => ipcRenderer.invoke('project:importBackup')
  }
}

contextBridge.exposeInMainWorld('api', api)
