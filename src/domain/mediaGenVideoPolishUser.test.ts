import { describe, expect, it } from 'vitest'
import { buildMediaGenVideoPolishUserOverride } from './mediaGenVideoPolishUser'
import type { MediaGenMaterialSection } from './mediaGenPrep'

const profile: MediaGenMaterialSection = {
  id: 'profile',
  kind: 'text-profile',
  title: 'Aria',
  text: 'Name: Aria\nAppearance: silver hair',
  include: true,
  group: 'task'
}

describe('buildMediaGenVideoPolishUserOverride', () => {
  it('builds character-intro specialized polish user', () => {
    const u = buildMediaGenVideoPolishUserOverride({
      kind: 'character-intro',
      locale: 'en',
      seconds: 10,
      aspectRatio: '9:16',
      hasRefImage: true,
      fallbackPrompt: 'FALLBACK STILL PROMPT LONG ENOUGH',
      hardRules: 'no logo',
      includedSections: [profile]
    })
    expect(u).toBeTruthy()
    expect(u!).toMatch(/Self-introduction|casting|Aria/i)
    expect(u!).toMatch(/HARD RULES|no logo/i)
  })

  it('builds timeline-clip polish with revision', () => {
    const beat: MediaGenMaterialSection = {
      id: 'beat_profile',
      kind: 'text-profile',
      title: 'Beat #2',
      text: 'Story: Rooftop\nBeat #2 · 8s clip\nDialogue: hello',
      include: true,
      group: 'task'
    }
    const u = buildMediaGenVideoPolishUserOverride({
      kind: 'timeline-clip',
      locale: 'zh-HK',
      seconds: 8,
      hasRefImage: true,
      fallbackPrompt: 'FALLBACK CLIP PROMPT LONG ENOUGH XX',
      includedSections: [beat],
      revisionPrompt: 'more rain and neon'
    })
    expect(u).toBeTruthy()
    expect(u!).toMatch(/導演修訂|more rain|Rooftop|時間軸/i)
  })

  it('returns null for non-video image kinds', () => {
    expect(
      buildMediaGenVideoPolishUserOverride({
        kind: 'character-sheet',
        locale: 'en',
        seconds: 10,
        hasRefImage: false,
        fallbackPrompt: 'x'.repeat(50),
        includedSections: [profile]
      })
    ).toBeNull()
  })
})
