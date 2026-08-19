import { describe, expect, it, vi } from 'vitest'
import { mkdtempSync, writeFileSync, rmSync, existsSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { ensureTimelineClipStill } from './ensureTimelineClipStill'

describe('ensureTimelineClipStill', () => {
  it('skips when still already exists', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'idm-ens-'))
    const out = join(dir, 'still.png')
    writeFileSync(out, 'png')
    try {
      const generateImage = vi.fn()
      const r = await ensureTimelineClipStill({
        ai: {
          chat: vi.fn(),
          generateImage,
          editImage: vi.fn()
        } as never,
        outputPath: out,
        skipIfExists: true,
        storyTitle: 'T',
        displayIndex: 1,
        fallbackPrompt: 'A cinematic still of the courier in the rain alley at night.'
      })
      expect(r.skipped).toBe(true)
      expect(r.stillPath).toBe(out)
      expect(generateImage).not.toHaveBeenCalled()
      expect(existsSync(out)).toBe(true)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('polishes then writes a still when missing', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'idm-ens2-'))
    const out = join(dir, 'still.png')
    try {
      const r = await ensureTimelineClipStill({
        ai: {
          chat: vi.fn().mockResolvedValue({
            choices: [
              {
                message: {
                  content:
                    'A cinematic night alley still, wet pavement, courier in rain jacket, neon signs, identity lock, no watermark, 16:9.'
                }
              }
            ]
          }),
          generateImage: vi.fn(async () => ({
            b64: Buffer.from('STILL').toString('base64')
          })),
          editImage: vi.fn()
        } as never,
        outputPath: out,
        skipIfExists: true,
        locale: 'en',
        storyTitle: 'T',
        displayIndex: 1,
        fallbackPrompt:
          'A cinematic still of the courier in the rain alley at night.'
      })
      expect(r.skipped).toBe(false)
      expect(r.polished).toBe(true)
      expect(existsSync(out)).toBe(true)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('skips generate when the provider has no image APIs', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'idm-ens3-'))
    const out = join(dir, 'still.png')
    try {
      const r = await ensureTimelineClipStill({
        ai: { chat: vi.fn() } as never,
        outputPath: out,
        skipIfExists: true,
        storyTitle: 'T',
        displayIndex: 1,
        fallbackPrompt:
          'A cinematic still of the courier in the rain alley at night.'
      })
      expect(r.skipped).toBe(true)
      expect(r.stillPath).toBe(out)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
