import { describe, expect, it } from 'vitest'
import {
  buildStillKeyframePrompt,
  buildVideoPrepDraftKey,
  isVideoPrepPhaseLocked,
  loadVideoPrepDraftStore,
  mergeFinalVideoPrompt,
  parsePersistedVideoPrepDraft,
  serializeVideoPrepDraft,
  upsertVideoPrepDraft,
  videoPrepPhaseToStepIndex
} from './videoPrep'

describe('mergeFinalVideoPrompt', () => {
  it('returns professional only when no extra', () => {
    expect(mergeFinalVideoPrompt('PRO', '')).toBe('PRO')
  })

  it('appends user revision block', () => {
    const out = mergeFinalVideoPrompt('PRO', 'darker light')
    expect(out).toContain('PRO')
    expect(out).toContain('darker light')
    expect(out).toMatch(/REVISION|USER/i)
  })
})

describe('buildStillKeyframePrompt', () => {
  it('prefixes keyframe header and optional notes', () => {
    const out = buildStillKeyframePrompt('IDENTITY LOCK: same face', {
      improvementNotes: 'warmer light',
      locale: 'en'
    })
    expect(out).toMatch(/KEYFRAME STILL/i)
    expect(out).toContain('warmer light')
    expect(out).toContain('IDENTITY LOCK')
  })
})

describe('videoPrep wizard helpers', () => {
  it('locks loading phases', () => {
    expect(isVideoPrepPhaseLocked('loading-extract')).toBe(true)
    expect(isVideoPrepPhaseLocked('loading-polish')).toBe(true)
    expect(isVideoPrepPhaseLocked('loading-video')).toBe(true)
    expect(isVideoPrepPhaseLocked('review')).toBe(false)
    expect(isVideoPrepPhaseLocked('success')).toBe(false)
  })

  it('maps phase to step index', () => {
    expect(videoPrepPhaseToStepIndex('loading-extract')).toBe(0)
    expect(videoPrepPhaseToStepIndex('loading-polish')).toBe(1)
    expect(videoPrepPhaseToStepIndex('loading-still')).toBe(2)
    expect(videoPrepPhaseToStepIndex('review')).toBe(3)
    expect(videoPrepPhaseToStepIndex('loading-video')).toBe(4)
  })

  it('builds stable draft keys', () => {
    expect(
      buildVideoPrepDraftKey(
        'character-intro',
        { characterId: 'c1' },
        '/a.png'
      )
    ).toBe('character-intro:c1:/a.png')
    expect(
      buildVideoPrepDraftKey('timeline-clip', {
        storyId: 's1',
        entryId: 'e1'
      })
    ).toBe('timeline-clip:s1:e1')
  })

  it('round-trips persisted draft + multi store', () => {
    const draft = {
      kind: 'character-intro' as const,
      entityIds: { characterId: 'c1' },
      professionalPrompt: 'PRO',
      userExtraPrompt: 'extra',
      stillPath: '/tmp/s.png',
      sourceImagePath: '/a.png',
      durationSeconds: 10,
      aspectRatio: '16:9'
    }
    const raw = serializeVideoPrepDraft(draft, ['e2', 'e3'])
    const parsed = parsePersistedVideoPrepDraft(raw)
    expect(parsed?.draft.professionalPrompt).toBe('PRO')
    expect(parsed?.queueRemaining).toEqual(['e2', 'e3'])
    expect(parsePersistedVideoPrepDraft('not-json')).toBeNull()

    const key = buildVideoPrepDraftKey(
      draft.kind,
      draft.entityIds,
      draft.sourceImagePath
    )
    let store = upsertVideoPrepDraft({}, key, draft, [])
    expect(store[key]?.draft.stillPath).toBe('/tmp/s.png')
    const migrated = loadVideoPrepDraftStore({ v1Raw: raw, v2Raw: null })
    expect(Object.keys(migrated).length).toBe(1)
  })
})
