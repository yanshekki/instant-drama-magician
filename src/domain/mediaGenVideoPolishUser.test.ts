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

function sec(
  partial: Partial<MediaGenMaterialSection> &
    Pick<MediaGenMaterialSection, 'id' | 'kind' | 'title'>
): MediaGenMaterialSection {
  return {
    text: '',
    include: true,
    group: 'task',
    ...partial
  }
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

  it('builds costume-intro polish (zh + no ref)', () => {
    const u = buildMediaGenVideoPolishUserOverride({
      kind: 'costume-intro',
      locale: 'zh-HK',
      seconds: 6,
      hasRefImage: false,
      fallbackPrompt: 'FALLBACK COSTUME PROMPT LONG ENOUGH XX',
      includedSections: [
        sec({
          id: 'profile',
          kind: 'text-profile',
          title: 'Coat',
          text: 'Costume: Red trench\nDetails: long'
        })
      ]
    })
    expect(u).toBeTruthy()
    expect(u!).toMatch(/服裝|試穿|介紹|trench|Coat/i)
  })

  it('builds scene-intro polish', () => {
    const u = buildMediaGenVideoPolishUserOverride({
      kind: 'scene-intro',
      locale: 'en',
      seconds: 8,
      aspectRatio: '16:9',
      hasRefImage: true,
      fallbackPrompt: 'FALLBACK SCENE PROMPT LONG ENOUGH XX',
      hardRules: 'keep set dressing',
      includedSections: [
        sec({
          id: 'profile',
          kind: 'text-profile',
          title: 'Rooftop',
          text: 'Scene: Neon rooftop\nTime: night'
        })
      ]
    })
    expect(u).toBeTruthy()
    expect(u!).toMatch(/scene|rooftop|Neon|HARD RULES|set dressing/i)
  })

  it('builds prop-intro polish', () => {
    const u = buildMediaGenVideoPolishUserOverride({
      kind: 'prop-intro',
      locale: 'zh-HK',
      seconds: 6,
      hasRefImage: true,
      fallbackPrompt: 'FALLBACK PROP PROMPT LONG ENOUGH XX',
      includedSections: [
        sec({
          id: 'profile',
          kind: 'text-profile',
          title: 'Blade',
          text: 'Prop: silver blade\nMaterial: steel'
        })
      ]
    })
    expect(u).toBeTruthy()
    expect(u!).toMatch(/道具|blade|Prop|介紹/i)
  })

  it('builds action-intro polish en with ref + hard rules', () => {
    const u = buildMediaGenVideoPolishUserOverride({
      kind: 'action-intro',
      locale: 'en',
      seconds: 10,
      aspectRatio: '9:16',
      hasRefImage: true,
      fallbackPrompt: 'FALLBACK ACTION PROMPT LONG ENOUGH XX',
      hardRules: 'no face morph',
      includedSections: [
        sec({
          id: 'profile',
          kind: 'text-profile',
          title: 'Kick',
          text: 'Action: spinning kick\nPace: fast'
        })
      ]
    })
    expect(u).toBeTruthy()
    expect(u!).toMatch(/Action|motion|spinning kick|HARD RULES|no face morph/i)
    expect(u!).toMatch(/Reference still|Duration: 10s/i)
  })

  it('builds action-intro polish zh without ref image', () => {
    const u = buildMediaGenVideoPolishUserOverride({
      kind: 'action-intro',
      locale: 'zh-HK',
      seconds: 6,
      hasRefImage: false,
      fallbackPrompt: 'FALLBACK ZH ACTION PROMPT LONG ENOUGH',
      includedSections: [
        sec({
          id: 'profile',
          kind: 'text-profile',
          title: '揮劍',
          text: ''
        })
      ]
    })
    expect(u).toBeTruthy()
    expect(u!).toMatch(/動作|介紹|揮劍|模板草稿/i)
    expect(u!).not.toMatch(/參考靜圖已附/)
  })

  it('builds timeline-clip polish with revision', () => {
    const beat: MediaGenMaterialSection = {
      id: 'beat_profile',
      kind: 'text-profile',
      title: 'Beat #2',
      text: 'Story: Rooftop\nStyle: noir rain\nBeat #2 · 8s clip\nDialogue: hello',
      include: true,
      group: 'task'
    }
    const cont: MediaGenMaterialSection = {
      id: 'continuity_lock',
      kind: 'text-profile',
      title: 'Continuity',
      text: 'Prev end frame: wet neon',
      include: true,
      group: 'task'
    }
    const u = buildMediaGenVideoPolishUserOverride({
      kind: 'timeline-clip',
      locale: 'zh-HK',
      seconds: 8,
      hasRefImage: true,
      fallbackPrompt: 'FALLBACK CLIP PROMPT LONG ENOUGH XX',
      includedSections: [beat, cont],
      revisionPrompt: 'more rain and neon'
    })
    expect(u).toBeTruthy()
    expect(u!).toMatch(/導演修訂|more rain|Rooftop|時間軸|noir|wet neon/i)
  })

  it('timeline-clip defaults story when beat lacks Story: line', () => {
    const u = buildMediaGenVideoPolishUserOverride({
      kind: 'timeline-clip',
      locale: 'en',
      seconds: 6,
      hasRefImage: false,
      fallbackPrompt: 'FALLBACK CLIP PROMPT LONG ENOUGH EN',
      includedSections: [
        sec({
          id: 'beat_profile',
          kind: 'text-profile',
          title: 'Beat',
          text: 'Dialogue only: hi'
        })
      ]
    })
    expect(u).toBeTruthy()
    expect(u!.length).toBeGreaterThan(20)
  })

  it('firstProfileName falls back to section title', () => {
    const u = buildMediaGenVideoPolishUserOverride({
      kind: 'character-intro',
      locale: 'en',
      seconds: 6,
      hasRefImage: false,
      fallbackPrompt: 'FALLBACK NO NAME LINE PROMPT LONG ENOUGH',
      includedSections: [
        sec({
          id: 'profile',
          kind: 'text-profile',
          title: 'Mystery Guest',
          text: 'No name key here'
        })
      ]
    })
    expect(u).toBeTruthy()
    expect(u!).toMatch(/Mystery Guest|No name key/i)
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
