import type {
  CharacterProfileFields,
  CreateCharacterInput,
  CreatePropInput,
  CreateSceneInput,
  CreateStoryInput,
  CreateTimelineEntryInput,
  MediaStatus,
  PropProfileFields,
  SceneProfileFields,
  UpdateCharacterInput,
  UpdatePropInput,
  UpdateSceneInput,
  UpdateTimelineEntryInput
} from './domain'
import type { AppSettings } from './settings'

/** Actions pushed from the native application menu to the renderer. */
export type MenuAction =
  | { type: 'navigate'; path: string }
  | { type: 'new-story' }
  | { type: 'export-full' }
  | { type: 'import-full' }
  | { type: 'export-story' }
  | { type: 'import-story' }
  | { type: 'export-support' }
  | { type: 'preferences' }
  | { type: 'about' }
  | { type: 'check-updates' }
  | { type: 'open-user-data' }
  | { type: 'open-media' }
  | { type: 'full-backup-exported'; filePath: string }
  | { type: 'screenshot-saved'; filePath: string }
  | { type: 'open-legal'; kind: 'disclaimer' | 'terms' }

/** Renderer-facing Electron IPC API (mirrors preload bridge). */
export interface ElectronApi {
  stories: {
    list: () => Promise<unknown>
    get: (id: string) => Promise<unknown>
    create: (input: CreateStoryInput) => Promise<{ id: string }>
    update: (
      id: string,
      data: {
        title?: string
        status?: string
        styleNote?: string | null
        coverPath?: string | null
        refGalleryJson?: string | null
      }
    ) => Promise<unknown>
    delete: (id: string) => Promise<{ ok: boolean }>
    generateCover: (payload: {
      storyId: string
      referenceImagePath?: string | null
      useIdentityEdit?: boolean
      idea?: string | null
      locale?: 'zh-HK' | 'en'
    }) => Promise<{
      path: string
      draft?: boolean
      usedEdit?: boolean
      label?: string
    }>
    commitCover: (payload: {
      storyId: string
      path: string
      label?: string
    }) => Promise<{
      story: unknown
      path: string
      gallery?: unknown
    }>
    seedDemo: (locale?: 'zh-HK' | 'en') => Promise<{ storyId: string; title: string }>
    aiFillMeta: (payload: {
      storyId?: string
      title?: string
      idea?: string
      existingStyleNote?: string | null
      locale?: 'zh-HK' | 'en'
    }) => Promise<{ styleNote: string; raw: string }>
    aiFillScript: (payload: {
      storyId: string
      idea?: string
      locale?: 'zh-HK' | 'en'
      replace?: boolean
    }) => Promise<{
      beats: Array<{
        id: string
        dialogue: string
        characterId: string | null
        sceneId: string | null
        propId: string | null
        order: number
      }>
      drafts: unknown[]
      raw: string
    }>
    linkCharacter: (payload: {
      storyId: string
      characterId: string
      roleNote?: string
      costumeId?: string | null
    }) => Promise<unknown>
    setCharacterCostume: (payload: {
      storyId: string
      characterId: string
      costumeId: string | null
    }) => Promise<unknown>
    unlinkCharacter: (payload: {
      storyId: string
      characterId: string
    }) => Promise<{ ok: boolean }>
    linkScene: (payload: {
      storyId: string
      sceneId: string
      sceneNumber?: number
    }) => Promise<unknown>
    unlinkScene: (payload: {
      storyId: string
      sceneId: string
    }) => Promise<{ ok: boolean }>
    linkProp: (payload: {
      storyId: string
      propId: string
    }) => Promise<unknown>
    unlinkProp: (payload: {
      storyId: string
      propId: string
    }) => Promise<{ ok: boolean }>
    listCast: (storyId: string) => Promise<{
      characters: unknown[]
      scenes: unknown[]
      props: unknown[]
    }>
  }
  characters: {
    list: (
      opts?: string | { storyId?: string; q?: string; forStory?: boolean }
    ) => Promise<unknown>
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
    readSoulContent: (payload: {
      soulMdPath?: string | null
      soulHubId?: number | null
    }) => Promise<{
      source: 'hub' | 'file' | 'none'
      content: string
      id?: number
      title?: string
      path?: string
    }>
    /** Save user-edited soul markdown to a local .md file */
    writeSoulContent: (payload: {
      content: string
      filePath?: string | null
      characterId?: string | null
    }) => Promise<{ filePath: string; content: string }>
    aiFill: (payload: {
      idea?: string
      storyId?: string
      locale?: 'zh-HK' | 'en'
      /** All profile form fields currently filled */
      existingDraft?: Record<string, unknown>
      /** Full soul.md / hub markdown for identity merge */
      soulContent?: string | null
    }) => Promise<{
      profile: CharacterProfileFields
      profileJson: string
      raw: string
    }>
    generateSoul: (payload: {
      storyId?: string
      locale?: 'zh-HK' | 'en'
      profile: Record<string, unknown>
      existingSoul?: string | null
      userRequest?: string | null
    }) => Promise<{
      content: string
      filePath: string
      title: string
      raw: string
    }>
    generateSheet: (payload: {
      characterId: string
      variant?: string
      /** Identity-lock ref path; only used when useIdentityEdit is true. */
      referenceImagePath?: string | null
      /**
       * When true, image_edit with referenceImagePath.
       * When false/omit, pure generate so layout packages differ.
       */
      useIdentityEdit?: boolean
      /** false = draft only (default for UI); true = write gallery immediately */
      persist?: boolean
      artStyle?: string | null
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
      usedEdit?: boolean
      referencePath?: string | null
      enhance?: {
        enhanced: boolean
        before?: string
        after?: string
        reason?: string
      }
      draft?: boolean
      label?: string
      variant?: string
      layer?: string
      artStyle?: string
    }>
    /** Animate one gallery still into a self-intro video using character bible. */
    generateIntroVideo: (payload: {
      characterId: string
      sourceImagePath: string
      durationSeconds?: number
      locale?: 'zh-HK' | 'en'
    }) => Promise<{
      character: unknown
      path: string
      sourceImagePath: string
      gallery: Array<{
        id: string
        path: string
        kind: string
        label: string
        createdAt: string
        introVideoPath?: string | null
      }>
      jobId?: string
      degraded?: boolean
    }>
    commitSheet: (payload: {
      characterId: string
      path: string
      variant?: string
      label?: string
      layer?: string
      costumeDescription?: string | null
    }) => Promise<{
      character: unknown
      path: string
      gallery?: Array<{
        id: string
        path: string
        kind: string
        label: string
        createdAt: string
        layer?: string
      }>
    }>
    swapCostume: (payload: {
      characterId: string
      costumeDescription: string
      baseImagePath?: string | null
      artStyle?: string | null
      pose?: string | null
      persist?: boolean
      updateCostumeField?: boolean
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
        layer?: string
      }>
      basePath?: string
      pickReason?: string
      enhance?: unknown
      draft?: boolean
      label?: string
      variant?: string
      layer?: string
      costumeDescription?: string
      artStyle?: string
      pose?: string
    }>
    suggestWardrobe: (payload: {
      characterId?: string
      storyId?: string
      /** all | scene:<id> | beat:<timelineEntryId> */
      segmentKey?: string | null
      locale?: 'zh-HK' | 'en'
      name?: string
      appearance?: string | null
      costume?: string | null
      ageRange?: string | null
      gender?: string | null
      description?: string | null
      personality?: string | null
      visualTags?: string | null
      mannerisms?: string | null
      soulExcerpt?: string | null
      userRequest?: string | null
      existingCostumeNames?: string[]
    }) => Promise<{
      suggestion: {
        name: string
        costume: string
        artStyle: string
        rationale: string
      }
      raw: string
      segmentLabel?: string | null
      storyTitle?: string | null
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
    list: (
      opts?: string | { storyId?: string; q?: string; forStory?: boolean }
    ) => Promise<unknown>
    create: (input: CreateSceneInput) => Promise<unknown>
    update: (id: string, data: UpdateSceneInput) => Promise<unknown>
    delete: (id: string) => Promise<{ ok: boolean }>
    aiFill: (payload: {
      idea?: string
      storyId?: string
      /** all | scene:<id> | beat:<timelineEntryId> — with suggestFromStory */
      segmentKey?: string | null
      locale?: 'zh-HK' | 'en'
      existingDraft?: Record<string, string | undefined | null>
      suggestFromStory?: boolean
      sceneNumber?: number
    }) => Promise<{
      profile: SceneProfileFields & { artStyle?: string }
      profileJson: string
      raw: string
    }>
    generatePlate: (payload: {
      sceneId: string
      variant?: string
      referenceImagePath?: string | null
      useIdentityEdit?: boolean
      persist?: boolean
      artStyle?: string | null
    }) => Promise<{
      scene: unknown
      path: string
      draft?: boolean
      label?: string
      variant?: string
      layer?: string
      artStyle?: string
      usedEdit?: boolean
      enhance?: unknown
      gallery?: unknown
    }>
    /** Animate one gallery still into a location intro video using scene bible. */
    generateIntroVideo: (payload: {
      sceneId: string
      sourceImagePath: string
      durationSeconds?: number
      locale?: 'zh-HK' | 'en'
    }) => Promise<{
      scene: unknown
      path: string
      sourceImagePath: string
      gallery: Array<{
        id: string
        path: string
        kind: string
        label: string
        createdAt: string
        layer?: string
        introVideoPath?: string | null
      }>
      jobId?: string
      degraded?: boolean
      polished?: boolean
    }>
    commitPlate: (payload: {
      sceneId: string
      path: string
      variant?: string
      label?: string
      layer?: string
      atmosphereDescription?: string | null
    }) => Promise<{
      scene: unknown
      path: string
      gallery?: unknown
    }>
    swapAtmosphere: (payload: {
      sceneId: string
      atmosphereDescription: string
      baseImagePath?: string | null
      artStyle?: string | null
      pose?: string | null
      persist?: boolean
    }) => Promise<{
      scene: unknown
      path: string
      draft?: boolean
      label?: string
      variant?: string
      layer?: string
      atmosphereDescription?: string
      artStyle?: string
      enhance?: unknown
      basePath?: string
      gallery?: unknown
    }>
    copyGalleryFrom: (payload: {
      targetSceneId: string
      sourceSceneId: string
    }) => Promise<{ scene: unknown; gallery?: unknown }>
  }
  props: {
    list: (
      opts?: string | { storyId?: string; q?: string; forStory?: boolean }
    ) => Promise<unknown>
    create: (input: CreatePropInput) => Promise<unknown>
    update: (id: string, data: UpdatePropInput) => Promise<unknown>
    delete: (id: string) => Promise<{ ok: boolean }>
    aiFill: (payload: {
      idea?: string
      storyId?: string
      locale?: 'zh-HK' | 'en'
      existingDraft?: Record<string, string | undefined | null>
    }) => Promise<{
      profile: PropProfileFields & { artStyle?: string }
      profileJson: string
      raw: string
    }>
    generatePlate: (payload: {
      propId: string
      variant?: string
      referenceImagePath?: string | null
      /** When true, image_edit with ref; default pure generate. */
      useIdentityEdit?: boolean
      persist?: boolean
      artStyle?: string | null
    }) => Promise<{
      prop: unknown
      path: string
      draft?: boolean
      label?: string
      variant?: string
      artStyle?: string
      usedEdit?: boolean
      enhance?: unknown
      gallery?: unknown
    }>
    /** Animate one gallery still into a prop intro video using prop bible. */
    generateIntroVideo: (payload: {
      propId: string
      sourceImagePath: string
      durationSeconds?: number
      locale?: 'zh-HK' | 'en'
    }) => Promise<{
      prop: unknown
      path: string
      sourceImagePath: string
      gallery: Array<{
        id: string
        path: string
        kind: string
        label: string
        createdAt: string
        layer?: string
        introVideoPath?: string | null
      }>
      jobId?: string
      degraded?: boolean
      polished?: boolean
    }>
    commitPlate: (payload: {
      propId: string
      path: string
      variant?: string
      label?: string
    }) => Promise<{ prop: unknown; path: string; gallery?: unknown }>
  }
  costumes: {
    list: (opts?: {
      q?: string
      characterId?: string
      unlinkedOnly?: boolean
    }) => Promise<
      Array<{
        id: string
        name: string
        description: string
        artStyle?: string | null
        refImagePath?: string | null
        characterLinks: Array<{
          characterId: string
          dressedImagePath?: string | null
          character: {
            id: string
            name: string
            costume?: string | null
            refImagePath?: string | null
          }
        }>
      }>
    >
    get: (id: string) => Promise<unknown>
    create: (input: {
      name: string
      description: string
      artStyle?: string | null
      refImagePath?: string | null
      refGalleryJson?: string | null
      characterIds?: string[]
    }) => Promise<unknown>
    update: (
      id: string,
      data: {
        name?: string
        description?: string
        artStyle?: string | null
        refImagePath?: string | null
        refGalleryJson?: string | null
        characterIds?: string[]
      }
    ) => Promise<unknown>
    delete: (id: string) => Promise<{ ok: boolean }>
    linkCharacter: (payload: {
      costumeId: string
      characterId: string
    }) => Promise<unknown>
    unlinkCharacter: (payload: {
      costumeId: string
      characterId: string
    }) => Promise<unknown>
    setActive: (payload: {
      costumeId: string
      characterId: string
    }) => Promise<unknown>
    listForCharacter: (characterId: string) => Promise<
      Array<{
        id: string
        name: string
        description: string
        artStyle?: string | null
        refImagePath?: string | null
        isActive?: boolean
        dressedImagePath?: string | null
        characterLinks?: unknown[]
      }>
    >
    aiFill: (payload: {
      idea?: string
      locale?: 'zh-HK' | 'en'
      existingDraft?: {
        name?: string | null
        description?: string | null
        artStyle?: string | null
      }
    }) => Promise<{
      name: string
      description: string
      artStyle?: string | null
      raw?: string
    }>
    generateDressed: (payload: {
      costumeId: string
      characterId: string
      baseImagePath?: string | null
      pose?: string | null
    }) => Promise<{
      path: string
      costume: unknown
      characterId: string
      gallery?: Array<{
        id: string
        path: string
        kind: string
        label: string
        createdAt: string
        layer?: string
      }>
    }>
    /** Animate one costume still into a look intro video. */
    generateIntroVideo: (payload: {
      costumeId: string
      sourceImagePath: string
      durationSeconds?: number
      locale?: 'zh-HK' | 'en'
    }) => Promise<{
      costume: unknown
      path: string
      sourceImagePath: string
      gallery: Array<{
        id: string
        path: string
        kind: string
        label: string
        createdAt: string
        layer?: string
        introVideoPath?: string | null
      }>
      jobId?: string
      degraded?: boolean
      polished?: boolean
    }>
  }
  /** Shared video prep: materials → LLM prompt → still review → confirm video */
  videoPrep: {
    create: (payload: {
      kind:
        | 'character-intro'
        | 'scene-intro'
        | 'prop-intro'
        | 'costume-intro'
        | 'timeline-clip'
      sourceImagePath?: string | null
      characterId?: string
      sceneId?: string
      propId?: string
      costumeId?: string
      storyId?: string
      entryId?: string
      durationSeconds?: number
      locale?: 'zh-HK' | 'en'
      skipStillIfExists?: boolean
      stillOnly?: boolean
    }) => Promise<{
      kind: string
      entityIds: Record<string, string | undefined>
      professionalPrompt: string
      userExtraPrompt: string
      stillPath: string
      sourceImagePath?: string | null
      durationSeconds: number
      aspectRatio: string
      materialsSummary?: string
      stillPromptUsed?: string
      polished?: boolean
      skippedStill?: boolean
    }>
    openFromStill: (payload: {
      storyId: string
      entryId: string
      locale?: 'zh-HK' | 'en'
      forcePolish?: boolean
    }) => Promise<{
      kind: string
      entityIds: Record<string, string | undefined>
      professionalPrompt: string
      userExtraPrompt: string
      stillPath: string
      sourceImagePath?: string | null
      durationSeconds: number
      aspectRatio: string
      materialsSummary?: string
      polished?: boolean
      skippedStill?: boolean
    }>
    regenStill: (payload: {
      professionalPrompt: string
      improvementNotes: string
      sourceImagePath?: string | null
      characterId?: string
      sceneId?: string
      propId?: string
      costumeId?: string
      storyId?: string
      entryId?: string
      durationSeconds?: number
      aspectRatio?: string
      locale?: 'zh-HK' | 'en'
    }) => Promise<{
      professionalPrompt: string
      stillPath: string
      stillPromptUsed?: string
      polished?: boolean
    }>
    confirm: (payload: {
      kind:
        | 'character-intro'
        | 'scene-intro'
        | 'prop-intro'
        | 'costume-intro'
        | 'timeline-clip'
      professionalPrompt: string
      userExtraPrompt?: string | null
      stillPath: string
      sourceImagePath?: string | null
      characterId?: string
      sceneId?: string
      propId?: string
      costumeId?: string
      storyId?: string
      entryId?: string
      durationSeconds?: number
      aspectRatio?: string
      locale?: 'zh-HK' | 'en'
    }) => Promise<{
      path: string
      gallery?: unknown
      entity?: unknown
      polished?: boolean
      promptUsed?: string
      degraded?: boolean
    }>
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
    getAdvancedPrep: (storyId: string) => Promise<unknown>
    setCastPrep: (
      storyId: string,
      prep: {
        version?: number
        characters: Record<
          string,
          { refImagePath: string | null; costumeId: string | null }
        >
      }
    ) => Promise<unknown>
    clearEntryStill: (
      storyId: string,
      entryId: string
    ) => Promise<{ ok: boolean; stillPath: string }>
  }
  generation: {
    run: (
      storyId: string,
      opts?: { onlyFailedVideos?: boolean; interactiveVideo?: boolean }
    ) => Promise<unknown>
    runClip: (
      storyId: string,
      entryId: string,
      opts?: { revisionPrompt?: string | null }
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
    applyLlmPreset: (preset: string) => Promise<AppSettings>
    /** @deprecated use applyLlmPreset('grok-gateway') */
    applyGrokDefaults: () => Promise<AppSettings>
  }
  /** Local Grok CLI Gateway (gctoac) managed by the app */
  gateway: {
    status: () => Promise<{
      state:
        | 'ready'
        | 'gateway_starting'
        | 'gateway_missing'
        | 'grok_build_missing'
        | 'unhealthy'
        | 'error'
      message: string
      gctoacPath: string | null
      grokPath: string | null
      healthOk: boolean
      port: number
      baseUrl: string
      adminUrl: string
      version?: string
      details?: string
    }>
    ensure: () => Promise<{
      state: string
      message: string
      healthOk: boolean
      gctoacPath: string | null
      grokPath: string | null
      port: number
      baseUrl: string
      adminUrl: string
      /** API key is configured in settings (never returned to UI) */
      keyReady?: boolean
      keyCreated?: boolean
    }>
    installHints: () => Promise<{
      grokBuildUrl: string
      gatewayDocsUrl: string
      installCommand?: string
    }>
    /** Open Admin UI in an in-app window (fallback-friendly). */
    openAdmin: (url?: string) => Promise<{
      ok: boolean
      url: string
      reused?: boolean
      state?: string
      healthOk?: boolean
    }>
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
  /** Embedded HTTP server for browser remote control (desktop only). */
  webServer: {
    status: () => Promise<{
      running: boolean
      port: number
      host: string
      url: string
      authToken: string
      authRequired: boolean
      authDisabled: boolean
      staticReady: boolean
      error: string | null
      channels: number
    }>
    start: () => Promise<{
      running: boolean
      port: number
      host: string
      url: string
      authToken: string
      authRequired: boolean
      authDisabled: boolean
      staticReady: boolean
      error: string | null
      channels: number
    }>
    stop: () => Promise<{
      running: boolean
      port: number
      host: string
      url: string
      authToken: string
      authRequired: boolean
      authDisabled: boolean
      staticReady: boolean
      error: string | null
      channels: number
    }>
    generateToken: () => Promise<{ token: string; settings: AppSettings }>
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
    /** Native File menu / Settings: full DB+media+settings zip */
    exportFullBackup: () => Promise<{ ok: true } | null>
    /** Restore full zip (overwrites + relaunches) */
    importFullBackup: () => Promise<{ ok: true } | null>
    rebuildMenu: () => Promise<{ ok: true }>
    /** Subscribe to native menu → renderer actions */
    onMenuAction: (callback: (action: MenuAction) => void) => () => void
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
        level?: string
        storyId?: string
        meta?: Record<string, unknown>
      }>
    >
    query: (opts?: {
      limit?: number
      kind?: string
      level?: string
      q?: string
      since?: string
      until?: string
    }) => Promise<{
      entries: Array<{
        ts: string
        kind: string
        message: string
        level?: string
        storyId?: string
        meta?: Record<string, unknown>
      }>
      totalReturned: number
      path: string
      kinds: string[]
    }>
    clear: () => Promise<{ ok: true; path: string }>
    getPath: () => Promise<{ path: string }>
    openLogFolder: () => Promise<{ ok: true; path: string }>
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
    ) => Promise<{ outputPath: string }>
    /** All export versions for a story (newest first). */
    listExports: (storyId: string) => Promise<{
      items: Array<{
        id: string
        storyId: string
        kind: 'final' | 'board'
        fileName: string
        path: string
        workPath?: string | null
        createdAt: string
        sizeBytes?: number | null
      }>
      latestPath: string | null
    }>
    /** Delete one export version by id (or path / fileName). */
    deleteExport: (
      storyId: string,
      exportId: string
    ) => Promise<{
      ok: boolean
      items: Array<{
        id: string
        storyId: string
        kind: 'final' | 'board'
        fileName: string
        path: string
        workPath?: string | null
        createdAt: string
        sizeBytes?: number | null
      }>
      latestPath: string | null
    }>
    importClip: (
      storyId: string,
      entryId: string
    ) => Promise<{ filePath: string } | null>
    openClip: (filePath: string) => Promise<{ ok: boolean }>
    toPreviewUrl: (filePath: string) => Promise<{ url: string; filePath: string }>
    /** Save a copy via native Save dialog */
    saveAs: (filePath: string) => Promise<{ filePath: string } | null>
    /** Delete a draft sheet under media/tmp */
    discardSheetDraft: (filePath: string) => Promise<{ ok: boolean }>
    checkFfmpeg: () => Promise<{
      available: boolean
      message: string
      /** Resolved binary when available (diagnostics only) */
      path?: string
    }>
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
