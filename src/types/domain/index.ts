/** Domain types — framework-independent */

export type StoryStatus = 'DRAFT' | 'GENERATING' | 'COMPLETED' | 'FAILED'
export type SceneStatus = 'PENDING' | 'GENERATING' | 'COMPLETED' | 'FAILED'
export type MediaStatus = 'EMPTY' | 'QUEUED' | 'GENERATING' | 'READY' | 'FAILED'

export interface Story {
  id: string
  title: string
  status: StoryStatus
  exportPath?: string | null
  /** Visual / tone bible for clip prompt continuity */
  styleNote?: string | null
  /** Art medium id (same catalog as Character.artStyle). */
  artStyle?: string | null
  /** List-card poster (like Character.refImagePath). */
  coverPath?: string | null
  refGalleryJson?: string | null
  createdAt: string | Date
  updatedAt: string | Date
}

export interface StoryWithCounts extends Story {
  _count?: {
    characters?: number
    scenes?: number
    props?: number
    actions?: number
    timeline?: number
    storyCharacters?: number
    storyScenes?: number
    storyProps?: number
    storyActions?: number
  }
}

export interface StoryDetail extends Story {
  characters: Character[]
  scenes: Scene[]
  props: Prop[]
  actions: Action[]
  timeline: TimelineEntry[]
}

export interface Character {
  id: string
  /** @deprecated assets are global; optional when loaded via story join */
  storyId?: string
  name: string
  soulMdPath: string | null
  description: string
  refImagePath: string | null
  appearance?: string | null
  personality?: string | null
  backstory?: string | null
  costume?: string | null
  ageRange?: string | null
  gender?: string | null
  voiceDesc?: string | null
  /** JSON array of BCP-47 / ISO language codes the character speaks */
  spokenLanguages?: string | null
  mannerisms?: string | null
  relationships?: string | null
  visualTags?: string | null
  seedPrompt?: string | null
  profileJson?: string | null
  refSheetPath?: string | null
  refGalleryJson?: string | null
  soulHubId?: number | null
  /** Image art style id (photo_cinematic, anime_modern, …) */
  artStyle?: string | null
  /** JSON wardrobe library (see characterCostumes domain) */
  costumesJson?: string | null
}

/** AI-filled / form profile for a character (JSON schema for master prompt). */
export interface CharacterProfileFields {
  name: string
  description: string
  appearance?: string
  personality?: string
  backstory?: string
  costume?: string
  ageRange?: string
  gender?: string
  voiceDesc?: string
  /** ISO / BCP-47 codes (e.g. yue, en, ja) — multi spoken languages */
  spokenLanguages?: string[]
  mannerisms?: string
  relationships?: string
  visualTags?: string
  /** Original idea / seed used for master-prompt invent */
  seedPrompt?: string
}

export interface Scene {
  id: string
  /** @deprecated global library; optional when via join */
  storyId?: string
  /** Per-story number from StoryScene join (not stored on Scene). */
  sceneNumber?: number
  description: string
  script: string | null
  status: SceneStatus
  title?: string | null
  locationType?: string | null
  timeOfDay?: string | null
  weather?: string | null
  mood?: string | null
  lighting?: string | null
  colorPalette?: string | null
  setDressing?: string | null
  soundscape?: string | null
  cameraNotes?: string | null
  visualTags?: string | null
  artStyle?: string | null
  refImagePath?: string | null
  refGalleryJson?: string | null
  looksJson?: string | null
  profileJson?: string | null
  seedPrompt?: string | null
  locationKey?: string | null
}

/** AI-filled / form profile for a scene location bible. */
export interface SceneProfileFields {
  title?: string
  description: string
  script?: string
  locationType?: string
  timeOfDay?: string
  weather?: string
  mood?: string
  lighting?: string
  colorPalette?: string
  setDressing?: string
  soundscape?: string
  cameraNotes?: string
  visualTags?: string
}

export interface Prop {
  id: string
  /** @deprecated global library; optional when via join */
  storyId?: string
  name: string
  description: string
  material?: string | null
  sizeNotes?: string | null
  condition?: string | null
  visualTags?: string | null
  artStyle?: string | null
  refImagePath?: string | null
  refGalleryJson?: string | null
  profileJson?: string | null
  seedPrompt?: string | null
}

export interface PropProfileFields {
  name: string
  description: string
  material?: string
  sizeNotes?: string
  condition?: string
  visualTags?: string
}

export interface Action {
  id: string
  name: string
  description: string
  motionNotes?: string | null
  intention?: string | null
  cameraNotes?: string | null
  panelLayout?: string | null
  visualTags?: string | null
  artStyle?: string | null
  refImagePath?: string | null
  refGalleryJson?: string | null
  castRefsJson?: string | null
  profileJson?: string | null
  seedPrompt?: string | null
  createdAt?: string
  updatedAt?: string
}

