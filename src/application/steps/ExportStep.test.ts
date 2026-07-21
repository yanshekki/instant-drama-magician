import { describe, expect, it, vi } from 'vitest'
import { ExportStep } from './ExportStep'

describe('ExportStep', () => {
  const step = new ExportStep()

  it('returns cancelled when aborted', async () => {
    const r = await step.run({
      story: { id: 's1', title: 'T' },
      signal: { aborted: true },
      artifacts: {}
    } as never)
    expect(r.success).toBe(false)
    expect(r.error).toBe('errors.cancelled')
  })

  it('exportConcat path sets export path', async () => {
    const setExportPath = vi.fn()
    const r = await step.run({
      story: { id: 's1', title: 'Rain' },
      artifacts: { script: 'S' },
      media: {
        exportConcat: vi.fn().mockResolvedValue('/out/final.mp4')
      },
      persistence: { setExportPath }
    } as never)
    expect(r.success).toBe(true)
    expect(r.output).toMatch(/final\.mp4/)
    expect(setExportPath).toHaveBeenCalledWith('s1', '/out/final.mp4')
    expect(r.degraded).toBeFalsy()
  })

  it('exportStoryboard degraded fallback', async () => {
    const r = await step.run({
      story: { id: 's1', title: 'Rain' },
      artifacts: {},
      media: {
        exportStoryboard: vi.fn().mockResolvedValue('/out/board.mp4')
      }
    } as never)
    expect(r.degraded).toBe(true)
    expect(r.output).toMatch(/board\.mp4/)
  })

  it('no media export still succeeds', async () => {
    const r = await step.run({
      story: { id: 's1', title: 'Rain' },
      artifacts: {},
      media: {}
    } as never)
    expect(r.success).toBe(true)
    expect(r.output).toMatch(/not generated/)
  })

  it('export failure returns degraded success', async () => {
    const r = await step.run({
      story: { id: 's1', title: 'Rain' },
      artifacts: { script: 'x' },
      media: {
        exportConcat: vi.fn().mockRejectedValue(new Error('ffmpeg gone'))
      }
    } as never)
    expect(r.success).toBe(true)
    expect(r.degraded).toBe(true)
    expect(r.output).toMatch(/ffmpeg gone/)
  })
})
