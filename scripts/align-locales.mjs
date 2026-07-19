#!/usr/bin/env node
/**
 * Align all locale files to en.json key set, then fill missing strings.
 *
 * - Remove keys not in en
 * - Add missing keys from en (then translate for non-en)
 * - zh-CN: rebuild from zh-HK via OpenCC
 * - es/hi/ar/pt-BR/fr/ja/ru: Google-translate only keys that are still English source
 *
 *   npm run locales:align
 *   node scripts/align-locales.mjs
 *   node scripts/align-locales.mjs --no-translate   # structure only, fill with English
 */
import {
  LANGS,
  TRANSLATE_TARGETS,
  flatten,
  unflatten,
  loadJson,
  writeJson,
  protect,
  restore,
  loadCache,
  saveCache,
  googleTranslate,
  sleep
} from './locale-utils.mjs'

const noTranslate = process.argv.includes('--no-translate')

async function convertZhCn(zhHkFlat) {
  let convert = null
  try {
    const OpenCC = await import('opencc-js')
    convert = OpenCC.Converter({ from: 'hk', to: 'cn' })
  } catch {
    console.warn('[zh-CN] opencc-js missing — copy zh-HK as-is')
  }
  /** @type {Record<string, string>} */
  const out = {}
  for (const [k, v] of Object.entries(zhHkFlat)) {
    out[k] = convert ? convert(v) : v
  }
  return out
}

async function translateOne(text, gcode) {
  if (!text.trim()) return text
  const { protectedText, tokens } = protect(text)
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      let t = await googleTranslate(protectedText, gcode)
      if (!t) t = protectedText
      return restore(String(t), tokens)
    } catch {
      await sleep(250 * (attempt + 1))
    }
  }
  return text
}

/**
 * Align flat map to master keys; returns { flat, missingKeys, removedKeys }
 */
function alignToMaster(master, current) {
  /** @type {Record<string, string>} */
  const flat = {}
  const missing = []
  for (const k of Object.keys(master)) {
    if (k in current && current[k] != null && String(current[k]).length > 0) {
      flat[k] = String(current[k])
    } else {
      flat[k] = master[k]
      missing.push(k)
    }
  }
  const removed = Object.keys(current).filter((k) => !(k in master))
  return { flat, missing, removed }
}

async function translateMissing(lang, gcode, master, flat, missing) {
  if (noTranslate || missing.length === 0) {
    console.log(`[${lang}] skip translate missing=${missing.length}`)
    return flat
  }
  const cache = loadCache(lang)
  // Prefer cache for missing keys if present and not equal to empty
  /** @type {string[]} */
  const todo = []
  for (const k of missing) {
    if (cache[k] && cache[k] !== master[k]) {
      flat[k] = cache[k]
    } else {
      todo.push(k)
    }
  }
  console.log(
    `[${lang}] translate ${todo.length} (cached fills ${missing.length - todo.length})`
  )

  const CONCURRENCY = 6
  for (let i = 0; i < todo.length; i += CONCURRENCY) {
    const chunk = todo.slice(i, i + CONCURRENCY)
    const results = await Promise.all(
      chunk.map(async (k) => {
        const val = await translateOne(master[k], gcode)
        return [k, val]
      })
    )
    for (const [k, val] of results) {
      flat[k] = val
      cache[k] = val
    }
    if ((i + chunk.length) % 60 === 0 || i + chunk.length >= todo.length) {
      saveCache(lang, cache)
      console.log(`  ${lang} ${Math.min(i + chunk.length, todo.length)}/${todo.length}`)
    }
    await sleep(100)
  }
  // Also refresh cache for all keys
  for (const [k, v] of Object.entries(flat)) {
    cache[k] = v
  }
  saveCache(lang, cache)
  return flat
}

async function main() {
  const en = loadJson('en.json')
  const master = flatten(en)
  console.log(`master en leaves=${Object.keys(master).length}`)

  // Ensure zh-HK is aligned (structure) — keep HK strings
  {
    const cur = flatten(loadJson('zh-HK.json'))
    const { flat, missing, removed } = alignToMaster(master, cur)
    // For missing in zh-HK, prefer leave English temporarily (rare if already aligned)
    writeJson('zh-HK.json', unflatten(flat))
    console.log(
      `zh-HK aligned missing=${missing.length} removed=${removed.length} leaves=${Object.keys(flat).length}`
    )
  }

  // zh-CN from zh-HK
  {
    const zhHk = flatten(loadJson('zh-HK.json'))
    const zhCnFlat = await convertZhCn(zhHk)
    // Ensure every master key exists
    for (const k of Object.keys(master)) {
      if (!zhCnFlat[k]) zhCnFlat[k] = master[k]
    }
    // Drop extras
    for (const k of Object.keys(zhCnFlat)) {
      if (!(k in master)) delete zhCnFlat[k]
    }
    writeJson('zh-CN.json', unflatten(zhCnFlat))
    console.log(`zh-CN leaves=${Object.keys(zhCnFlat).length}`)
  }

  // Other languages
  for (const [lang, gcode] of TRANSLATE_TARGETS) {
    let cur = {}
    try {
      cur = flatten(loadJson(`${lang}.json`))
    } catch {
      cur = {}
    }
    const { flat, missing, removed } = alignToMaster(master, cur)
    console.log(
      `[${lang}] structure missing=${missing.length} removed=${removed.length}`
    )
    // Re-translate every key still identical to English (missing fills + stale leftovers).
    // Skip intentional same-as-en: empty, pure brand tokens, short codes without spaces.
    const staleEn = Object.keys(master).filter((k) => {
      if (flat[k] !== master[k]) return false
      if (missing.includes(k)) return false // already in missing
      const v = master[k]
      if (!v || !String(v).trim()) return false
      // Keep pure product / protocol labels that are meant to stay English
      if (/^(OpenAI|OpenRouter|xAI Grok|Groq|DeepSeek|Mistral|Together AI|Google Gemini|Ollama|LM Studio|HTTP|Kimi|Seedance|Seedream|FFmpeg|API|URL|JSON|CSV|PDF|PNG|JPG|MP4|WebM|SSE|RPC)$/i.test(v.trim())) {
        return false
      }
      if (/^Powered by /i.test(v)) return false
      // Short single-token codes (e.g. "▶ {{time}}s") — still translate if has letters & spaces or long enough
      if (v.length <= 3 && !/[a-zA-Z]{2,}/.test(v)) return false
      return true
    })
    const toFill = [...new Set([...missing, ...staleEn])]
    console.log(`[${lang}] stale-en to translate=${staleEn.length} total=${toFill.length}`)
    const filled = await translateMissing(lang, gcode, master, flat, toFill)
    writeJson(`${lang}.json`, unflatten(filled))
    console.log(`[${lang}] wrote leaves=${Object.keys(filled).length}`)
  }

  // Final verify
  console.log('\n--- verify ---')
  let ok = true
  for (const lang of LANGS) {
    const flat = flatten(loadJson(`${lang}.json`))
    const missing = Object.keys(master).filter((k) => !(k in flat))
    const extra = Object.keys(flat).filter((k) => !(k in master))
    const sameEn =
      lang === 'en'
        ? '-'
        : Object.keys(master).filter((k) => flat[k] === master[k]).length
    console.log(
      `${lang.padEnd(6)} leaves=${Object.keys(flat).length} missing=${missing.length} extra=${extra.length} same_as_en=${sameEn}`
    )
    if (missing.length || extra.length) ok = false
  }
  if (!ok) {
    console.error('ALIGN INCOMPLETE')
    process.exit(1)
  }
  console.log('ALL LOCALES ALIGNED')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
