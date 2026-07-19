#!/usr/bin/env node
/**
 * Generate UI locale JSON from en.json / zh-HK.json (Node only).
 *
 * - zh-CN: OpenCC hk → cn (if opencc-js installed), else copy structure from en keys + zh-HK leave unconverted with warning
 * - es, hi, ar, pt-BR, fr, ja, ru: Google Translate free API (preserves {{vars}})
 *
 *   npm run locales:generate
 *   node scripts/generate-locales.mjs
 *   node scripts/generate-locales.mjs --zh-cn-only
 *   node scripts/generate-locales.mjs --lang=ja
 */
import {
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

const SKIP_AS_IS = new Set([
  'OK',
  'FFmpeg',
  'API',
  'BGM',
  'TTS',
  'HTTP',
  'URL',
  'JSON',
  'LLM',
  'YSK',
  'Grok',
  'OpenAI'
])

const args = process.argv.slice(2)
const zhCnOnly = args.includes('--zh-cn-only')
const langArg = args.find((a) => a.startsWith('--lang='))
const onlyLang = langArg ? langArg.slice('--lang='.length) : null

async function convertZhCn(zhHkFlat) {
  let convert = null
  try {
    const OpenCC = await import('opencc-js')
    // hk (Traditional Hong Kong) → cn (Simplified)
    convert = OpenCC.Converter({ from: 'hk', to: 'cn' })
  } catch {
    try {
      // fallback package name variants
      const OpenCC = await import('opencc-js/core')
      convert = OpenCC.Converter({ from: 'hk', to: 'cn' })
    } catch {
      console.warn(
        '[zh-CN] opencc-js not available — installing is recommended: npm i -D opencc-js'
      )
    }
  }
  /** @type {Record<string, string>} */
  const out = {}
  for (const [k, v] of Object.entries(zhHkFlat)) {
    out[k] = convert ? convert(v) : v
  }
  return out
}

async function translateOne(text, gcode) {
  if (!text.trim() || SKIP_AS_IS.has(text)) return text
  const { protectedText, tokens } = protect(text)
  let lastErr = null
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      let t = await googleTranslate(protectedText, gcode)
      if (!t) t = protectedText
      t = restore(String(t), tokens)
      return t
    } catch (e) {
      lastErr = e
      await sleep(300 * (attempt + 1))
    }
  }
  console.warn('  translate fail:', lastErr?.message || lastErr)
  return text
}

async function doLang(lang, gcode, enFlat) {
  const cache = loadCache(lang)
  /** @type {Record<string, string>} */
  const out = { ...cache }
  const todo = Object.keys(enFlat).filter((k) => !out[k])
  console.log(
    `START ${lang} todo=${todo.length} cached=${Object.keys(enFlat).length - todo.length}`
  )

  const CONCURRENCY = 8
  let done = 0
  for (let i = 0; i < todo.length; i += CONCURRENCY) {
    const chunk = todo.slice(i, i + CONCURRENCY)
    const results = await Promise.all(
      chunk.map(async (k) => {
        const val = await translateOne(enFlat[k], gcode)
        return [k, val]
      })
    )
    for (const [k, val] of results) {
      out[k] = val
    }
    done += chunk.length
    if (done % 80 === 0 || done === todo.length) {
      saveCache(lang, out)
      console.log(`  ${lang} ${done}/${todo.length}`)
    }
    await sleep(120)
  }

  for (const [k, v] of Object.entries(enFlat)) {
    if (!out[k]) out[k] = v
  }
  saveCache(lang, out)
  writeJson(`${lang}.json`, unflatten(out))
  console.log(`DONE ${lang} leaves=${Object.keys(out).length}`)
  return Object.keys(out).length
}

async function main() {
  const en = loadJson('en.json')
  const zhHk = loadJson('zh-HK.json')
  const enFlat = flatten(en)
  const zhHkFlat = flatten(zhHk)

  // zh-CN from zh-HK
  const zhCnFlat = await convertZhCn(zhHkFlat)
  writeJson('zh-CN.json', unflatten(zhCnFlat))
  console.log('wrote zh-CN.json', Object.keys(zhCnFlat).length)

  if (zhCnOnly) {
    console.log('ALL OK (--zh-cn-only)')
    return
  }

  const targets = onlyLang
    ? TRANSLATE_TARGETS.filter(([lang]) => lang === onlyLang)
    : TRANSLATE_TARGETS

  if (onlyLang && targets.length === 0) {
    console.error(`Unknown --lang=${onlyLang}`)
    process.exit(1)
  }

  // Parallel languages (limited)
  const queue = [...targets]
  const workers = Math.min(3, queue.length)
  async function worker() {
    while (queue.length) {
      const item = queue.shift()
      if (!item) break
      const [lang, gcode] = item
      await doLang(lang, gcode, enFlat)
    }
  }
  await Promise.all(Array.from({ length: workers }, () => worker()))

  console.log('ALL OK')
  for (const name of [
    'en',
    'zh-HK',
    'zh-CN',
    ...TRANSLATE_TARGETS.map(([l]) => l)
  ]) {
    try {
      const n = Object.keys(flatten(loadJson(`${name}.json`))).length
      console.log(name, n)
    } catch {
      console.log(name, 'MISSING')
    }
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
