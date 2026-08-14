import { describe, expect, it } from 'vitest'
import {
  buildTimelineGraph,
  findTimelineGraphPrepCell,
  layoutTimelineGraph,
  previousStillPath,
  timelineGraphBezier,
  timelineGraphBindIds,
  timelineGraphCharImage,
  timelineGraphEdgePath,
  timelineGraphEstimateTextHeight,
  timelineGraphNodeSize,
  timelineGraphSnippet
} from './timelineGraph'

const entry = {
  id: 'e1',
  characterId: 'c1',
  characterIds: ['c1', 'c2'],
  sceneId: 's1',
  sceneIds: ['s1'],
  propId: 'p1',
  propIds: ['p1'],
  actionId: 'a1',
  actionIds: ['a1'],
  mediaStatus: 'READY',
  mediaPath: '/v.mp4'
}

describe('timelineGraphBindIds', () => {
  it('prefers multi list and dedupes', () => {
    expect(timelineGraphBindIds(['a', 'a', 'b'], 'z')).toEqual(['a', 'b'])
  })
  it('falls back to primary', () => {
    expect(timelineGraphBindIds([], 'solo')).toEqual(['solo'])
    expect(timelineGraphBindIds(undefined, 'solo')).toEqual(['solo'])
  })
  it('returns empty when nothing bound', () => {
    expect(timelineGraphBindIds([], null)).toEqual([])
    expect(timelineGraphBindIds(undefined, '  ')).toEqual([])
  })
})

describe('timelineGraph helpers', () => {
  it('resolves character image from cast card then character', () => {
    expect(
      timelineGraphCharImage('c1', { id: 'c1', refImagePath: '/char.png' }, [
        { characterId: 'c1', selectedRefImagePath: '/cast.png' }
      ])
    ).toBe('/cast.png')
    expect(
      timelineGraphCharImage('c1', { id: 'c1', refImagePath: '/char.png' }, [])
    ).toBe('/char.png')
    expect(timelineGraphCharImage('c1', undefined, undefined)).toBe(null)
  })

  it('snippets long text', () => {
    expect(timelineGraphSnippet('  hi  ')).toBe('hi')
    expect(timelineGraphSnippet('x'.repeat(80), 10)).toMatch(/…$/)
    expect(timelineGraphSnippet('')).toBe('')
  })

  it('finds prep cell and previous still', () => {
    const cells = [
      { entryId: 'e0', stillPath: '/prev.png', stillStatus: 'ready' as const },
      { entryId: 'e1', stillPath: '/now.png', stillStatus: 'ready' as const }
    ]
    expect(findTimelineGraphPrepCell(cells, 'e1')?.stillPath).toBe('/now.png')
    expect(findTimelineGraphPrepCell(cells, 'nope')).toBe(null)
    expect(previousStillPath(cells, 'e1')).toBe('/prev.png')
    expect(previousStillPath(cells, 'e0')).toBe(null)
    expect(previousStillPath([], 'e1')).toBe(null)
  })
})

describe('buildTimelineGraph', () => {
  it('returns empty without an entry', () => {
    expect(buildTimelineGraph({ entry: null })).toEqual({ nodes: [], edges: [] })
  })

  it('builds refs, prompt, still, video and wires into still', () => {
    const g = buildTimelineGraph({
      entry,
      story: { styleNote: 'noir rain forever and more words', artStyle: 'anime' },
      characters: [
        { id: 'c1', name: 'Aria', description: 'Lead detective', refImagePath: '/a.png' },
        { id: 'c2', name: 'Ben' }
      ],
      scenes: [{ id: 's1', title: 'Roof', refImagePath: '/s.png' }],
      props: [{ id: 'p1', name: 'Watch' }],
      actions: [{ id: 'a1', name: 'Turn' }],
      cell: { entryId: 'e1', stillPath: '/still.png', stillStatus: 'ready' },
      prevStillPath: '/prev.png',
      videoProvider: 'same-as-llm',
      videoModel: 'grok'
    })
    const kinds = g.nodes.map((n) => n.kind)
    expect(kinds).toContain('character')
    expect(kinds).toContain('scene')
    expect(kinds).toContain('prop')
    expect(kinds).toContain('action')
    expect(kinds).toContain('cinematic')
    expect(kinds).toContain('prompt')
    expect(kinds).toContain('still')
    expect(kinds).toContain('video')
    expect(g.nodes.filter((n) => n.kind === 'character')).toHaveLength(2)
    expect(g.nodes.find((n) => n.id === 'video')?.subtitle).toContain('grok')
    const cine = g.nodes.find((n) => n.id === 'cinematic')
    expect(cine?.title).toBe('anime')
    expect(cine?.subtitle).toBe('noir rain forever and more words')
    expect(g.nodes.find((n) => n.id === 'character:c1')?.subtitle).toBe(
      'Lead detective'
    )
    expect(g.nodes.find((n) => n.id === 'still')?.missing).toBe(false)
    expect(g.edges).toContainEqual({
      id: 'character:c1->character:c2',
      from: 'character:c1',
      to: 'character:c2'
    })
    expect(g.edges).toContainEqual({ id: 'prompt->still', from: 'prompt', to: 'still' })
    expect(g.edges).toContainEqual({ id: 'still->video', from: 'still', to: 'video' })
  })

  it('chains later clips after the selected video', () => {
    const g = buildTimelineGraph({
      entry: { id: 'e1', mediaStatus: 'READY', mediaPath: '/1.mp4' },
      entries: [
        { id: 'e1', startTime: 0, dialogue: '第一段', mediaStatus: 'READY', mediaPath: '/1.mp4' },
        { id: 'e2', startTime: 10, dialogue: '第二段', mediaStatus: 'EMPTY' },
        { id: 'e3', startTime: 20, dialogue: '第三段', mediaStatus: 'EMPTY' }
      ],
      cells: [
        { entryId: 'e1', stillPath: '/s1.png', stillStatus: 'ready' },
        { entryId: 'e2', stillPath: '/s2.png', stillStatus: 'ready' }
      ]
    })
    const clips = g.nodes.filter((n) => n.kind === 'clip')
    expect(clips).toHaveLength(2)
    expect(g.nodes.filter((n) => n.kind === 'prompt')).toHaveLength(3)
    expect(g.nodes.filter((n) => n.kind === 'still')).toHaveLength(3)
    expect(g.nodes.filter((n) => n.kind === 'cinematic')).toHaveLength(3)
    expect(g.nodes.find((n) => n.id === 'video')?.seq).toBe(1)
    expect(clips[0].id).toBe('clip:e2')
    expect(g.edges.some((e) => e.from === 'video' && e.to.includes('e2'))).toBe(
      true
    )
    expect(g.edges.some((e) => e.to === 'clip:e2')).toBe(true)
    expect(g.edges.some((e) => e.to === 'clip:e3')).toBe(true)
    const layout = layoutTimelineGraph(g)
    const v = layout.nodes.find((n) => n.id === 'video')
    const c2 = layout.nodes.find((n) => n.id === 'clip:e2')
    expect(Boolean(v && c2 && (c2.x !== v.x || c2.y !== v.y))).toBe(true)
  })

  it('inserts ghost cards when nothing is bound', () => {
    const g = buildTimelineGraph({
      entry: { id: 'e9', mediaStatus: 'EMPTY' }
    })
    expect(g.nodes.some((n) => n.kind === 'ghost-character')).toBe(true)
    expect(g.nodes.some((n) => n.kind === 'ghost-scene')).toBe(true)
    expect(g.nodes.some((n) => n.kind === 'character')).toBe(false)
  })
})

