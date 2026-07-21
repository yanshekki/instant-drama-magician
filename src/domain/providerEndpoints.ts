/**
 * Resolve chat / image / video endpoints from AppSettings (may differ per channel).
 */
import {
  GROK_GATEWAY_BASE_URL,
  GROK_GATEWAY_VIDEO_PATH
} from './gatewayDefaults'
import {
  applyLlmPreset,
  BYTEPLUS_ARK_BASE_URL,
  coerceLlmProviderPreset,
  DEFAULT_SEEDANCE_MODEL,
  DEFAULT_SEEDREAM_MODEL,
  getLlmPresetDef,
  imageCapablePresets,
  isLlmProviderPreset,
  videoCapablePresets,
  VOLC_ARK_BASE_URL,
  type LlmProviderPreset
} from './openaiCompatible'
import type {
  AppSettings,
  ImageProviderMode,
  VideoMode,
  VideoProviderMode
} from '../types/settings'

export interface ResolvedEndpoint {
  baseUrl: string
  apiKey: string
  model: string
}

export interface ResolvedVideoEndpoint extends ResolvedEndpoint {
  mode: VideoMode
  videoPath: string
}

export interface ChannelOption {
  id: string
  /** i18n under settings.channelPreset.* or settings.llmPreset.* */
  labelKey: string
  /** When true, labelKey is under channelPreset; else llmPreset */
  channelLabel?: boolean
  group?: 'channel' | 'recommended' | 'cloud' | 'local' | 'advanced'
}

function stripSlash(url: string): string {
  return url.trim().replace(/\/+$/, '')
}

export function resolveChatEndpoint(s: AppSettings): ResolvedEndpoint {
  return {
    baseUrl: stripSlash(s.baseUrl || GROK_GATEWAY_BASE_URL),
    apiKey: s.apiKey ?? '',
    model: s.model?.trim() || 'grok-4.5'
  }
}

export function resolveImageEndpoint(s: AppSettings): ResolvedEndpoint {
  const chat = resolveChatEndpoint(s)
  if (!s.imageProvider || s.imageProvider === 'same-as-llm') {
    return chat
  }
  if (s.imageProvider === 'seedream') {
    return {
      baseUrl: stripSlash(
        s.imageBaseUrl?.trim() || VOLC_ARK_BASE_URL
      ),
      apiKey: s.imageApiKey?.trim() || s.apiKey || '',
      model:
        s.imageModel?.trim() ||
        (s.model?.toLowerCase().includes('seedream')
          ? s.model
          : DEFAULT_SEEDREAM_MODEL)
    }
  }
  const preset = coerceLlmProviderPreset(s.imageProvider)
  const def = getLlmPresetDef(preset)
  const applied = applyLlmPreset(
    {
      llmProvider: preset,
      // Leave empty so outer fallback can hit def / chat for custom+blank base
      baseUrl: s.imageBaseUrl?.trim() || '',
      videoPath: s.videoPath,
      model: s.model
    },
    preset
  )
  const base =
    s.imageBaseUrl?.trim() ||
    applied.baseUrl ||
    def?.baseUrl ||
    chat.baseUrl
  const key =
    s.imageApiKey?.trim() ||
    (preset === s.llmProvider ? s.apiKey : '') ||
    s.apiKey
  return {
    baseUrl: stripSlash(base),
    apiKey: key ?? '',
    model: s.imageModel?.trim() || chat.model
  }
}

function videoPathForPreset(
  preset: LlmProviderPreset,
  base: string,
  explicit?: string
): string {
  const b = stripSlash(base)
  const ex = explicit?.trim()
  if (preset === 'grok-gateway') {
    // Keep override only when it still targets the gateway base / default path
    if (ex && (ex === GROK_GATEWAY_VIDEO_PATH || ex.startsWith(b))) {
      return ex
    }
    return GROK_GATEWAY_VIDEO_PATH
  }
  // Ignore leftover gateway default path when switching to another preset
  if (ex && ex !== GROK_GATEWAY_VIDEO_PATH && (ex.startsWith(b) || ex.startsWith(`${b}/`))) {
    return ex
  }
  return `${b}/videos`
}

function videoModeForPreset(
  preset: LlmProviderPreset,
  requested: VideoMode | undefined
): VideoMode {
  if (requested === 'stub') return 'stub'
  if (preset === 'grok-gateway') {
    return requested === 'http' ? 'http' : requested === 'auto' ? 'auto' : 'auto'
  }
  // Non-gateway OpenAI-compat: prefer HTTP video client when not stub
  if (requested === 'auto' || !requested) return 'http'
  return requested
}

