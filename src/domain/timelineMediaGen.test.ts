import { describe, expect, it } from 'vitest'
import { buildTimelineBeatMaterialSections } from './mediaGenPrep'

describe('buildTimelineBeatMaterialSections', () => {
  it('prefers previous continuity as edit base and includes beat text', () => {
    const r = buildTimelineBeatMaterialSections({
      kind: 'timeline-still',
      storyTitle: 'Rooftop',
      displayIndex: 2,
      dialogue: 'Hello',
      previousContinuityPath: '/prev.png',
      previousBeatIndex: 1,
      continuityLockText: 'CONTINUITY LOCK: end of beat #1',
      castRefPath: '/cast.png',
      castRefName: 'Keith',
      characterName: 'Keith',
      characterImagePath: '/char.png',
      sceneLabel: 'Roof',
      sceneImagePath: '/scene.png',
      hardRules: '【禁止】水印'
    })
    expect(r.editBaseSectionId).toBe('prev_clip')
    const prev = r.sections.find((s) => s.id === 'prev_clip')
    expect(prev?.include).toBe(true)
    expect(prev?.entityType).toBe('continuity')
    expect(prev?.entityType).not.toBe('gallery')
    expect(r.sections.find((s) => s.id === 'cast_ref')?.include).toBe(true)
    expect(r.sections.some((s) => s.id === 'beat_profile')).toBe(true)
    expect(r.sections.some((s) => s.id === 'hard_rules')).toBe(true)
    const lock = r.sections.find((s) => s.id === 'continuity_lock')
    expect(lock?.entityType).toBe('continuity')
    expect(lock?.entityType).not.toBe('other')
    expect(r.fallbackPrompt).toMatch(/Rooftop/)
    expect(r.taskHint).toMatch(/KEYFRAME|beat #2|關鍵幀|第 2 段/)
  })

  it('does not use character still as pixel base when there is no prev clip', () => {
    const r = buildTimelineBeatMaterialSections({
      kind: 'timeline-clip',
      storyTitle: 'S',
      displayIndex: 1,
      castRefPath: '/cast.png',
      castRefName: 'A',
      durationSeconds: 8
    })
    expect(r.editBaseSectionId).toBeNull()
    expect(r.genOptions.durationSeconds).toBe(8)
    expect(r.genOptions.useIdentityEdit).toBe(false)
    expect(r.sections.find((s) => s.id === 'cast_ref')?.canBeEditBase).toBe(
      false
    )
    expect(r.taskHint).toMatch(/KEYFRAME|關鍵幀|第 1 段/)
  })

  it('writes Chinese task hint when locale is zh-HK', () => {
    const r = buildTimelineBeatMaterialSections({
      kind: 'timeline-clip',
      storyTitle: '受戒下山',
      displayIndex: 1,
      locale: 'zh-HK'
    })
    expect(r.taskHint).toMatch(/受戒下山/)
    expect(r.taskHint).toMatch(/關鍵幀|第 1 段/)
    expect(r.taskHint).not.toMatch(/Keyframe still then/)
    const beat = r.sections.find((s) => s.id === 'beat_profile')
    expect(beat?.title).toMatch(/第 1 段/)
    expect(beat?.text).toMatch(/故事：受戒下山/)
    expect(beat?.text).not.toMatch(/^Story:/m)
    expect(beat?.text).not.toMatch(/^Beat #1/m)
  })

  it('includes this-beat storyboard still and prefers it as edit base', () => {
    const r = buildTimelineBeatMaterialSections({
      kind: 'timeline-clip',
      storyTitle: 'Rooftop',
      displayIndex: 3,
      previousContinuityPath: '/prev.png',
      previousBeatIndex: 2,
      ownStillPath: '/own.png'
    })
    const own = r.sections.find((s) => s.id === 'own_still')
    const prev = r.sections.find((s) => s.id === 'prev_clip')
    expect(own?.include).toBe(true)
    expect(own?.entityType).toBe('continuity')
    expect(own?.imagePath).toBe('/own.png')
    expect(own?.canBeEditBase).toBe(true)
    expect(prev?.entityType).toBe('continuity')
    expect(prev?.entityType).not.toBe('gallery')
    expect(r.editBaseSectionId).toBe('own_still')
    expect(r.sections.filter((s) => s.imagePath === '/own.png')).toHaveLength(
      1
    )
  })

  it('keeps a single section when own still path equals previous continuity', () => {
    const r = buildTimelineBeatMaterialSections({
      kind: 'timeline-still',
      storyTitle: 'S',
      displayIndex: 2,
      previousContinuityPath: '/same.png',
      previousBeatIndex: 1,
      ownStillPath: '/same.png'
    })
    const imgs = r.sections.filter((s) => s.imagePath === '/same.png')
    expect(imgs).toHaveLength(1)
    expect(imgs[0]?.entityType).toBe('continuity')
    expect(imgs[0]?.entityType).not.toBe('gallery')
    expect(r.editBaseSectionId).toBe(imgs[0]?.id ?? null)
  })
})