describe('layoutTimelineGraph', () => {
  it('places columns and builds bezier paths', () => {
    const g = buildTimelineGraph({
      entry,
      characters: [{ id: 'c1', name: 'A' }, { id: 'c2', name: 'B' }],
      scenes: [{ id: 's1', title: 'S' }]
    })
    const layout = layoutTimelineGraph(g)
    expect(layout.width).toBeGreaterThan(600)
    expect(layout.height).toBeGreaterThan(100)
    const video = layout.nodes.find((n) => n.kind === 'video')
    const still = layout.nodes.find((n) => n.kind === 'still')
    expect(video && still && video.column > still.column).toBe(true)
    const path = timelineGraphEdgePath(layout, layout.edges[0])
    expect(path).toMatch(/^M /)
    expect(path).toContain(' C ')
    expect(timelineGraphEdgePath(layout, { id: 'x', from: 'no', to: 'no' })).toBe(
      null
    )
  })

  it('stacks down a column then wraps to the next', () => {
    const g = buildTimelineGraph({
      entry,
      characters: [{ id: 'c1', name: 'A' }],
      scenes: [{ id: 's1', title: 'S' }]
    })
    const tall = layoutTimelineGraph(g, { maxColumnHeight: 4000 })
    const a = tall.nodes.find((n) => n.id === 'character:c1')
    const b = tall.nodes.find((n) => n.id.startsWith('scene:'))
    expect(a && b && a.x === b.x && b.y > a.y).toBe(true)

    const wrapped = layoutTimelineGraph(g, { maxColumnHeight: 280 })
    const wa = wrapped.nodes[0]
    const later = wrapped.nodes.find((n) => n.x > wa.x)
    expect(later).toBeTruthy()
  })

  it('bezier is stable', () => {
    expect(timelineGraphBezier({ x: 0, y: 10 }, { x: 100, y: 10 })).toBe(
      'M 0 10 C 50 10, 50 10, 100 10'
    )
    expect(timelineGraphBezier({ x: 10, y: 0 }, { x: 10, y: 100 })).toBe(
      'M 10 0 C 10 50, 10 50, 10 100'
    )
  })

  it('grows cinematic and character cards to fit copy', () => {
    expect(timelineGraphEstimateTextHeight('')).toBe(0)
    expect(timelineGraphEstimateTextHeight('短')).toBeGreaterThan(0)
    const short = timelineGraphNodeSize('cinematic', {
      title: 'anime',
      subtitle: 'noir rain',
      imagePath: null
    })
    const long = timelineGraphNodeSize('cinematic', {
      title: 'anime',
      subtitle: '亞青，濕石反光、香煙薄霧，蛛紗符懸在夜風裡輕顫。'.repeat(6),
      imagePath: null
    })
    expect(long.h).toBeGreaterThan(short.h)
    const withDesc = timelineGraphNodeSize('character', {
      title: '沈執一',
      subtitle: '剛受戒下山的廣府年輕法師，第一次接差捉鬼。',
      imagePath: '/a.png'
    })
    const noDesc = timelineGraphNodeSize('character', {
      title: '沈執一',
      subtitle: '',
      imagePath: '/a.png'
    })
    expect(withDesc.h).toBeGreaterThan(noDesc.h)
  })
})
