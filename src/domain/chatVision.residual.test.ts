/**
 * Residual coverage for chatVision tryResolveFfmpeg branches, fallbacks, and
 * imagePathToDataUrl / buildVisionUserContent error paths.
 * Uses hoisted vi.mock (ESM cannot spyOn named exports of 'fs'/'module').
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mkdtempSync, writeFileSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { AppError } from '../types/errors'

const spawnSyncMock = vi.hoisted(() =>
  vi.fn(() => ({
    status: 1,
    signal: null,
    output: [] as unknown[],
    pid: 0,
    stdout: '',
    stderr: 'fail',
    error: undefined as Error | undefined
  }))
)

const createRequireImpl = vi.hoisted(() =>
  vi.fn((..._args: unknown[]) => {
    // default: behave like string export of real path when needed
    return (id: string) => {
      if (id === 'ffmpeg-static') return '/mock/ffmpeg-bin'
      throw new Error(`unexpected require ${id}`)
    }
  })
)

const rmSyncMock = vi.hoisted(() =>
  vi.fn((...args: unknown[]) => {
    const actual = vi.importActual as unknown as typeof import('fs')
    void actual
    // call through unless tests override
    return undefined
  })
)

const readFileSyncMock = vi.hoisted(() => vi.fn())
const statSyncMock = vi.hoisted(() => vi.fn())
const existsSyncMock = vi.hoisted(() => vi.fn())

vi.mock('child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('child_process')>()
  return {
    ...actual,
    spawnSync: (...args: unknown[]) => spawnSyncMock(...args)
  }
})

vi.mock('module', async (importOriginal) => {
  const actual = await importOriginal<typeof import('module')>()
  return {
    ...actual,
    createRequire: (...args: unknown[]) => createRequireImpl(...args)
  }
})

vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs')>()
  return {
    ...actual,
    rmSync: (...args: Parameters<typeof actual.rmSync>) => {
      if (rmSyncMock.getMockImplementation()) {
        try {
          return rmSyncMock(...args)
        } catch (e) {
          // rethrow so finally catch in SUT is hit when mock throws
          throw e
        }
      }
      return actual.rmSync(...args)
    },
    readFileSync: (...args: Parameters<typeof actual.readFileSync>) => {
      if (readFileSyncMock.getMockImplementation()) {
        return readFileSyncMock(...args)
      }
      return actual.readFileSync(...args)
    },
    statSync: (...args: Parameters<typeof actual.statSync>) => {
      if (statSyncMock.getMockImplementation()) {
        return statSyncMock(...args)
      }
      return actual.statSync(...args)
    },
    existsSync: (...args: Parameters<typeof actual.existsSync>) => {
      if (existsSyncMock.getMockImplementation()) {
        return existsSyncMock(...args)
      }
      return actual.existsSync(...args)
    }
  }
})

import {
  buildVisionUserContent,
  imagePathToDataUrl,
  loadImageBytesForAi,
  prepareVisionImageBytes,
  VISION_SKIP_RESIZE_BYTES
} from './chatVision'

const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
)

afterEach(() => {
  spawnSyncMock.mockReset()
  spawnSyncMock.mockReturnValue({
    status: 1,
    signal: null,
    output: [],
    pid: 0,
    stdout: '',
    stderr: 'fail',
    error: undefined
  })
  createRequireImpl.mockReset()
  createRequireImpl.mockImplementation(() => {
    return (id: string) => {
      if (id === 'ffmpeg-static') return '/mock/ffmpeg-bin'
      throw new Error(`unexpected require ${id}`)
    }
  })
  rmSyncMock.mockReset()
  readFileSyncMock.mockReset()
  statSyncMock.mockReset()
  existsSyncMock.mockReset()
})

beforeEach(() => {
  // Default: mock ffmpeg bin "exists"
  existsSyncMock.mockImplementation((p: unknown) => {
    if (String(p).includes('ffmpeg')) return true
    // fall through for real paths used in tests
    const { existsSync } = require('fs') as typeof import('fs')
    // Use real exists via unmocked - but we mocked existsSync.
    // For test files we create, return true if we know them, else use original.
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const fsActual = require('node:fs') as typeof import('fs')
      // Our mock wraps — call the Node built-in via a fresh require of original is hard.
      // Simpler: track written paths
      return true
    } catch {
      return true
    }
  })
})

describe('chatVision residual lines', () => {
  it('resolves ffmpeg-static object default export', () => {
    const dir = mkdtempSync(join(tmpdir(), 'idm-cv-obj-'))
    const p = join(dir, 'big.bin')
    try {
      writeFileSync(p, Buffer.alloc(VISION_SKIP_RESIZE_BYTES + 1000, 1))
      createRequireImpl.mockReturnValue(
        (() => ({ default: '/mock/ffmpeg-from-default' })) as never
      )
      existsSyncMock.mockImplementation((path: unknown) => {
        const s = String(path)
        if (s.includes('ffmpeg-from-default')) return true
        if (s === p) return true
        return false
      })
      spawnSyncMock.mockReturnValue({
        status: 1,
        signal: null,
        output: [],
        pid: 0,
        stdout: '',
        stderr: 'fail',
        error: undefined
      })
      const r = prepareVisionImageBytes(p)
      expect(r.resized).toBe(false)
      expect(r.bytes.length).toBe(VISION_SKIP_RESIZE_BYTES + 1000)
      expect(createRequireImpl).toHaveBeenCalled()
    } finally {
      // use real rm via node:fs
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('node:fs').rmSync(dir, { recursive: true, force: true })
    }
  })

  it('createRequire throws falls back to node_modules candidate', () => {
    const dir = mkdtempSync(join(tmpdir(), 'idm-cv-cand-'))
    const p = join(dir, 'big.bin')
    try {
      writeFileSync(p, Buffer.alloc(VISION_SKIP_RESIZE_BYTES + 500, 2))
      createRequireImpl.mockImplementation(() => {
        throw new Error('require broken')
      })
      existsSyncMock.mockImplementation((path: unknown) => {
        const s = String(path)
        if (s === p) return true
        // candidate path under node_modules/ffmpeg-static/ffmpeg
        if (s.includes('node_modules') && s.includes('ffmpeg-static')) return true
        return false
      })
      spawnSyncMock.mockReturnValue({
        status: 1,
        signal: null,
        output: [],
        pid: 0,
        stdout: '',
        stderr: 'fail',
        error: undefined
      })
      const r = prepareVisionImageBytes(p)
      expect(r.resized).toBe(false)
    } finally {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('node:fs').rmSync(dir, { recursive: true, force: true })
    }
  })

  it('rmSync throw in finally is swallowed; returns original bytes', () => {
    const dir = mkdtempSync(join(tmpdir(), 'idm-cv-rm-'))
    const p = join(dir, 'big.bin')
    try {
      writeFileSync(p, Buffer.alloc(VISION_SKIP_RESIZE_BYTES + 300, 3))
      createRequireImpl.mockReturnValue((() => '/mock/ffmpeg-bin') as never)
      existsSyncMock.mockImplementation((path: unknown) => {
        const s = String(path)
        if (s === p) return true
        if (s.includes('ffmpeg')) return true
        // outPath after spawn - don't exist so resize fails path → 152
        if (s.endsWith('vision.jpg')) return false
        return false
      })
      spawnSyncMock.mockReturnValue({
        status: 0,
        signal: null,
        output: [],
        pid: 0,
        stdout: '',
        stderr: '',
        error: undefined
      })
      rmSyncMock.mockImplementation(() => {
        throw new Error('rm boom')
      })
      const r = prepareVisionImageBytes(p)
      expect(r.resized).toBe(false)
      expect(rmSyncMock).toHaveBeenCalled()
    } finally {
      rmSyncMock.mockReset()
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('node:fs').rmSync(dir, { recursive: true, force: true })
    }
  })

  it('loadImageBytesForAi falls through when statSync throws', () => {
    const dir = mkdtempSync(join(tmpdir(), 'idm-cv-stat-'))
    const p = join(dir, 't.png')
    try {
      writeFileSync(p, TINY_PNG)
      existsSyncMock.mockImplementation((path: unknown) => String(path) === p)
      statSyncMock.mockImplementation(() => {
        throw new Error('stat fail')
      })
      createRequireImpl.mockReturnValue((() => '/mock/ffmpeg-bin') as never)
      // prepareVisionImageBytes will read via real readFileSync (mock not set)
      // but our existsSync only allows p — ffmpeg path false → no ffmpeg, return original
      existsSyncMock.mockImplementation((path: unknown) => {
        if (String(path) === p) return true
        return false
      })
      const r = loadImageBytesForAi(p)
      expect(r.bytes.equals(TINY_PNG)).toBe(true)
      expect(r.resized).toBe(false)
    } finally {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('node:fs').rmSync(dir, { recursive: true, force: true })
    }
  })

  it('imagePathToDataUrl returns null on read failure; buildVision throws', () => {
    const dir = mkdtempSync(join(tmpdir(), 'idm-cv-null-'))
    const p = join(dir, 't.png')
    try {
      writeFileSync(p, TINY_PNG)
      existsSyncMock.mockImplementation((path: unknown) => String(path) === p)
      // loadImageBytesForAi: exists true, size small path uses readFileSync
      statSyncMock.mockReturnValue({ size: 10 } as never)
      readFileSyncMock.mockImplementation(() => {
        throw new Error('read fail')
      })
      expect(imagePathToDataUrl(p)).toBeNull()
      expect(() => buildVisionUserContent('hello', p)).toThrow(AppError)
    } finally {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('node:fs').rmSync(dir, { recursive: true, force: true })
    }
  })

  it('mod.default null when ffmpeg-static is empty object', () => {
    const dir = mkdtempSync(join(tmpdir(), 'idm-cv-nullmod-'))
    const p = join(dir, 'big.bin')
    try {
      writeFileSync(p, Buffer.alloc(VISION_SKIP_RESIZE_BYTES + 100, 4))
      createRequireImpl.mockReturnValue((() => ({ default: 123 })) as never)
      existsSyncMock.mockImplementation((path: unknown) => {
        if (String(path) === p) return true
        // candidate exists
        if (String(path).includes('node_modules') && String(path).includes('ffmpeg'))
          return true
        return false
      })
      spawnSyncMock.mockReturnValue({
        status: 1,
        signal: null,
        output: [],
        pid: 0,
        stdout: '',
        stderr: 'x',
        error: undefined
      })
      const r = prepareVisionImageBytes(p)
      expect(r.resized).toBe(false)
    } finally {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('node:fs').rmSync(dir, { recursive: true, force: true })
    }
  })
})

// silence unused
void rmSync
