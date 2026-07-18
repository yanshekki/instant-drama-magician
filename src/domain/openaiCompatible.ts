/**
 * OpenAI-compatible LLM endpoints catalog.
 * Chat uses POST {baseUrl}/chat/completions for every preset.
 * Image/video full pipeline is first-class on Grok Gateway only.
 */

import {
  GROK_GATEWAY_BASE_URL,
  GROK_GATEWAY_VIDEO_PATH,
  LEGACY_GROK_BASE_URL,
  LEGACY_GROK_VIDEO_PATH,
  adminUrlFromBase
} from './gatewayDefaults'

export type LlmProviderPreset =
  | 'grok-gateway'
  | 'openai'
  | 'openrouter'
  | 'xai'
  | 'groq'
  | 'deepseek'
  | 'mistral'
  | 'together'
  | 'google-openai'
  | 'ollama'
  | 'lmstudio'
  | 'custom'

export type LlmProviderGroup = 'recommended' | 'cloud' | 'local' | 'advanced'

export interface ProviderCaps {
  chat: boolean
  /** Native image API expected in this app stack */
  image: boolean
  /** Native /v1/videos (Grok gateway style) */
  video: boolean
}

export interface LlmPresetDef {
  id: LlmProviderPreset
  group: LlmProviderGroup
  /** i18n: settings.llmPreset.<labelKey> */
  labelKey: string
  /** i18n: settings.llmPresetHint.<labelKey> */
  hintKey: string
  baseUrl: string
  defaultModel: string
  docsUrl: string
  caps: ProviderCaps
  /** true = API key optional (local servers) */
  keyOptional?: boolean
  /** Host fingerprint fragments for inferLlmPreset */
  match?: string[]
}

export const OPENAI_API_BASE_URL = 'https://api.openai.com/v1'

/**
 * caps.image / caps.video = works with THIS app’s HTTP clients:
 * - image: POST {base}/images/generations|edits (OpenAI Images API shape)
 * - video: OpenAI-style /videos create+poll (GrokHttpVideoProvider), not xAI /videos/generations
 *
 * Research notes (2026-07):
 * - grok-gateway: full pipeline (chat + images + videos)
 * - openai: Images API + Videos/Sora API (/v1/videos)
 * - xai: /v1/images/generations OpenAI-compat; video uses /v1/videos/generations (not our client)
 * - together: documents OpenAI-compat /v1/images/generations; no /videos for our client
 * - openrouter / groq / deepseek / mistral / google-openai / ollama / lmstudio:
 *   chat-first; no reliable OpenAI Images/Videos path for our clients
 * - custom: user-supplied OpenAI-compatible gateway
 */
