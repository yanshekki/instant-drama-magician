/**
 * SQLite + Prisma DateTime can end up as mixed storage classes:
 * - TEXT  e.g. '2026-07-20 17:41:17'  (manual backfill / old rows)
 * - INTEGER epoch ms                  (Prisma @updatedAt writes)
 *
 * SQLite ORDER BY compares storage class first (integer < text), so
 * `ORDER BY updatedAt DESC` puts TEXT (often *older*) above INTEGER
 * (often *newer*) — library lists appear sorted wrong.
 *
 * Convert TEXT timestamps to INTEGER ms so server orderBy matches reality.
 */
import type { PrismaClient } from '../../types/prisma'

/** Models that carry createdAt / updatedAt DateTime columns. */
const DATE_TABLES = [
  'Story',
  'Character',
  'Costume',
  'Scene',
  'Prop',
  'Action'
] as const

const DATE_COLUMNS = ['createdAt', 'updatedAt'] as const

export type NormalizeSqliteDateTimesResult = {
  tables: Record<string, number>
  total: number
}

/**
 * Idempotent: only rewrites rows where typeof(column) = 'text' and julianday works.
 */
export async function normalizeSqliteDateTimes(
  prisma: PrismaClient
): Promise<NormalizeSqliteDateTimesResult> {
  const tables: Record<string, number> = {}
  let total = 0

  for (const table of DATE_TABLES) {
    let tableCount = 0
    for (const col of DATE_COLUMNS) {
      // julianday(text) → days since noon UTC Nov 24 4714 BC
      // (julianday - 2440587.5) * 86400000 → Unix epoch ms
      const sql = `
        UPDATE "${table}"
        SET "${col}" = CAST((julianday("${col}") - 2440587.5) * 86400000 AS INTEGER)
        WHERE typeof("${col}") = 'text'
          AND julianday("${col}") IS NOT NULL
      `
      try {
        const n = await prisma.$executeRawUnsafe(sql)
        tableCount += n
        total += n
      } catch {
        // Table/column may not exist on very old DBs — ignore
      }
    }
    tables[table] = tableCount
  }

  return { tables, total }
}
