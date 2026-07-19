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
})
