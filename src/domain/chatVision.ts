/**
 * Multimodal (vision) helpers for AI fill — attach local stills as data URLs.
 */
import { existsSync, readFileSync } from 'fs'
import { extname } from 'path'
import type { ChatContentPart } from '../types/domain'

export function resolveReadableImagePath(
  path: string | null | undefined
): string | null {
  if (typeof path !== 'string') return null
  const p = path.trim()
  if (!p || !existsSync(p)) return null
  return p
}

export function imagePathToDataUrl(filePath: string): string | null {
  try {
    const buf = readFileSync(filePath)
    const ext = extname(filePath).toLowerCase()
    const mime =
      ext === '.jpg' || ext === '.jpeg'
        ? 'image/jpeg'
        : ext === '.webp'
          ? 'image/webp'
          : ext === '.gif'
            ? 'image/gif'
            : 'image/png'
    return `data:${mime};base64,${buf.toString('base64')}`
  } catch {
    return null
  }
}

/**
 * OpenAI-compatible user content: plain text, or text + image when path is readable.
 */
export function buildVisionUserContent(
  textPrompt: string,
  referenceImagePath?: string | null
): string | ChatContentPart[] {
  const path = resolveReadableImagePath(referenceImagePath)
  if (!path) return textPrompt
  const dataUrl = imagePathToDataUrl(path)
  if (!dataUrl) return textPrompt
  return [
    { type: 'text', text: textPrompt },
    { type: 'image_url', image_url: { url: dataUrl } }
  ]
}

export function visionFillUserPreamble(
  locale: 'zh-HK' | 'en',
  kind: 'character' | 'scene' | 'prop' | 'action' | 'costume'
): string {
  if (locale === 'en') {
    const what =
      kind === 'character'
        ? 'character identity (name, appearance, costume, age, gender, tags)'
        : kind === 'scene'
          ? 'location profile (title, description, lighting, mood, set dressing, tags)'
          : kind === 'prop'
            ? 'prop profile (name, description, material, size, condition, tags)'
            : kind === 'action'
              ? 'action profile (name, description, motion, intention, camera notes, tags)'
              : 'wardrobe (name, full costume description)'
    return `A reference still is attached. Fill ALL profile fields for this ${what} primarily FROM THE IMAGE. Optionally refine with any idea/draft text.`
  }
  const what =
    kind === 'character'
      ? '角色（名稱、外貌、戲服、年齡、性別、標籤等）'
      : kind === 'scene'
        ? '場景（標題、描述、光影、氣氛、佈景、標籤等）'
        : kind === 'prop'
          ? '道具（名稱、描述、材質、尺寸、狀態、標籤等）'
          : kind === 'action'
            ? '動作（名稱、說明、節奏、意圖、鏡頭備註、標籤等）'
            : '戲服（名稱、完整造型描述）'
  return `已附上參考靜圖。請主要根據圖片填寫此${what}全部欄位；可結合構思／草稿潤飾。`
}