export const LLM_PRESET_CATALOG: readonly LlmPresetDef[] = [
  {
    id: 'grok-gateway',
    group: 'recommended',
    labelKey: 'grokGateway',
    hintKey: 'grokGateway',
    baseUrl: GROK_GATEWAY_BASE_URL,
    defaultModel: 'grok-4.5',
    docsUrl: 'https://github.com/yanshekki/Grok-Cli-to-OpenAI-compatible',
    caps: { chat: true, image: true, video: true },
    match: ['127.0.0.1:3847', 'localhost:3847', '127.0.0.1:39281']
  },
  {
    id: 'openai',
    group: 'recommended',
    labelKey: 'openai',
    hintKey: 'openai',
    baseUrl: OPENAI_API_BASE_URL,
    defaultModel: 'gpt-4o-mini',
    docsUrl: 'https://platform.openai.com/docs/api-reference',
    caps: { chat: true, image: true, video: true },
    match: ['api.openai.com']
  },
  {
    id: 'openrouter',
    group: 'recommended',
    labelKey: 'openrouter',
    hintKey: 'openrouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    defaultModel: 'openai/gpt-4o-mini',
    docsUrl: 'https://openrouter.ai/docs',
    caps: { chat: true, image: false, video: false },
    match: ['openrouter.ai']
  },
  {
    id: 'xai',
    group: 'cloud',
    labelKey: 'xai',
    hintKey: 'xai',
    baseUrl: 'https://api.x.ai/v1',
    defaultModel: 'grok-3-mini',
    docsUrl: 'https://docs.x.ai/docs',
    caps: { chat: true, image: true, video: false },
    match: ['api.x.ai']
  },
  {
    id: 'groq',
    group: 'cloud',
    labelKey: 'groq',
    hintKey: 'groq',
    baseUrl: 'https://api.groq.com/openai/v1',
    defaultModel: 'llama-3.3-70b-versatile',
    docsUrl: 'https://console.groq.com/docs/quickstart',
    caps: { chat: true, image: false, video: false },
    match: ['api.groq.com']
  },
  {
    id: 'deepseek',
    group: 'cloud',
    labelKey: 'deepseek',
    hintKey: 'deepseek',
    baseUrl: 'https://api.deepseek.com/v1',
    defaultModel: 'deepseek-chat',
    docsUrl: 'https://api-docs.deepseek.com',
    caps: { chat: true, image: false, video: false },
    match: ['api.deepseek.com']
  },
  {
    id: 'mistral',
    group: 'cloud',
    labelKey: 'mistral',
    hintKey: 'mistral',
    baseUrl: 'https://api.mistral.ai/v1',
    defaultModel: 'mistral-small-latest',
    docsUrl: 'https://docs.mistral.ai',
    caps: { chat: true, image: false, video: false },
    match: ['api.mistral.ai']
  },
  {
    id: 'together',
    group: 'cloud',
    labelKey: 'together',
    hintKey: 'together',
    baseUrl: 'https://api.together.xyz/v1',
    defaultModel: 'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo',
    docsUrl: 'https://docs.together.ai',
    caps: { chat: true, image: true, video: false },
    match: ['api.together.xyz', 'together.xyz']
  },
  {
    id: 'google-openai',
    group: 'cloud',
    labelKey: 'googleOpenai',
    hintKey: 'googleOpenai',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    defaultModel: 'gemini-2.0-flash',
    docsUrl: 'https://ai.google.dev/gemini-api/docs/openai',
    caps: { chat: true, image: false, video: false },
    match: ['generativelanguage.googleapis.com']
  },
  {
    id: 'ollama',
    group: 'local',
    labelKey: 'ollama',
    hintKey: 'ollama',
    baseUrl: 'http://127.0.0.1:11434/v1',
    defaultModel: 'llama3.2',
    docsUrl: 'https://github.com/ollama/ollama/blob/main/docs/openai.md',
    caps: { chat: true, image: false, video: false },
    keyOptional: true,
    match: ['127.0.0.1:11434', 'localhost:11434']
  },
  {
    id: 'lmstudio',
    group: 'local',
    labelKey: 'lmstudio',
    hintKey: 'lmstudio',
    baseUrl: 'http://127.0.0.1:1234/v1',
    defaultModel: 'local-model',
    docsUrl: 'https://lmstudio.ai/docs',
    caps: { chat: true, image: false, video: false },
    keyOptional: true,
    match: ['127.0.0.1:1234', 'localhost:1234']
  },
  {
    id: 'custom',
    group: 'advanced',
    labelKey: 'custom',
    hintKey: 'custom',
    baseUrl: '',
    defaultModel: '',
    docsUrl: 'https://platform.openai.com/docs/api-reference',
    caps: { chat: true, image: true, video: true }
  }
] as const

export const LLM_PRESET_OPTIONS = LLM_PRESET_CATALOG.map((p) => ({
  id: p.id,
  labelKey: p.labelKey,
  group: p.group
}))

export const LLM_GROUP_ORDER: LlmProviderGroup[] = [
  'recommended',
  'cloud',
  'local',
  'advanced'
]

export interface LlmEndpointFields {
  llmProvider: LlmProviderPreset
  baseUrl: string
  videoPath: string
  model: string
}

export function getLlmPresetDef(
  id: string | null | undefined
): LlmPresetDef | undefined {
  return LLM_PRESET_CATALOG.find((p) => p.id === id)
}

export function isLlmProviderPreset(id: string): id is LlmProviderPreset {
  return LLM_PRESET_CATALOG.some((p) => p.id === id)
}

/** Normalize unknown saved ids (older 3-value enum still works). */
export function coerceLlmProviderPreset(
  id: string | null | undefined,
  baseUrl?: string
): LlmProviderPreset {
  if (id && isLlmProviderPreset(id)) return id
  if (baseUrl) return inferLlmPreset(baseUrl)
  return 'grok-gateway'
}

