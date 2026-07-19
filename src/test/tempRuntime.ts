/**
 * Temp dataDir + real SQLite runtime for integration tests.
 */
import { mkdtempSync, rmSync, existsSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { execSync } from 'child_process'
import { createRuntime, type AppRuntime } from '../runtime/createRuntime'

export interface TempRuntimeHandle {
  runtime: AppRuntime
  dataDir: string
  dispose: () => Promise<void>
}

let schemaPushedFor = new Set<string>()

export function pushSchema(dbPath: string): void {
  const key = dbPath
  if (schemaPushedFor.has(key) && existsSync(dbPath)) return
  execSync(`npx prisma db push --skip-generate`, {
    cwd: join(__dirname, '../..'),
    env: {
      ...process.env,
      DATABASE_URL: `file:${dbPath}`
    },
    stdio: 'pipe'
  })
  schemaPushedFor.add(key)
}

export async function createTempRuntime(
  opts?: { prefix?: string }
): Promise<TempRuntimeHandle> {
  const dataDir = mkdtempSync(join(tmpdir(), opts?.prefix ?? 'idm-test-'))
  const dbPath = join(dataDir, 'instant-drama.db')
  pushSchema(dbPath)
  const databaseUrl = `file:${dbPath}`
  process.env.DATABASE_URL = databaseUrl
  const runtime = createRuntime({
    dataDir,
    databaseUrl,
    appVersion: 'test',
    isPackaged: false
  })
  return {
    runtime,
    dataDir,
    dispose: async () => {
      await runtime.dispose()
      try {
        rmSync(dataDir, { recursive: true, force: true })
      } catch {
        /* ignore */
      }
    }
  }
}
