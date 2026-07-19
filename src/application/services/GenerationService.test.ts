import { describe, expect, it, vi } from 'vitest'
import { GenerationService } from './GenerationService'
import { createMockPrisma } from '../../test/mockPrisma'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

describe('GenerationService', () => {
  it('cancel is safe when idle', () => {
    const dir = mkdtempSync(join(tmpdir(), 'idm-gen-'))
    try {
      const prisma = createMockPrisma()
      const settings = {
        aspectRatio: '16:9',
        imageSizeWide: '1792x1024'
      }
      const ai = {
        getStatus: vi.fn().mockResolvedValue({ available: false, message: 'off' }),
        chat: vi.fn(),
        generateImage: vi.fn(),
        generateVideo: vi.fn()
      }
      // constructor(prisma, ai, { mediaRoot, settings })
      const svc = new GenerationService(prisma as never, ai as never, {
        mediaRoot: dir,
        settings: settings as never
      })
      expect(() => svc.cancel()).not.toThrow()
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
