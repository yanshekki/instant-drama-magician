import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync
} from 'fs'
import { dirname, join } from 'path'

export interface ActivityEntry {
  ts: string
  kind: string
  message: string
  storyId?: string
  meta?: Record<string, string | number | boolean | null>
}

const MAX_LINES = 500

/**
 * Append-only JSONL activity log under userData for support reports.
 */
export class ActivityLog {
  constructor(private readonly filePath: string) {}

  static defaultPath(userData: string): string {
    return join(userData, 'logs', 'activity.jsonl')
  }

  append(entry: Omit<ActivityEntry, 'ts'> & { ts?: string }): void {
    mkdirSync(dirname(this.filePath), { recursive: true })
    const row: ActivityEntry = {
      ts: entry.ts ?? new Date().toISOString(),
      kind: entry.kind,
      message: entry.message,
      storyId: entry.storyId,
      meta: entry.meta
    }
    appendFileSync(this.filePath, `${JSON.stringify(row)}\n`, 'utf-8')
    this.trimIfNeeded()
  }

  readRecent(limit = 100): ActivityEntry[] {
    if (!existsSync(this.filePath)) return []
    const lines = readFileSync(this.filePath, 'utf-8')
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
    const slice = lines.slice(-limit)
    const out: ActivityEntry[] = []
    for (const line of slice) {
      try {
        out.push(JSON.parse(line) as ActivityEntry)
      } catch {
        // skip corrupt
      }
    }
    return out
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
