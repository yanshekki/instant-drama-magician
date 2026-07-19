/**
 * Shared helpers for locale generate / verify (Node only).
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
export const ROOT = join(__dirname, '..')
export const LOCALE_DIR = join(ROOT, 'src', 'locales')
export const CACHE_DIR = join(ROOT, '.locale-cache')

export const LANGS = [
  'en',
  'zh-HK',
  'zh-CN',
  'es',
  'hi',
  'ar',
  'pt-BR',
  'fr',
  'ja',
  'ru'
]

/** Google Translate free endpoint target codes */
export const TRANSLATE_TARGETS = [
  ['es', 'es'],
  ['hi', 'hi'],
  ['ar', 'ar'],
  ['pt-BR', 'pt'],
  ['fr', 'fr'],
  ['ja', 'ja'],
  ['ru', 'ru']
]

const PLACEHOLDER_RE = /(\{\{[^}]+\}\}|\{[a-zA-Z0-9_]+\})/g

export function loadJson(name) {
  return JSON.parse(readFileSync(join(LOCALE_DIR, name), 'utf8'))
}

export function writeJson(name, data) {
  writeFileSync(
    join(LOCALE_DIR, name),
    JSON.stringify(data, null, 2) + '\n',
    'utf8'
  )
}

export function flatten(d, prefix = '') {
  /** @type {Record<string, string>} */
  const out = {}
  for (const [k, v] of Object.entries(d)) {
    const key = prefix ? `${prefix}.${k}` : k
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      Object.assign(out, flatten(v, key))
    } else {
      out[key] = String(v ?? '')
    }
  }
  return out
}

export function unflatten(flat) {
  const root = {}
  for (const [key, val] of Object.entries(flat)) {
    const parts = key.split('.')
    let cur = root
    for (let i = 0; i < parts.length - 1; i++) {
      const p = parts[i]
      if (!cur[p] || typeof cur[p] !== 'object') cur[p] = {}
      cur = cur[p]
    }
    cur[parts[parts.length - 1]] = val
  }
  return root
}

export function protect(s) {
  /** @type {string[]} */
  const tokens = []
  const protectedText = s.replace(PLACEHOLDER_RE, (m) => {
    tokens.push(m)
    return `__PH${tokens.length - 1}__`
  })
  return { protectedText, tokens }
}

export function restore(s, tokens) {
  let out = s
  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i]
    for (const variant of [
      `__PH${i}__`,
      `__ph${i}__`,
      `__PH ${i}__`,
      `[[${i}]]`,
      `[${i}]`
    ]) {
      if (out.includes(variant)) {
        out = out.split(variant).join(tok)
        break
      }
    }
    if (!out.includes(tok)) {
      out = `${out} ${tok}`.trim()
    }
  }
  return out
}

export function ensureCacheDir() {
  if (!existsSync(CACHE_DIR)) mkdirSync(CACHE_DIR, { recursive: true })
}

export function loadCache(lang) {
  ensureCacheDir()
  const p = join(CACHE_DIR, `${lang}.json`)
  if (!existsSync(p)) return {}
  try {
    return JSON.parse(readFileSync(p, 'utf8'))
  } catch {
    return {}
  }
}

export function saveCache(lang, cache) {
  ensureCacheDir()
  writeFileSync(
    join(CACHE_DIR, `${lang}.json`),
    JSON.stringify(cache, null, 0),
    'utf8'
  )
}

/**
 * Free Google Translate (same approach many CLI tools use).
 * @param {string} text
 * @param {string} targetLang e.g. es, ja, pt
 */
export async function googleTranslate(text, targetLang) {
  const url =
    'https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=' +
    encodeURIComponent(targetLang) +
    '&dt=t&q=' +
    encodeURIComponent(text)
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`translate HTTP ${res.status}`)
  }
  const data = await res.json()
  if (!Array.isArray(data?.[0])) return text
  return data[0].map((row) => row?.[0] ?? '').join('')
}

export async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}
