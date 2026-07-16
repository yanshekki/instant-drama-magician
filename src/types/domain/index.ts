/** Domain types — framework-independent */

export type StoryStatus = 'DRAFT' | 'GENERATING' | 'COMPLETED' | 'FAILED'
export type SceneStatus = 'PENDING' | 'GENERATING' | 'COMPLETED' | 'FAILED'
export type MediaStatus = 'EMPTY' | 'QUEUED' | 'GENERATING' | 'READY' | 'FAILED'

export interface Story {
  id: string
  title: string
  status: StoryStatus
  exportPath?: string | null
  createdAt: string | Date
  updatedAt: string | Date
}

export interface StoryWithCounts extends Story {
  _count?: {
    characters: number
    scenes: number
    props: number
    timeline: number
  }
}

export interface StoryDetail extends Story {
  characters: Character[]
  scenes: Scene[]
  props: Prop[]
  timeline: TimelineEntry[]
}

export interface Character {
  id: string
  storyId: string
  name: string
  soulMdPath: string | null
  description: string
  refImagePath: string | null
}

export interface Scene {
  id: string
  storyId: string
  sceneNumber: number
  description: string
  script: string | null
  status: SceneStatus
}

export interface Prop {
  id: string
  storyId: string
  name: string
  description: string
}

export interface TimelineEntry {
  id: string
  storyId: string
  startTime: number
  endTime: number
  characterId: string | null
  sceneId: string | null
  propId: string | null
  dialogue: string | null
  order: number
  mediaPath: string | null
  mediaStatus: MediaStatus
  mediaError: string | null
}

export interface CreateStoryInput {
  title: string
}

export interface CreateCharacterInput {
  storyId: string
  name: string
  description: string
  soulMdPath?: string | null
  refImagePath?: string | null
}

export interface CreateSceneInput {
  storyId: string
  sceneNumber: number
  description: string
  script?: string | null
  status?: SceneStatus
}

export interface CreatePropInput {
  storyId: string
  name: string
  description: string
}

export interface CreateTimelineEntryInput {
  storyId: string
  startTime: number
  endTime: number
  characterId?: string | null
  sceneId?: string | null
  propId?: string | null
  dialogue?: string | null
  order: number
}

export interface UpdateTimelineEntryInput {
  startTime?: number
  endTime?: number
  characterId?: string | null
  sceneId?: string | null
  propId?: string | null
  dialogue?: string | null
  order?: number
  mediaPath?: string | null
  mediaStatus?: MediaStatus
  mediaError?: string | null
}

export interface VideoGenRequest {
  prompt: string
  durationSeconds: number
  refImagePath?: string | null
  outputPath: string
}

export interface VideoGenResult {
  outputPath: string
  degraded?: boolean
}

/** AI provider contract */
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
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

export interface AIProviderStatus {
  available: boolean
  baseUrl: string
  model: string
  message: string
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
  }
  signal?: AbortSignal
  onlyFailedVideos?: boolean
  onClipProgress?: (payload: {
    entryId: string
    index: number
    total: number
    status: MediaStatus
  }) => void
}
