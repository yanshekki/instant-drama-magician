import { copyFileSync, existsSync, mkdirSync, unlinkSync } from 'fs'
import { dirname, extname, join } from 'path'

/**
 * Local media layout under a root directory:
 *   {root}/{storyId}/clips/{entryId}.mp4
 *   {root}/{storyId}/exports/...
 *   {root}/refs/...
 */
export class MediaStore {
  constructor(private readonly root: string) {}

  get rootDir(): string {
    return this.root
  }

  storyDir(storyId: string): string {
    return join(this.root, storyId)
  }

  clipsDir(storyId: string): string {
    return join(this.storyDir(storyId), 'clips')
  }

  exportsDir(storyId: string): string {
    return join(this.storyDir(storyId), 'exports')
  }

  ttsDir(storyId: string): string {
    return join(this.storyDir(storyId), 'tts')
  }

  clipPath(storyId: string, entryId: string, ext = '.mp4'): string {
    return join(this.clipsDir(storyId), `${entryId}${ext}`)
  }

  ttsPath(storyId: string, entryId: string, ext = '.wav'): string {
    return join(this.ttsDir(storyId), `${entryId}${ext}`)
  }

  charsDir(storyId: string): string {
    return join(this.storyDir(storyId), 'chars')
  }

  characterSheetPath(storyId: string, characterId: string, ext = '.png'): string {
    return join(this.charsDir(storyId), `${characterId}_sheet${ext}`)
  }

  ensureStoryDirs(storyId: string): void {
    mkdirSync(this.clipsDir(storyId), { recursive: true })
    mkdirSync(this.exportsDir(storyId), { recursive: true })
    mkdirSync(this.ttsDir(storyId), { recursive: true })
    mkdirSync(this.charsDir(storyId), { recursive: true })
  }

  importClip(storyId: string, entryId: string, sourcePath: string): string {
    if (!existsSync(sourcePath)) {
      throw new Error(`Source media not found: ${sourcePath}`)
    }
    this.ensureStoryDirs(storyId)
    const ext = extname(sourcePath) || '.mp4'
    const dest = this.clipPath(storyId, entryId, ext)
    mkdirSync(dirname(dest), { recursive: true })
    copyFileSync(sourcePath, dest)
    return dest
  }

  deleteIfExists(filePath: string): void {
    if (existsSync(filePath)) unlinkSync(filePath)
  }
}
