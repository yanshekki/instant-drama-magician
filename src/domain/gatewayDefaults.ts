/**
 * Canonical defaults for Grok-Cli-to-OpenAI-compatible
 * https://github.com/yanshekki/Grok-Cli-to-OpenAI-compatible
 *
 * Gateway default port: 3847 (docs). Older InstantDrama used 39281.
 */

export const GROK_GATEWAY_DEFAULT_PORT = 3847

export const GROK_GATEWAY_BASE_URL = `http://127.0.0.1:${GROK_GATEWAY_DEFAULT_PORT}/v1`
export const GROK_GATEWAY_VIDEO_PATH = `${GROK_GATEWAY_BASE_URL}/videos`
export const GROK_GATEWAY_ADMIN_URL = `http://127.0.0.1:${GROK_GATEWAY_DEFAULT_PORT}/admin/`
export const GROK_GATEWAY_HEALTH_URL = `http://127.0.0.1:${GROK_GATEWAY_DEFAULT_PORT}/health`

/** Legacy InstantDrama defaults (pre Round 11) */
export const LEGACY_GROK_BASE_URL = 'http://127.0.0.1:39281/v1'
export const LEGACY_GROK_VIDEO_PATH = 'http://127.0.0.1:39281/v1/videos'

export interface GatewayUrlFields {
  baseUrl: string
  videoPath: string
}

/**
 * Migrate only exact legacy default URLs so custom ports are never overwritten.
 */
export function migrateGatewayDefaults<T extends GatewayUrlFields>(
  settings: T
): { settings: T; migrated: boolean } {
  let migrated = false
  let baseUrl = settings.baseUrl
  let videoPath = settings.videoPath

  if (normalizeUrl(baseUrl) === normalizeUrl(LEGACY_GROK_BASE_URL)) {
    baseUrl = GROK_GATEWAY_BASE_URL
    migrated = true
  }
  if (normalizeUrl(videoPath) === normalizeUrl(LEGACY_GROK_VIDEO_PATH)) {
    videoPath = GROK_GATEWAY_VIDEO_PATH
    migrated = true
  }
  // If base moved but video still empty/legacy relative — keep consistent
  if (
    migrated &&
    normalizeUrl(videoPath) === normalizeUrl(LEGACY_GROK_VIDEO_PATH)
  ) {
    videoPath = GROK_GATEWAY_VIDEO_PATH
  }

  if (!migrated) return { settings, migrated: false }
  return {
    settings: { ...settings, baseUrl, videoPath },
    migrated: true
  }
}

export function adminUrlFromBase(baseUrl: string): string {
  try {
    const u = new URL(baseUrl)
    // base is .../v1 → origin + /admin/
    const origin = u.origin
    return `${origin}/admin/`
  } catch {
    return GROK_GATEWAY_ADMIN_URL
  }
}

export function healthUrlFromBase(baseUrl: string): string {
  try {
    const u = new URL(baseUrl)
    return `${u.origin}/health`
  } catch {
    return GROK_GATEWAY_HEALTH_URL
  }
}

function normalizeUrl(url: string): string {
  return url.trim().replace(/\/+$/, '').toLowerCase()
}
