/**
 * Reference jobs for still/video generation.
 * Spatial (white-model) refs lock blocking and camera; they must not steal identity.
 */
export const SPATIAL_REF_ROLES = [
  'identity',
  'spatial',
  'motion',
  'style'
] as const

export type SpatialRefRole = (typeof SPATIAL_REF_ROLES)[number]

export function isSpatialRefRole(value: string | null | undefined): value is SpatialRefRole {
  return (
    typeof value === 'string' &&
    (SPATIAL_REF_ROLES as readonly string[]).includes(value)
  )
}

export function parseSpatialRefRole(
  value: unknown,
  fallback: SpatialRefRole = 'identity'
): SpatialRefRole {
  if (typeof value === 'string' && isSpatialRefRole(value)) return value
  return fallback
}

/** English model-facing job lines (PromptCatalog wraps locale-specific lead copy). */
export const SPATIAL_ROLE_MODEL_LINES: Record<SpatialRefRole, string> = {
  identity:
    'IDENTITY: face, hair, body proportions, wardrobe colors, accessories. Do not restyle or age-shift.',
  spatial:
    'SPATIAL CONTRACT (white model / clay blockout): subject positions, relative scale, floor contact, camera height, lens direction, and travel path only. Do not copy gray clay, untextured surfaces, or placeholder colors as the final look.',
  motion:
    'MOTION: timing, gesture, body direction, and implied camera cadence. Do not replace identity or wardrobe.',
  style:
    'STYLE: palette, lighting language, and grade. Do not move subjects or change camera path.'
}

export type SpatialMarkerKind =
  | 'character'
  | 'costume'
  | 'scene'
  | 'prop'
  | 'action'
  | 'camera'

export interface SpatialMarker {
  id: string
  entityId: string
  kind: SpatialMarkerKind
  name: string
  /** Floor X in 0..1 (left → right). */
  x: number
  /** Floor Z in 0..1 (near → far). */
  z: number
  y?: number
  yaw?: number
}

export interface SpatialCamera {
  x: number
  y: number
  z: number
  fov: number
  lookAtX: number
  lookAtY: number
  lookAtZ: number
}

export interface SpatialBlocking {
  version: 1
  aspect: '16:9' | '9:16'
  markers: SpatialMarker[]
  camera: SpatialCamera
}

export const DEFAULT_SPATIAL_CAMERA: SpatialCamera = {
  x: 0.5,
  y: 0.18,
  z: 0.08,
  fov: 35,
  lookAtX: 0.5,
  lookAtY: 0.12,
  lookAtZ: 0.55
}

export function clampUnit(n: number, fallback = 0.5): number {
  if (!Number.isFinite(n)) return fallback
  return Math.min(1, Math.max(0, n))
}

export function defaultSpatialBlocking(input: {
  aspect?: '16:9' | '9:16'
  characters?: Array<{ id: string; name: string }>
  props?: Array<{ id: string; name: string }>
  scenes?: Array<{ id: string; name: string }>
  actions?: Array<{ id: string; name: string }>
}): SpatialBlocking {
  const aspect = input.aspect === '9:16' ? '9:16' : '16:9'
  const markers: SpatialMarker[] = []
  const chars = input.characters ?? []
  const spread = Math.max(1, chars.length)
  chars.forEach((c, i) => {
    const x = spread === 1 ? 0.5 : 0.22 + (i / (spread - 1)) * 0.56
    markers.push({
      id: `character:${c.id}`,
      entityId: c.id,
      kind: 'character',
      name: c.name,
      x,
      z: 0.55,
      y: 0,
      yaw: 0
    })
  })
  ;(input.props ?? []).forEach((p, i) => {
    markers.push({
      id: `prop:${p.id}`,
      entityId: p.id,
      kind: 'prop',
      name: p.name,
      x: 0.18 + (i % 3) * 0.12,
      z: 0.42,
      y: 0,
      yaw: 0
    })
  })
  const scene = (input.scenes ?? [])[0]
  if (scene) {
    markers.push({
      id: `scene:${scene.id}`,
      entityId: scene.id,
      kind: 'scene',
      name: scene.name,
      x: 0.5,
      z: 0.82,
      y: 0,
      yaw: 0
    })
  }
  ;(input.actions ?? []).forEach((a, i) => {
    markers.push({
      id: `action:${a.id}`,
      entityId: a.id,
      kind: 'action',
      name: a.name,
      x: 0.72 + (i % 2) * 0.08,
      z: 0.38,
      y: 0,
      yaw: 0
    })
  })
  return {
    version: 1,
    aspect,
    markers,
    camera: { ...DEFAULT_SPATIAL_CAMERA }
  }
}

export function parseSpatialBlocking(raw: unknown): SpatialBlocking | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const aspect = o.aspect === '9:16' ? '9:16' : '16:9'
  const cameraRaw =
    o.camera && typeof o.camera === 'object'
      ? (o.camera as Record<string, unknown>)
      : {}
  const camera: SpatialCamera = {
    x: clampUnit(Number(cameraRaw.x), DEFAULT_SPATIAL_CAMERA.x),
    y: clampUnit(Number(cameraRaw.y), DEFAULT_SPATIAL_CAMERA.y),
    z: clampUnit(Number(cameraRaw.z), DEFAULT_SPATIAL_CAMERA.z),
    fov: Number.isFinite(Number(cameraRaw.fov))
      ? Math.min(90, Math.max(12, Number(cameraRaw.fov)))
      : DEFAULT_SPATIAL_CAMERA.fov,
    lookAtX: clampUnit(Number(cameraRaw.lookAtX), DEFAULT_SPATIAL_CAMERA.lookAtX),
    lookAtY: clampUnit(Number(cameraRaw.lookAtY), DEFAULT_SPATIAL_CAMERA.lookAtY),
    lookAtZ: clampUnit(Number(cameraRaw.lookAtZ), DEFAULT_SPATIAL_CAMERA.lookAtZ)
  }
  const markers: SpatialMarker[] = []
  if (Array.isArray(o.markers)) {
    for (const row of o.markers) {
      if (!row || typeof row !== 'object') continue
      const m = row as Record<string, unknown>
      const kind = String(m.kind || '')
      if (
        kind !== 'character' &&
        kind !== 'costume' &&
        kind !== 'scene' &&
        kind !== 'prop' &&
        kind !== 'action' &&
        kind !== 'camera'
      ) {
        continue
      }
      const entityId = typeof m.entityId === 'string' ? m.entityId.trim() : ''
      if (!entityId) continue
      markers.push({
        id:
          typeof m.id === 'string' && m.id.trim()
            ? m.id.trim()
            : `${kind}:${entityId}`,
        entityId,
        kind,
        name: typeof m.name === 'string' && m.name.trim() ? m.name.trim() : entityId,
        x: clampUnit(Number(m.x), 0.5),
        z: clampUnit(Number(m.z), 0.5),
        y: Number.isFinite(Number(m.y)) ? Number(m.y) : 0,
        yaw: Number.isFinite(Number(m.yaw)) ? Number(m.yaw) : 0
      })
    }
  }
  return { version: 1, aspect, markers, camera }
}
