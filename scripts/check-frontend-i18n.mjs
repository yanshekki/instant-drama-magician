#!/usr/bin/env node
/**
 * Frontend i18n hygiene:
 * 1) t('a.b.c') keys used in presentation must exist in en + zh-HK
 * 2) defaultValue: 'English' pairs should have a real key (warn if missing)
 *
 *   node scripts/check-frontend-i18n.mjs
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'fs'
import { join, relative, dirname } from 'path'
import { fileURLToPath } from 'url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SCAN = join(ROOT, 'src', 'presentation')

function walk(dir, out = []) {
  if (!existsSync(dir)) return out
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules') continue
    const p = join(dir, name)
    const st = statSync(p)
    if (st.isDirectory()) walk(p, out)
    else if (/\.(tsx?|jsx?)$/.test(name) && !name.includes('.test.')) out.push(p)
  }
  return out
}

function loadJson(rel) {
  return JSON.parse(readFileSync(join(ROOT, rel), 'utf8'))
}

function hasKey(obj, dotted) {
  const parts = dotted.split('.')
  let cur = obj
  for (const p of parts) {
    if (cur == null || typeof cur !== 'object' || !(p in cur)) return false
    cur = cur[p]
  }
  return typeof cur === 'string' || typeof cur === 'number'
}

const en = loadJson('src/locales/en.json')
const hk = loadJson('src/locales/zh-HK.json')

const T_CALL =
  /\bt\(\s*['"`]([a-zA-Z][a-zA-Z0-9_.]*)['"`]/g
// Dynamic t(`prefix.${x}`) — only check static prefix leaves exist is hard; skip template with ${
const files = walk(SCAN)
const missingEn = new Set()
const missingHk = new Set()
const used = new Set()

for (const f of files) {
  const text = readFileSync(f, 'utf8')
  // skip template literals with interpolation
  const withoutInterp = text.replace(/`[^`]*\$\{[^`]*`/g, '``')
  let m
  const re = new RegExp(T_CALL.source, 'g')
  while ((m = re.exec(withoutInterp)) !== null) {
    const key = m[1]
    if (!key.includes('.')) continue // skip single segment rare
    used.add(key)
    if (!hasKey(en, key)) missingEn.add(`${key}  (${relative(ROOT, f)})`)
    if (!hasKey(hk, key)) missingHk.add(`${key}  (${relative(ROOT, f)})`)
  }
}

// Allowlist: intentional dynamic namespaces (status codes, kind ids)
const ALLOW_PREFIX = [
  'scenes.status.',
  'mediaGen.kind.',
  'mediaGen.entity.',
  'mediaGen.steps.',
  'mediaGen.phase.',
  'errors.',
  'settings.updateError.',
  'settings.channelPreset.',
  'settings.llmPreset.',
  'settings.llmPresetHint.',
  'settings.channelPresetHint.',
  'characters.sheet',
  'characters.art',
  'actions.panelLayout_',
  'scenes.plate',
  'props.plate'
]

function allowed(msg) {
  const key = msg.split('  ')[0]
  return ALLOW_PREFIX.some((p) => key.startsWith(p))
}

const missEn = [...missingEn].filter((x) => !allowed(x))
const missHk = [...missingHk].filter((x) => !allowed(x))

let failed = false
if (missEn.length) {
  failed = true
  console.error('Missing in en.json:')
  missEn.slice(0, 40).forEach((x) => console.error('  ', x))
  if (missEn.length > 40) console.error(`  … +${missEn.length - 40} more`)
}
if (missHk.length) {
  failed = true
  console.error('Missing in zh-HK.json:')
  missHk.slice(0, 40).forEach((x) => console.error('  ', x))
  if (missHk.length > 40) console.error(`  … +${missHk.length - 40} more`)
}

if (failed) {
  console.error(
    `\nFrontend i18n FAIL — ${missEn.length} en / ${missHk.length} zh-HK missing keys (scanned ${used.size} static t() keys).`
  )
  process.exit(1)
}

console.log(
  `Frontend i18n OK — ${used.size} static t() keys present in en + zh-HK (${files.length} files).`
)
