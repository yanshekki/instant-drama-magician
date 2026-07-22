import { describe, expect, it } from 'vitest'
import type { ActionCastRef } from './actionCastRefs'
import {
  actionPlateTaskHint,
  buildActionPlateMaterialSections,
  buildMediaGenPolishUserText,
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
})
