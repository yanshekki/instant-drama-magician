import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'

const handlers = {
  cmdDoctor: vi.fn(async () => undefined),
  cmdInvoke: vi.fn(async () => undefined),
  cmdChannels: vi.fn(async () => undefined),
  cmdConfig: vi.fn(async () => undefined),
  cmdServer: vi.fn(async () => undefined),
  cmdTools: vi.fn(async () => undefined),
  cmdBuild: vi.fn(async () => undefined),
  cmdOpen: vi.fn(async () => undefined),
  cmdUpdate: vi.fn(async () => undefined),
  cmdAi: vi.fn(async () => undefined),
  cmdApp: vi.fn(async () => undefined),
  cmdSettings: vi.fn(async () => undefined),
  cmdStories: vi.fn(async () => undefined),
  cmdDomain: vi.fn(async () => undefined),
  printHelp: vi.fn()
}

vi.mock('./commands/doctor', () => ({
  cmdDoctor: (...a: unknown[]) => handlers.cmdDoctor(...a)
}))
vi.mock('./commands/invoke', () => ({
  cmdInvoke: (...a: unknown[]) => handlers.cmdInvoke(...a)
}))
vi.mock('./commands/channels', () => ({
  cmdChannels: (...a: unknown[]) => handlers.cmdChannels(...a)
}))
vi.mock('./commands/configCmd', () => ({
  cmdConfig: (...a: unknown[]) => handlers.cmdConfig(...a)
}))
vi.mock('./commands/server', () => ({
  cmdServer: (...a: unknown[]) => handlers.cmdServer(...a)
}))
vi.mock('./commands/tools', () => ({
  cmdTools: (...a: unknown[]) => handlers.cmdTools(...a)
}))
vi.mock('./commands/build', () => ({
  cmdBuild: (...a: unknown[]) => handlers.cmdBuild(...a)
}))
vi.mock('./commands/open', () => ({
  cmdOpen: (...a: unknown[]) => handlers.cmdOpen(...a)
}))
vi.mock('./commands/update', () => ({
  cmdUpdate: (...a: unknown[]) => handlers.cmdUpdate(...a)
}))
vi.mock('./commands/sugar', () => ({
  cmdAi: (...a: unknown[]) => handlers.cmdAi(...a),
  cmdApp: (...a: unknown[]) => handlers.cmdApp(...a),
  cmdSettings: (...a: unknown[]) => handlers.cmdSettings(...a),
  cmdStories: (...a: unknown[]) => handlers.cmdStories(...a)
}))
vi.mock('./commands/domain', () => ({
  cmdDomain: (...a: unknown[]) => handlers.cmdDomain(...a),
  DOMAIN_NAMESPACES: [
    'characters',
    'scenes',
    'stories',
    'ai',
    'app',
    'settings',
    'webServer',
    'videoPrep'
  ]
}))
vi.mock('./commands/help', () => ({
  printHelp: () => handlers.printHelp()
}))
vi.mock('./output', () => ({
  emitFailure: vi.fn(() => {
    throw new Error('emitFailure')
  }),
  printHuman: vi.fn()
}))

describe('cli bin main routing', () => {
  beforeEach(() => {
    vi.resetModules()
    Object.values(handlers).forEach((fn) => {
      if (typeof fn.mockClear === 'function') fn.mockClear()
    })
    vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never)
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  async function run(argv: string[]) {
    const prev = process.argv
    process.argv = ['node', 'bin', ...argv]
    try {
      vi.resetModules()
      await import('./bin')
      await new Promise((r) => setTimeout(r, 30))
    } finally {
      process.argv = prev
    }
  }

  it('routes version help and commands', async () => {
    await run(['--version'])
    await run(['doctor'])
    await run(['invoke', 'stories:list'])
    await run(['channels'])
    await run(['config', 'get'])
    await run(['tools'])
    await run(['stories', 'list'])
    await run(['settings', 'get'])
    await run(['ai', 'status'])
    await run(['app', 'info'])
    await run(['characters', 'list'])
    await run(['build', 'dir'])
    await run(['update', 'check'])
    await run(['open'])
    await run(['desktop', 'build'])
    await run(['desktop', 'open'])
    await run(['video-prep', 'x'])
    await run(['web-server', 'status'])
    await run(['help'])

    expect(handlers.cmdDoctor).toHaveBeenCalled()
    expect(handlers.cmdInvoke).toHaveBeenCalled()
    expect(handlers.cmdStories).toHaveBeenCalled()
    expect(handlers.cmdDomain).toHaveBeenCalled()
    expect(handlers.printHelp).toHaveBeenCalled()
  })
})
