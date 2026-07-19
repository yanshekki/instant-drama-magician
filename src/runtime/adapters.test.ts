import { describe, expect, it, afterEach } from 'vitest'
import { createHeadlessDialog, createHeadlessShell } from './adapters'
import { writeFileSync, mkdtempSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

describe('headless adapters', () => {
  const prev = { ...process.env }
  let dir: string

  afterEach(() => {
    process.env = { ...prev }
    if (dir) rmSync(dir, { recursive: true, force: true })
  })

  it('showOpenDialog throws without IDM_PICK_FILE', async () => {
    delete process.env.IDM_PICK_FILE
    const d = createHeadlessDialog()
    await expect(d.showOpenDialog({ title: 'x' })).rejects.toMatchObject({
      code: 'VALIDATION'
    })
  })

  it('showOpenDialog uses IDM_PICK_FILE', async () => {
    dir = mkdtempSync(join(tmpdir(), 'idm-pick-'))
    const f = join(dir, 'a.png')
    writeFileSync(f, 'x')
    process.env.IDM_PICK_FILE = f
    const d = createHeadlessDialog()
    const r = await d.showOpenDialog({})
    expect(r.canceled).toBe(false)
    expect(r.filePaths[0]).toBe(f)
  })

  it('showSaveDialog uses IDM_SAVE_PATH', async () => {
    process.env.IDM_SAVE_PATH = '/tmp/out.zip'
    const d = createHeadlessDialog()
    const r = await d.showSaveDialog({ defaultPath: 'x.zip' })
    expect(r.filePath).toBe('/tmp/out.zip')
  })

  it('shell openPath returns string error or empty', async () => {
    const sh = createHeadlessShell()
    const err = await sh.openPath('/nonexistent-path-idm-test-xyz')
    expect(typeof err).toBe('string')
  })
})
