#!/usr/bin/env node
/**
 * Ensure every English .md has a -ZH peer with the same basename rule.
 * Root: README.md ↔ README-ZH.md
 * docs/*.md ↔ docs/*-ZH.md (except *-ZH.md themselves)
 */
import { readdirSync, existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
let errors = 0
function fail(msg) {
  console.error('FAIL:', msg)
  errors++
}

const rootEn = join(root, 'README.md')
const rootZh = join(root, 'README-ZH.md')
if (!existsSync(rootEn) || !existsSync(rootZh)) fail('README.md / README-ZH.md missing')
else {
  for (const f of [rootEn, rootZh]) {
    const t = readFileSync(f, 'utf8')
    for (let i = 1; i <= 6; i++) {
      if (!t.includes(`screen/${i}.png`)) fail(`${f} missing screen ${i}`)
    }
  }
}

function checkDir(dir, files) {
  for (const name of files) {
    if (!name.endsWith('.md') || name.endsWith('-ZH.md')) continue
    const zh = name.replace(/\.md$/, '-ZH.md')
    if (!files.includes(zh)) fail(`${dir}/${name} missing peer ${zh}`)
  }
}

checkDir('docs', readdirSync(join(root, 'docs')))
checkDir('resources', readdirSync(join(root, 'resources')))
checkDir('skills/idm', readdirSync(join(root, 'skills/idm')))

if (errors) {
  console.error(`\n${errors} error(s)`)
  process.exit(1)
}
console.log('OK: bilingual doc pairs present; README screens 1–6 embedded')
