/**
 * LLM polish for media gen prep: multi-vision chat → one technical image prompt.
 */
import type { AIProvider } from '../../types/domain'
import { chatContentText } from '../../types/domain'
import {
  buildMediaGenPolishSystemPrompt,
  buildMediaGenPolishUserText,
  extractPolishedMediaPrompt,
  includedMaterialImagePaths,
  type MediaGenKind,
  type MediaGenMaterialSection
} from '../../domain/mediaGenPrep'
import { buildMultiVisionUserContent } from '../../domain/chatVision'
import { ensureHardRules } from '../../domain/promptHardRules'
import { AppError } from '../../types/errors'

export async function polishMediaGenPrompt(options: {
  ai: AIProvider
  locale?: 'zh-HK' | 'en'
  kind: MediaGenKind
  includedSections: MediaGenMaterialSection[]
  taskHint?: string
  /** Template prompt if LLM fails or returns too short. */
  fallbackPrompt: string
  hardRules?: string | null
  maxTokens?: number
  signal?: AbortSignal
}): Promise<{ prompt: string; polished: boolean; imageCount: number }> {
  const locale = options.locale ?? 'zh-HK'
  const fallback = options.fallbackPrompt.trim()
  if (!fallback) {
    throw new AppError('VALIDATION', 'errors.fallbackPromptRequired')
  }
  if (options.signal?.aborted) {
    throw new AppError('CANCELLED', 'errors.cancelled')
  }

  const seal = (prompt: string): string =>
    ensureHardRules(prompt, options.hardRules)

  const imagePaths = includedMaterialImagePaths(options.includedSections)
  const userText = buildMediaGenPolishUserText({
    kind: options.kind,
    locale,
    includedSections: options.includedSections,
    taskHint: options.taskHint
  })

  let userContent: string | ReturnType<typeof buildMultiVisionUserContent> =
    userText
  try {
    if (imagePaths.length > 0) {
      userContent = buildMultiVisionUserContent(userText, imagePaths)
    }
  } catch {
    // Fall back to text-only polish if images unreadable
    userContent = userText
  }

  try {
    const completion = await options.ai.chat({
      messages: [
        {
          role: 'system',
          content: buildMediaGenPolishSystemPrompt(locale)
        },
        { role: 'user', content: userContent }
      ],
      max_tokens: options.maxTokens ?? 1200
    })
    if (options.signal?.aborted) {
      throw new AppError('CANCELLED', 'errors.cancelled')
    }
    const raw = chatContentText(completion.choices[0]?.message?.content)
    const extracted = extractPolishedMediaPrompt(raw)
    if (extracted.length >= 40) {
      return {
        prompt: seal(extracted),
        polished: true,
        imageCount: imagePaths.length
      }
    }
  } catch (e) {
    if (e instanceof AppError && e.code === 'CANCELLED') throw e
    /* use fallback */
  }

  return {
    prompt: seal(fallback),
    polished: false,
    imageCount: imagePaths.length
  }
}
