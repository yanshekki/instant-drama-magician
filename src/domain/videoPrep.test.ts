import { describe, expect, it } from 'vitest'
import {
  VIDEO_PREP_STEPS,
  buildStillKeyframePrompt,
  buildStillRegenPolishUserPrompt,
  buildVideoPrepDraftKey,
  isVideoPrepPhaseLocked,
  loadVideoPrepDraftStore,
  makePersistedVideoPrepDraft,
  materialsSummaryLines,
  mergeFinalVideoPrompt,
  parsePersistedVideoPrepDraft,
  parseVideoPrepDraftStore,
  removeVideoPrepDraft,
  serializeVideoPrepDraft,
  serializeVideoPrepDraftStore,
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
    expect(parsePersistedVideoPrepDraft(null)).toBeNull()
    expect(parsePersistedVideoPrepDraft('{"version":2}')).toBeNull()

    const key = buildVideoPrepDraftKey(
      draft.kind,
      draft.entityIds,
      draft.sourceImagePath
    )
    let store = upsertVideoPrepDraft({}, key, draft, [])
    expect(store[key]?.draft.stillPath).toBe('/tmp/s.png')
    const migrated = loadVideoPrepDraftStore({ v1Raw: raw, v2Raw: null })
    expect(Object.keys(migrated).length).toBe(1)

    const v2 = serializeVideoPrepDraftStore(store)
    expect(Object.keys(parseVideoPrepDraftStore(v2))).toContain(key)
    expect(parseVideoPrepDraftStore(null)).toEqual({})
    expect(parseVideoPrepDraftStore('[]')).toEqual({})
    expect(parseVideoPrepDraftStore('not-json')).toEqual({})
    expect(
      parseVideoPrepDraftStore(
        JSON.stringify({
          bad: { version: 1, draft: { kind: 'x' } },
          [key]: makePersistedVideoPrepDraft(draft, [], key)
        })
      )[key]?.draft.stillPath
    ).toBe('/tmp/s.png')

    store = removeVideoPrepDraft(store, key)
    expect(store[key]).toBeUndefined()
    expect(removeVideoPrepDraft(store, 'missing')).toBe(store)

    expect(loadVideoPrepDraftStore({ v2Raw: v2 })[key]?.draft.stillPath).toBe(
      '/tmp/s.png'
    )
    expect(loadVideoPrepDraftStore({ v1Raw: null, v2Raw: null })).toEqual({})
  })

  it('maps more phases and draft keys for other kinds', () => {
    expect(VIDEO_PREP_STEPS).toHaveLength(5)
    expect(isVideoPrepPhaseLocked('loading-materials')).toBe(true)
    expect(isVideoPrepPhaseLocked('loading-regen')).toBe(true)
    expect(isVideoPrepPhaseLocked('error')).toBe(false)
    expect(videoPrepPhaseToStepIndex('loading-materials')).toBe(0)
    expect(videoPrepPhaseToStepIndex('loading-regen')).toBe(3)
    expect(videoPrepPhaseToStepIndex('success')).toBe(4)
    expect(videoPrepPhaseToStepIndex('error')).toBe(3)
    expect(
      buildVideoPrepDraftKey('scene-intro', { sceneId: 'sc1' }, null)
    ).toBe('scene-intro:sc1:_')
    expect(buildVideoPrepDraftKey('prop-intro', { propId: 'p1' })).toBe(
      'prop-intro:p1:_'
    )
    expect(
      buildVideoPrepDraftKey('timeline-clip', {
        storyId: '  ',
        entryId: undefined
      })
    ).toBe('timeline-clip:_:_')
  })

  it('mergeFinalVideoPrompt variants + hard rules', () => {
    expect(mergeFinalVideoPrompt('', '')).toBe('')
    expect(mergeFinalVideoPrompt('', 'only extra')).toBe('only extra')
    expect(mergeFinalVideoPrompt('PRO', null)).toBe('PRO')
    const withRules = mergeFinalVideoPrompt('PRO', 'darker', '【禁止】水印')
    expect(withRules).toContain('PRO')
    expect(withRules).toContain('darker')
    expect(withRules).toMatch(/禁止|水印/)
  })

  it('buildStillKeyframePrompt zh notes and empty base', () => {
    const zh = buildStillKeyframePrompt('BASE', {
      improvementNotes: '更暖',
      locale: 'zh-HK'
    })
    expect(zh).toContain('更暖')
    expect(zh).toContain('BASE')
    expect(buildStillKeyframePrompt('', { locale: 'en' })).toMatch(/KEYFRAME/)
  })

  it('buildStillRegenPolishUserPrompt en/zh with hard rules', () => {
    const en = buildStillRegenPolishUserPrompt({
      locale: 'en',
      professionalPrompt: 'PRO',
      improvementNotes: 'warmer',
      seconds: 8,
      aspectRatio: '9:16',
      hardRules: 'NO watermark'
    })
    expect(en).toMatch(/TASK|Revise/)
    expect(en).toContain('warmer')
    expect(en).toContain('NO watermark')
    expect(en).toContain('8s')

    const zh = buildStillRegenPolishUserPrompt({
      locale: 'zh-HK',
      professionalPrompt: 'PRO',
      improvementNotes: '更暗',
      seconds: 6,
      hardRules: '禁止 logo'
    })
    expect(zh).toMatch(/任務|修訂/)
    expect(zh).toContain('更暗')
    expect(zh).toContain('禁止 logo')
  })

  it('materialsSummaryLines filters blanks', () => {
    expect(materialsSummaryLines([' a ', '', null, 'b', undefined])).toBe(
      'a\nb'
    )
  })
})
