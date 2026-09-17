#!/usr/bin/env node
/**
 * Ban ad-hoc Prisma SQLite URLs in production code.
 * Windows ``file:${join(abs)}`` becomes file:C:\... and CANTOPEN.
 * Use pathToFileUrl / normalizePrismaSqliteUrl from src/domain/appPaths.ts.
 */
import { readdirSync, readFileSync, statSync } from 'fs'
import { join, relative } from 'path'
import { fileURLToPath } from 'url'

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..')
const SCAN = ['src', 'electron', 'server']
const ALLOW = new Set([
  'src/domain/appPaths.ts'
])

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === 'types' && dir.endsWith('src')) continue
    const p = join(dir, name)
    const st = statSync(p)
    if (st.isDirectory()) walk(p, out)
    else if (/\.(ts|tsx|js|mjs)$/.test(name)) out.push(p)
  }
  return out
}

const hits = []
for (const top of SCAN) {
  const abs = join(ROOT, top)
  for (const file of walk(abs)) {
    const rel = relative(ROOT, file).replace(/\\/g, '/')
    if (ALLOW.has(rel)) continue
    if (rel.startsWith('src/types/prisma/')) continue
    if (rel.startsWith('src/test/')) continue
    if (/\.test\.(ts|tsx)$/.test(rel) || rel.includes('.test.')) continue
    const text = readFileSync(file, 'utf8')
    const lines = text.split('\n')
    lines.forEach((line, i) => {
      if (line.includes('`file:${') || line.includes("'file:${") || line.includes('"file:${')) {
        hits.push(`${rel}:${i + 1}: ${line.trim()}`)
      }
    })
  }
}

if (hits.length) {
  console.error('Prisma SQLite URLs must go through pathToFileUrl / normalizePrismaSqliteUrl:')
  for (const h of hits) console.error('  ' + h)
  process.exit(1)
}
console.log('Prisma file-URL construction OK')
