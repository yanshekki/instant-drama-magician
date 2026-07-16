/** Domain types — framework-independent */

export type StoryStatus = 'DRAFT' | 'GENERATING' | 'COMPLETED' | 'FAILED'
export type SceneStatus = 'PENDING' | 'GENERATING' | 'COMPLETED' | 'FAILED'

export interface Story {
  id: string
  title: string
  status: StoryStatus
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
}

/** Generation pipeline */
export type PipelineStepName =
  | 'script'
  | 'character'
  | 'scene'
  | 'props'
  | 'timeline'
  | 'export'

export interface PipelineStepResult {
  step: PipelineStepName
  success: boolean
  output?: string
  error?: string
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

export interface PipelineContext {
  story: StoryDetail
  ai: AIProvider
  artifacts: Record<string, string>
}
