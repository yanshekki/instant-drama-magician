/**
 * Spatial package channels — Blender / shot-stage interchange (not a video backend).
 */
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync
} from 'fs'
import { extname, join } from 'path'
import { execFileSync } from 'child_process'
import type { HandlerContext } from './context'
import { AppError } from '../../types/errors'
import {
  defaultSpatialBlocking,
  parseSpatialBlocking
} from '../../domain/spatialRef'
import {
  parseSpatialPackageManifest,
  SPATIAL_PACKAGE_KIND,
  type SpatialPackageManifest,
  type SpatialPackageMesh,
  type SpatialPackageRef
} from '../../domain/spatialPackage'
import { encodeClayPlayblastPng } from '../../domain/spatialPlayblast'
import { buildProxyGltf, proxyMeshSizeForEntity } from '../../domain/spatialMesh'
import { snapVideoSeconds } from '../../domain/videoDuration'
import { hydrateTimelineBindings } from '../../domain/timelineBindings'

type BeatRow = {
  id: string
  startTime?: number
  endTime?: number
  cameraTemplateId?: string | null
  characterId?: string | null
  sceneId?: string | null
  propId?: string | null
  actionId?: string | null
  characterIds?: string | null
  sceneIds?: string | null
  propIds?: string | null
  actionIds?: string | null
}

type NamedRow = {
  id: string
  name?: string | null
  title?: string | null
  description?: string | null
}

function safeId(id: string): string {
  return id.replace(/[^a-zA-Z0-9_-]/g, '') || 'id'
}

function copyNamed(
  src: string,
  destDir: string,
  prefix: string
): string | null {
  if (!src || !existsSync(src)) return null
  mkdirSync(destDir, { recursive: true })
  const ext = extname(src) || '.png'
  const dest = join(destDir, `${prefix}${ext}`)
  copyFileSync(src, dest)
  return dest
}

function readManifest(
  store: { spatialManifestPath: (s: string, e: string) => string },
  storyId: string,
  entryId: string
): SpatialPackageManifest | null {
  const p = store.spatialManifestPath(storyId, entryId)
  if (!existsSync(p)) return null
  try {
    return parseSpatialPackageManifest(JSON.parse(readFileSync(p, 'utf8')))
  } catch {
    return null
  }
}

