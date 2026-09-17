#!/usr/bin/env node
/**
 * ensureSqliteSchema.ts must mention every table from an empty→schema diff.
 * Does not rewrite SQL; fails if a new model is missing from first-run DDL.
 */
import { execSync } from 'child_process'
import { readFileSync } from 'fs'
import { join } from 'path'
import { fileURLToPath } from 'url'

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..')
const sql = execSync(
  'npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script',
  { cwd: ROOT, encoding: 'utf8' }
)
const tables = [
  ...sql.matchAll(/CREATE TABLE\s+"([^"]+)"/g)
].map((m) => m[1])
const src = readFileSync(
  join(ROOT, 'src/infrastructure/db/ensureSqliteSchema.ts'),
  'utf8'
)
const missing = tables.filter((t) => !src.includes(`"${t}"`))
if (!tables.length) {
  console.error('prisma migrate diff produced no CREATE TABLE statements')
  process.exit(1)
}
if (missing.length) {
  console.error(
    'ensureSqliteSchema.ts missing tables from schema.prisma:',
    missing.join(', ')
  )
  process.exit(1)
}
console.log(`SQLite first-run schema covers ${tables.length} tables`)
