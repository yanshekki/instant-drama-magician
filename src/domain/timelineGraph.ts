/**
 * Timeline v2 pipeline graph — derived nodes/edges + layout.
 * Topology is fixed (refs + prompt → still → video). Nothing is persisted.
 */

export type TimelineGraphNodeKind =
  | 'character'
  | 'scene'
  | 'prop'
  | 'action'
  | 'cinematic'
  | 'prompt'
  | 'still'
  | 'video'
  | 'ghost-character'
  | 'ghost-scene'

export type TimelineGraphColumn = 0 | 1 | 2

export type TimelineGraphPrepCell = {
  entryId: string
  stillPath?: string | null
  stillStatus?: 'missing' | 'ready' | 'stale' | string
  continuityKind?: 'first' | 'locked' | 'text-only' | string
}

export type TimelineGraphCastCard = {
  characterId: string
  selectedRefImagePath?: string | null
}

export type TimelineGraphNode = {
  id: string
  kind: TimelineGraphNodeKind
  column: TimelineGraphColumn
  title: string
  subtitle: string
  imagePath: string | null
  status: string | null
  missing: boolean
  entityId: string | null
  entryId: string
}

export type TimelineGraphEdge = {
  id: string
  from: string
  to: string
}

export type TimelineGraphPoint = { x: number; y: number }

export type TimelineGraphLaidOutNode = TimelineGraphNode & {
  x: number
  y: number
  w: number
  h: number
  inPort: TimelineGraphPoint
  outPort: TimelineGraphPoint
}

export type TimelineGraphModel = {
  nodes: TimelineGraphNode[]
  edges: TimelineGraphEdge[]
}

export type TimelineGraphLayout = {
  nodes: TimelineGraphLaidOutNode[]
  edges: TimelineGraphEdge[]
  width: number
  height: number
}

export type TimelineGraphNamed = {
  id: string
  name?: string | null
  title?: string | null
  description?: string
  refImagePath?: string | null
}

export type BuildTimelineGraphInput = {
  entry: {
    id: string
    characterId?: string | null
    sceneId?: string | null
    propId?: string | null
    actionId?: string | null
    characterIds?: string[]
    sceneIds?: string[]
    propIds?: string[]
    actionIds?: string[]
    mediaStatus?: string | null
    mediaPath?: string | null
  } | null
  story?: {
    styleNote?: string | null
    artStyle?: string | null
  } | null
  characters?: TimelineGraphNamed[]
  scenes?: TimelineGraphNamed[]
  props?: TimelineGraphNamed[]
  actions?: TimelineGraphNamed[]
  cell?: TimelineGraphPrepCell | null
  prevStillPath?: string | null
  castCards?: TimelineGraphCastCard[]
  imageProvider?: string | null
  videoProvider?: string | null
  imageModel?: string | null
  videoModel?: string | null
}

export const TIMELINE_GRAPH_PAD = 20
export const TIMELINE_GRAPH_GAP_Y = 16
export const TIMELINE_GRAPH_COL_X = [20, 316, 668] as const

const SIZE: Record<TimelineGraphNodeKind, { w: number; h: number }> = {
  character: { w: 280, h: 248 },
  scene: { w: 280, h: 248 },
  prop: { w: 280, h: 200 },
  action: { w: 280, h: 200 },
  cinematic: { w: 280, h: 200 },
  'ghost-character': { w: 280, h: 136 },
  'ghost-scene': { w: 280, h: 136 },
  prompt: { w: 328, h: 400 },
  still: { w: 328, h: 280 },
  video: { w: 400, h: 340 }
}

const ENTITY_IMAGE_H = 144
const ENTITY_EMPTY_H = 52

