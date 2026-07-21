/**
 * Shared ElectronApi mock for hooks / pages / components.
 */
import { vi } from 'vitest'
import type { ElectronApi } from '../types/electron-api'

export function createMockApi(
  overrides: Partial<Record<keyof ElectronApi, unknown>> = {}
): ElectronApi {
  const api = {
    stories: {
      list: vi.fn().mockResolvedValue([]),
      get: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: 's1' }),
      update: vi.fn().mockResolvedValue({}),
      delete: vi.fn().mockResolvedValue({ ok: true }),
      seedDemo: vi.fn().mockResolvedValue({ storyId: 's1', title: 'Demo' }),
      generateCover: vi.fn().mockResolvedValue({ path: '/tmp/c.png' }),
      commitCover: vi.fn().mockResolvedValue({}),
      aiFillMeta: vi.fn().mockResolvedValue({ styleNote: '' }),
      aiFillScript: vi.fn().mockResolvedValue({ beats: [], drafts: [], raw: '' }),
      linkCharacter: vi.fn().mockResolvedValue({}),
      unlinkCharacter: vi.fn().mockResolvedValue({}),
      linkScene: vi.fn().mockResolvedValue({}),
      unlinkScene: vi.fn().mockResolvedValue({}),
      linkProp: vi.fn().mockResolvedValue({}),
      unlinkProp: vi.fn().mockResolvedValue({}),
      listCast: vi.fn().mockResolvedValue([]),
      setCharacterCostume: vi.fn().mockResolvedValue({})
    },
    characters: {
      list: vi.fn().mockResolvedValue([]),
      create: vi.fn().mockResolvedValue({ id: 'c1' }),
      update: vi.fn().mockResolvedValue({}),
      delete: vi.fn().mockResolvedValue({ ok: true }),
      aiFill: vi.fn().mockResolvedValue({}),
      generateSheet: vi.fn().mockResolvedValue({ path: '/tmp/s.png' }),
      commitSheet: vi.fn().mockResolvedValue({}),
      generateSoul: vi.fn().mockResolvedValue({}),
      importSoulMd: vi.fn().mockResolvedValue({}),
      importSoulMdUrl: vi.fn().mockResolvedValue({}),
      readSoulContent: vi.fn().mockResolvedValue(''),
      writeSoulContent: vi.fn().mockResolvedValue({}),
      suggestWardrobe: vi.fn().mockResolvedValue([]),
      swapCostume: vi.fn().mockResolvedValue({}),
      generateIntroVideo: vi.fn().mockResolvedValue({})
    },
    scenes: {
      list: vi.fn().mockResolvedValue([]),
      create: vi.fn().mockResolvedValue({ id: 'sc1' }),
      update: vi.fn().mockResolvedValue({}),
      delete: vi.fn().mockResolvedValue({ ok: true }),
      aiFill: vi.fn().mockResolvedValue({}),
      generatePlate: vi.fn().mockResolvedValue({ path: '/tmp/p.png' }),
      commitPlate: vi.fn().mockResolvedValue({}),
      generateIntroVideo: vi.fn().mockResolvedValue({}),
      swapAtmosphere: vi.fn().mockResolvedValue({}),
      copyGalleryFrom: vi.fn().mockResolvedValue({})
    },
    props: {
      list: vi.fn().mockResolvedValue([]),
      create: vi.fn().mockResolvedValue({ id: 'p1' }),
      update: vi.fn().mockResolvedValue({}),
      delete: vi.fn().mockResolvedValue({ ok: true }),
      aiFill: vi.fn().mockResolvedValue({}),
      generatePlate: vi.fn().mockResolvedValue({ path: '/tmp/p.png' }),
      commitPlate: vi.fn().mockResolvedValue({}),
      generateIntroVideo: vi.fn().mockResolvedValue({})
    },
    actions: {
      list: vi.fn().mockResolvedValue([]),
      get: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: 'a1' }),
      update: vi.fn().mockResolvedValue({}),
      delete: vi.fn().mockResolvedValue({ ok: true }),
      linkStory: vi.fn().mockResolvedValue({ ok: true }),
      unlinkStory: vi.fn().mockResolvedValue({ ok: true }),
      aiFill: vi.fn().mockResolvedValue({ profile: {}, profileJson: '{}', raw: '' }),
      generatePlate: vi.fn().mockResolvedValue({ path: '/tmp/a.png' }),
      commitPlate: vi.fn().mockResolvedValue({}),
      generateIntroVideo: vi.fn().mockResolvedValue({})
    },
    costumes: {
      list: vi.fn().mockResolvedValue([]),
      get: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: 'co1' }),
      update: vi.fn().mockResolvedValue({}),
      delete: vi.fn().mockResolvedValue({ ok: true }),
      listForCharacter: vi.fn().mockResolvedValue([]),
      linkCharacter: vi.fn().mockResolvedValue({}),
      unlinkCharacter: vi.fn().mockResolvedValue({}),
      setActive: vi.fn().mockResolvedValue({}),
      aiFill: vi.fn().mockResolvedValue({}),
      generateDressed: vi.fn().mockResolvedValue({}),
      generateIntroVideo: vi.fn().mockResolvedValue({})
    },
    timeline: {
      list: vi.fn().mockResolvedValue([]),
      create: vi.fn().mockResolvedValue({ id: 't1' }),
      update: vi.fn().mockResolvedValue({}),
      delete: vi.fn().mockResolvedValue({ ok: true }),
      reorder: vi.fn().mockResolvedValue({ ok: true }),
      setMedia: vi.fn().mockResolvedValue({}),
      clearEntryStill: vi.fn().mockResolvedValue({}),
      getAdvancedPrep: vi.fn().mockResolvedValue({}),
      setCastPrep: vi.fn().mockResolvedValue({})
    },
    settings: {
      get: vi.fn().mockResolvedValue({
        uiLanguage: 'en',
        legalAcceptedVersion: '1.0.0',
        webServerPort: 8787
      }),
      set: vi.fn().mockImplementation(async (p: unknown) => p)
    },
    ai: {
      status: vi.fn().mockResolvedValue({ available: true, message: 'ok' }),
      listModels: vi.fn().mockResolvedValue([]),
      testChat: vi.fn().mockResolvedValue({ ok: true }),
      probeChat: vi.fn().mockResolvedValue({ available: true }),
      probeVideo: vi.fn().mockResolvedValue({ available: false }),
      applyGrokDefaults: vi.fn().mockResolvedValue({}),
      applyLlmPreset: vi.fn().mockResolvedValue({})
    },
    app: {
      getInfo: vi
        .fn()
        .mockResolvedValue({ version: '1.0.0', name: 'IDM', channels: 137 }),
      exportFullBackup: vi.fn().mockResolvedValue({ ok: true }),
      importFullBackup: vi.fn().mockResolvedValue({ ok: true }),
      rebuildMenu: vi.fn().mockResolvedValue({ ok: true }),
      onMenuAction: vi.fn(() => () => undefined)
    },
    media: {
      checkFfmpeg: vi.fn().mockResolvedValue({ available: true }),
      toPreviewUrl: vi.fn().mockResolvedValue({ url: 'x', filePath: 'y' }),
      pickRefImage: vi.fn().mockResolvedValue(null),
      pickBgm: vi.fn().mockResolvedValue(null),
      saveAs: vi.fn().mockResolvedValue(null),
      listExports: vi.fn().mockResolvedValue([]),
      exportFinal: vi.fn().mockResolvedValue({}),
      exportPreflight: vi.fn().mockResolvedValue({ ok: true }),
      exportConcat: vi.fn().mockResolvedValue({}),
      exportStoryboard: vi.fn().mockResolvedValue({}),
      importClip: vi.fn().mockResolvedValue({}),
      openClip: vi.fn().mockResolvedValue({}),
      deleteExport: vi.fn().mockResolvedValue({}),
      discardSheetDraft: vi.fn().mockResolvedValue({})
    },
    activity: {
      recent: vi.fn().mockResolvedValue([]),
      query: vi.fn().mockResolvedValue([]),
      clear: vi.fn().mockResolvedValue({ ok: true }),
      getPath: vi.fn().mockResolvedValue({ path: '/tmp/a.log' }),
      openLogFolder: vi.fn().mockResolvedValue({ ok: true })
    },
    diagnostics: {
      full: vi.fn().mockResolvedValue({})
    },
    webServer: {
      status: vi.fn().mockResolvedValue({ running: false }),
      start: vi.fn().mockResolvedValue({}),
      stop: vi.fn().mockResolvedValue({}),
      generateToken: vi.fn().mockResolvedValue('token')
    },
    generation: {
      run: vi.fn().mockResolvedValue({ success: true, steps: [] }),
      runClip: vi.fn().mockResolvedValue({}),
      cancel: vi.fn().mockResolvedValue({ ok: true }),
      progress: vi.fn().mockResolvedValue(null),
      onProgress: vi.fn(() => () => undefined)
    },
    updates: {
      status: vi.fn().mockResolvedValue({
        status: 'idle',
        channel: 'desktop-dev',
        currentVersion: '0.0.0',
        canCheck: false,
        canDownload: false,
        canAutoInstall: false,
        source: 'none'
      }),
      check: vi.fn().mockResolvedValue({
        status: 'dev-skipped',
        channel: 'desktop-dev',
        currentVersion: '0.0.0'
      }),
      download: vi.fn().mockResolvedValue({ status: 'dev-skipped' }),
      install: vi.fn().mockResolvedValue({ ok: false }),
      checkNpm: vi.fn().mockResolvedValue({
        packageName: 'instant-drama-magician',
        currentVersion: '0.0.0',
        latestVersion: null,
        updateAvailable: false,
        checkedAt: new Date().toISOString(),
        installCommand: 'npm install -g instant-drama-magician@latest'
      }),
      openReleasePage: vi.fn().mockResolvedValue({
        ok: true,
        url: 'https://github.com/yanshekki/instant-drama-magician/releases'
      }),
      onState: vi.fn(() => () => undefined)
    },
    shell: {
      openExternal: vi.fn().mockResolvedValue({ ok: true }),
      openPath: vi.fn().mockResolvedValue({ ok: true }),
      showItemInFolder: vi.fn().mockResolvedValue({ ok: true })
    },
    project: {
      exportBackup: vi.fn().mockResolvedValue({}),
      importBackup: vi.fn().mockResolvedValue({})
    },
    support: {
      exportReport: vi.fn().mockResolvedValue({})
    },
    gateway: {
      status: vi.fn().mockResolvedValue({}),
      ensure: vi.fn().mockResolvedValue({}),
      installHints: vi.fn().mockResolvedValue({}),
      openAdmin: vi.fn().mockResolvedValue({})
    },
    souls: {
      list: vi.fn().mockResolvedValue([]),
      get: vi.fn().mockResolvedValue(null),
      searchLocal: vi.fn().mockResolvedValue([]),
      categories: vi.fn().mockResolvedValue([]),
      suggestions: vi.fn().mockResolvedValue([]),
      ensureIndex: vi.fn().mockResolvedValue({})
    },
    videoPrep: {
      create: vi.fn().mockResolvedValue({}),
      confirm: vi.fn().mockResolvedValue({}),
      openFromStill: vi.fn().mockResolvedValue({}),
      regenStill: vi.fn().mockResolvedValue({})
    },
    ...overrides
  }
  return api as unknown as ElectronApi
}

export function stubGetApi(api: ElectronApi = createMockApi()): void {
  vi.mock('../../lib/api', () => ({
    getApi: () => api,
    isElectron: () => false,
    isWebRuntime: () => true
  }))
}
