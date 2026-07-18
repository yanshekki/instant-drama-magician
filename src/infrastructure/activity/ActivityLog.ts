import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync
} from 'fs'
import { dirname, join } from 'path'

export type AuditLevel = 'debug' | 'info' | 'warn' | 'error'

export interface ActivityEntry {
  ts: string
  /** Category: ipc | generation | character | export | settings | support | … */
  kind: string
  message: string
  level?: AuditLevel
  storyId?: string
  /** Free-form structured context (JSON-serializable) */
  meta?: Record<string, unknown>
}

export interface ActivityQuery {
  limit?: number
  /** Filter by kind (exact or prefix with *) */
  kind?: string
  level?: AuditLevel | 'all'
  /** Case-insensitive search in message + meta JSON */
  q?: string
  /** ISO start (inclusive) */
  since?: string
  /** ISO end (inclusive) */
  until?: string
}

/** Keep more history for debug page (JSONL under userData/logs). */
const MAX_LINES = 5000

/**
 * Append-only JSONL audit / activity log under userData.
 * Used for support reports and the in-app Audit Log page.
 */
export class ActivityLog {
  constructor(private readonly filePath: string) {}

  static defaultPath(userData: string): string {
    return join(userData, 'logs', 'activity.jsonl')
  }

  get path(): string {
    return this.filePath
  }

  append(
    entry: Omit<ActivityEntry, 'ts'> & { ts?: string; level?: AuditLevel }
  ): void {
    mkdirSync(dirname(this.filePath), { recursive: true })
    const row: ActivityEntry = {
      ts: entry.ts ?? new Date().toISOString(),
      kind: entry.kind,
      message: entry.message,
      level: entry.level ?? 'info',
      storyId: entry.storyId,
      meta: entry.meta
    }
    try {
      appendFileSync(this.filePath, `${JSON.stringify(row)}\n`, 'utf-8')
      this.trimIfNeeded()
    } catch {
      // never throw from audit into main product path
    }
  }

  readRecent(limit = 100): ActivityEntry[] {
    return this.query({ limit })
  }

  query(opts: ActivityQuery = {}): ActivityEntry[] {
    const limit = Math.min(Math.max(opts.limit ?? 200, 1), MAX_LINES)
    if (!existsSync(this.filePath)) return []

    const lines = readFileSync(this.filePath, 'utf-8')
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)

    const all: ActivityEntry[] = []
    for (const line of lines) {
      try {
        all.push(JSON.parse(line) as ActivityEntry)
      } catch {
        // skip corrupt
      }
    }

    let filtered = all
    if (opts.kind && opts.kind !== 'all') {
      const k = opts.kind
      if (k.endsWith('*')) {
        const prefix = k.slice(0, -1)
        filtered = filtered.filter((e) => e.kind.startsWith(prefix))
      } else {
        filtered = filtered.filter((e) => e.kind === k)
      }
    }
    if (opts.level && opts.level !== 'all') {
      filtered = filtered.filter((e) => (e.level ?? 'info') === opts.level)
    }
    if (opts.since) {
      filtered = filtered.filter((e) => e.ts >= opts.since!)
    }
    if (opts.until) {
      filtered = filtered.filter((e) => e.ts <= opts.until!)
    }
    if (opts.q?.trim()) {
      const q = opts.q.trim().toLowerCase()
      filtered = filtered.filter((e) => {
        const hay = `${e.kind} ${e.message} ${e.storyId ?? ''} ${JSON.stringify(e.meta ?? {})}`.toLowerCase()
        return hay.includes(q)
      })
    }

    return filtered.slice(-limit)
  }

  /** Distinct kinds for filter UI */
  kinds(): string[] {
    const set = new Set<string>()
    for (const e of this.query({ limit: MAX_LINES })) {
      set.add(e.kind)
    }
    return [...set].sort()
  }

  clear(): { ok: true; path: string } {
    mkdirSync(dirname(this.filePath), { recursive: true })
    writeFileSync(this.filePath, '', 'utf-8')
    this.append({
      kind: 'audit',
      level: 'warn',
      message: 'log_cleared'
    })
    return { ok: true, path: this.filePath }
  }

  private trimIfNeeded(): void {
    if (!existsSync(this.filePath)) return
    const lines = readFileSync(this.filePath, 'utf-8')
      .split('\n')
      .filter((l) => l.trim())
    if (lines.length <= MAX_LINES) return
    writeFileSync(
      this.filePath,
      `${lines.slice(-MAX_LINES).join('\n')}\n`,
      'utf-8'
    )
  }
}