/** Wrapped-text block height for a ~280px card (CJK ~16 glyphs / line). */
export function timelineGraphEstimateTextHeight(
  text: string | null | undefined,
  opts?: { charsPerLine?: number; linePx?: number; min?: number; max?: number }
): number {
  const s = (text || '').replace(/\s+/g, ' ').trim()
  const min = opts?.min ?? 0
  if (!s) return min
  const cpl = opts?.charsPerLine ?? 16
  const linePx = opts?.linePx ?? 18
  const lines = Math.max(1, Math.ceil(s.length / cpl))
  const h = lines * linePx + 10
  return Math.min(opts?.max ?? 240, Math.max(min, h))
}

export function timelineGraphBindIds(
  list: string[] | null | undefined,
  primary: string | null | undefined
): string[] {
  const fromList = Array.isArray(list)
    ? list.filter((id) => typeof id === 'string' && id.trim())
    : []
  if (fromList.length) return [...new Set(fromList)]
  const one = typeof primary === 'string' ? primary.trim() : ''
  return one ? [one] : []
}

export function timelineGraphCharImage(
  characterId: string,
  character: TimelineGraphNamed | undefined,
  castCards: TimelineGraphCastCard[] | undefined
): string | null {
  const card = castCards?.find((c) => c.characterId === characterId)
  const fromCard = card?.selectedRefImagePath?.trim()
  if (fromCard) return fromCard
  const fromChar = character?.refImagePath?.trim()
  return fromChar || null
}

export function timelineGraphSnippet(
  text: string | null | undefined,
  max = 72
): string {
  const s = (text || '').replace(/\s+/g, ' ').trim()
  if (!s) return ''
  if (s.length <= max) return s
  return `${s.slice(0, Math.max(1, max - 1)).trimEnd()}…`
}

function lookup(
  list: TimelineGraphNamed[] | undefined,
  id: string
): TimelineGraphNamed | undefined {
  return list?.find((row) => row.id === id)
}

function displayName(row: TimelineGraphNamed | undefined, fallback: string): string {
  const name = row?.name?.trim() || row?.title?.trim()
  if (name) return name
  const desc = timelineGraphSnippet(row?.description, 36)
  return desc || fallback
}

function channelSubtitle(
  provider: string | null | undefined,
  model: string | null | undefined
): string {
  const p = (provider || '').trim()
  const m = (model || '').trim()
  if (p && m) return `${p} · ${m}`
  return p || m || ''
}

