import { describe, expect, it } from 'vitest'
import {
  extractPolishedVideoPrompt,
  truncateForVideoPrompt,
  hardRulesMaterialsBlock,
  buildVideoPromptPolishSystemPrompt,
  buildIntroVideoPolishUserPrompt,
  buildSceneIntroVideoPolishUserPrompt,
  buildPropIntroVideoPolishUserPrompt,
  buildCostumeIntroVideoPolishUserPrompt,
  buildClipVideoPolishUserPrompt
} from './videoPromptPolish'

describe('extractPolishedVideoPrompt', () => {
  it('strips markdown fences', () => {
    const raw = '```text\nIMAGE-TO-VIDEO: hero walks in rain.\n```'
    expect(extractPolishedVideoPrompt(raw)).toBe(
      'IMAGE-TO-VIDEO: hero walks in rain.'
    )
  })

  it('strips prompt labels', () => {
    expect(extractPolishedVideoPrompt('Prompt: cinematic push-in on face')).toBe(
      'cinematic push-in on face'
    )
    expect(extractPolishedVideoPrompt('提示詞：角色望向鏡頭微笑')).toBe(
      '角色望向鏡頭微笑'
    )
  })

  it('returns empty for blank', () => {
    expect(extractPolishedVideoPrompt('   ')).toBe('')
  })
})

describe('truncateForVideoPrompt', () => {
  it('truncates long soul', () => {
    const s = 'a'.repeat(100)
    const out = truncateForVideoPrompt(s, 50)
    expect(out.length).toBeLessThan(s.length)
    expect(out).toContain('[truncated]')
  })

  it('returns short text unchanged and empty for blank', () => {
    expect(truncateForVideoPrompt('short', 50)).toBe('short')
    expect(truncateForVideoPrompt('  ', 10)).toBe('')
    expect(truncateForVideoPrompt(null, 10)).toBe('')
  })
})

describe('hardRulesMaterialsBlock + system polish prompt', () => {
  it('formats hard rules materials for en/zh', () => {
    expect(hardRulesMaterialsBlock(null, 'en')).toBeNull()
    expect(hardRulesMaterialsBlock('  ', 'zh-HK')).toBeNull()
    const en = hardRulesMaterialsBlock('NO watermark', 'en')
    expect(en).toMatch(/HARD RULES/)
    expect(en).toContain('NO watermark')
    const zh = hardRulesMaterialsBlock('【禁止】水印', 'zh-HK')
    expect(zh).toMatch(/HARD RULES|鐵則/)
    expect(zh).toContain('水印')
  })

  it('buildVideoPromptPolishSystemPrompt en/zh', () => {
    const zh = buildVideoPromptPolishSystemPrompt('zh-HK')
    expect(zh.length).toBeGreaterThan(40)
    const en = buildVideoPromptPolishSystemPrompt('en')
    expect(en).toMatch(/image-to-video|director|prompt/i)
  })
})

describe('buildIntroVideoPolishUserPrompt', () => {
  it('includes dossier fields and soul', () => {
    const u = buildIntroVideoPolishUserPrompt({
      locale: 'zh-HK',
      seconds: 10,
      aspectRatio: '16:9',
      hasRefImage: true,
      fallbackPrompt: 'TEMPLATE FALLBACK',
      name: '小雨',
      appearance: '銀髮',
      backstory: '雨夜獨行',
      relationships: '與阿明有過往',
      spokenLanguages: ['yue', 'en'],
      soulExcerpt: '## 身份\n短劇主角'
    })
    expect(u).toContain('小雨')
    expect(u).toContain('銀髮')
    expect(u).toContain('雨夜獨行')
    expect(u).toContain('與阿明有過往')
    expect(u).toContain('soul.md')
    expect(u).toContain('TEMPLATE FALLBACK')
    expect(u).toContain('yue')
  })
})

