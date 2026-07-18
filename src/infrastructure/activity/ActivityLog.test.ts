import { describe, expect, it } from 'vitest'
import { mkdtempSync, readFileSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { ActivityLog } from './ActivityLog'

describe('ActivityLog', () => {
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

  it('filters by kind, level, and query', () => {
    const dir = mkdtempSync(join(tmpdir(), 'idm-log-q-'))
    const log = new ActivityLog(join(dir, 'activity.jsonl'))
    log.append({ kind: 'ipc', message: 'stories:list', level: 'info', meta: { ms: 3 } })
    log.append({
      kind: 'ipc',
      message: 'characters:generateSheet',
      level: 'error',
      meta: { ok: false, error: 'timeout' }
    })
    log.append({ kind: 'generation', message: 'run', level: 'info' })

    expect(log.query({ kind: 'ipc' })).toHaveLength(2)
    expect(log.query({ level: 'error' })).toHaveLength(1)
    expect(log.query({ q: 'timeout' })[0].message).toBe(
      'characters:generateSheet'
    )
    expect(log.kinds()).toContain('ipc')
  })

  it('clear keeps a clear marker', () => {
    const dir = mkdtempSync(join(tmpdir(), 'idm-log-c-'))
    const log = new ActivityLog(join(dir, 'activity.jsonl'))
    log.append({ kind: 'x', message: 'a' })
    log.clear()
    const recent = log.readRecent(10)
    expect(recent.some((e) => e.message === 'log_cleared')).toBe(true)
  })
})
