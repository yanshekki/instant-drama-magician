import type { SpatialBlocking, SpatialRefRole } from './spatialRef'
import { parseSpatialBlocking, parseSpatialRefRole } from './spatialRef'

export const SPATIAL_PACKAGE_KIND = 'idm-spatial-package' as const
export const SPATIAL_PACKAGE_VERSION = 1 as const

export interface SpatialPackageRef {
  role: SpatialRefRole
  entityType: string
  entityId: string
  path: string
  name?: string
}

export interface SpatialPackageMesh {
  entityType: string
  entityId: string
  path: string
  sourceImagePath?: string | null
}

export interface SpatialPackageManifest {
  version: typeof SPATIAL_PACKAGE_VERSION
  kind: typeof SPATIAL_PACKAGE_KIND
  storyId: string
  entryId: string
  storyTitle?: string
  exportedAt: string
  durationSeconds: number
  aspectRatio: '16:9' | '9:16'
  cameraTemplateId?: string | null
  characterIds: string[]
  sceneIds: string[]
  propIds: string[]
  actionIds: string[]
  blocking: SpatialBlocking
  refs: SpatialPackageRef[]
  playblastPath?: string | null
  /** When true, video I2V may use the playblast as first_frame (weaker face lock). */
  usePlayblastAsFirstFrame?: boolean
  meshes?: SpatialPackageMesh[]
}

export function parseSpatialPackageManifest(
  raw: unknown
): SpatialPackageManifest | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  if (o.kind !== SPATIAL_PACKAGE_KIND) return null
  const storyId = typeof o.storyId === 'string' ? o.storyId.trim() : ''
  const entryId = typeof o.entryId === 'string' ? o.entryId.trim() : ''
  if (!storyId || !entryId) return null
  const blocking = parseSpatialBlocking(o.blocking)
  if (!blocking) return null
  const ids = (v: unknown): string[] =>
    Array.isArray(v)
      ? v.filter((x): x is string => typeof x === 'string' && Boolean(x.trim()))
      : []
  const refs: SpatialPackageRef[] = []
  if (Array.isArray(o.refs)) {
    for (const row of o.refs) {
      if (!row || typeof row !== 'object') continue
      const r = row as Record<string, unknown>
      const path = typeof r.path === 'string' ? r.path.trim() : ''
      if (!path) continue
      refs.push({
        role: parseSpatialRefRole(r.role, 'identity'),
        entityType: typeof r.entityType === 'string' ? r.entityType : 'other',
        entityId: typeof r.entityId === 'string' ? r.entityId : '',
        path,
        name: typeof r.name === 'string' ? r.name : undefined
      })
    }
  }
  const meshes: SpatialPackageMesh[] = []
  if (Array.isArray(o.meshes)) {
    for (const row of o.meshes) {
      if (!row || typeof row !== 'object') continue
      const m = row as Record<string, unknown>
      const path = typeof m.path === 'string' ? m.path.trim() : ''
      const entityId = typeof m.entityId === 'string' ? m.entityId.trim() : ''
      if (!path || !entityId) continue
      meshes.push({
        entityType: typeof m.entityType === 'string' ? m.entityType : 'prop',
        entityId,
        path,
        sourceImagePath:
          typeof m.sourceImagePath === 'string' ? m.sourceImagePath : null
      })
    }
  }
  const duration = Number(o.durationSeconds)
  return {
    version: 1,
    kind: SPATIAL_PACKAGE_KIND,
    storyId,
    entryId,
    storyTitle: typeof o.storyTitle === 'string' ? o.storyTitle : undefined,
    exportedAt:
      typeof o.exportedAt === 'string' && o.exportedAt
        ? o.exportedAt
        : new Date().toISOString(),
    durationSeconds: Number.isFinite(duration) && duration > 0 ? duration : 6,
    aspectRatio: o.aspectRatio === '9:16' ? '9:16' : '16:9',
    cameraTemplateId:
      typeof o.cameraTemplateId === 'string' ? o.cameraTemplateId : null,
    characterIds: ids(o.characterIds),
    sceneIds: ids(o.sceneIds),
    propIds: ids(o.propIds),
    actionIds: ids(o.actionIds),
    blocking,
    refs,
    playblastPath:
      typeof o.playblastPath === 'string' && o.playblastPath.trim()
        ? o.playblastPath.trim()
        : null,
    usePlayblastAsFirstFrame: o.usePlayblastAsFirstFrame === true,
    meshes
  }
}

export function spatialPlayblastRef(
  manifest: SpatialPackageManifest
): SpatialPackageRef | null {
  const fromRefs = manifest.refs.find((r) => r.role === 'spatial' && r.path)
  if (fromRefs) return fromRefs
  if (manifest.playblastPath?.trim()) {
    return {
      role: 'spatial',
      entityType: 'spatial',
      entityId: manifest.entryId,
      path: manifest.playblastPath,
      name: 'white-model'
    }
  }
  return null
}
