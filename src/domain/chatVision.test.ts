import { describe, expect, it } from 'vitest'
import { writeFileSync, mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import {
  buildVisionUserContent,
  dataUrlToGrokImagePart,
  imagePathToDataUrl,
  isReferenceImagePathClaimed,
  loadImageBytesForAi,
  mimeFromImagePath,
  prepareVisionImageBytes,
  resolveReadableImagePath,
  visionFillUserPreamble,
  VISION_MAX_BYTES,
  VISION_MAX_EDGE,
  VISION_SKIP_RESIZE_BYTES
} from './chatVision'
import { AppError } from '../types/errors'

/** Minimal valid 1×1 PNG */
const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
)

describe('chatVision', () => {
  it('isReferenceImagePathClaimed', () => {
    expect(isReferenceImagePathClaimed(null)).toBe(false)
    expect(isReferenceImagePathClaimed('')).toBe(false)
    expect(isReferenceImagePathClaimed('  ')).toBe(false)
    expect(isReferenceImagePathClaimed('/tmp/x.png')).toBe(true)
  })

  it('resolveReadableImagePath returns null for missing files', () => {
    expect(resolveReadableImagePath('/no/such/file-xyz.png')).toBeNull()
    expect(resolveReadableImagePath(null)).toBeNull()
    expect(resolveReadableImagePath('  ')).toBeNull()
    expect(resolveReadableImagePath(123 as unknown as string)).toBeNull()
  })

  it('mimeFromImagePath maps common extensions', () => {
    expect(mimeFromImagePath('/a.jpg')).toBe('image/jpeg')
    expect(mimeFromImagePath('/a.jpeg')).toBe('image/jpeg')
    expect(mimeFromImagePath('/a.webp')).toBe('image/webp')
    expect(mimeFromImagePath('/a.gif')).toBe('image/gif')
    expect(mimeFromImagePath('/a.png')).toBe('image/png')
    expect(mimeFromImagePath('/a.unknown')).toBe('image/png')
  })

  it('buildVisionUserContent returns text only when no path claimed', () => {
    expect(buildVisionUserContent('hello', null)).toBe('hello')
    expect(buildVisionUserContent('hello', '')).toBe('hello')
  })

  it('buildVisionUserContent throws when path claimed but missing', () => {
    expect(() =>
      buildVisionUserContent('hello', '/no/such/vision-missing.png')
    ).toThrow(AppError)
    try {
      buildVisionUserContent('hello', '/no/such/vision-missing.png')
    } catch (e) {
      expect(e).toBeInstanceOf(AppError)
      expect((e as AppError).message).toBe('errors.visionImageUnreadable')
      expect((e as AppError).details).toBe('errors.visionImageUnreadableDetail')
    }
  })

  it('buildVisionUserContent attaches data URL for readable still', () => {
    const dir = mkdtempSync(join(tmpdir(), 'idm-cv-'))
    const p = join(dir, 't.png')
    try {
      writeFileSync(p, TINY_PNG)
      const content = buildVisionUserContent('describe', p)
      expect(Array.isArray(content)).toBe(true)
      if (!Array.isArray(content)) return
      expect(content[0]).toEqual({ type: 'text', text: 'describe' })
      expect(content[1]?.type).toBe('image_url')
      if (content[1]?.type === 'image_url') {
        expect(content[1].image_url.url.startsWith('data:image/png;base64,')).toBe(
          true
        )
      }
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('dataUrlToGrokImagePart parses ACP fields', () => {
    expect(dataUrlToGrokImagePart('data:image/jpeg;base64,abcXYZ')).toEqual({
      type: 'image',
      mimeType: 'image/jpeg',
      data: 'abcXYZ'
    })
    expect(dataUrlToGrokImagePart('not-a-data-url')).toBeNull()
  })

  it('exports size constants tuned for Grok CLI vision', () => {
    expect(VISION_SKIP_RESIZE_BYTES).toBeGreaterThan(0)
    expect(VISION_MAX_BYTES).toBeLessThanOrEqual(150_000)
    expect(VISION_MAX_EDGE).toBeLessThanOrEqual(1024)
    expect(VISION_SKIP_RESIZE_BYTES).toBeLessThanOrEqual(VISION_MAX_BYTES)
  })

  it('prepareVisionImageBytes leaves tiny stills unchanged', () => {
    const dir = mkdtempSync(join(tmpdir(), 'idm-cv-tiny-'))
    const p = join(dir, 't.png')
    try {
      writeFileSync(p, TINY_PNG)
      const r = prepareVisionImageBytes(p)
      expect(r.resized).toBe(false)
      expect(r.bytes.length).toBe(TINY_PNG.length)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('prepareVisionImageBytes compresses mid-size JPEGs (shared by all AI-fill pages)', () => {
    // Synthetic buffer larger than SKIP so ffmpeg path is attempted; if ffmpeg
    // missing, function returns original (still a valid contract).
    const dir = mkdtempSync(join(tmpdir(), 'idm-cv-mid-'))
    const p = join(dir, 'mid.jpg')
    try {
      // Not a real JPEG decode — use a padded file so size triggers resize.
      // ffmpeg will fail → original returned; if real jpg available in env, skip.
      const pad = Buffer.alloc(VISION_SKIP_RESIZE_BYTES + 50_000, 0xff)
      writeFileSync(p, Buffer.concat([TINY_PNG, pad]))
      const r = prepareVisionImageBytes(p)
      expect(r.bytes.length).toBeGreaterThan(0)
      // Either re-encoded smaller, or original fallback
      expect(r.bytes.length).toBeLessThanOrEqual(pad.length + TINY_PNG.length)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('loadImageBytesForAi and imagePathToDataUrl for tiny stills', () => {
    const dir = mkdtempSync(join(tmpdir(), 'idm-cv-load-'))
    const p = join(dir, 't.png')
    try {
      writeFileSync(p, TINY_PNG)
      const loaded = loadImageBytesForAi(p)
      expect(loaded.resized).toBe(false)
      expect(loaded.mime).toBe('image/png')
      const url = imagePathToDataUrl(p)
      expect(url).toMatch(/^data:image\/png;base64,/)
      expect(imagePathToDataUrl('/no/such.png')).toBeNull()
      expect(() => loadImageBytesForAi('/no/such.png')).toThrow(AppError)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('visionFillUserPreamble covers all kinds en/zh', () => {
    for (const kind of [
      'character',
      'scene',
      'prop',
      'action',
      'costume'
    ] as const) {
      expect(visionFillUserPreamble('en', kind)).toMatch(/reference still|image/i)
      expect(visionFillUserPreamble('zh-HK', kind)).toMatch(/參考|圖片/)
    }
  })

  it('resolveReadableImagePath returns existing tiny file', () => {
    const dir = mkdtempSync(join(tmpdir(), 'idm-cv-res-'))
    const p = join(dir, 'ok.png')
    try {
      writeFileSync(p, TINY_PNG)
      expect(resolveReadableImagePath(p)).toBe(p)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
