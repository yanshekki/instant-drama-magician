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
    log.append({ kind: 'export', message: 'final ok' })
    const recent = log.readRecent(10)
    expect(recent).toHaveLength(2)
    expect(recent[0].kind).toBe('generation')
    expect(recent[1].message).toBe('final ok')
    const raw = readFileSync(join(dir, 'activity.jsonl'), 'utf-8')
    expect(raw.split('\n').filter(Boolean)).toHaveLength(2)
  })
})
