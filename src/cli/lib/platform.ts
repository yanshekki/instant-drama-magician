/**
 * Normalize OS targets for desktop build/open.
 */

export type DesktopPlatform = 'mac' | 'linux' | 'win'

export function hostPlatform(): DesktopPlatform {
  if (process.platform === 'darwin') return 'mac'
  if (process.platform === 'win32') return 'win'
  return 'linux'
}

export function hostArch(): string {
  const a = process.arch
  if (a === 'arm64' || a === 'x64' || a === 'ia32') return a
  return a
}

/** Parse --platform flag: current|mac|linux|win|darwin|windows|ubuntu */
export function parsePlatformFlag(raw: string | boolean | undefined): DesktopPlatform {
  if (raw == null || raw === true || raw === 'current' || raw === '') {
    return hostPlatform()
  }
  const s = String(raw).toLowerCase()
  if (s === 'mac' || s === 'darwin' || s === 'macos' || s === 'osx') return 'mac'
  if (s === 'win' || s === 'windows' || s === 'win32') return 'win'
  if (s === 'linux' || s === 'ubuntu' || s === 'debian') return 'linux'
  throw new Error(
    `Unknown platform: ${raw}. Use mac|linux|win|current`
  )
}

/**
 * Whether building `target` for `platform` is supported on this host.
 * Electron-builder can sometimes cross-compile; we gate unsafe combos.
 */
export function canBuildOnHost(
  platform: DesktopPlatform,
  target: 'dir' | 'installer',
  force = false
): { ok: boolean; reason?: string } {
  if (force) return { ok: true }
  const host = hostPlatform()
  if (platform === host) return { ok: true }

  // Official: mac packages should be built on mac
  if (platform === 'mac' && host !== 'mac') {
    return {
      ok: false,
      reason:
        'Building macOS .app/.dmg requires a Mac host (or --force to try anyway).'
    }
  }

  // installer cross-compile often needs wine / special setup
  if (target === 'installer' && platform === 'win' && host === 'linux') {
    return {
      ok: true // electron-builder often works Linux→Win for nsis
    }
  }

  if (target === 'installer' && platform !== host) {
    return {
      ok: false,
      reason: `Cross-building installers for ${platform} on ${host} is unreliable. Use --target dir or build on ${platform}, or pass --force.`
    }
  }

  // dir cross-compile: allow win from linux (common CI pattern)
  if (target === 'dir' && platform === 'win' && host === 'linux') {
    return { ok: true }
  }

  if (target === 'dir' && platform !== host) {
    return {
      ok: false,
      reason: `Cross-building --target dir for ${platform} on ${host} is not supported by default. Use --force to try.`
    }
  }

  return { ok: true }
}

/** electron-builder CLI args for platform */
export function electronBuilderPlatformArgs(
  platform: DesktopPlatform
): string[] {
  if (platform === 'mac') return ['--mac']
  if (platform === 'win') return ['--win']
  return ['--linux']
}

export function electronBuilderInstallerTargets(
  platform: DesktopPlatform
): string[] {
  // config-driven targets still apply; these reinforce CLI intent
  if (platform === 'mac') return ['dmg']
  if (platform === 'win') return ['nsis']
  return ['AppImage', 'deb']
}