export function buildTimelineGraph(
  input: BuildTimelineGraphInput
): TimelineGraphModel {
  const entry = input.entry
  if (!entry?.id) return { nodes: [], edges: [] }

  const nodes: TimelineGraphNode[] = []
  const edges: TimelineGraphEdge[] = []
  const charIds = timelineGraphBindIds(entry.characterIds, entry.characterId)
  const sceneIds = timelineGraphBindIds(entry.sceneIds, entry.sceneId)
  const propIds = timelineGraphBindIds(entry.propIds, entry.propId)
  const actionIds = timelineGraphBindIds(entry.actionIds, entry.actionId)

  if (charIds.length === 0) {
    nodes.push({
      id: 'ghost-character',
      kind: 'ghost-character',
      column: 0,
      title: '',
      subtitle: '',
      imagePath: null,
      status: null,
      missing: true,
      entityId: null,
      entryId: entry.id
    })
  } else {
    for (const id of charIds) {
      const row = lookup(input.characters, id)
      const imagePath = timelineGraphCharImage(id, row, input.castCards)
      nodes.push({
        id: `character:${id}`,
        kind: 'character',
        column: 0,
        title: displayName(row, id),
        subtitle: (row?.description || '').replace(/\s+/g, ' ').trim(),
        imagePath,
        status: imagePath ? 'ready' : 'missing',
        missing: !imagePath,
        entityId: id,
        entryId: entry.id
      })
    }
  }

  if (sceneIds.length === 0) {
    nodes.push({
      id: 'ghost-scene',
      kind: 'ghost-scene',
      column: 0,
      title: '',
      subtitle: '',
      imagePath: null,
      status: null,
      missing: true,
      entityId: null,
      entryId: entry.id
    })
  } else {
    for (const id of sceneIds) {
      const row = lookup(input.scenes, id)
      const imagePath = row?.refImagePath?.trim() || null
      nodes.push({
        id: `scene:${id}`,
        kind: 'scene',
        column: 0,
        title: displayName(row, id),
        subtitle: (row?.description || '').replace(/\s+/g, ' ').trim(),
        imagePath,
        status: imagePath ? 'ready' : 'missing',
        missing: !imagePath,
        entityId: id,
        entryId: entry.id
      })
    }
  }

  for (const id of propIds) {
    const row = lookup(input.props, id)
    nodes.push({
      id: `prop:${id}`,
      kind: 'prop',
      column: 0,
      title: displayName(row, id),
      subtitle: (row?.description || '').replace(/\s+/g, ' ').trim(),
      imagePath: row?.refImagePath?.trim() || null,
      status: null,
      missing: false,
      entityId: id,
      entryId: entry.id
    })
  }

  for (const id of actionIds) {
    const row = lookup(input.actions, id)
    nodes.push({
      id: `action:${id}`,
      kind: 'action',
      column: 0,
      title: displayName(row, id),
      subtitle: (row?.description || '').replace(/\s+/g, ' ').trim(),
      imagePath: row?.refImagePath?.trim() || null,
      status: null,
      missing: false,
      entityId: id,
      entryId: entry.id
    })
  }

  const styleNote = (input.story?.styleNote || '').replace(/\s+/g, ' ').trim()
  const artStyle = (input.story?.artStyle || '').trim()
  const prevStill = input.prevStillPath?.trim() || null
  nodes.push({
    id: 'cinematic',
    kind: 'cinematic',
    column: 0,
    title: artStyle,
    subtitle: styleNote,
    imagePath: prevStill,
    status: prevStill ? 'locked' : styleNote || artStyle ? 'ready' : 'missing',
    missing: !prevStill && !styleNote && !artStyle,
    entityId: null,
    entryId: entry.id
  })

  nodes.push({
    id: 'prompt',
    kind: 'prompt',
    column: 1,
    title: '',
    subtitle: '',
    imagePath: null,
    status: null,
    missing: false,
    entityId: null,
    entryId: entry.id
  })

  const stillPath = input.cell?.stillPath?.trim() || null
  const stillStatus = (input.cell?.stillStatus || 'missing').toString()
  nodes.push({
    id: 'still',
    kind: 'still',
    column: 1,
    title: '',
    subtitle: input.cell?.continuityKind || '',
    imagePath: stillPath,
    status: stillStatus,
    missing: stillStatus === 'missing' || !stillPath,
    entityId: null,
    entryId: entry.id
  })

  nodes.push({
    id: 'video',
    kind: 'video',
    column: 2,
    title: '',
    subtitle: channelSubtitle(input.videoProvider, input.videoModel),
    imagePath: null,
    status: entry.mediaStatus || 'EMPTY',
    missing: entry.mediaStatus !== 'READY' || !entry.mediaPath,
    entityId: null,
    entryId: entry.id
  })

  const stillId = 'still'
  const videoId = 'video'
  for (const n of nodes) {
    if (n.id === stillId || n.id === videoId) continue
    edges.push({
      id: `${n.id}->${stillId}`,
      from: n.id,
      to: stillId
    })
  }
  edges.push({ id: `${stillId}->${videoId}`, from: stillId, to: videoId })

  return { nodes, edges }
}

