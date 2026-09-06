import { describe, expect, it, afterEach } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { makeHandlerContext, invokeRegistered } from '../../test/handlerTestUtils'
import { registerSpatialHandlers } from './spatial'
import { MediaStore } from '../../infrastructure/media/MediaStore'
import { SPATIAL_PACKAGE_KIND } from '../../domain/spatialPackage'
import { AppError } from '../../types/errors'

describe('registerSpatialHandlers', () => {
  let dir: string | undefined
  afterEach(() => {
    if (dir) {
      rmSync(dir, { recursive: true, force: true })
      dir = undefined
    }
  })

  function setup() {
    dir = mkdtempSync(join(tmpdir(), 'idm-spatial-'))
    const store = new MediaStore(dir)
    const ctx = makeHandlerContext({
      stories: () =>
        ({
          get: async (id: string) => ({
            id,
            title: 'Demo',
            timeline: [
              {
                id: 'e1',
                storyId: id,
                startTime: 0,
                endTime: 6,
                characterId: 'c1',
                characterIds: '["c1"]',
                sceneId: 'sc1',
                sceneIds: '["sc1"]',
                propId: 'p1',
                propIds: '["p1"]',
                actionId: 'a1',
                actionIds: '["a1"]',
                dialogue: 'hi',
                order: 0
              }
            ]
          })
        }) as never,
      characters: () =>
        ({
          get: async (id: string) => ({
            id,
            name: 'Nina',
            refImagePath: join(dir!, 'nina.png'),
            refSheetPath: null
          })
        }) as never,
      scenes: () =>
        ({
          get: async (id: string) => ({
            id,
            title: 'Court',
            description: 'court',
            refImagePath: join(dir!, 'court.png')
          })
        }) as never,
      props: () =>
        ({
          get: async (id: string) => ({
            id,
            name: 'Bag',
            refImagePath: join(dir!, 'bag.png')
          })
        }) as never,
      actions: () =>
        ({
          get: async (id: string) => ({
            id,
            name: 'Turn',
            refImagePath: join(dir!, 'turn.png')
          })
        }) as never,
      generation: () =>
        ({
          getMediaStore: () => store
        }) as never
    })
    writeFileSync(join(dir, 'nina.png'), 'png')
    writeFileSync(join(dir, 'court.png'), 'png')
    writeFileSync(join(dir, 'bag.png'), 'png')
    writeFileSync(join(dir, 'turn.png'), 'png')
    registerSpatialHandlers(ctx)
    const h = (ctx as { handlers: Map<string, unknown> }).handlers
    return { h, store }
  }

  it('compiles a beat package with clay playblast', async () => {
    const { h } = setup()
    const man = (await invokeRegistered(h as never, 'spatial:compileBeat', {
      storyId: 's1',
      entryId: 'e1'
    })) as { kind: string; playblastPath: string; refs: unknown[] }
    expect(man.kind).toBe(SPATIAL_PACKAGE_KIND)
    expect(existsSync(man.playblastPath)).toBe(true)
    expect(man.refs.length).toBeGreaterThan(1)
  })

  it('attaches a playblast still and reports blender status', async () => {
    const { h } = setup()
    const extra = join(dir!, 'white.png')
    writeFileSync(extra, 'png-bytes')
    const attached = (await invokeRegistered(h as never, 'spatial:attachRef', {
      storyId: 's1',
      entryId: 'e1',
      playblastPath: extra,
      usePlayblastAsFirstFrame: true
    })) as { playblastPath: string; usePlayblastAsFirstFrame: boolean }
    expect(existsSync(attached.playblastPath)).toBe(true)
    expect(attached.usePlayblastAsFirstFrame).toBe(true)
    const st = (await invokeRegistered(h as never, 'spatial:blenderStatus')) as {
      available: boolean
    }
    expect(typeof st.available).toBe('boolean')
  })

  it('imports a package and generates a proxy mesh', async () => {
    const { h } = setup()
    await invokeRegistered(h as never, 'spatial:compileBeat', {
      storyId: 's1',
      entryId: 'e1'
    })
    const pkg = join(dir!, 'pkg')
    mkdirSync(join(pkg, 'spatial'), { recursive: true })
    writeFileSync(join(pkg, 'spatial', 'playblast.png'), 'png')
    writeFileSync(
      join(pkg, 'manifest.json'),
      JSON.stringify({
        kind: SPATIAL_PACKAGE_KIND,
        storyId: 's1',
        entryId: 'e1',
        blocking: {
          version: 1,
          aspect: '16:9',
          markers: [],
          camera: { x: 0.5, y: 0.2, z: 0.1, fov: 35, lookAtX: 0.5, lookAtY: 0.1, lookAtZ: 0.5 }
        }
      })
    )
    const imported = (await invokeRegistered(h as never, 'spatial:importPackage', {
      storyId: 's1',
      entryId: 'e1',
      packageDir: pkg
    })) as { kind: string }
    expect(imported.kind).toBe(SPATIAL_PACKAGE_KIND)
    const mesh = (await invokeRegistered(h as never, 'spatial:generateMesh', {
      storyId: 's1',
      entryId: 'e1',
      entityType: 'prop',
      entityId: 'p1',
      imagePath: join(dir!, 'bag.png')
    })) as { mesh: { path: string } }
    expect(existsSync(mesh.mesh.path)).toBe(true)
  })

  it('validates payloads and destDir / base64 attach / mesh fallback', async () => {
    const { h } = setup()
    await expect(
      invokeRegistered(h as never, 'spatial:compileBeat', {})
    ).rejects.toBeInstanceOf(AppError)
    await expect(
      invokeRegistered(h as never, 'spatial:compileBeat', {
        storyId: 's1',
        entryId: 'missing'
      })
    ).rejects.toBeInstanceOf(AppError)
    const dest = join(dir!, 'export-pkg')
    const exported = (await invokeRegistered(h as never, 'spatial:compileBeat', {
      storyId: 's1',
      entryId: 'e1',
      destDir: dest
    })) as { playblastPath: string }
    expect(existsSync(join(dest, 'manifest.json'))).toBe(true)
    expect(existsSync(exported.playblastPath)).toBe(true)

    const attached = (await invokeRegistered(h as never, 'spatial:attachRef', {
      storyId: 's1',
      entryId: 'e1',
      playblastPngBase64:
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
    })) as { playblastPath: string }
    expect(existsSync(attached.playblastPath)).toBe(true)

    await expect(
      invokeRegistered(h as never, 'spatial:attachRef', {
        storyId: 's1',
        entryId: 'e1',
        playblastPath: join(dir!, 'no-such.png')
      })
    ).rejects.toBeInstanceOf(AppError)

    await expect(
      invokeRegistered(h as never, 'spatial:importPackage', {
        storyId: 's1',
        entryId: 'e1'
      })
    ).rejects.toBeInstanceOf(AppError)
    await expect(
      invokeRegistered(h as never, 'spatial:importPackage', {
        storyId: 's1',
        entryId: 'e1',
        packageDir: join(dir!, 'missing-pkg')
      })
    ).rejects.toBeInstanceOf(AppError)

    const fromRef = (await invokeRegistered(h as never, 'spatial:generateMesh', {
      storyId: 's1',
      entryId: 'e1',
      entityType: 'prop',
      entityId: 'p1'
    })) as { mesh: { path: string } }
    expect(existsSync(fromRef.mesh.path)).toBe(true)

    const fromPlayblast = (await invokeRegistered(h as never, 'spatial:generateMesh', {
      storyId: 's1',
      entryId: 'e1',
      entityType: 'scene',
      entityId: 'unknown-mesh'
    })) as { mesh: { path: string } }
    expect(existsSync(fromPlayblast.mesh.path)).toBe(true)

    await expect(
      invokeRegistered(h as never, 'spatial:generateMesh', {
        storyId: 's1',
        entryId: 'e1'
      })
    ).rejects.toBeInstanceOf(AppError)
  })

  it('covers missing timeline, skipped refs, corrupt sidecar, and import edges', async () => {
    dir = mkdtempSync(join(tmpdir(), 'idm-spatial-'))
    const store = new MediaStore(dir)
    const noTimeline = makeHandlerContext({
      stories: () =>
        ({
          get: async (id: string) => ({ id, title: 'Empty' })
        }) as never,
      generation: () => ({ getMediaStore: () => store }) as never
    })
    registerSpatialHandlers(noTimeline)
    const hMissing = (noTimeline as { handlers: Map<string, unknown> }).handlers
    await expect(
      invokeRegistered(hMissing as never, 'spatial:compileBeat', {
        storyId: 's1',
        entryId: 'e1'
      })
    ).rejects.toBeInstanceOf(AppError)

    const skipCtx = makeHandlerContext({
      stories: () =>
        ({
          get: async (id: string) => ({
            id,
            title: 'Demo',
            timeline: [
              {
                id: 'e1',
                startTime: 0,
                endTime: 4,
                characterIds: '["c1"]',
                sceneIds: '["sc1"]',
                propIds: '["p1"]',
                actionIds: '["a1"]'
              }
            ]
          })
        }) as never,
      characters: () =>
        ({
          get: async () => {
            throw new Error('missing character')
          }
        }) as never,
      scenes: () =>
        ({
          get: async (id: string) => ({
            id,
            description: 'court-only'
          })
        }) as never,
      props: () =>
        ({
          get: async (id: string) => ({ id, name: 'Bag' })
        }) as never,
      actions: () =>
        ({
          get: async () => {
            throw new Error('missing action')
          }
        }) as never,
      generation: () => ({ getMediaStore: () => store }) as never
    })
    registerSpatialHandlers(skipCtx)
    const hSkip = (skipCtx as { handlers: Map<string, unknown> }).handlers
    const skipped = (await invokeRegistered(hSkip as never, 'spatial:compileBeat', {
      storyId: 's1',
      entryId: 'e1'
    })) as { playblastPath: string; refs: Array<{ role: string }> }
    expect(existsSync(skipped.playblastPath)).toBe(true)
    expect(skipped.refs.some((r) => r.role === 'spatial')).toBe(true)

    writeFileSync(store.spatialManifestPath('s1', 'e1'), '{not-json')
    const recovered = (await invokeRegistered(hSkip as never, 'spatial:compileBeat', {
      storyId: 's1',
      entryId: 'e1'
    })) as { kind: string }
    expect(recovered.kind).toBe(SPATIAL_PACKAGE_KIND)

    const badPkg = join(dir, 'bad-pkg')
    mkdirSync(badPkg, { recursive: true })
    writeFileSync(join(badPkg, 'manifest.json'), '{"kind":"nope"}')
    await expect(
      invokeRegistered(hSkip as never, 'spatial:importPackage', {
        storyId: 's1',
        entryId: 'e1',
        packageDir: badPkg
      })
    ).rejects.toBeInstanceOf(AppError)

    const absPlay = join(dir, 'from-blender.png')
    writeFileSync(absPlay, 'png')
    const absPkg = join(dir, 'abs-pkg')
    mkdirSync(absPkg, { recursive: true })
    writeFileSync(
      join(absPkg, 'manifest.json'),
      JSON.stringify({
        kind: SPATIAL_PACKAGE_KIND,
        storyId: 's1',
        entryId: 'e1',
        playblastPath: absPlay,
        blocking: {
          version: 1,
          aspect: '9:16',
          markers: [],
          camera: {
            x: 0.5,
            y: 0.2,
            z: 0.1,
            fov: 35,
            lookAtX: 0.5,
            lookAtY: 0.1,
            lookAtZ: 0.5
          }
        }
      })
    )
    const importedAbs = (await invokeRegistered(
      hSkip as never,
      'spatial:importPackage',
      { storyId: 's1', entryId: 'e1', packageDir: absPkg }
    )) as { playblastPath: string }
    expect(existsSync(importedAbs.playblastPath)).toBe(true)

    await expect(
      invokeRegistered(hSkip as never, 'spatial:attachRef', {})
    ).rejects.toBeInstanceOf(AppError)
    await expect(
      invokeRegistered(hSkip as never, 'spatial:generateMesh', {
        storyId: 's1',
        entryId: 'e1',
        entityId: 'p1',
        imagePath: join(dir, 'missing-texture.png')
      })
    ).rejects.toBeInstanceOf(AppError)
  })
})
