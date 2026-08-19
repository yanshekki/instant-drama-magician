import { describe, expect, it } from 'vitest'
import { actionMotionRole, buildClipContinuityContext } from './clipContinuityContext'
import type { TimelineEntry } from '../types/domain'

const entry = (partial: Partial<TimelineEntry> & { id: string }): TimelineEntry => ({
  storyId: 's1',
  startTime: 0,
  endTime: 6,
  characterId: null,
  sceneId: null,
  propId: null,
  characterIds: [],
  sceneIds: [],
  propIds: [],
  dialogue: null,
  beatContentJson: null,
  order: 0,
  mediaPath: null,
  mediaStatus: 'EMPTY',
  mediaError: null,
  videoJobId: null,
  ...partial
})

describe('clipContinuityContext', () => {
  it('flags missing end-frame and sequential chain-end', () => {
    const entries = [
      entry({ id: 'e0', order: 0, characterId: 'c1' }),
      entry({ id: 'e1', order: 1, startTime: 6, endTime: 12, characterId: 'c1' })
    ]
    const ctx = buildClipContinuityContext({
      entries,
      currentId: 'e1',
      character: {
        id: 'c1',
        storyId: 's1',
        name: 'Ming',
        description: 'x',
        soulMdPath: null,
        refImagePath: '/c.png'
      },
      maps: {
        characters: new Map(),
        scenes: new Map(),
        props: new Map()
      },
      previousContinuityPath: null,
      continuityMode: 'chain-end',
      pathExists: () => true
    })
    expect(ctx.missingEndFrame).toBe(true)
    expect(ctx.sequentialRequired).toBe(true)
    expect(ctx.prevEntry?.id).toBe('e0')
    expect(ctx.continuityLock).toMatch(/連續|Continuity|畫面/)
  })

  it('always includes action plate in polish', () => {
    const entries = [entry({ id: 'e0', order: 0 })]
    const ctx = buildClipContinuityContext({
      entries,
      currentId: 'e0',
      action: { refImagePath: '/act.png' },
      maps: {
        characters: new Map(),
        scenes: new Map(),
        props: new Map()
      },
      pathExists: () => true
    })
    expect(ctx.actionInPolish).toBe(true)
    expect(ctx.polishPaths).toContain('/act.png')
    expect(actionMotionRole(true)).toBe('image')
    expect(actionMotionRole(false)).toBe('text')
  })
})
