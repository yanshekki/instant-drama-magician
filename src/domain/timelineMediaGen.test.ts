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
    expect(r.sections.find((s) => s.id === 'prev_clip')?.include).toBe(true)
    expect(r.sections.find((s) => s.id === 'cast_ref')?.include).toBe(true)
    expect(r.sections.some((s) => s.id === 'beat_profile')).toBe(true)
    expect(r.sections.some((s) => s.id === 'hard_rules')).toBe(true)
    expect(r.fallbackPrompt).toMatch(/Rooftop/)
    expect(r.taskHint).toMatch(/KEYFRAME|beat #2/i)
  })

  it('falls back to cast when no prev still', () => {
    const r = buildTimelineBeatMaterialSections({
      kind: 'timeline-clip',
      storyTitle: 'S',
      displayIndex: 1,
      castRefPath: '/cast.png',
      castRefName: 'A',
      durationSeconds: 8
    })
    expect(r.editBaseSectionId).toBe('cast_ref')
    expect(r.genOptions.durationSeconds).toBe(8)
    expect(r.genOptions.useIdentityEdit).toBe(true)
    expect(r.taskHint).toMatch(/video/i)
  })
})
