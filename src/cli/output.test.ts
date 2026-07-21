import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { emitSuccess, emitFailure, table, printJson } from './output'
import { EXIT } from './types'

describe('cli output', () => {
  let stdout: string
  let stderr: string
  const exit = vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
    throw new Error(`exit:${code}`)
  }) as never)

  beforeEach(() => {
    stdout = ''
    stderr = ''
    vi.spyOn(process.stdout, 'write').mockImplementation((c) => {
      stdout += String(c)
      return true
    })
    vi.spyOn(process.stderr, 'write').mockImplementation((c) => {
      stderr += String(c)
      return true
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('emitSuccess json mode', () => {
    emitSuccess(
      {
        json: true,
        pretty: false,
        quiet: false,
        url: null,
        token: null,
        local: true,
        dataDir: null,
        profile: null,
        yes: false,
        help: false
      },
      {
        ok: true,
        channel: 'stories:list',
        result: [1],
        meta: { ms: 1, mode: 'local' }
      }
    )
    expect(JSON.parse(stdout).ok).toBe(true)
    expect(JSON.parse(stdout).channel).toBe('stories:list')
  })

  it('emitFailure json writes error payload', () => {
    try {
      emitFailure(
        {
          json: true,
          pretty: false,
          quiet: false,
          url: null,
          token: null,
          local: true,
          dataDir: null,
          profile: null,
          yes: false,
          help: false
        },
        { message: 'boom', code: 'ERROR' },
        EXIT.ERROR
      )
    } catch {
      /* process.exit mocked or vitest intercept */
    }
    expect(stdout).toContain('"ok":false')
    expect(stdout).toContain('boom')
  })

  it('table formats rows', () => {
    const t = table([
      { a: '1', b: 'xx' },
      { a: '22', b: 'y' }
    ])
    expect(t).toContain('a')
    expect(t).toContain('22')
  })

  it('printJson writes', () => {
    printJson({ a: 1 })
    expect(stdout).toContain('"a"')
  })

  it('emitSuccess human modes for null/primitive/object/non-result', async () => {
    const { emitSuccess, printHuman, printErr } = await import('./output')
    const base = {
      json: false,
      pretty: false,
      quiet: false,
      url: null,
      token: null,
      local: true,
      dataDir: null,
      profile: null,
      yes: false,
      help: false
    }
    stdout = ''
    emitSuccess(base, {
      ok: true,
      channel: 'x',
      result: null,
      meta: { ms: 1, mode: 'local' }
    })
    expect(stdout).toContain('ok')

    stdout = ''
    emitSuccess(base, {
      ok: true,
      channel: 'x',
      result: 42,
      meta: { ms: 1, mode: 'local' }
    })
    expect(stdout).toContain('42')

    stdout = ''
    emitSuccess(base, {
      ok: true,
      channel: 'x',
      result: { a: 1 },
      meta: { ms: 1, mode: 'local' }
    })
    expect(stdout).toContain('"a"')

    stdout = ''
    emitSuccess(base, { status: 'ready' })
    expect(stdout).toContain('ready')

    // line already ending with newline
    stdout = ''
    printHuman('done\n')
    expect(stdout).toBe('done\n')
    stderr = ''
    printErr('e\n')
    expect(stderr).toBe('e\n')
  })

  it('emitFailure human mode and prebuilt error body', () => {
    const base = {
      json: false,
      pretty: false,
      quiet: false,
      url: null,
      token: null,
      local: true,
      dataDir: null,
      profile: null,
      yes: false,
      help: false
    }
    try {
      emitFailure(base, { message: 'nope', code: 'USAGE' }, EXIT.USAGE)
    } catch {
      /* exit mocked */
    }
    expect(stderr).toContain('USAGE')
    expect(stderr).toContain('nope')

    stdout = ''
    try {
      emitFailure(
        { ...base, json: true },
        { ok: false, error: { code: 'X', message: 'y' } },
        EXIT.ERROR
      )
    } catch {
      /* */
    }
    expect(stdout).toContain('"ok":false')
  })

  it('table empty rows', () => {
    expect(table([])).toBe('(empty)')
  })
})