function writeManifest(
  store: {
    spatialDir: (s: string, e: string) => string
    spatialManifestPath: (s: string, e: string) => string
    ensureStoryDirs: (s: string) => void
  },
  manifest: SpatialPackageManifest
): string {
  store.ensureStoryDirs(manifest.storyId)
  mkdirSync(store.spatialDir(manifest.storyId, manifest.entryId), {
    recursive: true
  })
  const p = store.spatialManifestPath(manifest.storyId, manifest.entryId)
  writeFileSync(p, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
  return p
}

function detectBlender(): {
  available: boolean
  path: string | null
  version: string | null
} {
  const env = process.env.BLENDER_PATH?.trim()
  const candidates = [
    env,
    'blender',
    '/usr/bin/blender',
    '/usr/local/bin/blender',
    '/snap/bin/blender'
  ].filter((x): x is string => Boolean(x))
  for (const bin of candidates) {
    try {
      const out = execFileSync(bin, ['--version'], {
        encoding: 'utf8',
        timeout: 4000,
        stdio: ['ignore', 'pipe', 'pipe']
      })
      const line = String(out).split('\n')[0]?.trim() || null
      return { available: true, path: bin, version: line }
    } catch {
      /* try next */
    }
  }
  return { available: false, path: null, version: null }
}

export function registerSpatialHandlers(ctx: HandlerContext): void {
  const { reg, stories, characters, scenes, props, actions, generation } =
    ctx

  const store = () => generation().getMediaStore()

  const loadBeat = async (storyId: string, entryId: string) => {
    const story = await stories().get(storyId)
    const timeline = (story as { timeline?: Array<Record<string, unknown>> })
      .timeline
    if (!Array.isArray(timeline)) {
      throw new AppError('NOT_FOUND', 'errors.timelineEntryNotFound')
    }
    const entry = timeline
      .map((e) => hydrateTimelineBindings(e as BeatRow))
      .find((e) => e.id === entryId)
    if (!entry) {
      throw new AppError('NOT_FOUND', 'errors.timelineEntryNotFound')
    }
    return { story, entry }
  }

  const named = async (
    getter: (id: string) => Promise<NamedRow>,
    ids: string[]
  ): Promise<Array<{ id: string; name: string }>> => {
    const out: Array<{ id: string; name: string }> = []
    for (const id of ids) {
      try {
        const row = await getter(id)
        out.push({
          id: row.id,
          name: row.name || row.title || String(row.description || id).slice(0, 48)
        })
      } catch {
        out.push({ id, name: id })
      }
    }
    return out
  }

  const compile = async (payload: {
    storyId?: string
    entryId?: string
    destDir?: string
    blocking?: unknown
    usePlayblastAsFirstFrame?: boolean
  }): Promise<SpatialPackageManifest> => {
    const storyId = payload.storyId?.trim()
    const entryId = payload.entryId?.trim()
    if (!storyId || !entryId) {
      throw new AppError('VALIDATION', 'errors.timelineEntryNotFound')
    }
    const { story, entry } = await loadBeat(storyId, entryId)
    const ms = store()
    const existing = readManifest(ms, storyId, entryId)
    const charIds = entry.characterIds ?? []
    const sceneIds = entry.sceneIds ?? []
    const propIds = entry.propIds ?? []
    const actionIds = entry.actionIds ?? []
    const charRows = await named((id) => characters().get(id), charIds)
    const sceneRows = await named((id) => scenes().get(id), sceneIds)
    const propRows = await named((id) => props().get(id), propIds)
    const actionRows = await named((id) => actions().get(id), actionIds)
    const blocking =
      parseSpatialBlocking(payload.blocking) ||
      existing?.blocking ||
      defaultSpatialBlocking({
        aspect: existing?.aspectRatio === '9:16' ? '9:16' : '16:9',
        characters: charRows,
        scenes: sceneRows,
        props: propRows,
        actions: actionRows
      })
    const durationSeconds = snapVideoSeconds(
      Number(entry.endTime) - Number(entry.startTime)
    )
    const destRoot = payload.destDir?.trim()
      ? payload.destDir.trim()
      : ms.spatialDir(storyId, entryId)
    mkdirSync(destRoot, { recursive: true })
    mkdirSync(join(destRoot, 'identity'), { recursive: true })
    mkdirSync(join(destRoot, 'spatial'), { recursive: true })
    mkdirSync(join(destRoot, 'mesh'), { recursive: true })

    const refs: SpatialPackageRef[] = []
    for (const c of charIds) {
      try {
        const ch = await characters().get(c)
        const src = ch.refSheetPath?.trim() || ch.refImagePath?.trim()
        const copied = src
          ? copyNamed(src, join(destRoot, 'identity'), `character-${safeId(c)}`)
          : null
        if (copied) {
          refs.push({
            role: 'identity',
            entityType: 'character',
            entityId: c,
            path: copied,
            name: ch.name
          })
        }
      } catch {
        /* skip */
      }
    }
    for (const sid of sceneIds) {
      try {
        const sc = await scenes().get(sid)
        const src = sc.refImagePath?.trim()
        const copied = src
          ? copyNamed(src, join(destRoot, 'identity'), `scene-${safeId(sid)}`)
          : null
        if (copied) {
          refs.push({
            role: 'identity',
            entityType: 'scene',
            entityId: sid,
            path: copied,
            name: sc.title || String(sc.description || sid).slice(0, 48)
          })
        }
      } catch {
        /* skip */
      }
    }
    for (const pid of propIds) {
      try {
        const pr = await props().get(pid)
        const src = pr.refImagePath?.trim()
        const copied = src
          ? copyNamed(src, join(destRoot, 'identity'), `prop-${safeId(pid)}`)
          : null
        if (copied) {
          refs.push({
            role: 'identity',
            entityType: 'prop',
            entityId: pid,
            path: copied,
            name: pr.name
          })
        }
      } catch {
        /* skip */
      }
    }
    for (const aid of actionIds) {
      try {
        const ac = await actions().get(aid)
        const src = ac.refImagePath?.trim()
        const copied = src
          ? copyNamed(src, join(destRoot, 'identity'), `action-${safeId(aid)}`)
          : null
        if (copied) {
          refs.push({
            role: 'motion',
            entityType: 'action',
            entityId: aid,
            path: copied,
            name: ac.name
          })
        }
      } catch {
        /* skip */
      }
    }

    let playblastPath =
      existing?.playblastPath && existsSync(existing.playblastPath)
        ? existing.playblastPath
        : join(destRoot, 'spatial', 'playblast.png')
    if (!existsSync(playblastPath) || payload.blocking) {
      mkdirSync(join(destRoot, 'spatial'), { recursive: true })
      playblastPath = join(destRoot, 'spatial', 'playblast.png')
      writeFileSync(playblastPath, encodeClayPlayblastPng(blocking))
    }
    refs.push({
      role: 'spatial',
      entityType: 'spatial',
      entityId: entryId,
      path: playblastPath,
      name: 'white-model'
    })

    const manifest: SpatialPackageManifest = {
      version: 1,
      kind: SPATIAL_PACKAGE_KIND,
      storyId,
      entryId,
      storyTitle: (story as { title?: string }).title,
      exportedAt: new Date().toISOString(),
      durationSeconds,
      aspectRatio: blocking.aspect,
      cameraTemplateId:
        (entry as { cameraTemplateId?: string | null }).cameraTemplateId ?? null,
      characterIds: charIds,
      sceneIds: sceneIds,
      propIds: propIds,
      actionIds: actionIds,
      blocking,
      refs,
      playblastPath,
      usePlayblastAsFirstFrame:
        payload.usePlayblastAsFirstFrame === true ||
        existing?.usePlayblastAsFirstFrame === true,
      meshes: existing?.meshes ?? []
    }
    if (!payload.destDir?.trim()) {
      writeManifest(ms, manifest)
    } else {
      writeFileSync(
        join(destRoot, 'manifest.json'),
        `${JSON.stringify(manifest, null, 2)}\n`,
        'utf8'
      )
    }
    return manifest
  }

  reg('spatial:compileBeat', async (payload: Record<string, unknown> = {}) =>
    compile(payload)
  )

  reg(
    'spatial:importPackage',
    async (payload: {
      storyId?: string
      entryId?: string
      packageDir?: string
    }) => {
      const storyId = payload.storyId?.trim()
      const entryId = payload.entryId?.trim()
      const packageDir = payload.packageDir?.trim()
      if (!storyId || !entryId || !packageDir) {
        throw new AppError('VALIDATION', 'errors.timelineEntryNotFound')
      }
      await loadBeat(storyId, entryId)
      const manPath = join(packageDir, 'manifest.json')
      if (!existsSync(manPath)) {
        throw new AppError('NOT_FOUND', 'errors.sourceMediaNotFound', manPath)
      }
      const parsed = parseSpatialPackageManifest(
        JSON.parse(readFileSync(manPath, 'utf8'))
      )
      if (!parsed) {
        throw new AppError('VALIDATION', 'errors.sourceMediaNotFound', manPath)
      }
      const ms = store()
      ms.ensureStoryDirs(storyId)
      const dest = ms.spatialDir(storyId, entryId)
      mkdirSync(dest, { recursive: true })
      const playSrc = parsed.playblastPath
      let playblastPath = parsed.playblastPath
      if (playSrc && existsSync(playSrc)) {
        playblastPath = copyNamed(playSrc, join(dest, 'spatial'), 'playblast')
      } else {
        const localPlay = join(packageDir, 'spatial', 'playblast.png')
        if (existsSync(localPlay)) {
          playblastPath = copyNamed(localPlay, join(dest, 'spatial'), 'playblast')
        }
      }
      const next: SpatialPackageManifest = {
        ...parsed,
        storyId,
        entryId,
        playblastPath: playblastPath || parsed.playblastPath,
        exportedAt: new Date().toISOString()
      }
      writeManifest(ms, next)
      return next
    }
  )

  reg(
    'spatial:attachRef',
    async (payload: {
      storyId?: string
      entryId?: string
      playblastPath?: string
      playblastPngBase64?: string
      blocking?: unknown
      usePlayblastAsFirstFrame?: boolean
    }) => {
      const storyId = payload.storyId?.trim()
      const entryId = payload.entryId?.trim()
      if (!storyId || !entryId) {
        throw new AppError('VALIDATION', 'errors.timelineEntryNotFound')
      }
      const blockingPatch = parseSpatialBlocking(payload.blocking)
      const current = await compile({
        storyId,
        entryId,
        blocking: blockingPatch ?? undefined,
        usePlayblastAsFirstFrame: payload.usePlayblastAsFirstFrame
      })
      const ms = store()
      mkdirSync(ms.spatialDir(storyId, entryId), { recursive: true })
      const dest = ms.spatialPlayblastPath(storyId, entryId)
      mkdirSync(join(ms.spatialDir(storyId, entryId), 'spatial'), {
        recursive: true
      })
      const out = join(ms.spatialDir(storyId, entryId), 'spatial', 'playblast.png')
      const fromPath = payload.playblastPath?.trim()
      if (fromPath) {
        if (!existsSync(fromPath)) {
          throw new AppError('NOT_FOUND', 'errors.sourceMediaNotFound', fromPath)
        }
        copyFileSync(fromPath, out)
      } else if (payload.playblastPngBase64?.trim()) {
        const raw = payload.playblastPngBase64.trim().replace(/^data:image\/\w+;base64,/, '')
        writeFileSync(out, Buffer.from(raw, 'base64'))
      }
      if (!existsSync(out) && !existsSync(dest) && current.playblastPath) {
        /* keep compiled clay */
      } else if (existsSync(out)) {
        current.playblastPath = out
      }
      const spatialIdx = current.refs.findIndex((r) => r.role === 'spatial')
      const spatialRef: SpatialPackageRef = {
        role: 'spatial',
        entityType: 'spatial',
        entityId: entryId,
        path: current.playblastPath || out,
        name: 'white-model'
      }
      if (spatialIdx >= 0) current.refs[spatialIdx] = spatialRef
      else current.refs.push(spatialRef)
      if (payload.usePlayblastAsFirstFrame !== undefined) {
        current.usePlayblastAsFirstFrame = payload.usePlayblastAsFirstFrame === true
      }
      writeManifest(ms, current)
      return current
    }
  )

  reg('spatial:blenderStatus', async () => {
    const detected = detectBlender()
    return {
      ...detected,
      addonHint:
        'Install blender/idm_spatial as a Blender add-on, then invoke spatial:compileBeat / spatial:importPackage via instant-drama CLI.'
    }
  })

  reg(
    'spatial:generateMesh',
    async (payload: {
      storyId?: string
      entryId?: string
      entityType?: string
      entityId?: string
      imagePath?: string
    }) => {
      const storyId = payload.storyId?.trim()
      const entryId = payload.entryId?.trim()
      const entityId = payload.entityId?.trim()
      const entityType = payload.entityType?.trim() || 'prop'
      if (!storyId || !entryId || !entityId) {
        throw new AppError('VALIDATION', 'errors.timelineEntryNotFound')
      }
      const current = await compile({ storyId, entryId })
      const ms = store()
      mkdirSync(ms.spatialMeshDir(storyId, entryId), { recursive: true })
      let imagePath = payload.imagePath?.trim() || ''
      if (!imagePath) {
        const hit = current.refs.find(
          (r) => r.entityId === entityId && r.role !== 'spatial'
        )
        imagePath = hit?.path || current.playblastPath || ''
      }
      if (!imagePath || !existsSync(imagePath)) {
        throw new AppError('NOT_FOUND', 'errors.sourceImageRequired')
      }
      const texName = `texture-${safeId(entityId)}${extname(imagePath) || '.png'}`
      const texDest = join(ms.spatialMeshDir(storyId, entryId), texName)
      copyFileSync(imagePath, texDest)
      const size = proxyMeshSizeForEntity(entityType)
      const gltf = buildProxyGltf({
        name: `${entityType}-${entityId}`,
        textureFileName: texName,
        ...size
      })
      const gltfPath = ms.spatialMeshPath(storyId, entryId, entityId)
      writeFileSync(gltfPath, gltf, 'utf8')
      const mesh: SpatialPackageMesh = {
        entityType,
        entityId,
        path: gltfPath,
        sourceImagePath: imagePath
      }
      const meshes = [...(current.meshes ?? []).filter((m) => m.entityId !== entityId), mesh]
      current.meshes = meshes
      writeManifest(ms, current)
      return { ...current, mesh }
    }
  )
}
