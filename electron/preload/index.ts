import { contextBridge, ipcRenderer } from 'electron'
import type {
  CreateCharacterInput,
  CreatePropInput,
  CreateSceneInput,
  CreateStoryInput,
  CreateTimelineEntryInput,
  MediaStatus,
  UpdateCharacterInput,
  UpdateTimelineEntryInput
} from '../../src/types/domain'
import type { ElectronApi } from '../../src/types/electron-api'

/** Escape hatch for renderer polyfills when a namespace is missing after hot reload. */
function invokeChannel(channel: string, args: unknown[] = []): Promise<unknown> {
  return ipcRenderer.invoke(channel, ...args)
}

const api: ElectronApi & {
  /** @internal */
  _invoke?: (channel: string, args?: unknown[]) => Promise<unknown>
} = {
  _invoke: (channel: string, args: unknown[] = []) =>
    invokeChannel(channel, args),
  stories: {
    list: () => ipcRenderer.invoke('stories:list'),
    get: (id: string) => ipcRenderer.invoke('stories:get', id),
    create: (input: CreateStoryInput) => ipcRenderer.invoke('stories:create', input),
    update: (
      id: string,
      data: {
        title?: string
        status?: string
        styleNote?: string | null
        coverPath?: string | null
        refGalleryJson?: string | null
      }
    ) => ipcRenderer.invoke('stories:update', id, data),
    delete: (id: string) => ipcRenderer.invoke('stories:delete', id),
    generateCover: (payload: Record<string, unknown>) =>
      ipcRenderer.invoke('stories:generateCover', payload),
    commitCover: (payload: Record<string, unknown>) =>
      ipcRenderer.invoke('stories:commitCover', payload),
    seedDemo: (locale?: string) =>
      ipcRenderer.invoke('stories:seedDemo', locale),
    aiFillMeta: (payload: {
      storyId?: string
      title?: string
      idea?: string
      existingStyleNote?: string | null
      locale?: string
    }) => ipcRenderer.invoke('stories:aiFillMeta', payload),
    aiFillScript: (payload: {
      storyId: string
      idea?: string
      locale?: string
      replace?: boolean
      promptTemplateId?: string | null
      chapterIds?: string[]
    }) => ipcRenderer.invoke('stories:aiFillScript', payload),
    linkCharacter: (payload: {
      storyId: string
      characterId: string
      roleNote?: string
      costumeId?: string | null
    }) => ipcRenderer.invoke('stories:linkCharacter', payload),
    setCharacterCostume: (payload: {
      storyId: string
      characterId: string
      costumeId: string | null
    }) => ipcRenderer.invoke('stories:setCharacterCostume', payload),
    unlinkCharacter: (payload: { storyId: string; characterId: string }) =>
      ipcRenderer.invoke('stories:unlinkCharacter', payload),
    linkScene: (payload: {
      storyId: string
      sceneId: string
      sceneNumber?: number
    }) => ipcRenderer.invoke('stories:linkScene', payload),
    unlinkScene: (payload: { storyId: string; sceneId: string }) =>
      ipcRenderer.invoke('stories:unlinkScene', payload),
    linkProp: (payload: { storyId: string; propId: string }) =>
      ipcRenderer.invoke('stories:linkProp', payload),
    unlinkProp: (payload: { storyId: string; propId: string }) =>
      ipcRenderer.invoke('stories:unlinkProp', payload),
    linkAction: (payload: { storyId: string; actionId: string }) =>
      ipcRenderer.invoke('stories:linkAction', payload),
    unlinkAction: (payload: { storyId: string; actionId: string }) =>
      ipcRenderer.invoke('stories:unlinkAction', payload),
    listCast: (storyId: string) => ipcRenderer.invoke('stories:listCast', storyId)
  },
  chapters: {
    list: (storyId: string) => ipcRenderer.invoke('chapters:list', storyId),
    create: (input: { storyId: string; title?: string; body?: string }) =>
      ipcRenderer.invoke('chapters:create', input),
    update: (id: string, data: { title?: string; body?: string }) =>
      ipcRenderer.invoke('chapters:update', id, data),
    delete: (id: string) => ipcRenderer.invoke('chapters:delete', id),
    reorder: (storyId: string, orderedIds: string[]) =>
      ipcRenderer.invoke('chapters:reorder', storyId, orderedIds),
    aiFill: (payload: Record<string, unknown>) =>
      ipcRenderer.invoke('chapters:aiFill', payload),
    aiPolish: (payload: Record<string, unknown>) =>
      ipcRenderer.invoke('chapters:aiPolish', payload),
    generateCast: (payload: Record<string, unknown>) =>
      ipcRenderer.invoke('chapters:generateCast', payload)
  },
  characters: {
    get: (id: string) => ipcRenderer.invoke('characters:get', id),
    list: (opts?: string | { storyId?: string; q?: string; forStory?: boolean }) =>
      ipcRenderer.invoke('characters:list', opts),
    create: (input: CreateCharacterInput) => ipcRenderer.invoke('characters:create', input),
    update: (id: string, data: UpdateCharacterInput) =>
      ipcRenderer.invoke('characters:update', id, data),
    delete: (id: string) => ipcRenderer.invoke('characters:delete', id),
    importSoulMd: () =>
      ipcRenderer.invoke('characters:importSoulMd') as Promise<{
        filePath: string
        content: string
      } | null>,
    importSoulMdUrl: (url: string) => ipcRenderer.invoke('characters:importSoulMdUrl', url),
    readSoulContent: (payload: {
      soulMdPath?: string | null
      soulHubId?: number | null
    }) => ipcRenderer.invoke('characters:readSoulContent', payload),
    writeSoulContent: (payload: {
      content: string
      filePath?: string | null
      characterId?: string | null
    }) => ipcRenderer.invoke('characters:writeSoulContent', payload),
    aiFill: (payload: {
      idea?: string
      storyId?: string
      locale?: string
      existingDraft?: Record<string, unknown>
      soulContent?: string | null
      referenceImagePath?: string | null
      promptTemplateId?: string | null
    }) => ipcRenderer.invoke('characters:aiFill', payload),
    generateSoul: (payload: {
      storyId?: string
      locale?: string
      profile: Record<string, unknown>
      existingSoul?: string | null
      userRequest?: string | null
    }) => ipcRenderer.invoke('characters:generateSoul', payload),
    generateSheet: (payload: {
      characterId: string
      variant?: string
      referenceImagePath?: string | null
      useIdentityEdit?: boolean
      persist?: boolean
      artStyle?: string | null
    }) => ipcRenderer.invoke('characters:generateSheet', payload),
    generateIntroVideo: (payload: {
      characterId: string
      sourceImagePath: string
      durationSeconds?: number
      locale?: string
    }) => ipcRenderer.invoke('characters:generateIntroVideo', payload),
    commitSheet: (payload: {
      characterId: string
      path: string
      variant?: string
      label?: string
      layer?: string
      costumeDescription?: string | null
    }) => ipcRenderer.invoke('characters:commitSheet', payload),
    swapCostume: (payload: {
      characterId: string
      costumeDescription: string
      baseImagePath?: string | null
      artStyle?: string | null
      pose?: string | null
      persist?: boolean
      updateCostumeField?: boolean
    }) => ipcRenderer.invoke('characters:swapCostume', payload),
    suggestWardrobe: (payload: {
      characterId?: string
      storyId?: string
      segmentKey?: string | null
      segmentKeys?: string[] | null
      locale?: string
      name?: string
      appearance?: string | null
      costume?: string | null
      ageRange?: string | null
      gender?: string | null
      existingCostumeNames?: string[]
    }) => ipcRenderer.invoke('characters:suggestWardrobe', payload)
  },
  souls: {
    list: (opts?: {
      page?: number
      limit?: number
      q?: string
      role?: string
    }) => ipcRenderer.invoke('souls:list', opts),
    get: (id: number) => ipcRenderer.invoke('souls:get', id),
    categories: () => ipcRenderer.invoke('souls:categories'),
    ensureIndex: (force?: boolean) =>
      ipcRenderer.invoke('souls:ensureIndex', force),
    suggestions: () => ipcRenderer.invoke('souls:suggestions'),
    searchLocal: (q: string, limit?: number) =>
      ipcRenderer.invoke('souls:searchLocal', q, limit)
  },
  scenes: {
    list: (opts?: string | { storyId?: string; q?: string; forStory?: boolean }) =>
      ipcRenderer.invoke('scenes:list', opts),
    create: (input: CreateSceneInput) => ipcRenderer.invoke('scenes:create', input),
    update: (id: string, data: Record<string, unknown>) =>
      ipcRenderer.invoke('scenes:update', id, data),
    delete: (id: string) => ipcRenderer.invoke('scenes:delete', id),
    aiFill: (payload: Record<string, unknown>) =>
      ipcRenderer.invoke('scenes:aiFill', payload),
    generatePlate: (payload: Record<string, unknown>) =>
      ipcRenderer.invoke('scenes:generatePlate', payload),
    generateIntroVideo: (payload: {
      sceneId: string
      sourceImagePath: string
      durationSeconds?: number
      locale?: string
    }) => ipcRenderer.invoke('scenes:generateIntroVideo', payload),
    commitPlate: (payload: Record<string, unknown>) =>
      ipcRenderer.invoke('scenes:commitPlate', payload),
    swapAtmosphere: (payload: Record<string, unknown>) =>
      ipcRenderer.invoke('scenes:swapAtmosphere', payload),
    copyGalleryFrom: (payload: {
      targetSceneId: string
      sourceSceneId: string
    }) => ipcRenderer.invoke('scenes:copyGalleryFrom', payload)
  },
  props: {
    list: (opts?: string | { storyId?: string; q?: string; forStory?: boolean }) =>
      ipcRenderer.invoke('props:list', opts),
    create: (input: CreatePropInput) => ipcRenderer.invoke('props:create', input),
    update: (id: string, data: Record<string, unknown>) =>
      ipcRenderer.invoke('props:update', id, data),
    delete: (id: string) => ipcRenderer.invoke('props:delete', id),
    aiFill: (payload: Record<string, unknown>) =>
      ipcRenderer.invoke('props:aiFill', payload),
    generatePlate: (payload: Record<string, unknown>) =>
      ipcRenderer.invoke('props:generatePlate', payload),
    generateIntroVideo: (payload: {
      propId: string
      sourceImagePath: string
      durationSeconds?: number
      locale?: string
    }) => ipcRenderer.invoke('props:generateIntroVideo', payload),
    commitPlate: (payload: Record<string, unknown>) =>
      ipcRenderer.invoke('props:commitPlate', payload)
  },
  actions: {
    list: (
      opts?: string | { storyId?: string; q?: string; forStory?: boolean }
    ) => ipcRenderer.invoke('actions:list', opts),
    get: (id: string) => ipcRenderer.invoke('actions:get', id),
    create: (input: import('../../src/types/domain').CreateActionInput) =>
      ipcRenderer.invoke('actions:create', input),
    update: (
      id: string,
      data: import('../../src/types/domain').UpdateActionInput
    ) => ipcRenderer.invoke('actions:update', id, data),
    delete: (id: string) => ipcRenderer.invoke('actions:delete', id),
    linkStory: (storyId: string, actionId: string) =>
      ipcRenderer.invoke('actions:linkStory', storyId, actionId),
    unlinkStory: (storyId: string, actionId: string) =>
      ipcRenderer.invoke('actions:unlinkStory', storyId, actionId),
    aiFill: (payload: Record<string, unknown>) =>
      ipcRenderer.invoke('actions:aiFill', payload),
    generatePlate: (payload: Record<string, unknown>) =>
      ipcRenderer.invoke('actions:generatePlate', payload),
    generateIntroVideo: (payload: {
      actionId: string
      sourceImagePath: string
      durationSeconds?: number
      locale?: string
    }) => ipcRenderer.invoke('actions:generateIntroVideo', payload),
    commitPlate: (payload: Record<string, unknown>) =>
      ipcRenderer.invoke('actions:commitPlate', payload)
  },
  costumes: {
    list: (opts?: {
      q?: string
      characterId?: string
      unlinkedOnly?: boolean
    }) => ipcRenderer.invoke('costumes:list', opts),
    get: (id: string) => ipcRenderer.invoke('costumes:get', id),
    create: (input: Record<string, unknown>) =>
      ipcRenderer.invoke('costumes:create', input),
    update: (id: string, data: Record<string, unknown>) =>
      ipcRenderer.invoke('costumes:update', id, data),
    delete: (id: string) => ipcRenderer.invoke('costumes:delete', id),
    linkCharacter: (payload: { costumeId: string; characterId: string }) =>
      ipcRenderer.invoke('costumes:linkCharacter', payload),
    unlinkCharacter: (payload: { costumeId: string; characterId: string }) =>
      ipcRenderer.invoke('costumes:unlinkCharacter', payload),
    setActive: (payload: { costumeId: string; characterId: string }) =>
      ipcRenderer.invoke('costumes:setActive', payload),
    listForCharacter: (characterId: string) =>
      ipcRenderer.invoke('costumes:listForCharacter', characterId),
    aiFill: (payload: {
      idea?: string
      locale?: string
      existingDraft?: {
        name?: string | null
        description?: string | null
        artStyle?: string | null
      }
      /** Gallery / external still — vision fill allowed with image alone */
      referenceImagePath?: string | null
    }) => ipcRenderer.invoke('costumes:aiFill', payload),
    generateDressed: (payload: {
      costumeId: string
      characterId: string
      baseImagePath?: string | null
      pose?: string | null
    }) => ipcRenderer.invoke('costumes:generateDressed', payload),
    appendTryOnStill: (payload: {
      costumeId: string
      characterId?: string | null
      sourcePath: string
      label?: string | null
    }) => ipcRenderer.invoke('costumes:appendTryOnStill', payload),
    generateIntroVideo: (payload: {
      costumeId: string
      sourceImagePath: string
      durationSeconds?: number
      locale?: string
    }) => ipcRenderer.invoke('costumes:generateIntroVideo', payload)
  },
  videoPrep: {
    create: (payload: Record<string, unknown>) =>
      ipcRenderer.invoke('videoPrep:create', payload),
    openFromStill: (payload: Record<string, unknown>) =>
      ipcRenderer.invoke('videoPrep:openFromStill', payload),
    regenStill: (payload: Record<string, unknown>) =>
      ipcRenderer.invoke('videoPrep:regenStill', payload),
    confirm: (payload: Record<string, unknown>) =>
      ipcRenderer.invoke('videoPrep:confirm', payload)
  },
  comics: {
    get: (storyId: string) => ipcRenderer.invoke('comics:get', storyId),
    update: (
      storyId: string,
      data: {
        title?: string | null
        artStyle?: string | null
        hardRules?: string | null
      }
    ) => ipcRenderer.invoke('comics:update', storyId, data),
    addPage: (
      storyId: string,
      input?: {
        panelLayout?: string | null
        artStyle?: string | null
        panelScript?: unknown
      }
    ) => ipcRenderer.invoke('comics:addPage', storyId, input),
    updatePage: (pageId: string, data: Record<string, unknown>) =>
      ipcRenderer.invoke('comics:updatePage', pageId, data),
    deletePage: (pageId: string) =>
      ipcRenderer.invoke('comics:deletePage', pageId),
    deletePageVideo: (pageId: string, videoId: string) =>
      ipcRenderer.invoke('comics:deletePageVideo', pageId, videoId),
    setPageVideoPrimary: (pageId: string, videoId: string) =>
      ipcRenderer.invoke('comics:setPageVideoPrimary', pageId, videoId),
    autoPaginate: (storyId: string, layoutId?: string | null) =>
      ipcRenderer.invoke('comics:autoPaginate', storyId, layoutId),
    importToTimeline: (pageId: string) =>
      ipcRenderer.invoke('comics:importToTimeline', pageId)
  },
  keyArt: {
    get: (storyId: string) => ipcRenderer.invoke('keyArt:get', storyId),
    update: (storyId: string, data: Record<string, unknown>) =>
      ipcRenderer.invoke('keyArt:update', storyId, data),
    addShot: (storyId: string, input?: Record<string, unknown>) =>
      ipcRenderer.invoke('keyArt:addShot', storyId, input),
    updateShot: (shotId: string, data: Record<string, unknown>) =>
      ipcRenderer.invoke('keyArt:updateShot', shotId, data),
    deleteShot: (shotId: string) =>
      ipcRenderer.invoke('keyArt:deleteShot', shotId),
    deleteShotImage: (shotId: string, imageId: string) =>
      ipcRenderer.invoke('keyArt:deleteShotImage', shotId, imageId),
    setShotImagePrimary: (shotId: string, imageId: string) =>
      ipcRenderer.invoke('keyArt:setShotImagePrimary', shotId, imageId),
    setAsStoryCover: (shotId: string) =>
      ipcRenderer.invoke('keyArt:setAsStoryCover', shotId)
  },
  mediaGen: {
    extract: (payload: Record<string, unknown>) =>
      ipcRenderer.invoke('mediaGen:extract', payload),
    polish: (payload: Record<string, unknown>) =>
      ipcRenderer.invoke('mediaGen:polish', payload),
    generateImage: (payload: Record<string, unknown>) =>
      ipcRenderer.invoke('mediaGen:generateImage', payload)
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
    ) => ipcRenderer.invoke('timeline:setMedia', id, data),
    getAdvancedPrep: (storyId: string) =>
      ipcRenderer.invoke('timeline:getAdvancedPrep', storyId),
    setCastPrep: (storyId: string, prep: Record<string, unknown>) =>
      ipcRenderer.invoke('timeline:setCastPrep', storyId, prep),
    clearEntryStill: (storyId: string, entryId: string) =>
      ipcRenderer.invoke('timeline:clearEntryStill', storyId, entryId)
  },
  generation: {
    run: (
      storyId: string,
      opts?: { onlyFailedVideos?: boolean; interactiveVideo?: boolean }
    ) => ipcRenderer.invoke('generation:run', storyId, opts),
    runClip: (
      storyId: string,
      entryId: string,
      opts?: { revisionPrompt?: string | null }
    ) => ipcRenderer.invoke('generation:runClip', storyId, entryId, opts),
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
    applyLlmPreset: (preset: string) =>
      ipcRenderer.invoke('ai:applyLlmPreset', preset),
    applyGrokDefaults: () => ipcRenderer.invoke('ai:applyGrokDefaults')
  },
  gateway: {
    status: () => ipcRenderer.invoke('gateway:status'),
    ensure: () => ipcRenderer.invoke('gateway:ensure'),
    installHints: () => ipcRenderer.invoke('gateway:installHints'),
    openAdmin: (url?: string) => ipcRenderer.invoke('gateway:openAdmin', url)
  },
  diagnostics: {
    full: () => ipcRenderer.invoke('diagnostics:full')
  },
  webServer: {
    status: () => ipcRenderer.invoke('webServer:status'),
    start: () => ipcRenderer.invoke('webServer:start'),
    stop: () => ipcRenderer.invoke('webServer:stop'),
    generateToken: () => ipcRenderer.invoke('webServer:generateToken')
  },
  app: {
    getInfo: () => ipcRenderer.invoke('app:getInfo'),
    exportFullBackup: () => ipcRenderer.invoke('app:exportFullBackup'),
    importFullBackup: () => ipcRenderer.invoke('app:importFullBackup'),
    rebuildMenu: () => ipcRenderer.invoke('app:rebuildMenu'),
    onMenuAction: (callback) => {
      const listener = (
        _event: Electron.IpcRendererEvent,
        action: {
          type: string
          path?: string
          filePath?: string
        }
      ): void => {
        callback(action as import('../../src/types/electron-api').MenuAction)
      }
      ipcRenderer.on('menu:action', listener)
      return () => {
        ipcRenderer.removeListener('menu:action', listener)
      }
    }
  },
  updates: {
    status: () => ipcRenderer.invoke('updates:status'),
    check: (opts?: { silent?: boolean }) =>
      ipcRenderer.invoke('updates:check', opts),
    download: () => ipcRenderer.invoke('updates:download'),
    install: () => ipcRenderer.invoke('updates:install'),
    checkNpm: () => ipcRenderer.invoke('updates:checkNpm'),
    openReleasePage: (version?: string) =>
      ipcRenderer.invoke('updates:openReleasePage', version),
    onState: (callback) => {
      const listener = (
        _event: Electron.IpcRendererEvent,
        state: {
          channel?: string
          status: string
          currentVersion: string
          latestVersion?: string
          progress?: number
          message?: string
          messageKey?: string
          releaseNotes?: string | null
          releaseUrl?: string
          installCommand?: string
          canAutoInstall?: boolean
          canDownload?: boolean
          canCheck?: boolean
          errorKind?: string
          source?: string
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
    recent: (limit?: number) => ipcRenderer.invoke('activity:recent', limit),
    query: (opts?: {
      limit?: number
      kind?: string
      level?: string
      q?: string
      since?: string
      until?: string
    }) => ipcRenderer.invoke('activity:query', opts),
    clear: () => ipcRenderer.invoke('activity:clear'),
    getPath: () => ipcRenderer.invoke('activity:getPath'),
    openLogFolder: () => ipcRenderer.invoke('activity:openLogFolder')
  },
  support: {
    exportReport: () => ipcRenderer.invoke('support:exportReport')
  },
  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    set: (partial) => ipcRenderer.invoke('settings:set', partial)
  },
  desktopNotify: {
    show: (payload) => ipcRenderer.invoke('desktopNotify:show', payload)
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
    exportFinal: (
      storyId: string,
      options?: Partial<{
        exportProfile: 'balanced' | 'fast'
        burnSubtitles: boolean
        includeSilentAudio: boolean
        bgmVolume: number
        dialogueVolume: number
        openExportFolder: boolean
      }>
    ) => ipcRenderer.invoke('media:exportFinal', storyId, options),
    listExports: (storyId: string) =>
      ipcRenderer.invoke('media:listExports', storyId),
    deleteExport: (storyId: string, exportId: string) =>
      ipcRenderer.invoke('media:deleteExport', storyId, exportId),
    importClip: (storyId: string, entryId: string) =>
      ipcRenderer.invoke('media:importClip', storyId, entryId),
    openClip: (filePath: string) => ipcRenderer.invoke('media:openClip', filePath),
    toPreviewUrl: (filePath: string) => ipcRenderer.invoke('media:toPreviewUrl', filePath),
    saveAs: (filePath: string, destPath?: string, suggestedName?: string) =>
      ipcRenderer.invoke('media:saveAs', filePath, destPath, suggestedName),
    discardSheetDraft: (filePath: string) =>
      ipcRenderer.invoke('media:discardSheetDraft', filePath),
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
