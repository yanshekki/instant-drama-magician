#!/usr/bin/env node
/**
 * Fail if electron-updater feed URLs do not exist as files, or if installer
 * names contain spaces (GitHub Releases rewrite spaces to dots → 404).
 *
 *   node scripts/verify-update-feed.mjs [releaseDir]
 */
import { existsSync, readdirSync, readFileSync } from 'fs'
import { join } from 'path'

const dir = process.argv[2] || 'release'
if (!existsSync(dir)) {
  console.error(`missing dir ${dir}`)
  process.exit(1)
}

const files = readdirSync(dir)
const ymls = files.filter((f) => f === 'latest.yml' || /^latest-.*\.yml$/.test(f))
if (ymls.length === 0) {
  console.error(`no latest*.yml in ${dir}`)
  process.exit(1)
}

function quoted(value) {
  return value.trim().replace(/^['"]|['"]$/g, '')
}

let failed = false
for (const ymlName of ymls) {
  const text = readFileSync(join(dir, ymlName), 'utf8')
  const urls = [...text.matchAll(/^\s*(?:-\s*)?url:\s*(.+)$/gm)].map((m) =>
    quoted(m[1])
  )
  const paths = [...text.matchAll(/^path:\s*(.+)$/gm)].map((m) => quoted(m[1]))
  const names = [...new Set([...urls, ...paths])]
  if (names.length === 0) {
    console.error(`${ymlName}: no url/path entries`)
    failed = true
    continue
  }
  for (const name of names) {
    if (/\s/.test(name)) {
      console.error(
        `${ymlName}: space in asset name "${name}" (GitHub rewrites spaces; auto-update 404)`
      )
      failed = true
    }
    if (!files.includes(name)) {
      const installers = files.filter((f) =>
        /\.(AppImage|deb|exe|dmg|zip|blockmap|yml)$/i.test(f)
      )
      console.error(`${ymlName}: "${name}" not on disk. have: ${installers.join(', ')}`)
      failed = true
    }
  }
}

for (const f of files) {
  if (/\.(AppImage|exe|dmg)$/i.test(f) && /\s/.test(f)) {
    console.error(`installer filename has space (GitHub 404 risk): ${f}`)
    failed = true
  }
}

if (failed) process.exit(1)
console.log(`update feed filenames OK (${ymls.join(', ')})`)
