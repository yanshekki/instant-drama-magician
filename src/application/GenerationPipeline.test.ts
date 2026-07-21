import { describe, expect, it, vi } from 'vitest'
import { GenerationPipeline } from './GenerationPipeline'
import type { PipelineStep, StoryDetail } from '../types/domain'

const emptyStory = {
  id: 's1',
  title: 'T',
  status: 'DRAFT',
  characters: [],
  scenes: [],
  props: [],
  timeline: []
} as unknown as StoryDetail

function mockStep(
  name: PipelineStep['name'],
  impl?: (ctx: unknown) => Promise<{ step: string; success: boolean; output?: string; error?: string }>
): PipelineStep {
  return {
    name,
    run: vi.fn(
      impl ??
        (async () => ({
          step: name,
          success: true,
          output: `${name}-out`
        }))
    )
  } as PipelineStep
}

describe('GenerationPipeline', () => {
  it('constructs default steps and custom steps', () => {
    const ai = { chat: vi.fn() } as never
    const p = new GenerationPipeline(ai)
    expect(p).toBeInstanceOf(GenerationPipeline)
    const custom = new GenerationPipeline(ai, [mockStep('script')])
    expect(custom).toBeInstanceOf(GenerationPipeline)
  })

  it('runs all steps and stores artifacts', async () => {
    const steps = [
      mockStep('script'),
      mockStep('character'),
      mockStep('scene')
    ]
    const onStepComplete = vi.fn()
    const p = new GenerationPipeline({} as never, steps)
    const result = await p.run(emptyStory, { onStepComplete })
    expect(result.success).toBe(true)
    expect(result.steps).toHaveLength(3)
    expect(onStepComplete).toHaveBeenCalledTimes(3)
    expect(steps[0].run).toHaveBeenCalled()
  })

  it('stops on first failed step', async () => {
    const steps = [
      mockStep('script'),
      mockStep('character', async () => ({
        step: 'character',
        success: false,
        error: 'bad'
      })),
      mockStep('scene')
    ]
    const p = new GenerationPipeline({} as never, steps)
    const result = await p.run(emptyStory)
    expect(result.success).toBe(false)
    expect(result.steps).toHaveLength(2)
    expect(steps[2].run).not.toHaveBeenCalled()
  })

  it('catches thrown errors from step.run', async () => {
    const steps = [
      mockStep('script', async () => {
        throw new Error('explode')
      })
    ]
    const onStepComplete = vi.fn()
    const p = new GenerationPipeline({} as never, steps)
    const result = await p.run(emptyStory, { onStepComplete })
    expect(result.success).toBe(false)
    expect(result.steps[0].error).toMatch(/explode/)
    expect(onStepComplete).toHaveBeenCalled()
  })

  it('catches non-Error throws', async () => {
    const steps = [
      mockStep('script', async () => {
        throw 'string-fail'
      })
    ]
    const p = new GenerationPipeline({} as never, steps)
    const result = await p.run(emptyStory)
    expect(result.steps[0].error).toBe('string-fail')
  })

  it('onlyFailedVideos filters to video step only', async () => {
    const steps = [
      mockStep('script'),
      mockStep('video'),
      mockStep('export')
    ]
    const p = new GenerationPipeline({} as never, steps)
    const result = await p.run(emptyStory, { onlyFailedVideos: true })
    expect(result.success).toBe(true)
    expect(steps[0].run).not.toHaveBeenCalled()
    expect(steps[1].run).toHaveBeenCalled()
    expect(steps[2].run).not.toHaveBeenCalled()
  })

  it('interactiveVideo skips video and export', async () => {
    const steps = [
      mockStep('script'),
      mockStep('video'),
      mockStep('export')
    ]
    const p = new GenerationPipeline({} as never, steps)
    const result = await p.run(emptyStory, { interactiveVideo: true })
    expect(result.success).toBe(true)
    expect(steps[0].run).toHaveBeenCalled()
    expect(steps[1].run).not.toHaveBeenCalled()
    expect(steps[2].run).not.toHaveBeenCalled()
  })

  it('onlyFailed + interactive returns deferred message', async () => {
    const steps = [mockStep('video'), mockStep('export')]
    const p = new GenerationPipeline({} as never, steps)
    const result = await p.run(emptyStory, {
      onlyFailedVideos: true,
      interactiveVideo: true
    })
    expect(result.success).toBe(true)
    expect(result.steps[0].output).toMatch(/Interactive video/)
    expect(steps[0].run).not.toHaveBeenCalled()
  })

  it('aborts mid-run when signal aborted', async () => {
    const steps = [mockStep('script'), mockStep('character')]
    const p = new GenerationPipeline({} as never, steps)
    const result = await p.run(emptyStory, {
      signal: { aborted: true } as AbortSignal
    })
    expect(result.success).toBe(false)
    expect(result.steps[0].error).toBe('errors.cancelled')
    expect(steps[0].run).not.toHaveBeenCalled()
  })

  it('passes options into context', async () => {
    const step = mockStep('script')
    const p = new GenerationPipeline({} as never, [step])
    const persistence = { getStory: vi.fn() }
    const media = { clipOutputPath: vi.fn() }
    const onClipProgress = vi.fn()
    await p.run(emptyStory, {
      persistence: persistence as never,
      media: media as never,
      videoConcurrency: 3,
      aspectRatio: '9:16',
      onClipProgress
    })
    const ctx = (step.run as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(ctx.videoConcurrency).toBe(3)
    expect(ctx.aspectRatio).toBe('9:16')
    expect(ctx.persistence).toBe(persistence)
    expect(ctx.media).toBe(media)
    expect(ctx.onClipProgress).toBe(onClipProgress)
  })
})
