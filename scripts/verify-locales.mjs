#!/usr/bin/env node
/**
 * Verify all UI locales have identical leaf key sets (vs en.json).
 *
 *   node scripts/verify-locales.mjs
 *   npm run locales:verify
 */
import { LANGS, loadJson, flatten } from './locale-utils.mjs'

function main() {
  const base = flatten(loadJson('en.json'))
  let ok = true
  for (const lang of LANGS) {
    let flat
    try {
      flat = flatten(loadJson(`${lang}.json`))
    } catch {
      console.log(`MISSING FILE ${lang}`)
      ok = false
      continue
    }
    const missing = [...Object.keys(base)].filter((k) => !(k in flat)).sort()
    const extra = [...Object.keys(flat)].filter((k) => !(k in base)).sort()
    const sameEn =
      lang === 'en'
        ? '-'
        : Object.entries(flat).filter(
            ([k, v]) => k in base && v === base[k]
          ).length
    console.log(
      `${lang.padEnd(6)} leaves=${Object.keys(flat).length} missing=${missing.length} extra=${extra.length} same_as_en=${sameEn}`
    )
    if (missing.length) {
      console.log('  missing sample:', missing.slice(0, 8))
      ok = false
    }
    if (extra.length) {
      console.log('  extra sample:', extra.slice(0, 8))
    }
  }
  process.exit(ok ? 0 : 1)
}

main()
