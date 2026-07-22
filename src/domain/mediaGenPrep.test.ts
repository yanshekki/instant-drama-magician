import { describe, expect, it } from 'vitest'
import type { ActionCastRef } from './actionCastRefs'
import {
  actionPlateTaskHint,
  buildActionPlateMaterialSections,
  buildGenericEntityMaterialSections,
  buildMediaGenPolishSystemPrompt,
  buildMediaGenPolishUserText,
  buildTimelineBeatMaterialSections,
  extractPolishedMediaPrompt,
  includedMaterialImagePaths,
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
    expect(text).toMatch(/Ref#1/)
    expect(text).toMatch(/Ref#2/)
    expect(text).toMatch(/Slash|strip-3|EXACTLY 3/i)
  })

  it('extractPolishedMediaPrompt strips fences', () => {
    expect(
      extractPolishedMediaPrompt('```\nLONG ENOUGH POLISHED PROMPT BODY HERE XX\n```')
    ).toMatch(/LONG ENOUGH/)
    expect(extractPolishedMediaPrompt('')).toBe('')
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
    expect(shellPhaseToStepIndex('result', 'image')).toBe(3)
    expect(shellPhaseToStepIndex('confirm-video', 'video')).toBe(3)
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
    expect(built.sections.some((s) => s.entityType === 'scene')).toBe(true)
    expect(built.fallbackPrompt).toMatch(/A, B|Cast/)
  })

  it('buildMediaGenPolishSystemPrompt video mode', () => {
    const v = buildMediaGenPolishSystemPrompt('en', { mode: 'video' })
    expect(v).toMatch(/video|camera/i)
    const i = buildMediaGenPolishSystemPrompt('zh-HK')
    expect(i).toMatch(/LAYOUT|出圖方案|layout/i)
  })
})
