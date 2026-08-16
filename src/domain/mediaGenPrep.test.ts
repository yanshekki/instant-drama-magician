import { describe, expect, it } from 'vitest'
import type { ActionCastRef } from './actionCastRefs'
import {
  actionPlateTaskHint,
  buildActionPlateMaterialSections,
  buildGenericEntityMaterialSections,
  buildMediaGenPolishSystemPrompt,
  buildMediaGenPolishUserText,
  buildComicPageMaterialSections,
  buildTimelineBeatMaterialSections,
  comicPageTaskHint,
  extractPolishedMediaPrompt,
  stripMediaGenPreamble,
  includedMaterialImagePaths,
  isMediaGenPrepPhaseLocked,
  mediaGenMode,
  pickDefaultEditBaseSectionId,
  resolveEditBasePath,
  shellPhaseToStepIndex,
  shellStepsForMode
} from './mediaGenPrep'

const fullCast: ActionCastRef[] = [
  {
    id: '1',
    entityType: 'prop',
    entityId: 'p1',
    entityName: '金心項鍊',
    imagePath: '/prop.png'
  },
  {
    id: '2',
    entityType: 'character',
    entityId: 'c1',
    entityName: '阿明',
    imagePath: '/char.png'
  },
  {
    id: '3',
    entityType: 'scene',
    entityId: 's1',
    entityName: '便利店',
    imagePath: '/scene.png'
  },
  {
    id: '4',
    entityType: 'costume',
    entityId: 'k1',
    entityName: '灰格紋',
    imagePath: '/costume.png'
  }
]