export interface ActionProfileFields {
  name: string
  description: string
  motionNotes?: string
  intention?: string
  cameraNotes?: string
  visualTags?: string
}

export interface TimelineEntry {
  id: string
  storyId: string
  startTime: number
  endTime: number
  /** Primary character = characterIds[0] */
  characterId: string | null
  sceneId: string | null
  propId: string | null
  actionId: string | null
  /** Multi-bind lists (hydrated on list/create/update responses). */
  characterIds: string[]
  sceneIds: string[]
  propIds: string[]
  actionIds: string[]
  /** Spoken-line cache / legacy free text */
  dialogue: string | null
  /** Structured beat screenplay (BeatContent JSON) */
  beatContentJson: string | null
  order: number
  mediaPath: string | null
  mediaStatus: MediaStatus
  mediaError: string | null
  videoJobId: string | null
}

export interface CreateStoryInput {
  title: string
  styleNote?: string | null
  artStyle?: string | null
}

export interface UpdateStoryInput {
  title?: string
  status?: StoryStatus | string
  styleNote?: string | null
  artStyle?: string | null
  coverPath?: string | null
  refGalleryJson?: string | null
}

export interface CreateCharacterInput {
  /** When set, auto-link to this story after create (M2M). */
  storyId?: string
  linkStoryId?: string | null
  name: string
  description: string
  soulMdPath?: string | null
  refImagePath?: string | null
  appearance?: string | null
  personality?: string | null
  backstory?: string | null
  costume?: string | null
  ageRange?: string | null
  gender?: string | null
  voiceDesc?: string | null
  /** JSON string array of language codes */
  spokenLanguages?: string | null
  mannerisms?: string | null
  relationships?: string | null
  visualTags?: string | null
  seedPrompt?: string | null
  profileJson?: string | null
  refSheetPath?: string | null
  refGalleryJson?: string | null
  soulHubId?: number | null
  artStyle?: string | null
  costumesJson?: string | null
}

export type UpdateCharacterInput = Partial<
  Omit<CreateCharacterInput, 'storyId' | 'linkStoryId'>
>

export interface CreateSceneInput {
  /** When set, auto-link to this story after create (M2M). */
  storyId?: string
  linkStoryId?: string | null
  /** Per-story scene number when linking. */
  sceneNumber?: number
  description: string
  script?: string | null
  status?: SceneStatus
  title?: string | null
  locationType?: string | null
  timeOfDay?: string | null
  weather?: string | null
  mood?: string | null
  lighting?: string | null
  colorPalette?: string | null
  setDressing?: string | null
  soundscape?: string | null
  cameraNotes?: string | null
  visualTags?: string | null
  artStyle?: string | null
  refImagePath?: string | null
  refGalleryJson?: string | null
  looksJson?: string | null
  profileJson?: string | null
  seedPrompt?: string | null
  locationKey?: string | null
}

export type UpdateSceneInput = Partial<
  Omit<CreateSceneInput, 'storyId' | 'linkStoryId' | 'sceneNumber'>
>

export interface CreatePropInput {
  /** When set, auto-link to this story after create (M2M). */
  storyId?: string
  linkStoryId?: string | null
  name: string
  description: string
  material?: string | null
  sizeNotes?: string | null
  condition?: string | null
  visualTags?: string | null
  artStyle?: string | null
  refImagePath?: string | null
  refGalleryJson?: string | null
  profileJson?: string | null
  seedPrompt?: string | null
}

export type UpdatePropInput = Partial<
  Omit<CreatePropInput, 'storyId' | 'linkStoryId'>
>

export interface CreateActionInput {
  /** When set, auto-link to this story after create (M2M). */
  storyId?: string
  linkStoryId?: string | null
  name: string
  description?: string
  motionNotes?: string | null
  intention?: string | null
  cameraNotes?: string | null
  panelLayout?: string | null
  visualTags?: string | null
  artStyle?: string | null
  refImagePath?: string | null
  refGalleryJson?: string | null
  castRefsJson?: string | null
  profileJson?: string | null
  seedPrompt?: string | null
}

export type UpdateActionInput = Partial<
  Omit<CreateActionInput, 'storyId' | 'linkStoryId'>
>

export interface CreateTimelineEntryInput {
  storyId: string
  startTime: number
  endTime: number
  characterId?: string | null
  sceneId?: string | null
  propId?: string | null
  actionId?: string | null
  characterIds?: string[] | null
  sceneIds?: string[] | null
  propIds?: string[] | null
  actionIds?: string[] | null
  dialogue?: string | null
  beatContentJson?: string | null
  order: number
}

