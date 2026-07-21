/**
 * Shared realistic fixtures for presentation page / context tests.
 */

export const nowIso = '2026-07-15T12:00:00.000Z'
export const oldIso = '2026-07-01T08:00:00.000Z'

export function makeStory(overrides: Record<string, unknown> = {}) {
  return {
    id: 'story-1',
    title: 'Demo Story',
    status: 'DRAFT',
    styleNote: 'noir rain',
    hardRules: 'no logos',
    artStyle: 'anime',
    coverPath: '/media/cover.png',
    refGalleryJson: null,
    createdAt: oldIso,
    updatedAt: nowIso,
    _count: {
      storyCharacters: 1,
      storyScenes: 1,
      storyProps: 1,
      storyActions: 0,
      timeline: 1,
      characters: 1,
      scenes: 1,
      props: 1,
      actions: 0
    },
    ...overrides
  }
}

export function makeCharacter(overrides: Record<string, unknown> = {}) {
  return {
    id: 'char-1',
    name: 'Aria',
    description: 'Lead detective',
    appearance: 'short dark hair',
    personality: 'stoic',
    backstory: 'ex-cop',
    costume: 'trench coat',
    ageRange: '30s',
    gender: 'female',
    voiceDesc: 'low',
    spokenLanguages: '["en"]',
    mannerisms: 'taps pen',
    relationships: '',
    visualTags: 'rain, neon',
    seedPrompt: 'detective',
    profileJson: '{}',
    artStyle: 'anime',
    hardRules: '',
    refImagePath: '/media/aria.png',
    refGalleryJson: null,
    soulMdPath: null,
    createdAt: oldIso,
    updatedAt: nowIso,
    ...overrides
  }
}

export function makeScene(overrides: Record<string, unknown> = {}) {
  return {
    id: 'scene-1',
    title: 'Rooftop',
    description: 'Rainy night rooftop',
    script: 'Aria waits.',
    locationType: 'exterior',
    timeOfDay: 'night',
    weather: 'rain',
    mood: 'tense',
    lighting: 'neon',
    colorPalette: 'cyan/magenta',
    setDressing: 'AC units',
    soundscape: 'rain',
    cameraNotes: 'wide',
    visualTags: 'city',
    artStyle: 'anime',
    profileJson: '{}',
    seedPrompt: 'rooftop',
    hardRules: '',
    refImagePath: '/media/roof.png',
    refGalleryJson: null,
    createdAt: oldIso,
    updatedAt: nowIso,
    ...overrides
  }
}

export function makeProp(overrides: Record<string, unknown> = {}) {
  return {
    id: 'prop-1',
    name: 'Badge',
    description: 'Police badge',
    material: 'metal',
    sizeNotes: 'palm',
    condition: 'worn',
    visualTags: 'shiny',
    artStyle: 'anime',
    profileJson: '{}',
    seedPrompt: 'badge',
    hardRules: '',
    refImagePath: '/media/badge.png',
    refGalleryJson: null,
    createdAt: oldIso,
    updatedAt: nowIso,
    ...overrides
  }
}

export function makeAction(overrides: Record<string, unknown> = {}) {
  return {
    id: 'action-1',
    name: 'Draw gun',
    description: 'Quick draw',
    motionNotes: 'snap',
    intention: 'threaten',
    cameraNotes: 'close-up',
    visualTags: 'action',
    artStyle: 'anime',
    profileJson: '{}',
    seedPrompt: 'draw',
    hardRules: '',
    refImagePath: null,
    refGalleryJson: null,
    createdAt: oldIso,
    updatedAt: nowIso,
    ...overrides
  }
}

export function makeCostume(overrides: Record<string, unknown> = {}) {
  return {
    id: 'cost-1',
    name: 'Rain coat',
    description: 'Long black trench',
    refImagePath: '/media/coat.png',
    characterLinks: [{ characterId: 'char-1', character: { id: 'char-1' } }],
    createdAt: oldIso,
    updatedAt: nowIso,
    ...overrides
  }
}

export function makeTimelineEntry(overrides: Record<string, unknown> = {}) {
  return {
    id: 'entry-1',
    storyId: 'story-1',
    order: 0,
    dialogue: 'We start here.',
    duration: 4,
    startTime: 0,
    endTime: 4,
    characterId: 'char-1',
    sceneId: 'scene-1',
    propId: null,
    actionId: null,
    mediaPath: null,
    stillPath: null,
    mediaStatus: 'EMPTY',
    status: 'PENDING',
    contentJson: null,
    createdAt: oldIso,
    updatedAt: nowIso,
    ...overrides
  }
}

export function makeStoryDetail(overrides: Record<string, unknown> = {}) {
  const base = makeStory()
  return {
    ...base,
    characters: [
      {
        ...makeCharacter(),
        storyCostumeId: null,
        storyCostume: null
      }
    ],
    scenes: [makeScene()],
    props: [makeProp()],
    actions: [],
    ...overrides
  }
}

export function makeAuditEntries() {
  const t0 = '2026-07-15T12:00:00.000Z'
  const t1 = '2026-07-15T11:00:00.000Z'
  const t2 = '2026-07-14T10:00:00.000Z'
  return [
    {
      ts: t0,
      kind: 'ipc',
      message: 'media:exportFinal',
      level: 'info',
      storyId: 'story-1',
      meta: { ms: 3200, ok: true }
    },
    {
      ts: t1,
      kind: 'generation',
      message: 'generation:run pipeline step',
      level: 'error',
      storyId: 'story-1',
      meta: { ms: 100, ok: false }
    },
    {
      ts: t2,
      kind: 'ipc',
      message: 'characters:aiFill',
      level: 'warn',
      meta: { ms: 50 }
    },
    {
      ts: t2,
      kind: 'ipc',
      message: 'media:toPreviewUrl',
      level: 'debug',
      meta: {}
    },
    {
      ts: t1,
      kind: 'export',
      message: 'export board done',
      level: 'info',
      meta: { ms: 10 }
    },
    {
      ts: 'not-a-date',
      kind: 'ipc',
      message: 'app:getInfo',
      level: 'info',
      meta: {}
    }
  ]
}