export function resolveVideoEndpoint(s: AppSettings): ResolvedVideoEndpoint {
  const chat = resolveChatEndpoint(s)
  const vp = (s.videoProvider || 'same-as-llm') as VideoProviderMode

  if (vp === 'stub') {
    return {
      baseUrl: chat.baseUrl,
      apiKey: chat.apiKey,
      model: chat.model,
      mode: 'stub',
      videoPath: s.videoPath || GROK_GATEWAY_VIDEO_PATH
    }
  }

  if (vp === 'seedance') {
    return {
      baseUrl: stripSlash(s.videoBaseUrl?.trim() || VOLC_ARK_BASE_URL),
      apiKey: s.videoApiKey?.trim() || s.apiKey || '',
      model:
        s.videoModel?.trim() ||
        (s.model?.toLowerCase().includes('seedance')
          ? s.model
          : DEFAULT_SEEDANCE_MODEL),
      mode: 'http',
      // Marker path — SeedanceVideoProvider ignores OpenAI /videos shape
      videoPath: 'seedance://contents/generations/tasks'
    }
  }

  if (vp === 'same-as-llm') {
    const mode: VideoMode =
      s.llmProvider === 'grok-gateway'
        ? s.videoMode === 'stub'
          ? 'stub'
          : s.videoMode || 'auto'
        : s.videoMode === 'http'
          ? 'http'
          : s.videoMode === 'stub'
            ? 'stub'
            : s.videoMode === 'auto'
              ? 'auto'
              : 'http'
    return {
      baseUrl: chat.baseUrl,
      apiKey: chat.apiKey,
      model: chat.model,
      mode,
      videoPath:
        s.videoPath?.trim() ||
        (s.llmProvider === 'grok-gateway'
          ? GROK_GATEWAY_VIDEO_PATH
          : `${chat.baseUrl}/videos`)
    }
  }

  // Any LlmProviderPreset (including custom, grok-gateway, openai, …)
  const preset = coerceLlmProviderPreset(vp)
  const def = getLlmPresetDef(preset)
  const applied = applyLlmPreset(
    {
      llmProvider: preset,
      // Leave empty so outer fallback can hit def / chat for custom+blank base
      baseUrl: s.videoBaseUrl?.trim() || '',
      videoPath: s.videoPath,
      model: s.model
    },
    preset
  )
  const base = stripSlash(
    s.videoBaseUrl?.trim() ||
      applied.baseUrl ||
      def?.baseUrl ||
      chat.baseUrl
  )
  const mode = videoModeForPreset(preset, s.videoMode)
  return {
    baseUrl: base,
    apiKey: s.videoApiKey?.trim() || s.apiKey || '',
    model: s.videoModel?.trim() || chat.model,
    mode,
    videoPath: videoPathForPreset(preset, base, s.videoPath)
  }
}

/** Catalog default base URL for an image/video channel preset. */
export function channelPresetBaseUrl(
  id: ImageProviderMode | VideoProviderMode
): string {
  if (id === 'same-as-llm' || id === 'stub') return ''
  if (id === 'seedance' || id === 'seedream') return VOLC_ARK_BASE_URL
  if (!isLlmProviderPreset(id)) return ''
  return getLlmPresetDef(id)?.baseUrl ?? ''
}

/** Prefer China Ark; intl users can switch base to BYTEPLUS. */
export function arkDefaultBaseUrl(): string {
  return VOLC_ARK_BASE_URL
}

export function arkIntlBaseUrl(): string {
  return BYTEPLUS_ARK_BASE_URL
}

/** Image tab: same-as-llm + Seedream + only providers with caps.image. */
export function imageProviderOptions(): ChannelOption[] {
  return [
    {
      id: 'same-as-llm',
      labelKey: 'sameAsLlm',
      channelLabel: true,
      group: 'channel'
    },
    {
      id: 'seedream',
      labelKey: 'seedream',
      channelLabel: true,
      group: 'channel'
    },
    ...imageCapablePresets().map((p) => ({
      id: p.id,
      labelKey: p.labelKey,
      group: p.group as ChannelOption['group']
    }))
  ]
}

/** Video tab: same-as-llm + stub + Seedance + OpenAI-style /videos. */
export function videoProviderOptions(): ChannelOption[] {
  return [
    {
      id: 'same-as-llm',
      labelKey: 'sameAsLlm',
      channelLabel: true,
      group: 'channel'
    },
    {
      id: 'stub',
      labelKey: 'stub',
      channelLabel: true,
      group: 'channel'
    },
    {
      id: 'seedance',
      labelKey: 'seedance',
      channelLabel: true,
      group: 'channel'
    },
    ...videoCapablePresets().map((p) => ({
      id: p.id,
      labelKey: p.labelKey,
      group: p.group as ChannelOption['group']
    }))
  ]
}
