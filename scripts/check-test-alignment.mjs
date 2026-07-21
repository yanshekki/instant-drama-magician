#!/usr/bin/env node
/**
 * Fail if scannable modules lack a sibling *.test.ts(x).
 *
 *   node scripts/check-test-alignment.mjs
 *   npm run test:align
 *
 * Allowlist = pure re-exports / types / covered by matrix aggregators.
 * See docs/testing.md.
 */
import { readdirSync, statSync, existsSync, readFileSync } from 'fs'
import { join, relative, dirname, basename } from 'path'
import { fileURLToPath } from 'url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

/** Paths relative to repo root — no sibling test required */
const ALLOWLIST = new Set([
  // Aggregators exercised by registerAllHandlers / matrix
  'src/runtime/handlers/characters.ts',
  'src/runtime/handlers/scenes.ts',
  'src/runtime/handlers/videoPrep.ts',
  'src/runtime/handlers/settings.ts', // thin settings — covered by matrix + smoke
  // Pure type modules
  'src/infrastructure/update/updateTypes.ts',
  'src/infrastructure/ai/video/types.ts',
  'src/types/electron-api.ts',
  // App shell entry (not unit-tested as whole)
  'src/main.tsx',
  'src/App.tsx',
  'src/cli/bin.ts',
  'electron/main/index.ts',
  'electron/preload/index.ts',
  'server/index.ts'
])

const SCAN_DIRS = [
  'src/domain',
  'src/application',
  'src/runtime/handlers',
  'src/cli',
  'src/infrastructure',
  'src/lib',
  'src/presentation/hooks',
  'src/presentation/lib'
]

function walk(dir, out = []) {
  if (!existsSync(dir)) return out
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === 'prisma') continue
    const p = join(dir, name)
    const st = statSync(p)
    if (st.isDirectory()) walk(p, out)
    else out.push(p)
  }
  return out
}

function hasSiblingTest(fileAbs) {
  const dir = dirname(fileAbs)
  const base = basename(fileAbs)
  const stem = base.replace(/\.tsx?$/, '')
  for (const ext of ['.test.ts', '.test.tsx', '.integration.test.ts', '.contract.test.ts', '.onlyFailed.test.ts']) {
    if (existsSync(join(dir, stem + ext))) return true
  }
  // e.g. GenerationPipeline.onlyFailed.test.ts already matched .onlyFailed
  // Also accept *.pipeline.test.ts patterns via any file starting with stem + .
  for (const name of readdirSync(dir)) {
    if (name.startsWith(stem + '.') && name.includes('.test.')) return true
  }
  return false
}

function isSource(fileAbs) {
  if (!/\.tsx?$/.test(fileAbs)) return false
  if (fileAbs.includes('.test.')) return false
  if (fileAbs.endsWith('.d.ts')) return false
  if (fileAbs.includes(`${join('types', 'prisma')}`)) return false
  return true
}

const missing = []
for (const relDir of SCAN_DIRS) {
  const absDir = join(ROOT, relDir)
  for (const file of walk(absDir)) {
    if (!isSource(file)) continue
    const rel = relative(ROOT, file).replace(/\\/g, '/')
    if (ALLOWLIST.has(rel)) continue
    // index.ts re-exports often covered by package tests
    if (basename(file) === 'index.ts' && rel.startsWith('src/application/services/')) {
      continue
    }
    if (!hasSiblingTest(file)) missing.push(rel)
  }
}

if (missing.length) {
  console.error('Test alignment FAIL — missing sibling tests:\n')
  for (const m of missing.sort()) console.error('  ' + m)
  console.error(
    `\n${missing.length} file(s). Add foo.test.ts or allowlist in scripts/check-test-alignment.mjs\nSee docs/testing.md`
  )
  process.exit(1)
}

console.log(
  `Test alignment OK — scanned ${SCAN_DIRS.join(', ')} (allowlist ${ALLOWLIST.size})`
)
