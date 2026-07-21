import { describe, expect, it, vi } from 'vitest'
import { mkdtempSync, writeFileSync, readFileSync, rmSync, existsSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { generateVideoStillKeyframe } from './generateVideoStill'

describe('generateVideoStillKeyframe', () => {
  it('generateImage path writes still and seals hard rules', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'idm-still-'))
    const out = join(dir, 'still.png')
    try {
      const ai = {
        generateImage: vi.fn(async () => ({
          b64: Buffer.from('PNGDATA').toString('base64')
        })),
        editImage: vi.fn()
      }
      const store = { ensureLibraryDirs: vi.fn() }
      const r = await generateVideoStillKeyframe({
        ai,
        store: store as never,
        professionalPrompt: 'IDENTITY LOCK: face',
        hardRules: 'NO watermark',
        outputPath: out,
        locale: 'en'
      })
      expect(store.ensureLibraryDirs).toHaveBeenCalled()
      expect(ai.generateImage).toHaveBeenCalled()
      expect(ai.editImage).not.toHaveBeenCalled()
      expect(r.stillPath).toBe(out)
      expect(r.stillPromptUsed).toMatch(/KEYFRAME|IDENTITY|HARD|watermark/i)
      expect(existsSync(out)).toBe(true)
      expect(readFileSync(out).toString()).toBe('PNGDATA')
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('editImage when source still exists', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'idm-still-e-'))
    const src = join(dir, 'src.png')
    const out = join(dir, 'out.png')
    writeFileSync(src, 'src')
    try {
      const ai = {
        generateImage: vi.fn(),
        editImage: vi.fn(async () => ({
          b64: Buffer.from('EDIT').toString('base64')
        }))
      }
      const r = await generateVideoStillKeyframe({
        ai,
        store: { ensureLibraryDirs: vi.fn() } as never,
        professionalPrompt: 'PRO',
        sourceImagePath: src,
        improvementNotes: 'warmer',
        outputPath: out,
        aspectRatio: '9:16',
        size: '720x1280'
      })
      expect(ai.editImage).toHaveBeenCalledWith(
        expect.objectContaining({
          imagePath: src,
          aspectRatio: '9:16',
          size: '720x1280'
        })
      )
      expect(r.stillPromptUsed).toMatch(/warmer|KEYFRAME/i)
      expect(readFileSync(out).toString()).toBe('EDIT')
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('falls back to generate when source path missing', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'idm-still-m-'))
    const out = join(dir, 'out.png')
    try {
      const ai = {
        generateImage: vi.fn(async () => ({
          b64: Buffer.from('G').toString('base64')
        })),
        editImage: vi.fn()
      }
      await generateVideoStillKeyframe({
        ai,
        store: { ensureLibraryDirs: vi.fn() } as never,
        professionalPrompt: 'PRO',
        sourceImagePath: join(dir, 'missing.png'),
        outputPath: out
      })
      expect(ai.generateImage).toHaveBeenCalled()
      expect(ai.editImage).not.toHaveBeenCalled()
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
