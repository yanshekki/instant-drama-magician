#!/usr/bin/env node
/**
 * Fail pack/dist if src/types/prisma is missing the query engine for the
 * installer OS. Cross-packing (Linux `dist:win`) without a Windows generate
 * ships a .so inside an NSIS installer — DB never opens.
 *
 *   node scripts/check-prisma-engine-for-platform.mjs [win32|darwin|linux]
 */
import { existsSync, readdirSync } from 'fs'
import { join } from 'path'
import { fileURLToPath } from 'url'

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..')
const DIR = join(ROOT, 'src', 'types', 'prisma')
const want = (process.argv[2] || process.platform).toLowerCase()

const patterns = {
  win32: /^query_engine-windows\.dll\.node$/i,
  windows: /^query_engine-windows\.dll\.node$/i,
  darwin: /^libquery_engine-darwin.*\.dylib\.node$/i,
  linux: /^libquery_engine-.*\.so\.node$/i
}
const re = patterns[want]
if (!re) {
  console.error(`Unknown platform '${want}'. Use win32, darwin, or linux.`)
  process.exit(1)
}
if (!existsSync(DIR)) {
  console.error(`Missing ${DIR}. Run npx prisma generate on the target OS.`)
  process.exit(1)
}
const files = readdirSync(DIR)
const hit = files.filter((f) => re.test(f))
if (!hit.length) {
  console.error(
    `No Prisma query engine in src/types/prisma for '${want}'. Found: ${files.filter((f) => /query_engine|libquery_engine/.test(f)).join(', ') || '(none)'}`
  )
  console.error(
    'Generate on the OS you are packaging (release.yml already does this). Do not cross-pack Windows/mac from Linux.'
  )
  process.exit(1)
}
console.log(`Prisma query engine for ${want}: ${hit.join(', ')}`)
