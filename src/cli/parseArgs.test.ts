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

  it('stops at -- and collects remaining as positionals', () => {
    const p = parseArgv(['invoke', 'stories:list', '--', '--json', 'extra'])
    expect(p.command).toBe('invoke')
    expect(p.positionals).toEqual(['stories:list', '--json', 'extra'])
  })

  it('parses --flag=value and bare --flag true for subcommands', () => {
    const p = parseArgv([
      'build',
      '--target=dir',
      '--verbose',
      '--out',
      'dist',
      '-x'
    ])
    expect(p.flags.target).toBe('dir')
    expect(p.flags.verbose).toBe(true)
    expect(p.flags.out).toBe('dist')
    expect(p.flags.x).toBe(true)
  })

  it('parses short -q -y -h -V -p profile', () => {
    const p = parseArgv(['-q', '-y', '-h', '-p', 'demo', 'doctor'])
    expect(p.globals.quiet).toBe(true)
    expect(p.globals.yes).toBe(true)
    expect(p.globals.help).toBe(true)
    expect(p.globals.profile).toBe('demo')
    expect(p.command).toBe('doctor')
    expect(
      (parseArgv(['-V', 'x']).globals as { version?: boolean }).version
    ).toBe(true)
  })

  it('parses global bool =false/0 and value forms for profile/url/token', () => {
    const p = parseArgv([
      '--json=false',
      '--pretty=0',
      '--local=false',
      '--profile=dev',
      '--url=http://x',
      '--token=t',
      'c'
    ])
    expect(p.globals.json).toBe(false)
    expect(p.globals.pretty).toBe(false)
    expect(p.globals.local).toBe(false)
    expect(p.globals.profile).toBe('dev')
    expect(p.globals.url).toBe('http://x')
    expect(p.globals.token).toBe('t')
  })

  it('maps --version long form', () => {
    expect(
      (parseArgv(['--version']).globals as { version?: boolean }).version
    ).toBe(true)
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

  it('wraps non-array --args object', async () => {
    const args = await resolveInvokeArgs([], { args: '{"a":1}' })
    expect(args).toEqual([{ a: 1 }])
  })

  it('parses multiple positionals with mixed JSON', async () => {
    const args = await resolveInvokeArgs(['1', 'plain', '{"x":2}'], {})
    expect(args).toEqual([1, 'plain', { x: 2 }])
  })

  it('returns empty for no positionals and no flags', async () => {
    expect(await resolveInvokeArgs([], {})).toEqual([])
  })

  it('reads --args-stdin from process.stdin', async () => {
    const { Readable } = await import('stream')
    const r = Readable.from([Buffer.from('["stdin",2]')])
    const prev = process.stdin
    Object.defineProperty(process, 'stdin', {
      configurable: true,
      value: r
    })
    try {
      const args = await resolveInvokeArgs([], { argsStdin: true })
      expect(args).toEqual(['stdin', 2])
    } finally {
      Object.defineProperty(process, 'stdin', {
        configurable: true,
        value: prev
      })
    }
  })

  it('args-stdin empty yields []', async () => {
    const { Readable } = await import('stream')
    const r = Readable.from([Buffer.from('   ')])
    const prev = process.stdin
    Object.defineProperty(process, 'stdin', {
      configurable: true,
      value: r
    })
    try {
      expect(await resolveInvokeArgs([], { 'args-stdin': true })).toEqual([])
    } finally {
      Object.defineProperty(process, 'stdin', {
        configurable: true,
        value: prev
      })
    }
  })
})