/** Apply preset URLs/models. Custom leaves URLs as-is. */
export function applyLlmPreset<T extends LlmEndpointFields>(
  settings: T,
  preset: LlmProviderPreset
): T {
  const def = getLlmPresetDef(preset)
  if (!def || preset === 'custom') {
    return { ...settings, llmProvider: 'custom' }
  }

  const shouldResetModel =
    !settings.model?.trim() || modelLooksForeign(settings.model, preset)

  return {
    ...settings,
    llmProvider: preset,
    baseUrl: def.baseUrl,
    videoPath:
      preset === 'grok-gateway'
        ? GROK_GATEWAY_VIDEO_PATH
        : `${def.baseUrl.replace(/\/+$/, '')}/videos`,
    model: shouldResetModel ? def.defaultModel : settings.model
  }
}

function modelLooksForeign(model: string, preset: LlmProviderPreset): boolean {
  const m = model.trim().toLowerCase()
  if (preset === 'grok-gateway' || preset === 'xai') {
    return m.startsWith('gpt-') || m.includes('claude') || m.includes('gemini')
  }
  if (preset === 'openai') {
    return m.startsWith('grok-') || m === 'grok-cli' || m.includes('llama')
  }
  if (preset === 'ollama' || preset === 'lmstudio') {
    return m.startsWith('gpt-') || m.startsWith('grok-')
  }
  return false
}

export function inferLlmPreset(baseUrl: string): LlmProviderPreset {
  const n = normalize(baseUrl)
  if (!n) return 'custom'
  if (
    n === normalize(GROK_GATEWAY_BASE_URL) ||
    n === normalize(LEGACY_GROK_BASE_URL)
  ) {
    return 'grok-gateway'
  }
  for (const def of LLM_PRESET_CATALOG) {
    if (def.id === 'custom' || def.id === 'grok-gateway') continue
    if (def.match?.some((frag) => n.includes(frag.toLowerCase()))) {
      return def.id
    }
  }
  return 'custom'
}

export function llmPresetHintKey(preset: LlmProviderPreset): string {
  const def = getLlmPresetDef(preset)
  return def ? `llmPresetHint.${def.hintKey}` : 'llmPresetHint.custom'
}

export function supportsLocalAdmin(preset: LlmProviderPreset): boolean {
  return preset === 'grok-gateway'
}

export function supportsOpenAiVideosPath(preset: LlmProviderPreset): boolean {
  return preset === 'grok-gateway' || preset === 'custom'
}

export function providerCaps(preset: LlmProviderPreset): ProviderCaps {
  return (
    getLlmPresetDef(preset)?.caps ?? {
      chat: true,
      image: false,
      video: false
    }
  )
}

/** Presets that expose OpenAI-compatible image gen for this app. */
export function imageCapablePresets(): LlmPresetDef[] {
  return LLM_PRESET_CATALOG.filter((p) => p.caps.image)
}

/** Presets that expose OpenAI-style /videos for this app’s video client. */
export function videoCapablePresets(): LlmPresetDef[] {
  return LLM_PRESET_CATALOG.filter((p) => p.caps.video)
}

export function isImageCapableProvider(
  id: string | null | undefined
): boolean {
  if (!id || id === 'same-as-llm') return true
  return isLlmProviderPreset(id) && providerCaps(id).image
}

export function isVideoCapableProvider(
  id: string | null | undefined
): boolean {
  if (!id || id === 'same-as-llm' || id === 'stub') return true
  return isLlmProviderPreset(id) && providerCaps(id).video
}

export function providerDocsUrl(preset: LlmProviderPreset): string {
  return (
    getLlmPresetDef(preset)?.docsUrl ??
    'https://platform.openai.com/docs/api-reference'
  )
}

export function providerKeyOptional(preset: LlmProviderPreset): boolean {
  return Boolean(getLlmPresetDef(preset)?.keyOptional)
}

export { adminUrlFromBase, LEGACY_GROK_VIDEO_PATH }

function normalize(url: string): string {
  return url.trim().replace(/\/+$/, '').toLowerCase()
}
