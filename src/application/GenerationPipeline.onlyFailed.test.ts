import { describe, expect, it } from 'vitest'
import { GenerationPipeline } from './GenerationPipeline'
import type {
  AIProvider,
  PipelineStep,
  PipelineStepResult,
  StoryDetail
} from '../types/domain'

class RecordingStep implements PipelineStep {
  constructor(
    readonly name: PipelineStep['name'],
    private readonly calls: string[]
  ) {}
  async run(): Promise<PipelineStepResult> {
    this.calls.push(this.name)
    return { step: this.name, success: true, output: this.name }
  }
}

describe('GenerationPipeline onlyFailedVideos', () => {
  it('runs only video step when retrying failed clips', async () => {
    const calls: string[] = []
    const steps: PipelineStep[] = [
      new RecordingStep('script', calls),
      new RecordingStep('character', calls),
      new RecordingStep('scene', calls),
      new RecordingStep('props', calls),
      new RecordingStep('timeline', calls),
      new RecordingStep('video', calls),
      new RecordingStep('export', calls)
    ]
    const ai = {
      getStatus: async () => ({
        available: false,
        baseUrl: '',
        model: '',
        message: ''
      }),
      chat: async () => {
        throw new Error('no chat')
      }
    } as AIProvider
    const pipeline = new GenerationPipeline(ai, steps)
    const story = {
      id: 's1',
      title: 't',
      status: 'DRAFT',
      createdAt: new Date(),
      updatedAt: new Date(),
      characters: [],
      scenes: [],
      props: [],
      timeline: []
    } as StoryDetail

    const result = await pipeline.run(story, { onlyFailedVideos: true })
    expect(result.success).toBe(true)
    expect(calls).toEqual(['video'])
  })
})