describe('buildSceneIntroVideoPolishUserPrompt', () => {
  it('includes location dossier and space lock task', () => {
    const u = buildSceneIntroVideoPolishUserPrompt({
      locale: 'zh-HK',
      seconds: 10,
      aspectRatio: '16:9',
      hasRefImage: true,
      fallbackPrompt: 'SCENE TEMPLATE',
      title: '碼頭倉庫',
      description: '鏽鐵門與濕潤碼頭',
      timeOfDay: 'night',
      weather: 'rain',
      mood: 'tense',
      lighting: 'neon spill'
    })
    expect(u).toContain('場景介紹')
    expect(u).toContain('碼頭倉庫')
    expect(u).toContain('鏽鐵門')
    expect(u).toContain('rain')
    expect(u).toContain('SCENE TEMPLATE')
    expect(u).toMatch(/空間身份/)
  })
})

describe('buildPropIntroVideoPolishUserPrompt', () => {
  it('includes prop dossier', () => {
    const u = buildPropIntroVideoPolishUserPrompt({
      locale: 'zh-HK',
      seconds: 10,
      hasRefImage: true,
      fallbackPrompt: 'PROP TEMPLATE',
      name: '懷錶',
      description: '生鏽銀殼',
      material: 'silver'
    })
    expect(u).toContain('道具')
    expect(u).toContain('懷錶')
    expect(u).toContain('PROP TEMPLATE')
  })
})

describe('buildCostumeIntroVideoPolishUserPrompt', () => {
  it('includes costume dossier', () => {
    const u = buildCostumeIntroVideoPolishUserPrompt({
      locale: 'en',
      seconds: 10,
      hasRefImage: true,
      fallbackPrompt: 'COSTUME TEMPLATE',
      name: 'Rain coat',
      description: 'black leather trench'
    })
    expect(u).toMatch(/Costume|wardrobe/i)
    expect(u).toContain('Rain coat')
    expect(u).toContain('COSTUME TEMPLATE')
  })
})

describe('buildClipVideoPolishUserPrompt', () => {
  it('includes revision and beat', () => {
    const u = buildClipVideoPolishUserPrompt({
      locale: 'en',
      seconds: 6,
      hasRefImage: true,
      fallbackPrompt: 'CLIP TEMPLATE',
      storyTitle: 'Demo',
      beatOrDialogue: 'Hello',
      revisionPrompt: 'only two hands'
    })
    expect(u).toContain('Demo')
    expect(u).toContain('Hello')
    expect(u).toContain('only two hands')
    expect(u).toContain('CLIP TEMPLATE')
  })

  it('includes labeled hardRules materials', () => {
    const u = buildClipVideoPolishUserPrompt({
      locale: 'en',
      seconds: 10,
      hasRefImage: false,
      fallbackPrompt: 'CLIP',
      storyTitle: 'S',
      hardRules: '[Character · Keith]\n【必須】two hands'
    })
    expect(u).toContain('HARD RULES')
    expect(u).toContain('[Character · Keith]')
    expect(u).toContain('two hands')
  })
})

describe('buildIntroVideoPolishUserPrompt hardRules', () => {
  it('embeds entity hardRules for polish materials', () => {
    const u = buildIntroVideoPolishUserPrompt({
      locale: 'zh-HK',
      seconds: 10,
      hasRefImage: true,
      fallbackPrompt: 'CHAR TEMPLATE',
      name: '小雨',
      hardRules: '【禁止】第三人臉'
    })
    expect(u).toContain('HARD RULES')
    expect(u).toContain('第三人臉')
    expect(u).toContain('CHAR TEMPLATE')
  })

  it('en locale without ref image', () => {
    const u = buildIntroVideoPolishUserPrompt({
      locale: 'en',
      seconds: 8,
      aspectRatio: '9:16',
      hasRefImage: false,
      fallbackPrompt: 'FALLBACK',
      name: 'Ming'
    })
    expect(u).toContain('Ming')
    expect(u).toContain('FALLBACK')
    expect(u).toMatch(/8|9:16/)
  })
})

