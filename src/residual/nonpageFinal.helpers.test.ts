/**
 * Final residual scrub: pure helpers + AppUpdate residual branches.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { join } from 'path'
import { mkdtempSync, writeFileSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { mimeFromPath } from '../infrastructure/ai/GrokCliClient'
import {
  launchScore,
  safeStatMtime
} from '../cli/lib/desktopPaths'
import { basenameMatch } from '../application/services/GenerationService'
import { ffmpegRequireBase } from '../infrastructure/ffmpeg/resolveFfmpegPath'

describe('nonpage final pure helpers', () => {
  it('mimeFromPath covers all extensions', () => {
    expect(mimeFromPath('a.jpg')).toBe('image/jpeg')
    expect(mimeFromPath('a.JPEG')).toBe('image/jpeg')
    expect(mimeFromPath('a.webp')).toBe('image/webp')
    expect(mimeFromPath('a.gif')).toBe('image/gif')
    expect(mimeFromPath('a.png')).toBe('image/png')
    expect(mimeFromPath('a')).toBe('image/png')
  })

  it('launchScore and safeStatMtime', () => {
    expect(launchScore({ kind: 'app' } as never)).toBe(100)
    expect(launchScore({ kind: 'dir-binary' } as never)).toBe(90)
    expect(launchScore({ kind: 'exe' } as never)).toBe(90)
    expect(launchScore({ kind: 'appimage' } as never)).toBe(80)
    expect(launchScore({ kind: 'dmg' } as never)).toBe(10)
    expect(launchScore({ kind: 'nsis' } as never)).toBe(10)
    expect(launchScore({ kind: 'deb' } as never)).toBe(10)
    expect(launchScore({ kind: 'other' } as never)).toBe(0)
    expect(safeStatMtime('/no/such/path/xyz')).toBe(0)
    const dir = mkdtempSync(join(tmpdir(), 'idm-stat-'))
    const f = join(dir, 'x')
    writeFileSync(f, '1')
    expect(safeStatMtime(f)).toBeGreaterThan(0)
    rmSync(dir, { recursive: true, force: true })
  })

  it('basenameMatch and ffmpegRequireBase', () => {
    expect(basenameMatch(String.raw`C:\out\file.mp4`, 'file.mp4')).toBe(true)
    expect(basenameMatch('/out/file.mp4', 'file.mp4')).toBe(true)
    expect(ffmpegRequireBase(true).length).toBeGreaterThan(0)
    expect(ffmpegRequireBase(false)).toContain('package.json')
  })
})
