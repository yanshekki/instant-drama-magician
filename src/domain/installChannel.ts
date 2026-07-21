/**
 * Detect how InstantDrama Magician was installed so update UX can route correctly:
 * - desktop-packaged → electron-updater + GitHub Releases
 * - desktop-dev → informational only (no installer updates)
 * - cli-npm → npm registry
 * - web → open desktop/CLI install links only
 */

export type InstallChannel =
  | 'desktop-packaged'
  | 'desktop-dev'
  | 'cli-npm'
  | 'web'

export const GITHUB_OWNER = 'yanshekki'
export const GITHUB_REPO = 'instant-drama-magician'
export const GITHUB_RELEASES_URL = `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases`

export type InstallChannelInput = {
  /** Electron app.isPackaged */
  isPackaged?: boolean
  /** Running under Electron (main or renderer with desktop API) */
  isElectron?: boolean
  /** Pure browser / embedded web server SPA */
  isWeb?: boolean
  /** CLI binary (`instant-drama` / node bin) */
  isCli?: boolean
}

/**
 * Resolve the install channel. Priority: cli → web → electron packaged/dev → cli fallback.
 */
export function detectInstallChannel(input: InstallChannelInput): InstallChannel {
  if (input.isCli) return 'cli-npm'
  if (input.isWeb) return 'web'
  if (input.isElectron) {
    return input.isPackaged ? 'desktop-packaged' : 'desktop-dev'
  }
  return 'cli-npm'
}

/** GitHub Releases landing page, or a specific tag page when version is known. */
export function githubReleaseUrl(version?: string | null): string {
  const v = version?.trim()
  if (!v) return GITHUB_RELEASES_URL
  const tag = v.startsWith('v') ? v : `v${v}`
  return `${GITHUB_RELEASES_URL}/tag/${tag}`
}

export function channelAllowsDesktopAutoUpdate(channel: InstallChannel): boolean {
  return channel === 'desktop-packaged'
}

export function channelAllowsNpmAutoUpdate(channel: InstallChannel): boolean {
  return channel === 'cli-npm'
}
