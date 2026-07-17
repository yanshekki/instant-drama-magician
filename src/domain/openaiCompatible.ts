/**
 * Unified OpenAI-compatible LLM endpoints.
 * Grok-Cli-to-OpenAI-compatible is one preset — same /v1/chat/completions contract.
 */

import {
  GROK_GATEWAY_BASE_URL,
  GROK_GATEWAY_VIDEO_PATH,
  LEGACY_GROK_BASE_URL,
  LEGACY_GROK_VIDEO_PATH,
  adminUrlFromBase
} from './gatewayDefaults'

export type LlmProviderPreset = 'grok-gateway' | 'openai' | 'custom'

export const OPENAI_API_BASE_URL = 'https://api.openai.com/v1'

export interface LlmEndpointFields {
  llmProvider: LlmProviderPreset
  baseUrl: string
  videoPath: string
  model: string
}

export const LLM_PRESET_OPTIONS: Array<{
  id: LlmProviderPreset
  /** i18n key suffix under settings.llmPreset.* */
  labelKey: string
}> = [
  { id: 'grok-gateway', labelKey: 'grokGateway' },
  { id: 'openai', labelKey: 'openai' },
  { id: 'custom', labelKey: 'custom' }
]

/** Apply preset URLs/models. Custom leaves URLs as-is (only sets provider tag). */
export function applyLlmPreset<T extends LlmEndpointFields>(
  settings: T,
  preset: LlmProviderPreset
): T {
  if (preset === 'grok-gateway') {
    return {
      ...settings,
      llmProvider: 'grok-gateway',
      baseUrl: GROK_GATEWAY_BASE_URL,
      videoPath: GROK_GATEWAY_VIDEO_PATH,
      model:
        !settings.model?.trim() ||
        settings.model.startsWith('gpt-') ||
        settings.model === 'grok-cli'
          ? 'grok-4.5'
          : settings.model
    }
  }
  if (preset === 'openai') {
    return {
      ...settings,
      llmProvider: 'openai',
      baseUrl: OPENAI_API_BASE_URL,
      // OpenAI has no /videos — keep path empty-ish under base for clarity
      videoPath: `${OPENAI_API_BASE_URL}/videos`,
      model:
        !settings.model.trim() ||
        settings.model === 'grok-cli' ||
        settings.model === 'grok-4.5' ||
        settings.model.startsWith('grok-')
          ? 'gpt-4o-mini'
          : settings.model
    }
  }
  return { ...settings, llmProvider: 'custom' }
}

export function inferLlmPreset(baseUrl: string): LlmProviderPreset {
  const n = normalize(baseUrl)
  if (
    n === normalize(GROK_GATEWAY_BASE_URL) ||
    n === normalize(LEGACY_GROK_BASE_URL) ||
    n.includes('127.0.0.1:3847') ||
    n.includes('localhost:3847') ||
    n.includes('127.0.0.1:39281')
  ) {
    return 'grok-gateway'
  }
  if (
    n === normalize(OPENAI_API_BASE_URL) ||
    n.includes('api.openai.com')
  ) {
    return 'openai'
  }
  return 'custom'
}

export function llmPresetHintKey(preset: LlmProviderPreset): string {
  if (preset === 'grok-gateway') return 'llmHintGrok'
  if (preset === 'openai') return 'llmHintOpenAI'
  return 'llmHintCustom'
}

export function supportsLocalAdmin(preset: LlmProviderPreset): boolean {
  return preset === 'grok-gateway'
}

export function supportsOpenAiVideosPath(preset: LlmProviderPreset): boolean {
  // Only local Grok gateway implements /v1/videos in our stack
  return preset === 'grok-gateway' || preset === 'custom'
}

export { adminUrlFromBase, LEGACY_GROK_VIDEO_PATH }

function normalize(url: string): string {
  return url.trim().replace(/\/+$/, '').toLowerCase()
}
