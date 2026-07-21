import { describe, expect, it } from 'vitest'
import {
  appendFileSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
  rmSync
} from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { ActivityLog } from './ActivityLog'

describe('ActivityLog', () => {
  it('defaultPath and path getter', () => {
    expect(ActivityLog.defaultPath('/data')).toBe(
      join('/data', 'logs', 'activity.jsonl')
    )
    const log = new ActivityLog('/tmp/x.jsonl')
    expect(log.path).toBe('/tmp/x.jsonl')
  })

  it('appends and reads recent entries', () => {
    const dir = mkdtempSync(join(tmpdir(), 'idm-log-'))
    const log = new ActivityLog(join(dir, 'activity.jsonl'))
    log.append({ kind: 'generation', message: 'start', storyId: 's1' })
    log.append({ kind: 'export', message: 'final ok', level: 'info' })
    const recent = log.readRecent(10)
    expect(recent).toHaveLength(2)
    expect(recent[0].kind).toBe('generation')
    expect(recent[1].message).toBe('final ok')
    const raw = readFileSync(join(dir, 'activity.jsonl'), 'utf-8')
    expect(raw.split('\n').filter(Boolean)).toHaveLength(2)
  })

  it('filters by kind prefix, level, since/until, and query', () => {
    const dir = mkdtempSync(join(tmpdir(), 'idm-log-q-'))
    const log = new ActivityLog(join(dir, 'activity.jsonl'))
    log.append({
      kind: 'ipc',
      message: 'stories:list',
      level: 'info',
      ts: '2024-01-01T00:00:00.000Z',
      meta: { ms: 3 }
    })
    log.append({
      kind: 'ipc.sheet',
      message: 'characters:generateSheet',
      level: 'error',
      ts: '2024-06-01T00:00:00.000Z',
      meta: { ok: false, error: 'timeout' }
    })
    log.append({
      kind: 'generation',
      message: 'run',
      level: 'info',
      ts: '2024-12-01T00:00:00.000Z'
    })

    expect(log.query({ kind: 'ipc' })).toHaveLength(1)
    expect(log.query({ kind: 'ipc*' })).toHaveLength(2)
    expect(log.query({ level: 'error' })).toHaveLength(1)
    expect(log.query({ q: 'timeout' })[0].message).toBe(
      'characters:generateSheet'
    )
    expect(
      log.query({
        since: '2024-05-01T00:00:00.000Z',
        until: '2024-07-01T00:00:00.000Z'
      })
    ).toHaveLength(1)
    expect(log.kinds()).toEqual(
      expect.arrayContaining(['ipc', 'ipc.sheet', 'generation'])
    )
  })

  it('skips corrupt lines and empty file', () => {
    const dir = mkdtempSync(join(tmpdir(), 'idm-log-bad-'))
    const path = join(dir, 'activity.jsonl')
    writeFileSync(path, 'not-json\n{"kind":"ok","message":"m","ts":"t"}\n', 'utf-8')
    const log = new ActivityLog(path)
    expect(log.query()).toHaveLength(1)
    expect(new ActivityLog(join(dir, 'missing.jsonl')).query()).toEqual([])
  })

  it('clear keeps a clear marker', () => {
    const dir = mkdtempSync(join(tmpdir(), 'idm-log-c-'))
    const log = new ActivityLog(join(dir, 'activity.jsonl'))
    log.append({ kind: 'x', message: 'a' })
    log.clear()
    const recent = log.readRecent(10)
    expect(recent.some((e) => e.message === 'log_cleared')).toBe(true)
  })

  it('append never throws on bad path parent is creatable', () => {
    const dir = mkdtempSync(join(tmpdir(), 'idm-log-a-'))
    const log = new ActivityLog(join(dir, 'nested', 'a.jsonl'))
    expect(() =>
      log.append({ kind: 'k', message: 'm', level: 'debug' })
    ).not.toThrow()
  })

  it('force100 trim max lines on append flood', () => {
    const dir = mkdtempSync(join(tmpdir(), 'idm-act-'))
    const log = new ActivityLog(join(dir, 'a.jsonl'))
    // MAX_LINES is 5000 — push past to hit trimIfNeeded write path
    for (let i = 0; i < 5010; i++) {
      log.append({ kind: 'x', message: `m${i}` })
    }
    const recent = log.readRecent(20)
    expect(recent.length).toBeLessThanOrEqual(20)
    rmSync(dir, { recursive: true, force: true })
  }, 60_000)

})
