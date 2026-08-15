import { describe, expect, it } from 'vitest'
import {
  buildMediaGenVideoDirectorFallback,
  buildMediaGenVideoPolishUserOverride,
  looksLikeEnglishKeyframeTaskHint,
  pickVideoDirectorPrompt,
  rewriteDirectorSealWording
} from './mediaGenVideoPolishUser'
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
    expect(u!).toMatch(/Hard rules|no logo/i)
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
    expect(u!).toMatch(/scene|rooftop|Neon|Hard rules|set dressing/i)
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
    expect(u!).toMatch(/Action|motion|spinning kick|Hard rules|no face morph/i)
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

  it('detects English keyframe taskHint boilerplate', () => {
    expect(
      looksLikeEnglishKeyframeTaskHint(
        'Keyframe still then short-drama video for story "受戒下山" beat #1. Continuity-lock previous frame when attached.'
      )
    ).toBe(true)
    expect(looksLikeEnglishKeyframeTaskHint('圖生影片：以呢張關鍵幀做短劇片段。')).toBe(
      false
    )
  })

  it('zh director fallback never includes English keyframe taskHint', () => {
    const fb = buildMediaGenVideoDirectorFallback({
      locale: 'zh-HK',
      seconds: 10,
      aspectRatio: '16:9',
      stillPrompt:
        'Keyframe still then short-drama video for story "受戒下山" beat #1. Continuity-lock previous frame when attached.',
      beatText: 'Story: 受戒下山\nBeat #1 · 10s clip\nDialogue: 走！'
    })
    expect(fb).toMatch(/圖生影片|關鍵幀/)
    expect(fb).toMatch(/受戒下山/)
    expect(fb).toMatch(/故事：/)
    expect(fb).toMatch(/第 1 段/)
    expect(fb).not.toMatch(/Keyframe still then/)
    expect(fb).not.toMatch(/^Story:/m)
    expect(fb).not.toMatch(/^Beat #1/m)
    expect(fb).toMatch(/10 秒/)
  })

  it('pickVideoDirectorPrompt replaces English keyframe hint on zh UI', () => {
    const fb = buildMediaGenVideoDirectorFallback({
      locale: 'zh-HK',
      seconds: 8,
      aspectRatio: '16:9'
    })
    expect(
      pickVideoDirectorPrompt(
        'Keyframe still then short-drama video for story "受戒下山" beat #1.',
        fb,
        'zh-HK'
      )
    ).toBe(fb)
    expect(
      pickVideoDirectorPrompt('鏡頭推進，青年拔劍衝出巷口。', fb, 'zh-HK')
    ).toBe('鏡頭推進，青年拔劍衝出巷口。')
    expect(
      pickVideoDirectorPrompt(
        '對白鎖定 · 角色「沈執一」：可聽語音與口型必須只用粵語（yue）。\n若前文與生成鐵則衝突，以生成鐵則為準。',
        fb,
        'zh-HK'
      )
    ).toBe(fb)
  })

  it('rewrites leftover English beat labels in director text', () => {
    const raw = [
      '情緒：生疏肅穆',
      'Beat atmosphere: 祠堂門半掩',
      'SFX cues: 門軸細響',
      'VISUAL ACTION: 沈執一：推門',
      'EXPRESSION: 沈執一：凝視',
      'SPEECH (spoken lines): 沈執一：「你可願走？」',
      'Ref#1是上一段終幀'
    ].join('\n')
    const out = rewriteDirectorSealWording(raw, 'zh-HK')
    expect(out).toContain('氣氛：')
    expect(out).toContain('聲效：')
    expect(out).toContain('動作：')
    expect(out).toContain('表情：')
    expect(out).toContain('對白：')
    expect(out).toContain('參考圖1')
    expect(out).not.toMatch(/VISUAL ACTION/)
    expect(out).not.toMatch(/SPEECH \(spoken/)
    expect(out).not.toMatch(/Beat atmosphere/)
    expect(out).not.toMatch(/SFX cues/)
    expect(out).not.toMatch(/Ref#/)
  })

  it('rewrites leftover 口白 and English HARD RULES into 書面語', () => {
    const raw = [
      'SPEECH LOCK · 角色「沈執一」：每段都要同一種口白。',
      'HARD RULES (highest priority — must obey; override any conflicting earlier details):',
      '【禁止】水印',
      'If any earlier instruction conflicts with HARD RULES, follow HARD RULES.'
    ].join('\n')
    const out = rewriteDirectorSealWording(raw, 'zh-HK')
    expect(out).toContain('對白鎖定')
    expect(out).toContain('同一種對白')
    expect(out).toContain('生成鐵則')
    expect(out).not.toMatch(/SPEECH LOCK/)
    expect(out).not.toMatch(/口白/)
    expect(out).not.toMatch(/If any earlier instruction/)
  })

  it('rewrites leftover English seals for ja and fr', () => {
    const raw = [
      'SPEECH LOCK · Character "Aoi": audible speech AND lip-sync MUST be Japanese.',
      'HARD RULES (highest priority — must obey; override any conflicting earlier details):',
      'no logo',
      'If any earlier instruction conflicts with HARD RULES, follow HARD RULES.',
      'VISUAL ACTION: open the door',
      'SPEECH (spoken lines): Aoi: hello'
    ].join('\n')
    const ja = rewriteDirectorSealWording(raw, 'ja')
    expect(ja).toContain('台詞ロック')
    expect(ja).toContain('生成の鉄則')
    expect(ja).toContain('動作：')
    expect(ja).toContain('台詞：')
    expect(ja).not.toMatch(/SPEECH LOCK|HARD RULES|VISUAL ACTION/)
    const fr = rewriteDirectorSealWording(raw, 'fr')
    expect(fr).toContain('Verrouillage des répliques')
    expect(fr).toContain('RÈGLES FERMES')
    expect(fr).not.toMatch(/SPEECH LOCK|HARD RULES/)
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