export interface UpdateTimelineEntryInput {
  startTime?: number
  endTime?: number
  characterId?: string | null
  sceneId?: string | null
  propId?: string | null
  actionId?: string | null
  characterIds?: string[] | null
  sceneIds?: string[] | null
  propIds?: string[] | null
  actionIds?: string[] | null
  dialogue?: string | null
  beatContentJson?: string | null
  order?: number
  mediaPath?: string | null
  mediaStatus?: MediaStatus
  mediaError?: string | null
  videoJobId?: string | null
}

export interface VideoGenRequest {
  prompt: string
  durationSeconds: number
  refImagePath?: string | null
  outputPath: string
  aspectRatio?: string
  sourceAssetId?: string
  sourceDocumentId?: string
}

export interface VideoGenResult {
  outputPath: string
  degraded?: boolean
  jobId?: string
}

/** OpenAI-compatible multimodal content parts (vision). */
export type ChatContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } }

/**
 * Flatten assistant/user content to plain text (ignores image parts).
 * Use when reading LLM replies that may be string or multimodal parts.
 */
export function chatContentText(
  content: string | ChatContentPart[] | null | undefined
): string {
  if (content == null) return ''
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return ''
  return content
    .map((p) => {
      if (!p || typeof p !== 'object') return ''
      if (p.type === 'text' && 'text' in p) return String(p.text ?? '')
      return ''
    })
    .join('')
}

/** AI provider contract */
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  /** Plain string or multimodal parts (vision user messages). */
  content: string | ChatContentPart[]
}

export interface ChatCompletionRequest {
  model?: string
  messages: ChatMessage[]
  temperature?: number
  max_tokens?: number
}

export interface ChatCompletionChoice {
  index: number
  message: ChatMessage
  finish_reason: string | null
}

export interface ChatCompletionResponse {
  id: string
  object: string
  created: number
  model: string
  choices: ChatCompletionChoice[]
}

export interface AIChannelStatus {
  available: boolean
  message: string
  /** Provider id (e.g. openai, same-as-llm, stub) */
  provider?: string
}

export interface AIProviderStatus {
  available: boolean
  baseUrl: string
  model: string
  message: string
  /** Chat / LLM channel */
  chat?: AIChannelStatus
  /**
   * Image channel — only populated when settings.imageProvider is not same-as-llm.
   */
  image?: AIChannelStatus | null
  /**
   * Video channel — only populated when settings.videoProvider is not same-as-llm.
   */
  video?: AIChannelStatus | null
}

export interface AIProvider {
  getStatus(): Promise<AIProviderStatus>
  chat(request: ChatCompletionRequest): Promise<ChatCompletionResponse>
  generateVideo?(request: VideoGenRequest): Promise<VideoGenResult>
}

/** Generation pipeline */
export type PipelineStepName =
  | 'script'
  | 'character'
  | 'scene'
  | 'props'
  | 'timeline'
  | 'video'
  | 'export'

export interface PipelineStepResult {
  step: PipelineStepName
  success: boolean
  output?: string
  error?: string
  degraded?: boolean
}

export interface GenerationResult {
  storyId: string
  steps: PipelineStepResult[]
  success: boolean
}

export interface PipelineStep {
  name: PipelineStepName
  run(context: PipelineContext): Promise<PipelineStepResult>
}

/** Optional persistence hooks for steps that write back to the DB */
export interface PipelinePersistence {
  updateSceneScript?: (
    sceneId: string,
    script: string,
    status?: SceneStatus
  ) => Promise<void>
  replaceTimelineSuggestions?: (
    storyId: string,
    entries: Array<{
      startTime: number
      endTime: number
      sceneId?: string | null
      characterId?: string | null
      dialogue?: string | null
      order: number
    }>
  ) => Promise<void>
  setExportPath?: (storyId: string, path: string) => Promise<void>
  updateEntryMedia?: (
    entryId: string,
    data: {
      mediaPath?: string | null
      mediaStatus: MediaStatus
      mediaError?: string | null
      videoJobId?: string | null
    }
  ) => Promise<void>
  listTimeline?: (storyId: string) => Promise<TimelineEntry[]>
}

export interface PipelineContext {
  story: StoryDetail
  ai: AIProvider
  artifacts: Record<string, string>
  persistence?: PipelinePersistence
  media?: {
    exportStoryboard?: (storyId: string) => Promise<string>
    exportConcat?: (storyId: string) => Promise<string>
    clipOutputPath?: (storyId: string, entryId: string) => string
    /** Previous-beat keyframe for clip-to-clip visual continuity. */
    clipContinuityStillPath?: (storyId: string, entryId: string) => string
  }
  signal?: AbortSignal
  onlyFailedVideos?: boolean
  /**
   * Skip automatic Video (+ Export) steps — UI will run per-clip video-prep.
   * Used by Timeline interactive queue.
   */
  interactiveVideo?: boolean
  videoConcurrency?: number
  onClipProgress?: (payload: {
    entryId: string
    index: number
    total: number
    status: MediaStatus
    jobId?: string
  }) => void
  aspectRatio?: string
}
