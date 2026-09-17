import { afterEach, describe, expect, it } from 'vitest'
import { mkdtempSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { PrismaClient } from '../../types/prisma'
import {
  ensureSqliteSchema,
  sqliteInitStatementCount
} from './ensureSqliteSchema'
import { pathToFileUrl } from '../../domain/appPaths'

describe('ensureSqliteSchema', () => {
  let dir: string
  let prisma: PrismaClient | null = null

  afterEach(async () => {
    if (prisma) {
      await prisma.$disconnect().catch(() => undefined)
      prisma = null
    }
    if (dir) rmSync(dir, { recursive: true, force: true })
  })

  it('skips mocks that have no raw SQL API', async () => {
    await expect(ensureSqliteSchema({} as PrismaClient)).resolves.toBe(false)
    expect(sqliteInitStatementCount()).toBeGreaterThan(10)
  })

  it('creates Story/Character tables on a brand-new sqlite file', async () => {
    dir = mkdtempSync(join(tmpdir(), 'idm-schema-'))
    const url = pathToFileUrl(join(dir, 'fresh.db'))
    prisma = new PrismaClient({ datasources: { db: { url } } })
    await expect(
      prisma.character.findMany({ take: 1 })
    ).rejects.toThrow()
    expect(await ensureSqliteSchema(prisma)).toBe(true)
    expect(await ensureSqliteSchema(prisma)).toBe(false)
    const created = await prisma.story.create({
      data: { title: 'fresh install', updatedAt: new Date() }
    })
    expect(created.title).toBe('fresh install')
    const chars = await prisma.character.findMany()
    expect(chars).toEqual([])
  })
})
