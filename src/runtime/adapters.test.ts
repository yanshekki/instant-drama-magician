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
    // xdg-open may hang or fail on CI; race with timeout so headless stays non-blocking
    await Promise.race([
      sh.openExternal('https://example.com'),
      new Promise((r) => setTimeout(r, 500))
    ])
    expect(() => sh.showItemInFolder('/tmp')).not.toThrow()
  })

  it('covers platform branches via process.platform stub', async () => {
    const platforms = ['darwin', 'win32', 'linux'] as const
    const orig = process.platform
    for (const p of platforms) {
      Object.defineProperty(process, 'platform', {
        value: p,
        configurable: true
      })
      const sh = createHeadlessShell()
      process.env.IDM_DEBUG = '1'
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
      // openPath returns error string on failure (no hang if xdg-open missing)
      const err = await Promise.race([
        sh.openPath('/nonexistent-idm-path-xyz'),
        new Promise<string>((r) => setTimeout(() => r('timeout'), 800))
      ])
      expect(typeof err).toBe('string')
      await Promise.race([
        sh.openExternal('https://x.test'),
        new Promise((r) => setTimeout(r, 500))
      ])
      warn.mockRestore()
      delete process.env.IDM_DEBUG
    }
    Object.defineProperty(process, 'platform', {
      value: orig,
      configurable: true
    })
  })
})
