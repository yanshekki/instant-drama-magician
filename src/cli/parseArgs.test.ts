import { describe, expect, it } from 'vitest'
import { parseArgv, resolveInvokeArgs } from './parseArgs'

describe('parseArgv', () => {
  it('parses command and positionals', () => {
    const p = parseArgv(['stories', 'list', 'extra'])
    expect(p.command).toBe('stories')
    expect(p.positionals).toEqual(['list', 'extra'])
  })

  it('parses global boolean flags', () => {
    const p = parseArgv(['--json', '--local', '-y', 'doctor'])
    expect(p.globals.json).toBe(true)
    expect(p.globals.local).toBe(true)
    expect(p.globals.yes).toBe(true)
    expect(p.command).toBe('doctor')
  })

  it('parses value flags', () => {
    const p = parseArgv([
      '--url',
      'http://127.0.0.1:8787',
      '--token=secret',
      '--data-dir',
      '/tmp/x',
      'channels',
      'list'
    ])
    expect(p.globals.url).toBe('http://127.0.0.1:8787')
    expect(p.globals.token).toBe('secret')
    expect(p.globals.dataDir).toBe('/tmp/x')
    expect(p.command).toBe('channels')
    expect(p.positionals).toEqual(['list'])
  })

  it('parses --help and version', () => {
    expect(parseArgv(['--help']).globals.help).toBe(true)
    expect((parseArgv(['-V']).globals as { version?: boolean }).version).toBe(
      true
    )
  })
})

describe('resolveInvokeArgs', () => {
  it('parses JSON array positional', async () => {
    const args = await resolveInvokeArgs(['["a",1]'], {})
    expect(args).toEqual(['a', 1])
  })

  it('parses --args flag', async () => {
    const args = await resolveInvokeArgs([], { args: '{"title":"T"}' })
    expect(args).toEqual([{ title: 'T' }])
  })

  it('keeps bare strings', async () => {
    const args = await resolveInvokeArgs(['story-1'], {})
    expect(args).toEqual(['story-1'])
  })
})
