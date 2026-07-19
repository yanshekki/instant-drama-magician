import { describe, expect, it, vi } from 'vitest'
import { ProjectBackupService } from './ProjectBackupService'
import { createMockPrisma } from '../../test/mockPrisma'
import { mkdtempSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

describe('ProjectBackupService', () => {
  it('constructs with prisma + media store', () => {
    const prisma = createMockPrisma()
    const media = { mediaRoot: '/tmp', ensureTmpDir: () => undefined }
    const svc = new ProjectBackupService(prisma as never, media as never)
    expect(svc).toBeTruthy()
  })

  it('exportStoryToZip throws for missing story', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'idm-pb-'))
    try {
      const prisma = createMockPrisma()
      ;(prisma.story.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
        null
      )
      const media = {
        mediaRoot: dir,
        ensureTmpDir: () => undefined
      }
      const svc = new ProjectBackupService(prisma as never, media as never)
      await expect(
        svc.exportStoryToZip('missing', join(dir, 'out.zip'))
      ).rejects.toBeTruthy()
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
