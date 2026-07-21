/**
 * Residual line coverage for domain modules that still had uncovered statements.
 * Invokes real exported APIs; mocks only Date / JSON where needed.
 * (chatVision residual mocks live in chatVision.residual.test.ts)
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AppError } from '../types/errors'
import { pathToFileUrl } from './appPaths'
import { parseEntryStillPromptCache, buildCastCardModel } from './advancedPrep'
import {
  buildImproveUserPrompt
} from './aiImprovePrompt'
import {
  legacyDialogueToBeatContent,
  parseBeatContent,
  serializeBeatContent,
  beatContentToClipPromptBlock
} from './beatContent'
import {
  rewriteVisionContentForGrokGateway
} from './chatCompletionBody'
import {
  buildCostumeIntroVideoPrompt,
  buildCostumeSwapPrompt,
  pickBestBaseImage
} from './costumeSwap'
import { buildXfadeFilterChain } from './exportLayout'
import {
  GROK_GATEWAY_BASE_URL,
  GROK_GATEWAY_VIDEO_PATH,
  LEGACY_GROK_BASE_URL,
  migrateGatewayDefaults
} from './gatewayDefaults'
import { extractJsonObject } from './jsonProfileFields'
import { formatLegalAcceptedAt } from './legal'
import {
  applyLlmPreset,
  providerDocsUrl
} from './openaiCompatible'
import { isProfileFieldEmpty } from './profileFillMissing'
import {
  buildClipPrompt,
  buildContinuityLockPrompt,
  previousClipContext,
  resolveClipRefImage
} from './promptContinuity'
import { collectTimelineHardRules } from './promptHardRules'
import {
  resolveImageEndpoint,
  resolveVideoEndpoint
} from './providerEndpoints'
import { pickBestSceneBaseImage } from './sceneAtmosphere'
import { buildSceneSuggestFromStoryUserPrompt } from './sceneMasterPrompt'
import {
  extractStoryBeatsJson,
  resolveBeatIds
} from './storyMasterPrompt'
import { normalizeBindings } from './timelineBindings'
import { detectBrowserUiLanguage } from './uiLanguages'
import {
  buildStillRegenPolishUserPrompt,
  buildVideoPrepDraftKey,
  parsePersistedVideoPrepDraft,
  parseVideoPrepDraftStore,
  videoPrepPhaseToStepIndex
} from './videoPrep'
import {
  buildClipVideoPolishUserPrompt,
  buildCostumeIntroVideoPolishUserPrompt,
  buildIntroVideoPolishUserPrompt,
  buildPropIntroVideoPolishUserPrompt,
  buildSceneIntroVideoPolishUserPrompt
} from './videoPromptPolish'
import {
  buildWardrobeSuggestUserPrompt,
  extractWardrobeSuggestionJson
} from './wardrobeSuggest'
import {
  formatSpokenLanguagesDisplay,
  languageLabel,
  normalizeLanguageCodes
} from './worldLanguages'
import { DEFAULT_SETTINGS, type AppSettings } from '../types/settings'
import type { Character, TimelineEntry } from '../types/domain'
import type { CharacterGalleryItem } from './characterGallery'
import type { SceneGalleryItem } from './sceneGallery'

function s(partial: Partial<AppSettings>): AppSettings {
  return { ...DEFAULT_SETTINGS, ...partial }
}

const baseEntry = (
  partial: Partial<TimelineEntry> & { id: string }
): TimelineEntry => ({
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

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('residual: chatCompletionBody', () => {
  it('passes through non-object and unknown-type parts', () => {
    const parts = rewriteVisionContentForGrokGateway([
      null,
      'str',
      42,
      { type: 'text', text: 't' },
      { type: 'custom_block', data: 1 }
    ] as never)
    expect(Array.isArray(parts)).toBe(true)
    if (!Array.isArray(parts)) return
    expect(parts[0]).toBeNull()
    expect(parts[1]).toBe('str')
    expect(parts[2]).toBe(42)
    expect(parts[3]).toEqual({ type: 'text', text: 't' })
    expect(parts[4]).toEqual({ type: 'custom_block', data: 1 })
  })
})

describe('residual: legal', () => {
  it('returns iso when Date construction throws', () => {
    const Orig = globalThis.Date
    // Force catch branch (invalid ISO already uses NaN path, not throw)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(globalThis as any).Date = class {
      constructor() {
        throw new Error('Date broken')
      }
      static now() {
        return Orig.now()
      }
    }
    try {
      expect(formatLegalAcceptedAt('2026-07-19T12:00:00.000Z')).toBe(
        '2026-07-19T12:00:00.000Z'
      )
    } finally {
      globalThis.Date = Orig
    }
  })
})

describe('residual: exportLayout + gatewayDefaults', () => {
  it('empty xfade durations yields black color source', () => {
    expect(
      buildXfadeFilterChain({ clipDurations: [], transitionSec: 0.3 })
    ).toBe('color=c=black:s=1280x720:d=1[vout]')
  })

  it('migrates legacy base with empty video path', () => {
    const { settings, migrated } = migrateGatewayDefaults({
      baseUrl: LEGACY_GROK_BASE_URL,
      videoPath: ''
    })
    expect(migrated).toBe(true)
    expect(settings.baseUrl).toBe(GROK_GATEWAY_BASE_URL)
    expect(settings.videoPath).toBe(GROK_GATEWAY_VIDEO_PATH)
  })
})

describe('residual: jsonProfileFields + profileFillMissing + aiImprove', () => {
  it('extractJsonObject throws when parse yields non-object', () => {
    const spy = vi.spyOn(JSON, 'parse').mockReturnValueOnce(null)
    expect(() => extractJsonObject('{"a":1}')).toThrow(AppError)
    spy.mockRestore()
  })

  it('isProfileFieldEmpty true for plain objects', () => {
    expect(isProfileFieldEmpty({})).toBe(true)
    expect(isProfileFieldEmpty({ a: 1 })).toBe(true)
  })

  it('improve mode empty idea uses default polish strings', () => {
    const en = buildImproveUserPrompt({
      locale: 'en',
      idea: '',
      draft: { name: 'A' }
    })
    expect(en).toContain('(polish all fields for short-drama continuity)')
    const zh = buildImproveUserPrompt({
      locale: 'zh-HK',
      idea: '',
      draft: { name: 'A' }
    })
    expect(zh).toMatch(/全面潤飾|continuity/)
  })
})

describe('residual: appPaths + uiLanguages', () => {
  it('pathToFileUrl uses file:/// on win32 platform', () => {
    const desc = Object.getOwnPropertyDescriptor(process, 'platform')
    Object.defineProperty(process, 'platform', {
      configurable: true,
      value: 'win32'
    })
    try {
      const u = pathToFileUrl('/tmp/foo/instant-drama.db')
      expect(u.startsWith('file:///')).toBe(true)
      // drive-letter branch: path that still matches after resolve on this OS
      // (regex path is covered when resolved starts with X:)
      const driveLike = pathToFileUrl('C:/Users/ki/instant-drama.db')
      // On Linux resolve rewrites drive paths; win32 platform still forces triple slash
      expect(driveLike.startsWith('file:///')).toBe(true)
    } finally {
      if (desc) Object.defineProperty(process, 'platform', desc)
      else
        Object.defineProperty(process, 'platform', {
          configurable: true,
          value: 'linux'
        })
    }
  })

  it('detectBrowserUiLanguage covers es/hi/ar/pt/fr/ja/ru prefixes and fallback', () => {
    const cases: Array<[string, string]> = [
      ['es-MX', 'es'],
      ['hi-IN', 'hi'],
      ['ar-SA', 'ar'],
      ['pt-BR', 'pt-BR'],
      ['fr-FR', 'fr'],
      ['ja-JP', 'ja'],
      ['ru-RU', 'ru']
    ]
    for (const [nav, expected] of cases) {
      Object.defineProperty(globalThis, 'navigator', {
        configurable: true,
        value: { language: nav, languages: [nav] }
      })
      expect(detectBrowserUiLanguage('en')).toBe(expected)
    }
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: { language: 'xx-YY', languages: ['xx-YY'] }
    })
    expect(detectBrowserUiLanguage('en')).toBe('en')
  })
})

describe('residual: timelineBindings', () => {
  it('explicit null single ids clear multi lists', () => {
    const n = normalizeBindings({
      characterId: null,
      sceneId: null,
      propId: null,
      actionId: null
    })
    expect(n.characterIdList).toEqual([])
    expect(n.sceneIdList).toEqual([])
    expect(n.propIdList).toEqual([])
    expect(n.actionIdList).toEqual([])
  })
})

describe('residual: beatContent', () => {
  it('legacy structured tags path and action/expr without who', () => {
    const structured = legacyDialogueToBeatContent(
      '【動作】摘帽\n【表情】皺眉'
    )
    expect(structured?.units.some((u) => u.type === 'action')).toBe(true)

    const zhNoWho = parseBeatContent(
      ['【動作】踢門', '【表情】驚恐', '【對白】「誰？」'].join('\n')
    )
    expect(zhNoWho?.units.find((u) => u.type === 'action')).toMatchObject({
      type: 'action',
      text: '踢門'
    })
    expect(zhNoWho?.units.find((u) => u.type === 'expression')).toMatchObject({
      type: 'expression',
      text: '驚恐'
    })

    const enNoWho = parseBeatContent(
      ['[ACTION] kicks door', '[EXPR] shocked'].join('\n')
    )
    expect(enNoWho?.units.find((u) => u.type === 'action')).toMatchObject({
      type: 'action',
      text: 'kicks door'
    })
    expect(enNoWho?.units.find((u) => u.type === 'expression')).toMatchObject({
      type: 'expression',
      text: 'shocked'
    })

    // Invalid JSON object start + invalid jsonFallback catch
    expect(
      parseBeatContent('{not-json', 'also-not-json')
    ).toBeTruthy()

    const serEn = serializeBeatContent(
      {
        version: 1,
        units: [
          { type: 'action', text: 'walks' },
          { type: 'expression', text: 'smiles' }
        ]
      },
      'en'
    )
    expect(serEn).toContain('[ACTION] walks')
    expect(serEn).toContain('[EXPR] smiles')

    const serZh = serializeBeatContent(
      {
        version: 1,
        units: [
          { type: 'action', text: '走' },
          { type: 'expression', text: '笑' }
        ]
      },
      'zh-HK'
    )
    expect(serZh).toContain('【動作】走')
    expect(serZh).toContain('【表情】笑')

    const serZhWho = serializeBeatContent(
      {
        version: 1,
        units: [{ type: 'expression', who: '阿明', text: '皺眉' }]
      },
      'zh-HK'
    )
    expect(serZhWho).toContain('【表情｜阿明】皺眉')

    const block = beatContentToClipPromptBlock({
      version: 1,
      units: [{ type: 'dialogue', who: '', line: 'alone', tone: 'soft' }]
    })
    expect(block).toMatch(/「alone」/)
  })
})

describe('residual: promptContinuity', () => {
  it('preferCast, null ref, dialogue snippet, scene/prop branches', () => {
    expect(
      resolveClipRefImage({
        preferCastOverContinuity: true,
        castRefPath: '/cast.png',
        previousContinuityPath: '/prev.png'
      })
    ).toEqual({ path: '/cast.png', source: 'cast' })

    expect(resolveClipRefImage({})).toBeNull()
    expect(
      resolveClipRefImage({
        action: { refImagePath: '/a.png' }
      })
    ).toEqual({ path: '/a.png', source: 'action' })

    const lock = buildContinuityLockPrompt({
      previousBeatIndex: 1,
      previousDialogueSnippet: 'Hello there from last beat',
      hasContinuityImage: true
    })
    expect(lock).toContain('Previous beat context')
    expect(lock).toContain('Hello there')

    const entries = [
      baseEntry({
        id: 'e0',
        order: 0,
        sceneId: 'sc1',
        propId: 'p1',
        dialogue: 'Hi'
      }),
      baseEntry({ id: 'e1', order: 1, startTime: 6, endTime: 12 })
    ]
    const ctx = previousClipContext(entries, 'e1', {
      characters: new Map(),
      scenes: new Map([
        [
          'sc1',
          {
            id: 'sc1',
            storyId: 's1',
            sceneNumber: 2,
            title: 'Alley',
            description: 'wet',
            script: null,
            status: 'PENDING',
            refImagePath: null,
            mood: 'tense'
          } as never
        ]
      ]),
      props: new Map([
        [
          'p1',
          {
            id: 'p1',
            storyId: 's1',
            name: 'Umbrella',
            description: 'red',
            refImagePath: null
          } as never
        ]
      ])
    })
    expect(ctx).toMatch(/scene #2|Alley|Umbrella|tense/i)

    // Scene without locationType / weather — still builds (null branches)
    const p = buildClipPrompt({
      storyTitle: 'S',
      scene: {
        id: 'sc',
        storyId: 's',
        sceneNumber: 1,
        description: 'room',
        script: null,
        status: 'PENDING',
        refImagePath: null
      } as never,
      prop: {
        id: 'p',
        storyId: 's',
        name: 'Key',
        description: 'brass',
        refImagePath: null
      } as never,
      seconds: 4
    })
    expect(p).toMatch(/room|Key/)
  })
})

describe('residual: videoPromptPolish en/zh variants', () => {
  it('covers remaining locale branches for all polish builders', () => {
    expect(
      buildIntroVideoPolishUserPrompt({
        locale: 'en',
        seconds: 8,
        hasRefImage: true,
        fallbackPrompt: 'F',
        name: 'Ming'
      })
    ).toMatch(/Reference still is attached/)

    expect(
      buildIntroVideoPolishUserPrompt({
        locale: 'zh-HK',
        seconds: 8,
        hasRefImage: false,
        fallbackPrompt: 'F',
        name: '阿明'
      })
    ).toMatch(/本文無靜圖路徑/)

    expect(
      buildSceneIntroVideoPolishUserPrompt({
        locale: 'en',
        seconds: 10,
        hasRefImage: false,
        fallbackPrompt: 'S',
        title: '',
        description: ''
      })
    ).toMatch(/Location/)

    expect(
      buildSceneIntroVideoPolishUserPrompt({
        locale: 'zh-HK',
        seconds: 10,
        hasRefImage: false,
        fallbackPrompt: 'S',
        title: '',
        description: '',
        script: 'A waits in rain'
      })
    ).toMatch(/本文無靜圖路徑|劇本提示|場景/)

    expect(
      buildPropIntroVideoPolishUserPrompt({
        locale: 'en',
        seconds: 10,
        hasRefImage: true,
        fallbackPrompt: 'P',
        name: 'Watch',
        description: 'silver'
      })
    ).toMatch(/Reference prop still is attached/)

    expect(
      buildPropIntroVideoPolishUserPrompt({
        locale: 'zh-HK',
        seconds: 10,
        hasRefImage: false,
        fallbackPrompt: 'P',
        name: '錶',
        description: '銀'
      })
    ).toMatch(/本文無靜圖路徑/)

    expect(
      buildCostumeIntroVideoPolishUserPrompt({
        locale: 'zh-HK',
        seconds: 10,
        hasRefImage: true,
        fallbackPrompt: 'C',
        name: '雨衣',
        description: '黑'
      })
    ).toMatch(/參考靜圖會交予影片 API/)

    expect(
      buildCostumeIntroVideoPolishUserPrompt({
        locale: 'en',
        seconds: 10,
        hasRefImage: false,
        fallbackPrompt: 'C',
        name: 'Coat',
        description: 'leather'
      })
    ).toMatch(/No reference still path/)

    const clipZh = buildClipVideoPolishUserPrompt({
      locale: 'zh-HK',
      seconds: 6,
      hasRefImage: true,
      fallbackPrompt: 'CLIP',
      storyTitle: '雨夜',
      characterBlocks: ['阿明：外賣'],
      actionBlock: '踢門',
      previousContext: '上一段',
      revisionPrompt: '更暗',
      beatOrDialogue: '走'
    })
    expect(clipZh).toMatch(/參考靜圖|角色：|動作指導：|前一段連續性：|導演修訂/)
  })
})

describe('residual: providerEndpoints + openaiCompatible', () => {
  it('image baseUrl fallbacks and video path defaults', () => {
    // imageBaseUrl empty → applied.baseUrl / def.baseUrl
    const img = resolveImageEndpoint(
      s({
        imageProvider: 'openai',
        imageBaseUrl: '',
        imageApiKey: 'k'
      })
    )
    expect(img.baseUrl).toContain('openai')

    // custom + empty imageBaseUrl → def (empty) → chat.baseUrl fallbacks
    const imgCustom = resolveImageEndpoint(
      s({
        imageProvider: 'custom',
        imageBaseUrl: '',
        imageApiKey: 'k',
        baseUrl: GROK_GATEWAY_BASE_URL
      })
    )
    expect(imgCustom.baseUrl).toBe(GROK_GATEWAY_BASE_URL)

    // same-as-llm non-gateway default video path
    const vidOpenai = resolveVideoEndpoint(
      s({
        llmProvider: 'openai',
        baseUrl: 'https://api.openai.com/v1',
        apiKey: 'sk',
        videoProvider: 'same-as-llm',
        videoPath: ''
      })
    )
    expect(vidOpenai.videoPath).toMatch(/\/videos$/)

    // grok-gateway same-as-llm empty videoPath → gateway path
    const vidGrok = resolveVideoEndpoint(
      s({
        llmProvider: 'grok-gateway',
        baseUrl: GROK_GATEWAY_BASE_URL,
        videoProvider: 'same-as-llm',
        videoPath: ''
      })
    )
    expect(vidGrok.videoPath).toBe(GROK_GATEWAY_VIDEO_PATH)

    // dedicated video preset with empty videoBaseUrl uses def/applied base
    const vidCustom = resolveVideoEndpoint(
      s({
        videoProvider: 'openai',
        videoBaseUrl: '',
        videoPath: '',
        videoApiKey: 'vk'
      })
    )
    expect(vidCustom.baseUrl).toBe('https://api.openai.com/v1')
    expect(vidCustom.videoPath).toMatch(/videos/)

    // dedicated grok-gateway video with empty path → default gateway path (117-118)
    const vidGw = resolveVideoEndpoint(
      s({
        videoProvider: 'grok-gateway',
        videoBaseUrl: GROK_GATEWAY_BASE_URL,
        videoPath: '',
        videoApiKey: 'gk'
      })
    )
    expect(vidGw.videoPath).toBe(GROK_GATEWAY_VIDEO_PATH)

    // custom video + empty videoBaseUrl → chat fallback
    const vidBlankCustom = resolveVideoEndpoint(
      s({
        videoProvider: 'custom',
        videoBaseUrl: '',
        videoPath: '',
        baseUrl: GROK_GATEWAY_BASE_URL
      })
    )
    expect(vidBlankCustom.baseUrl).toBe(GROK_GATEWAY_BASE_URL)
  })

  it('modelLooksForeign kimi/openai residual prefixes + docsUrl fallback', () => {
    expect(
      applyLlmPreset(
        {
          llmProvider: 'custom',
          baseUrl: 'x',
          videoPath: 'x',
          model: 'claude-3-opus'
        },
        'kimi'
      ).model
    ).not.toBe('claude-3-opus')
    expect(
      applyLlmPreset(
        {
          llmProvider: 'custom',
          baseUrl: 'x',
          videoPath: 'x',
          model: 'llama-3-70b'
        },
        'kimi'
      ).model
    ).not.toBe('llama-3-70b')
    expect(
      applyLlmPreset(
        {
          llmProvider: 'custom',
          baseUrl: 'x',
          videoPath: 'x',
          model: 'grok-beta'
        },
        'kimi'
      ).model
    ).not.toBe('grok-beta')

    expect(
      applyLlmPreset(
        {
          llmProvider: 'custom',
          baseUrl: 'x',
          videoPath: 'x',
          model: 'grok-cli'
        },
        'openai'
      ).model
    ).toBe('gpt-4o-mini')
    expect(
      applyLlmPreset(
        {
          llmProvider: 'custom',
          baseUrl: 'x',
          videoPath: 'x',
          model: 'llama-3'
        },
        'openai'
      ).model
    ).toBe('gpt-4o-mini')
    expect(
      applyLlmPreset(
        {
          llmProvider: 'custom',
          baseUrl: 'x',
          videoPath: 'x',
          model: 'kimi-k2'
        },
        'openai'
      ).model
    ).toBe('gpt-4o-mini')

    expect(providerDocsUrl('not-a-real-preset' as never)).toBe(
      'https://platform.openai.com/docs/api-reference'
    )
  })
})

describe('residual: wardrobeSuggest + sceneAtmosphere + costumeSwap', () => {
  it('styleNote/segmentLabel en and Look name fallback', () => {
    const u = buildWardrobeSuggestUserPrompt({
      characterName: 'Aiko',
      appearance: 'black hair',
      sceneSnippets: ['chase'],
      locale: 'en',
      styleNote: 'neon noir',
      segmentLabel: 'reunion'
    })
    expect(u).toContain('style: neon noir')
    expect(u).toContain('Selected plot segment: reunion')

    const r = extractWardrobeSuggestionJson(
      '{"name":"","costume":"red jacket","artStyle":"photo_cinematic"}'
    )
    expect(r.name).toBe('Look')
  })

  it('scene atmosphere any reason when no preferred layers', () => {
    const g: SceneGalleryItem[] = [
      {
        id: '1',
        path: '/d.png',
        kind: 'sheet',
        label: 'Detail wet surface',
        createdAt: '1',
        layer: 'detail'
      }
    ]
    expect(pickBestSceneBaseImage(g)).toEqual({
      item: g[0],
      reason: 'any'
    })
  })

  it('costume any reason, mannerisms, empty name fallbacks', () => {
    const g: CharacterGalleryItem[] = [
      {
        id: '1',
        path: '/x.png',
        kind: 'external',
        label: 'misc external',
        createdAt: '1'
      }
    ]
    expect(pickBestBaseImage(g).reason).toBe('any')

    const p = buildCostumeSwapPrompt({
      name: 'Ming',
      newCostume: 'coat',
      mannerisms: 'touches helmet often when nervous in rain'
    })
    expect(p).toMatch(/Mannerism/)

    expect(
      buildCostumeIntroVideoPrompt(
        { name: '  ', description: 'long black coat description' },
        'en'
      )
    ).toContain('long black coat description')

    expect(
      buildCostumeIntroVideoPrompt({ name: '', description: '' }, 'en')
    ).toMatch(/Look/)
    expect(
      buildCostumeIntroVideoPrompt({ name: '', description: '' }, 'zh-HK')
    ).toMatch(/造型/)
  })
})

describe('residual: advancedPrep + videoPrep', () => {
  it('still cache keeps string updatedAt; cast hasAnyImage or-chain', () => {
    const cache = parseEntryStillPromptCache(
      JSON.stringify({
        professionalPrompt: 'pro',
        stillPath: '/s.png',
        updatedAt: '2026-01-01T00:00:00.000Z'
      })
    )
    expect(cache?.updatedAt).toBe('2026-01-01T00:00:00.000Z')

    // No refs, empty gallery, but costume with image → hasAnyImage via costumes
    const character = {
      id: 'c1',
      name: 'M',
      description: 'd',
      refImagePath: null,
      refSheetPath: null,
      refGalleryJson: '[]',
      costumesJson: JSON.stringify([
        {
          id: 'cos1',
          name: 'C',
          description: 'x',
          imagePath: '/cos.png',
          createdAt: '1',
          updatedAt: '1'
        }
      ])
    } as unknown as Character
    const card = buildCastCardModel(character, null)
    expect(card.hasAnyImage).toBe(true)
  })

  it('draft key costume, empty queue parse, materials hardRules null branch', () => {
    expect(
      buildVideoPrepDraftKey('costume-intro', { costumeId: 'cos1' }, null)
    ).toBe('costume-intro:cos1:_')
    // no entity ids → primary '_'
    expect(buildVideoPrepDraftKey('character-intro', {}, null)).toBe(
      'character-intro:_:_'
    )

    expect(videoPrepPhaseToStepIndex('not-a-phase' as never)).toBe(0)

    const persisted = parsePersistedVideoPrepDraft(
      JSON.stringify({
        version: 1,
        draft: {
          kind: 'character-intro',
          entityIds: { characterId: 'c1' },
          professionalPrompt: 'PRO',
          userExtraPrompt: '',
          stillPath: '/s.png',
          sourceImagePath: null,
          durationSeconds: 10,
          aspectRatio: '16:9'
        },
        queueRemaining: 'not-array'
      })
    )
    expect(persisted?.queueRemaining).toEqual([])

    const store = parseVideoPrepDraftStore(
      JSON.stringify({
        'k1': {
          version: 1,
          draft: {
            kind: 'character-intro',
            entityIds: { characterId: 'c1' },
            professionalPrompt: 'PRO',
            userExtraPrompt: '',
            stillPath: '/s.png',
            sourceImagePath: null,
            durationSeconds: 10,
            aspectRatio: '16:9'
          },
          queueRemaining: 123
        }
      })
    )
    expect(store.k1?.queueRemaining).toEqual([])

    const polish = buildStillRegenPolishUserPrompt({
      locale: 'en',
      seconds: 6,
      aspectRatio: '16:9',
      improvementNotes: 'warmer',
      professionalPrompt: 'PRO',
      hardRules: null
    })
    expect(polish).toContain('warmer')
    expect(polish).not.toMatch(/HARD RULES \(must keep/)
  })
})

describe('residual: storyMasterPrompt + promptHardRules + sceneMaster', () => {
  it('action unit fallback, line field, who collection, cast matching', () => {
    // Long legacy → action unit (not short dialogue)
    const longAction = extractStoryBeatsJson(
      JSON.stringify([
        {
          characterName: '',
          sceneHint: '',
          propName: '',
          dialogue:
            '阿明在雨中奔跑，穿過窄巷，終於停在門前，深呼吸後推開門。'
        }
      ])
    )
    expect(longAction[0].content.units[0]?.type).toBe('action')

    // line field (not dialogue/script)
    const lineBeats = extractStoryBeatsJson(
      JSON.stringify([
        {
          characterName: 'Ming',
          sceneHint: '1',
          propName: '',
          line: 'Wait for me!'
        }
      ])
    )
    expect(lineBeats[0].content.units[0]?.type).toBe('dialogue')

    // units with who → characterNames collection
    const withWho = extractStoryBeatsJson(
      JSON.stringify([
        {
          characterName: 'A',
          characterNames: ['A'],
          sceneHint: '',
          propName: '',
          units: [
            { type: 'dialogue', who: 'B-side', line: 'hi' },
            { type: 'action', who: 'C-extra', text: 'runs' }
          ]
        }
      ])
    )
    expect(withWho[0].characterNames).toEqual(
      expect.arrayContaining(['A', 'B-side', 'C-extra'])
    )

    // resolveBeatIds: no exact name match → includes; description scene match; prop exact
    const r = resolveBeatIds(
      {
        characterName: 'Mei',
        characterNames: ['nobody-exact'],
        sceneHint: 'wet cobble',
        propName: 'red umbrella',
        dialogue: 'hi',
        content: {
          version: 1,
          units: [{ type: 'dialogue', who: 'Mei', line: 'hi' }]
        },
        scriptText: 'hi',
        beatContentJson: '{}'
      },
      {
        characters: [{ id: 'c1', name: 'Xiao Mei' }],
        scenes: [
          {
            id: 'sc1',
            sceneNumber: 9,
            title: null as unknown as string,
            description: 'wet cobble alley at night'
          }
        ],
        props: [{ id: 'p1', name: 'Red Umbrella' }]
      }
    )
    expect(r.characterId).toBe('c1')
    expect(r.sceneId).toBe('sc1')
    expect(r.propId).toBe('p1')

    // prop partial match → null final when nothing matches
    const noProp = resolveBeatIds(
      {
        characterName: '',
        characterNames: [],
        sceneHint: '',
        propName: 'zzzz',
        dialogue: 'x',
        content: { version: 1, units: [] },
        scriptText: 'x',
        beatContentJson: '{}'
      },
      {
        characters: [],
        scenes: [],
        props: [{ id: 'p1', name: 'Key' }]
      }
    )
    expect(noProp.propId).toBeNull()
  })

  it('scene name fallback to Scene label', () => {
    const m = collectTimelineHardRules({
      scenes: [{ hardRules: 'empty set only' }]
    })
    expect(m).toContain('[Scene · Scene]')
  })

  it('focus vs scenes labels en/zh', () => {
    const enFocus = buildSceneSuggestFromStoryUserPrompt({
      locale: 'en',
      storyTitle: 'Rain',
      sceneNumber: 1,
      characterSnippets: [],
      propSnippets: [],
      priorSceneSnippets: ['beat'],
      focusSnippets: ['reunion detail']
    })
    expect(enFocus).toContain('Selected plot segment detail:')

    const zhScenes = buildSceneSuggestFromStoryUserPrompt({
      locale: 'zh-HK',
      storyTitle: '雨',
      sceneNumber: 1,
      characterSnippets: [],
      propSnippets: [],
      priorSceneSnippets: ['#1 巷']
    })
    expect(zhScenes).toContain('故事場次／段落：')
  })
})

describe('residual: worldLanguages', () => {
  it('navigator fallback, non-string parse items, format display', () => {
    // Force Intl.DisplayNames to throw → fallback return
    const Orig = Intl.DisplayNames
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(Intl as any).DisplayNames = class {
      constructor() {
        throw new Error('no intl')
      }
    }
    try {
      const label = languageLabel('en', 'en')
      expect(label.length).toBeGreaterThan(0)
    } finally {
      Intl.DisplayNames = Orig
    }

    expect(normalizeLanguageCodes([1, true, 'en'] as never)).toContain('en')

    expect(formatSpokenLanguagesDisplay([])).toBe('')
    expect(formatSpokenLanguagesDisplay(['en', 'yue'], 'en')).toMatch(/、/)
    expect(formatSpokenLanguagesDisplay(['en'], 'zh-HK').length).toBeGreaterThan(
      0
    )
  })
})