describe('mediaGenPrep', () => {
  it('buildActionPlateMaterialSections defaults cast on and gallery off', () => {
    const { sections, editBaseSectionId, fallbackPrompt } =
      buildActionPlateMaterialSections({
        actionId: 'a1',
        profile: {
          name: '櫃台側身',
          description: '四拍',
          motionNotes: '側身'
        },
        castRefs: fullCast,
        galleryIdentityPaths: ['/salon-board.png'],
        panelLayout: 'grid-2x3',
        artStyleId: 'photo_cinematic'
      })

    const castSecs = sections.filter((s) =>
      ['character', 'costume', 'scene', 'prop'].includes(s.entityType || '')
    )
    expect(castSecs).toHaveLength(4)
    expect(castSecs.every((s) => s.include)).toBe(true)
    expect(castSecs.find((s) => s.entityType === 'character')?.title).toBe(
      '阿明'
    )
    expect(castSecs.every((s) => s.group === 'refs')).toBe(true)

    const gal = sections.find((s) => s.entityType === 'gallery')
    expect(gal?.include).toBe(false)
    expect(gal?.canBeEditBase).toBe(false)

    // With cast: default pure generate (null base) so salon board cannot win
    expect(editBaseSectionId).toBeNull()
    expect(fallbackPrompt).toMatch(/SUBJECT BINDING|阿明|EXACTLY 6/i)

    const included = sections.filter((s) => s.include)
    expect(includedMaterialImagePaths(included)).toEqual([
      '/char.png',
      '/costume.png',
      '/scene.png',
      '/prop.png'
    ])
  })

  it('pickDefaultEditBase prefers character over costume', () => {
    const { sections } = buildActionPlateMaterialSections({
      actionId: 'a1',
      profile: { name: 'X' },
      castRefs: fullCast,
      galleryIdentityPaths: []
    })
    // Force include for pick
    const id = pickDefaultEditBaseSectionId(sections)
    expect(id).toMatch(/character/)
    expect(resolveEditBasePath(sections, id)).toBe('/char.png')
    expect(resolveEditBasePath(sections, null)).toBeNull()
  })

  it('polish user text numbers Ref# for images', () => {
    const { sections } = buildActionPlateMaterialSections({
      actionId: 'a1',
      profile: { name: 'Slash' },
      castRefs: fullCast.slice(0, 2),
      panelLayout: 'strip-3'
    })
    const text = buildMediaGenPolishUserText({
      kind: 'action-plate',
      locale: 'en',
      includedSections: sections.filter((s) => s.include),
      taskHint: actionPlateTaskHint('strip-3', 'Slash')
    })
    expect(text).toMatch(/Ref#1|參考圖1/)
    expect(text).toMatch(/Ref#2|參考圖2/)
    expect(text).toMatch(/Slash|strip-3|EXACTLY 3/i)
    expect(text).toMatch(/ground-truth|Lock identity/i)
    expect(text).not.toMatch(/No reference stills are attached/)
  })

  it('polish user and system text forbid invented refs when no images', () => {
    const text = buildMediaGenPolishUserText({
      kind: 'character-sheet',
      locale: 'en',
      includedSections: [
        {
          id: 'profile',
          kind: 'text-profile',
          title: 'Vladimir Putin',
          entityType: 'character',
          text: 'Name: Vladimir Putin',
          include: true
        }
      ]
    })
    expect(text).toMatch(/No reference stills are attached/)
    expect(text).toMatch(/Do not mention a workspace, Wikipedia/)
    expect(text).not.toMatch(/Attached images are ground-truth/)
    expect(text).not.toMatch(/Ref#1/)

    const sys0 = buildMediaGenPolishSystemPrompt('en', { hasImages: false })
    expect(sys0).toMatch(/No reference stills are attached/)
    expect(sys0).not.toMatch(/attached reference stills/)

    const sys1 = buildMediaGenPolishSystemPrompt('en', { hasImages: true })
    expect(sys1).toMatch(/attached reference stills/)
    expect(sys1).not.toMatch(/No reference stills are attached/)

    const zh0 = buildMediaGenPolishUserText({
      kind: 'character-sheet',
      locale: 'zh-HK',
      includedSections: [
        {
          id: 'profile',
          kind: 'text-profile',
          title: '普京',
          entityType: 'character',
          text: '姓名：普京',
          include: true
        }
      ]
    })
    expect(zh0).toMatch(/沒有附上參考靜圖/)
    expect(zh0).not.toMatch(/附圖圖序/)
    expect(zh0).toMatch(/任務：|種類：|材料/)
    expect(zh0).not.toMatch(/^Task:|^Kind:|--- MATERIALS ---/m)
  })

  it('extractPolishedMediaPrompt strips fences', () => {
    expect(
      extractPolishedMediaPrompt('```\nLONG ENOUGH POLISHED PROMPT BODY HERE XX\n```')
    ).toMatch(/LONG ENOUGH/)
    expect(extractPolishedMediaPrompt('')).toBe('')
  })

  it('extractPolishedMediaPrompt strips leaked assistant preamble', () => {
    const leak =
      "I'll check the workspace for any attached reference stills so the prompt can lock identity to those images.Found Wikipedia stills in the media-run folder. I'll open them so the prompt can lock face, hair, and wardrobe to those references.Single 16:9 live-action photoreal film-still character bible of Vladimir Putin, one adult male age 70–73."
    const out = extractPolishedMediaPrompt(leak)
    expect(out).toMatch(/^Single 16:9 live-action photoreal/)
    expect(out).not.toMatch(/I'll check|Wikipedia|workspace|media-run/i)
    expect(out).toMatch(/Vladimir Putin/)
  })

  it('extractPolishedMediaPrompt keeps a clean director prompt', () => {
    const clean =
      'Single 16:9 live-action photoreal film-still character bible of Maya, one adult woman. HARD RULES: two hands.'
    expect(extractPolishedMediaPrompt(clean)).toBe(clean)
    expect(stripMediaGenPreamble(clean)).toBe(clean)
  })

  it('shell steps differ for image vs video tracks', () => {
    expect(mediaGenMode('character-sheet')).toBe('image')
    expect(mediaGenMode('character-intro')).toBe('video')
    expect(shellStepsForMode('image')).toEqual([
      'materials',
      'polish',
      'generate',
      'result'
    ])
    expect(shellStepsForMode('video')).toEqual([
      'materials',
      'polish',
      'keyframe',
      'confirm-video',
      'video-done'
    ])
    expect(shellPhaseToStepIndex('keyframe', 'video')).toBe(2)
    expect(shellPhaseToStepIndex('loading-polish', 'video')).toBe(1)
    expect(shellPhaseToStepIndex('loading-director', 'video')).toBe(3)
    expect(shellPhaseToStepIndex('result', 'image')).toBe(3)
    expect(shellPhaseToStepIndex('confirm-video', 'video')).toBe(3)
    expect(isMediaGenPrepPhaseLocked('loading-director')).toBe(true)
  })

  it('buildGenericEntityMaterialSections layout + forcePureLayout', () => {
    const built = buildGenericEntityMaterialSections({
      kind: 'character-sheet',
      name: 'Aria',
      profileText: 'Name: Aria\nAge: 20s',
      artStyleId: 'photo_cinematic',
      galleryPaths: ['/a.png'],
      preferIdentityEdit: true,
      forcePureLayout: true,
      layoutSection: {
        title: 'turnaround',
        text: 'LAYOUT: 3-view turnaround. Wardrobe layer: body.'
      },
      fallbackPrompt: 'PROFESSIONAL TEMPLATE WITH LAYOUT turnaround',
      genOptionsExtra: { sheetVariant: 'turnaround', galleryLabel: 'Turnaround' }
    })
    expect(built.editBaseSectionId).toBeNull()
    expect(built.fallbackPrompt).toMatch(/PROFESSIONAL TEMPLATE/)
    expect(built.sections.some((s) => s.entityType === 'layout')).toBe(true)
    expect(built.genOptions.forcePureLayout).toBe(true)
    expect(built.genOptions.sheetVariant).toBe('turnaround')
    expect(
      built.sections.find((s) => s.imagePath)?.canBeEditBase
    ).toBe(false)
  })

  it('buildTimelineBeatMaterialSections multi cast refs', () => {
    const built = buildTimelineBeatMaterialSections({
      kind: 'timeline-still',
      storyTitle: 'Demo',
      displayIndex: 2,
      dialogue: 'hello',
      characters: [
        { id: 'c1', name: 'A', imagePath: '/a.png' },
        { id: 'c2', name: 'B', imagePath: '/b.png' }
      ],
      scenes: [{ id: 'sc1', name: 'Roof', imagePath: '/s.png' }],
      props: [{ id: 'p1', name: 'Badge', imagePath: '/p.png' }]
    })
    const charSecs = built.sections.filter((s) => s.entityType === 'character')
    expect(charSecs.length).toBe(2)
    expect(charSecs.every((s) => s.canBeEditBase === false)).toBe(true)
    expect(built.editBaseSectionId).toBeNull()
    expect(built.sections.some((s) => s.entityType === 'scene')).toBe(true)
    expect(built.fallbackPrompt).toMatch(/A, B|Cast/)
  })

  it('buildMediaGenPolishSystemPrompt video mode', () => {
    const v = buildMediaGenPolishSystemPrompt('en', { mode: 'video' })
    expect(v).toMatch(/video|camera/i)
    expect(v).toMatch(/materials and seed|Demo story|fixed sample/i)
    const i = buildMediaGenPolishSystemPrompt('zh-HK')
    expect(i).toMatch(/LAYOUT|出圖方案|layout/i)
    expect(i).toMatch(/固定樣本|Demo|材料/)
  })

  it('buildComicPageMaterialSections locks panel count', () => {
    const built = buildComicPageMaterialSections({
      storyTitle: '夜巴',
      pageOrder: 2,
      layoutId: 'grid-2x2',
      artStyleId: 'comic_western',
      hardRules: 'no logo',
      slots: [
        { caption: '開門' },
        { caption: '' },
        { caption: '對打' },
        { caption: '收勢' }
      ],
      galleryPaths: ['/c.png'],
      previousPagePath: '/prev.png',
      ownPagePath: '/own.png',
      locale: 'zh-HK'
    })
    expect(built.genOptions.panelLayout).toBe('grid-2x2')
    expect(built.fallbackPrompt).toMatch(/剛好 4 格|必須剛好 4/)
    expect(built.fallbackPrompt).toMatch(/必須媒介：西式漫畫|畫風：/)
    expect(built.fallbackPrompt).not.toMatch(
      /EXACTLY 4|GEOMETRY LOCK|Layout:|MANDATORY MEDIUM/
    )
    expect(built.fallbackPrompt).toContain('開門')
    expect(built.taskHint).toContain('夜巴')
    expect(built.sections.some((s) => s.id === 'prev_page')).toBe(true)
    expect(built.sections.some((s) => s.id === 'own_page')).toBe(true)
    expect(built.sections.some((s) => s.entityType === 'hardRules')).toBe(true)
    expect(mediaGenMode('comic-page')).toBe('image')
    expect(mediaGenMode('key-art')).toBe('image')
    expect(
      comicPageTaskHint({
        storyTitle: 'X',
        pageOrder: 1,
        panelCount: 4,
        locale: 'en'
      })
    ).toMatch(/exactly 4/i)
    expect(
      comicPageTaskHint({
        storyTitle: '夜巴',
        pageOrder: 1,
        panelCount: 4,
        locale: 'zh-HK'
      })
    ).toMatch(/剛好 4 格/)
  })
})
