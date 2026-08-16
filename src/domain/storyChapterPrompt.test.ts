import { describe, expect, it } from 'vitest'
import { AppError } from '../types/errors'
import {
  buildCastFromChaptersSystemPrompt,
  buildCastFromChaptersUserPrompt,
  buildStoryChaptersSystemPrompt,
  buildStoryChaptersUserPrompt,
  chapterAiMaxTokens,
  clampChapterAiCount,
  clampChapterAiWords,
  classifyCastDrafts,
  extractCastFromChaptersJson,
  extractStoryChaptersJson,
  filterChaptersForPrompt,
  formatChaptersForPrompt,
  hasNonEmptyChapterBody,
  summarizeCastPlan
} from './storyChapterPrompt'
import { buildStoryBeatsUserPrompt } from './storyMasterPrompt'

const emptyDrafts = {
  characters: [],
  scenes: [],
  props: [],
  actions: []
}

describe('storyChapterPrompt', () => {
  it('hasNonEmptyChapterBody ignores blank bodies', () => {
    expect(hasNonEmptyChapterBody([])).toBe(false)
    expect(hasNonEmptyChapterBody([{ body: '  ' }])).toBe(false)
    expect(hasNonEmptyChapterBody([{ body: 'Rain.' }])).toBe(true)
  })

  it('clamps chapter AI count, words, and token budget', () => {
    expect(clampChapterAiCount(undefined)).toBe(4)
    expect(clampChapterAiCount(1)).toBe(2)
    expect(clampChapterAiCount(99)).toBe(8)
    expect(clampChapterAiCount('3')).toBe(3)
    expect(clampChapterAiWords('nope')).toBe(120)
    expect(clampChapterAiWords(10)).toBe(60)
    expect(clampChapterAiWords(999)).toBe(400)
    expect(chapterAiMaxTokens(2, 60)).toBe(1200)
    expect(chapterAiMaxTokens(4, 120)).toBe(1360)
    expect(chapterAiMaxTokens(6, 200)).toBe(2800)
    expect(chapterAiMaxTokens(8, 400)).toBe(3500)
  })

  it('interpolates count and words into the chapter system prompt', () => {
    const p = buildStoryChaptersSystemPrompt('en', null, {
      count: 6,
      words: 200
    })
    expect(p).toMatch(/exactly 6 chapters/)
    expect(p).toMatch(/about 200 words/)
  })

  it('filterChaptersForPrompt keeps order and selected ids', () => {
    const rows = [
      { id: 'a', body: 'One', order: 0 },
      { id: 'b', body: '  ', order: 1 },
      { id: 'c', body: 'Three', order: 2 }
    ]
    expect(filterChaptersForPrompt(rows).map((c) => c.id)).toEqual(['a', 'c'])
    expect(filterChaptersForPrompt(rows, ['c', 'a']).map((c) => c.id)).toEqual([
      'a',
      'c'
    ])
    expect(filterChaptersForPrompt(rows, [])).toEqual([])
    expect(filterChaptersForPrompt(rows, ['missing'])).toEqual([])
  })

  it('extracts chapters from array, wrapper, fence, and single object', () => {
    expect(
      extractStoryChaptersJson(
        '```json\n[{"title":" One ","body":" Rain "}]\n```'
      )
    ).toEqual([{ title: 'One', body: 'Rain' }])
    expect(
      extractStoryChaptersJson('{"chapters":[{"title":"A","content":"B"}]}')
    ).toEqual([{ title: 'A', body: 'B' }])
    expect(
      extractStoryChaptersJson('{"title":"Solo","body":"Text"}')
    ).toEqual([{ title: 'Solo', body: 'Text' }])
    expect(() => extractStoryChaptersJson('{"no":"chapters"}')).toThrow(
      AppError
    )
    expect(() => extractStoryChaptersJson('[]')).toThrow(AppError)
  })

  it('extracts cast JSON and skips nameless rows', () => {
    const extracted = extractCastFromChaptersJson(`{
      "characters":[{"name":" Ming ","description":"courier"},{"name":""}],
      "scenes":[{"title":"Roof","description":"rain"}],
      "props":[{"name":"Umbrella"}],
      "actions":[{"name":"Run","motionNotes":"sprint"}]
    }`)
    expect(extracted.characters).toHaveLength(1)
    expect(extracted.characters[0].name).toBe('Ming')
    expect(extracted.scenes[0].title).toBe('Roof')
    expect(extracted.props[0].description).toBe('Umbrella')
    expect(extracted.actions[0].motionNotes).toBe('sprint')
    const many = extractCastFromChaptersJson(`{
      "characters":[{"name":"Ming"},{"name":"Mei"}],
      "scenes":[{"title":"Alley","description":"wet"},{"title":"Shrine","description":"smoke"}],
      "props":[{"name":"Talisman"},{"name":"Token"}],
      "actions":[{"name":"Descend"},{"name":"Bow"}]
    }`)
    expect(many.characters).toHaveLength(2)
    expect(many.scenes).toHaveLength(2)
    expect(many.props).toHaveLength(2)
    expect(many.actions).toHaveLength(2)
    expect(() => extractCastFromChaptersJson('[1,2]')).toThrow(AppError)
  })

  it('classifies skip / link / create by case-insensitive name', () => {
    const plan = classifyCastDrafts({
      drafts: {
        characters: [
          {
            name: 'MING',
            description: 'd',
            appearance: '',
            personality: '',
            costume: '',
            roleNote: 'lead'
          },
          {
            name: 'Mei',
            description: 'd',
            appearance: '',
            personality: '',
            costume: '',
            roleNote: ''
          },
          {
            name: 'New',
            description: 'd',
            appearance: '',
            personality: '',
            costume: '',
            roleNote: ''
          }
        ],
        scenes: [{ title: 'Alley', description: 'wet', locationType: '', timeOfDay: '', mood: '' }],
        props: [{ name: 'Cup', description: '' }],
        actions: [{ name: 'Kick', description: '', motionNotes: '', intention: '' }]
      },
      linked: {
        characters: [{ id: 'c1', name: 'Ming' }],
        scenes: [],
        props: [],
        actions: []
      },
      library: {
        characters: [{ id: 'c2', name: 'Mei' }],
        scenes: [{ id: 'sc1', title: 'Alley', description: 'wet' }],
        props: [{ id: 'p1', name: 'cup' }],
        actions: [{ id: 'a1', name: 'Kick' }]
      }
    })
    expect(plan.characters.map((i) => i.action)).toEqual([
      'skip',
      'link',
      'create'
    ])
    expect(plan.scenes[0]).toMatchObject({ action: 'link', existingId: 'sc1' })
    expect(plan.props[0].action).toBe('link')
    expect(plan.actions[0].action).toBe('link')
    expect(summarizeCastPlan(plan)).toEqual({ create: 1, link: 4, skip: 1 })
  })

  it('formats chapters and injects them into beats prompt', () => {
    const text = formatChaptersForPrompt(
      [
        { order: 1, title: 'Night', body: 'Rain on the roof.' },
        { order: 0, title: '', body: 'Open.' }
      ],
      'en'
    )
    expect(text).toMatch(/Open/)
    expect(text).toMatch(/Rain on the roof/)
    const user = buildStoryBeatsUserPrompt({
      title: 'Rain',
      characters: [{ name: 'Ming' }],
      scenes: [{ sceneNumber: 1, description: 'Roof' }],
      props: [],
      chaptersText: text,
      locale: 'en'
    })
    expect(user).toMatch(/Rain on the roof/)
    expect(user).toMatch(/primary plot source|chapters/i)
  })

  it('builds chapter and cast user prompts', () => {
    const ch = buildStoryChaptersUserPrompt({
      title: 'Rain',
      styleNote: 'neon',
      hardRules: 'no gore',
      idea: 'apology',
      locale: 'en'
    })
    expect(ch).toMatch(/Rain/)
    expect(ch).toMatch(/neon/)
    expect(ch).toMatch(/apology/)
    const cast = buildCastFromChaptersUserPrompt({
      title: 'Rain',
      chaptersText: 'Chapter 1',
      existingNames: 'Ming',
      locale: 'en'
    })
    expect(cast).toMatch(/Chapter 1/)
    expect(cast).toMatch(/Ming/)
    expect(cast).toMatch(/not one of each per chapter/)
    const sysEn = buildCastFromChaptersSystemPrompt('en')
    expect(sysEn).toMatch(/Do NOT emit one character/)
    expect(sysEn).toMatch(/one scene \/ one prop \/ one action per chapter/)
    const sysZh = buildCastFromChaptersSystemPrompt('zh-HK')
    expect(sysZh).toMatch(/禁止一章一角色|唔好一章一套/)
    expect(emptyDrafts.characters).toEqual([])
  })
})
