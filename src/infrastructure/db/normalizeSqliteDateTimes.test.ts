import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { execSync } from 'child_process'
import { PrismaClient } from '../../types/prisma'
import { normalizeSqliteDateTimes } from './normalizeSqliteDateTimes'

describe('normalizeSqliteDateTimes', () => {
  let dir: string
  let prisma: PrismaClient
  let url: string

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'idm-norm-dt-'))
    url = `file:${join(dir, 'test.db')}`
    process.env.DATABASE_URL = url
    execSync('npx prisma db push --skip-generate', {
      cwd: join(__dirname, '../../..'),
      env: { ...process.env, DATABASE_URL: url },
      stdio: 'pipe'
    })
    prisma = new PrismaClient({ datasources: { db: { url } } })
  })

  afterEach(async () => {
    await prisma.$disconnect()
    rmSync(dir, { recursive: true, force: true })
  })

  it('converts TEXT updatedAt so ORDER BY desc puts newest first', async () => {
    // Insert mixed storage: old text + new integer (simulates backfill + Prisma write)
    await prisma.$executeRawUnsafe(
      `INSERT INTO Prop (id, name, description, createdAt, updatedAt)
       VALUES
         ('old1', 'Alpha-old', 'd', '2026-01-01 00:00:00', '2026-01-01 00:00:00'),
         ('new1', 'Zeta-new', 'd', 1784570250194, 1784570250194)`
    )

    // Before normalize: TEXT wins DESC (wrong chronological order)
    const before = await prisma.$queryRawUnsafe<
      Array<{ name: string; updatedAt: unknown }>
    >(`SELECT name, updatedAt FROM Prop ORDER BY updatedAt DESC`)
    expect(before.map((r) => r.name)).toEqual(['Alpha-old', 'Zeta-new'])

    const result = await normalizeSqliteDateTimes(prisma)
    expect(result.total).toBeGreaterThan(0)

    const after = await prisma.$queryRawUnsafe<
      Array<{ name: string; updatedAt: unknown }>
    >(`SELECT name, updatedAt FROM Prop ORDER BY updatedAt DESC`)
    expect(after.map((r) => r.name)).toEqual(['Zeta-new', 'Alpha-old'])

    // All integer now
    const types = await prisma.$queryRawUnsafe<Array<{ t: string }>>(
      `SELECT typeof(updatedAt) as t FROM Prop`
    )
    expect(types.every((r) => r.t === 'integer')).toBe(true)
  })

  it('is idempotent', async () => {
    await prisma.$executeRawUnsafe(
      `INSERT INTO Prop (id, name, description, createdAt, updatedAt)
       VALUES ('p1', 'P', 'd', '2026-07-20 17:41:17', '2026-07-20 17:41:17')`
    )
    const a = await normalizeSqliteDateTimes(prisma)
    const b = await normalizeSqliteDateTimes(prisma)
    expect(a.total).toBeGreaterThan(0)
    expect(b.total).toBe(0)
  })
})