describe('other polish prompts en without ref', () => {
  it('scene / prop / costume / clip en variants', () => {
    expect(
      buildSceneIntroVideoPolishUserPrompt({
        locale: 'en',
        seconds: 10,
        hasRefImage: false,
        fallbackPrompt: 'S',
        title: 'Pier',
        description: 'wet',
        hardRules: 'NO logo'
      })
    ).toMatch(/Pier|SPACE|HARD/i)

    expect(
      buildPropIntroVideoPolishUserPrompt({
        locale: 'en',
        seconds: 10,
        hasRefImage: false,
        fallbackPrompt: 'P',
        name: 'Watch',
        description: 'silver',
        hardRules: 'NO brand'
      })
    ).toMatch(/Watch|PROP|HARD/i)

    expect(
      buildCostumeIntroVideoPolishUserPrompt({
        locale: 'zh-HK',
        seconds: 10,
        hasRefImage: false,
        fallbackPrompt: 'C',
        name: '雨衣',
        description: '黑皮',
        hardRules: '禁止 logo'
      })
    ).toMatch(/雨衣|服裝|HARD|鐵則/i)

    expect(
      buildClipVideoPolishUserPrompt({
        locale: 'zh-HK',
        seconds: 6,
        hasRefImage: false,
        fallbackPrompt: 'CLIP',
        storyTitle: '雨夜',
        beatOrDialogue: '走',
        hardRules: '必須雙手'
      })
    ).toMatch(/雨夜|走|CLIP|HARD|鐵則/i)
  })

  it('intro polish full dossier without spokenLanguages', () => {
    const u = buildIntroVideoPolishUserPrompt({
      locale: 'en',
      seconds: 8,
      hasRefImage: false,
      fallbackPrompt: 'T',
      name: 'Ming',
      ageRange: '20s',
      gender: 'm',
      description: 'courier',
      costume: 'jacket',
      personality: 'stubborn',
      voiceDesc: 'low',
      mannerisms: 'helmet',
      relationships: 'Yu',
      visualTags: 'urban',
      artStyle: 'photo_cinematic',
      seedPrompt: 'seed',
      soulExcerpt: '## Id\nCourier'
    })
    expect(u).toMatch(/Ming|courier|soul|match character bible/i)
  })

  it('scene polish title fallback and hasRefImage true en', () => {
    const u = buildSceneIntroVideoPolishUserPrompt({
      locale: 'en',
      seconds: 10,
      hasRefImage: true,
      fallbackPrompt: 'S',
      description: 'only description place name here',
      script: 'A waits',
      locationType: 'exterior',
      timeOfDay: 'dusk',
      weather: 'fog',
      colorPalette: 'teal',
      setDressing: 'crates',
      soundscape: 'waves',
      cameraNotes: 'pan',
      visualTags: 'wet',
      artStyle: 'anime_modern',
      seedPrompt: 'seed'
    })
    expect(u).toMatch(/only description|lock SPACE|dusk|fog/i)
  })

  it('prop/costume/clip full optional blocks', () => {
    expect(
      buildPropIntroVideoPolishUserPrompt({
        locale: 'zh-HK',
        seconds: 8,
        hasRefImage: true,
        fallbackPrompt: 'P',
        name: '傘',
        description: '紅',
        material: 'nylon',
        sizeNotes: 'hand',
        condition: 'worn',
        visualTags: 'wet',
        artStyle: 'photo_cinematic',
        seedPrompt: 's'
      })
    ).toMatch(/傘|物件|nylon/)

    expect(
      buildCostumeIntroVideoPolishUserPrompt({
        locale: 'en',
        seconds: 8,
        hasRefImage: true,
        fallbackPrompt: 'C',
        name: 'Coat',
        description: 'leather',
        artStyle: 'anime_modern'
      })
    ).toMatch(/Coat|IDENTITY|wardrobe/i)

    const clip = buildClipVideoPolishUserPrompt({
      locale: 'en',
      seconds: 6,
      hasRefImage: true,
      fallbackPrompt: 'CLIP',
      storyTitle: 'Rain',
      styleNote: 'neon bible note',
      characterBlocks: ['Ming: courier'],
      sceneBlock: 'Alley',
      propBlock: 'Umbrella',
      actionBlock: 'Draw sword',
      beatOrDialogue: 'Hello',
      previousContext: 'Prev beat',
      multiCastNote: '2 cast',
      revisionPrompt: 'darker',
      hardRules: 'NO logo'
    })
    expect(clip).toMatch(
      /Rain|neon|Ming|Alley|Umbrella|Draw|Hello|Prev|darker|NO logo/i
    )
  })

  it('extractPolishedVideoPrompt strips quotes', () => {
    expect(extractPolishedVideoPrompt('"quoted prompt here"')).toBe(
      'quoted prompt here'
    )
    expect(extractPolishedVideoPrompt("'single'")).toBe('single')
  })
})