export function timelineGraphNodeSize(
  kind: TimelineGraphNodeKind,
  node?: Pick<TimelineGraphNode, 'title' | 'subtitle' | 'imagePath'>
): {
  w: number
  h: number
} {
  const base = SIZE[kind]
  if (!node) return base
  if (kind === 'cinematic') {
    const titleH = node.title.trim() ? 20 : 0
    const imgH = node.imagePath ? 72 : 0
    const textH = timelineGraphEstimateTextHeight(node.subtitle, {
      min: 64,
      max: 280
    })
    return { w: base.w, h: 44 + titleH + imgH + textH + 12 }
  }
  if (
    kind === 'character' ||
    kind === 'scene' ||
    kind === 'prop' ||
    kind === 'action'
  ) {
    const imgH = node.imagePath ? ENTITY_IMAGE_H : ENTITY_EMPTY_H
    const textH = timelineGraphEstimateTextHeight(node.subtitle, {
      linePx: 17,
      min: 0,
      max: 88
    })
    return { w: base.w, h: 40 + imgH + 44 + textH }
  }
  return base
}

export function layoutTimelineGraph(model: TimelineGraphModel): TimelineGraphLayout {
  const byCol: TimelineGraphNode[][] = [[], [], []]
  for (const n of model.nodes) {
    byCol[n.column].push(n)
  }

  const laid: TimelineGraphLaidOutNode[] = []
  const colHeights = [0, 0, 0]

  for (let col = 0; col < 3; col++) {
    let y = TIMELINE_GRAPH_PAD
    const x = TIMELINE_GRAPH_COL_X[col]
    for (const n of byCol[col]) {
      const { w, h } = timelineGraphNodeSize(n.kind, n)
      laid.push({
        ...n,
        x,
        y,
        w,
        h,
        inPort: { x, y: y + h / 2 },
        outPort: { x: x + w, y: y + h / 2 }
      })
      y += h + TIMELINE_GRAPH_GAP_Y
    }
    colHeights[col] = y
  }

  const video = laid.find((n) => n.kind === 'video')
  const contentH = Math.max(...colHeights, TIMELINE_GRAPH_PAD + 120)
  if (video) {
    const targetY = Math.max(
      TIMELINE_GRAPH_PAD,
      Math.round((contentH - video.h) / 2)
    )
    const dy = targetY - video.y
    if (dy !== 0) {
      video.y += dy
      video.inPort = { x: video.x, y: video.y + video.h / 2 }
      video.outPort = { x: video.x + video.w, y: video.y + video.h / 2 }
    }
  }

  const maxRight = laid.reduce((m, n) => Math.max(m, n.x + n.w), 0)
  const maxBottom = laid.reduce((m, n) => Math.max(m, n.y + n.h), 0)

  return {
    nodes: laid,
    edges: model.edges,
    width: maxRight + TIMELINE_GRAPH_PAD,
    height: maxBottom + TIMELINE_GRAPH_PAD
  }
}

export function timelineGraphBezier(
  from: TimelineGraphPoint,
  to: TimelineGraphPoint
): string {
  const dx = Math.max(48, Math.abs(to.x - from.x) / 2)
  const c1x = from.x + dx
  const c2x = to.x - dx
  return `M ${from.x} ${from.y} C ${c1x} ${from.y}, ${c2x} ${to.y}, ${to.x} ${to.y}`
}

export function timelineGraphEdgePath(
  layout: TimelineGraphLayout,
  edge: TimelineGraphEdge
): string | null {
  const a = layout.nodes.find((n) => n.id === edge.from)
  const b = layout.nodes.find((n) => n.id === edge.to)
  if (!a || !b) return null
  return timelineGraphBezier(a.outPort, b.inPort)
}

export function findTimelineGraphPrepCell(
  cells: TimelineGraphPrepCell[] | null | undefined,
  entryId: string | null | undefined
): TimelineGraphPrepCell | null {
  if (!entryId || !cells?.length) return null
  return cells.find((c) => c.entryId === entryId) ?? null
}

export function previousStillPath(
  cells: Array<
    TimelineGraphPrepCell & { startTime?: number; order?: number }
  > | null
    | undefined,
  entryId: string | null | undefined
): string | null {
  if (!entryId || !cells?.length) return null
  const idx = cells.findIndex((c) => c.entryId === entryId)
  if (idx <= 0) return null
  const prev = cells[idx - 1]
  const path = prev?.stillPath?.trim()
  return path || null
}
