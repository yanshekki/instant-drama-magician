import { describe, expect, it, afterEach, vi } from 'vitest'
import { createHeadlessDialog, createHeadlessShell } from './adapters'
import { writeFileSync, mkdtempSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

describe('headless adapters', () => {
  const prev = { ...process.env }
  let dir: string | undefined

  afterEach(() => {
    process.env = { ...prev }
    if (dir) {
      rmSync(dir, { recursive: true, force: true })
      dir = undefined
    }
    vi.restoreAllMocks()
  })

  it('showOpenDialog throws without IDM_PICK_FILE', async () => {
    delete process.env.IDM_PICK_FILE
    delete process.env.IDM_OPEN_PATH
    const d = createHeadlessDialog()
    await expect(d.showOpenDialog({ title: 'x' })).rejects.toMatchObject({
      code: 'VALIDATION',
      message: 'errors.headlessPickFile'
    })
  })

  it('showOpenDialog uses IDM_PICK_FILE and IDM_OPEN_PATH', async () => {
    dir = mkdtempSync(join(tmpdir(), 'idm-pick-'))
    const f = join(dir, 'a.png')
    writeFileSync(f, 'x')
    process.env.IDM_PICK_FILE = f
    const d = createHeadlessDialog()
    const r = await d.showOpenDialog({})
    expect(r.canceled).toBe(false)
    expect(r.filePaths[0]).toBe(f)

    delete process.env.IDM_PICK_FILE
    process.env.IDM_OPEN_PATH = f
    const r2 = await d.showOpenDialog({}, { title: 'open' })
    expect(r2.filePaths[0]).toBe(f)
  })

  it('showSaveDialog uses env, defaultPath, or throws', async () => {
    const d = createHeadlessDialog()
    process.env.IDM_SAVE_PATH = '/tmp/out.zip'
    expect((await d.showSaveDialog({ defaultPath: 'x.zip' })).filePath).toBe(
      '/tmp/out.zip'
    )

    delete process.env.IDM_SAVE_PATH
    process.env.IDM_SAVE_FILE = '/tmp/out2.zip'
    expect((await d.showSaveDialog({})).filePath).toBe('/tmp/out2.zip')

    delete process.env.IDM_SAVE_FILE
    expect(
      (await d.showSaveDialog({ defaultPath: '/tmp/via-default.zip' }))
        .filePath
    ).toBe('/tmp/via-default.zip')

    await expect(d.showSaveDialog({ title: 'save' })).rejects.toMatchObject({
      message: 'errors.headlessSavePath'
    })
  })

  it('shell openPath returns string error or empty', async () => {
    const sh = createHeadlessShell()
    const err = await sh.openPath('/nonexistent-path-idm-test-xyz')
    expect(typeof err).toBe('string')
  })

  it('shell openExternal and showItemInFolder do not throw', async () => {
    const sh = createHeadlessShell()
    await sh.openExternal('https://example.com')
    expect(() => sh.showItemInFolder('/tmp')).not.toThrow()
  })
})
