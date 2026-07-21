import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { VideoStep } from './VideoStep'
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

const baseStory = {
  id: 's1',
  title: 'T',
  styleNote: 'neon',
  hardRules: 'no gore',
  characters: [
    {
      id: 'c1',
      name: 'Ming',
      description: 'courier',
      ageRange: '20s',
      gender: 'm',
      appearance: 'short hair',
      costume: 'jacket',
      personality: 'stubborn',
      backstory: 'past',
      relationships: 'none',
      mannerisms: 'nod',
      voiceDesc: 'low',
      visualTags: 'neon',
      artStyle: 'real',
      spokenLanguages: '["yue","en"]',
      refImagePath: '/c1.png'
    }
  ],
  scenes: [
    {
      id: 'sc1',
      sceneNumber: 1,
      title: 'Alley',
      description: 'wet alley',
      mood: 'tense',
      refImagePath: null
    }
  ],
  props: [{ id: 'p1', name: 'Bag', description: 'red', refImagePath: null }],
  actions: [{ id: 'a1', name: 'Draw', description: 'quick draw' }],
  timeline: [] as Array<Record<string, unknown>>
}

describe('VideoStep', () => {
  let dir: string

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'idm-vidstep-'))
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('runs without throw on empty story', async () => {
    const step = new VideoStep()
    const ai = {
      getStatus: vi.fn().mockResolvedValue({ available: false, message: 'off' }),
      chat: vi.fn()
    }
    const ctx = {
      story: baseStory,
      ai,
      signal: undefined,
      artifacts: {},
      media: {},
      persistence: {}
    }
    const r = await step.run(ctx as never)
    expect(r.step).toBe(step.name)
    expect(r.success).toBe(true)
    expect(r.output).toMatch(/No timeline/)
  })

  it('skips when generateVideo missing', async () => {
    const step = new VideoStep()
    const r = await step.run({
      story: {
        ...baseStory,
        timeline: [
          {
            id: 'e1',
            order: 0,
            startTime: 0,
            endTime: 6,
            characterId: 'c1',
            sceneId: 'sc1',
            propId: null,
            dialogue: 'hi',
            mediaStatus: 'EMPTY'
          }
        ]
      },
      ai: { chat: vi.fn() },
      artifacts: {}
    } as never)
    expect(r.degraded).toBe(true)
    expect(r.output).toMatch(/no generateVideo/i)
  })

  it('onlyFailedVideos with no targets', async () => {
    const step = new VideoStep()
    const r = await step.run({
      story: {
        ...baseStory,
        timeline: [
          {
            id: 'e1',
            order: 0,
            startTime: 0,
            endTime: 6,
            mediaStatus: 'READY',
            dialogue: null
          }
        ]
      },
      ai: { generateVideo: vi.fn() },
      onlyFailedVideos: true,
      artifacts: {}
    } as never)
    expect(r.output).toMatch(/No clips need/)
  })

  it('generates clips successfully with polish', async () => {
    const step = new VideoStep()
    const updateEntryMedia = vi.fn()
    const listTimeline = vi.fn().mockResolvedValue([])
    const onClipProgress = vi.fn()
    const contDir = join(dir, 'cont')
    mkdirSync(contDir, { recursive: true })
    const prevStill = join(contDir, 'e0.still.png')
    writeFileSync(prevStill, 'png')

    const r = await step.run({
      story: {
        ...baseStory,
        timeline: [
          {
            id: 'e0',
            order: 0,
            startTime: 0,
            endTime: 6,
            characterId: 'c1',
            sceneId: 'sc1',
            propId: 'p1',
            actionId: 'a1',
            dialogue: 'first',
            mediaStatus: 'EMPTY'
          },
          {
            id: 'e1',
            order: 1,
            startTime: 6,
            endTime: 12,
            characterId: 'c1',
            characterIds: ['c1'],
            sceneId: 'sc1',
            sceneIds: ['sc1'],
            propId: 'p1',
            propIds: ['p1'],
            actionId: 'a1',
            actionIds: ['a1'],
            dialogue: 'second beat',
            beatContentJson: null,
            mediaStatus: 'EMPTY'
          }
        ]
      },
      ai: {
        chat: vi.fn().mockResolvedValue({
          choices: [{ message: { content: 'polished video prompt' } }]
        }),
        generateVideo: vi.fn().mockResolvedValue({
          outputPath: join(dir, 'clip.mp4'),
          jobId: 'job-1',
          degraded: false
        })
      },
      media: {
        clipOutputPath: (storyId: string, entryId: string) =>
          join(dir, `${storyId}-${entryId}.mp4`),
        clipContinuityStillPath: (_s: string, entryId: string) =>
          entryId === 'e0' ? prevStill : join(dir, 'missing.png')
      },
      persistence: { updateEntryMedia, listTimeline },
      onClipProgress,
      aspectRatio: '16:9',
      videoConcurrency: 2,
      artifacts: {}
    } as never)

    expect(r.success).toBe(true)
    expect(updateEntryMedia).toHaveBeenCalled()
    expect(onClipProgress).toHaveBeenCalled()
    expect(listTimeline).toHaveBeenCalled()
    expect(r.output).toMatch(/ready/)
  })

  it('marks FAILED on generate error and partial success', async () => {
    const step = new VideoStep()
    const updateEntryMedia = vi.fn()
    let calls = 0
    const r = await step.run({
      story: {
        ...baseStory,
        timeline: [
          {
            id: 'e1',
            order: 0,
            startTime: 0,
            endTime: 6,
            characterId: 'c1',
            sceneId: 'sc1',
            dialogue: 'a',
            mediaStatus: 'EMPTY'
          },
          {
            id: 'e2',
            order: 1,
            startTime: 6,
            endTime: 12,
            characterId: null,
            sceneId: null,
            dialogue: 'b',
            mediaStatus: 'FAILED'
          }
        ]
      },
      ai: {
        chat: vi.fn().mockRejectedValue(new Error('no polish')),
        generateVideo: vi.fn().mockImplementation(async () => {
          calls += 1
          if (calls === 1) {
            return { outputPath: join(dir, 'ok.mp4'), degraded: true }
          }
          throw new Error('gen fail')
        })
      },
      media: {
        clipOutputPath: () => join(dir, 'out.mp4')
      },
      persistence: { updateEntryMedia },
      videoConcurrency: 1,
      artifacts: {}
    } as never)

    expect(updateEntryMedia).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ mediaStatus: 'FAILED' })
    )
    // at least one path exercised
    expect(r.step).toBe('video')
  })

  it('handles cancel via aborted signal', async () => {
    const step = new VideoStep()
    const signal = { aborted: true }
    const r = await step.run({
      story: {
        ...baseStory,
        timeline: [
          {
            id: 'e1',
            order: 0,
            startTime: 0,
            endTime: 6,
            mediaStatus: 'EMPTY',
            dialogue: 'x'
          }
        ]
      },
      ai: {
        chat: vi.fn(),
        generateVideo: vi.fn().mockResolvedValue({ outputPath: '/x.mp4' })
      },
      signal,
      media: { clipOutputPath: () => join(dir, 'x.mp4') },
      persistence: { updateEntryMedia: vi.fn() },
      artifacts: {}
    } as never)
    expect(r.success).toBe(false)
    expect(r.error).toBe('errors.cancelled')
  })

  it('handles invalid spokenLanguages JSON', async () => {
    const step = new VideoStep()
    const r = await step.run({
      story: {
        ...baseStory,
        characters: [
          {
            ...baseStory.characters[0],
            spokenLanguages: 'not-json'
          }
        ],
        timeline: [
          {
            id: 'e1',
            order: 0,
            startTime: 0,
            endTime: 6,
            characterId: 'c1',
            dialogue: 'hi',
            mediaStatus: 'EMPTY'
          }
        ]
      },
      ai: {
        chat: vi.fn().mockResolvedValue({
          choices: [{ message: { content: 'p' } }]
        }),
        generateVideo: vi.fn().mockResolvedValue({
          outputPath: join(dir, 'c.mp4'),
          degraded: false
        })
      },
      media: { clipOutputPath: () => join(dir, 'c.mp4') },
      persistence: { updateEntryMedia: vi.fn() },
      artifacts: {}
    } as never)
    expect(r.success).toBe(true)
  })

  it('all failures sets error message', async () => {
    const step = new VideoStep()
    const r = await step.run({
      story: {
        ...baseStory,
        timeline: [
          {
            id: 'e1',
            order: 0,
            startTime: 0,
            endTime: 6,
            dialogue: 'x',
            mediaStatus: 'EMPTY'
          }
        ]
      },
      ai: {
        chat: vi.fn().mockResolvedValue({
          choices: [{ message: { content: 'p' } }]
        }),
        generateVideo: vi.fn().mockRejectedValue('hard fail')
      },
      media: { clipOutputPath: () => join(dir, 'c.mp4') },
      persistence: { updateEntryMedia: vi.fn() },
      artifacts: {}
    } as never)
    expect(r.success).toBe(false)
    expect(r.error).toMatch(/All clip/)
  })

  it('spokenLanguages non-array JSON and string throw errors', async () => {
    const step = new VideoStep()
    const onClipProgress = vi.fn()
    const r = await step.run({
      story: {
        ...baseStory,
        characters: [
          {
            ...baseStory.characters[0],
            spokenLanguages: '{"not":"array"}'
          }
        ],
        timeline: [
          {
            id: 'e1',
            order: 0,
            startTime: 0,
            endTime: 6,
            characterId: 'c1',
            dialogue: 'hi',
            mediaStatus: 'EMPTY'
          }
        ]
      },
      ai: {
        chat: vi.fn().mockResolvedValue({
          choices: [{ message: { content: 'p' } }]
        }),
        generateVideo: vi.fn().mockRejectedValue('string-err')
      },
      media: { clipOutputPath: () => join(dir, 'c.mp4') },
      persistence: { updateEntryMedia: vi.fn() },
      onClipProgress,
      artifacts: {}
    } as never)
    expect(r.success).toBe(false)
    expect(
      onClipProgress.mock.calls.some(
        (c) => (c[0] as { status?: string }).status === 'FAILED'
      )
    ).toBe(true)
  })

  it('re-throws non-cancelled mapPool errors', async () => {
    vi.resetModules()
    vi.doMock('../../infrastructure/ai/video/httpUtils', async () => {
      const actual = await vi.importActual<
        typeof import('../../infrastructure/ai/video/httpUtils')
      >('../../infrastructure/ai/video/httpUtils')
      return {
        ...actual,
        mapPool: async () => {
          throw new Error('pool exploded')
        }
      }
    })
    const { VideoStep: VS } = await import('./VideoStep')
    const step = new VS()
    const storyWithClips = {
      ...baseStory,
      timeline: [
        {
          id: 'e1',
          order: 0,
          startTime: 0,
          endTime: 6,
          characterId: 'c1',
          dialogue: 'hi',
          mediaStatus: 'EMPTY'
        }
      ]
    }
    await expect(
      step.run({
        story: storyWithClips,
        ai: {
          chat: vi.fn(),
          generateVideo: vi.fn()
        },
        media: { clipOutputPath: () => join(dir, 'c.mp4') },
        persistence: { updateEntryMedia: vi.fn() },
        artifacts: {}
      } as never)
    ).rejects.toThrow(/pool exploded/)
    vi.doUnmock('../../infrastructure/ai/video/httpUtils')
    vi.resetModules()
  })
})
