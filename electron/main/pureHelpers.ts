/**
 * Pure helpers extracted from main process for unit-testable residual paths.
 * No Electron app boot side-effects.
 */
import {
  mkdirSync,
  existsSync,
  writeFileSync,
  readFileSync
} from 'fs'
import { join, resolve as pathResolve } from 'path'
import { execFileSync } from 'child_process'

export function ensureDirsNonFatal(dirs: string[]): void {
  for (const dir of dirs) {
    try {
      mkdirSync(dir, { recursive: true })
    } catch {
      /* non-fatal */
    }
  }
}

export function resolveAppIconPathFrom(candidates: string[]): string | undefined {
  for (const p of candidates) {
    if (p && existsSync(p)) return p
  }
  return undefined
}

export function collectAllowedMediaRoots(opts: {
  mediaRoot: string
  userData: string
  configHome: string | null
  cwd: string | null
}): string[] {
  const roots: string[] = [
    pathResolve(opts.mediaRoot),
    pathResolve(opts.userData)
  ]
  if (opts.configHome) {
    const cfg = pathResolve(opts.configHome)
    for (const name of [
      'instant-drama-magician',
      'instant-drama-magician-dev'
    ]) {
      roots.push(pathResolve(join(cfg, name)))
      roots.push(pathResolve(join(cfg, name, 'media')))
    }
  }
  if (opts.cwd) {
    const cwd = pathResolve(opts.cwd)
    roots.push(join(cwd, 'media'))
    roots.push(join(cwd, 'data'))
    roots.push(join(cwd, 'prisma'))
  }
  return roots
}

export function installLinuxDesktopIconPure(opts: {
  iconPath: string
  home: string
  appIconName: string
  displayNameEn: string
  displayNameZh: string
  execPath: string
  extraArgs: string[]
  iconsRootCandidates: string[]
  cwd: string
  resourcesPath: string
}): void {
  try {
    const hicolor = join(opts.home, '.local', 'share', 'icons', 'hicolor')
    const sizes = [16, 32, 48, 64, 128, 256, 512, 1024]
    const iconsRoot =
      opts.iconsRootCandidates.find((d) => existsSync(d)) ||
      opts.iconsRootCandidates[0]
    for (const s of sizes) {
      const sized = join(iconsRoot, `${s}x${s}.png`)
      const src = existsSync(sized) ? sized : opts.iconPath
      const destDir = join(hicolor, `${s}x${s}`, 'apps')
      mkdirSync(destDir, { recursive: true })
      const dest = join(destDir, `${opts.appIconName}.png`)
      writeFileSync(dest, readFileSync(src))
    }
    const pixmaps = join(opts.home, '.local', 'share', 'pixmaps')
    mkdirSync(pixmaps, { recursive: true })
    writeFileSync(
      join(pixmaps, `${opts.appIconName}.png`),
      readFileSync(
        existsSync(join(iconsRoot, '256x256.png'))
          ? join(iconsRoot, '256x256.png')
          : opts.iconPath
      )
    )
    const appsDir = join(opts.home, '.local', 'share', 'applications')
    mkdirSync(appsDir, { recursive: true })
    const hasClass = opts.extraArgs.some(
      (a) => a === `--class=${opts.appIconName}` || a === '--class'
    )
    const classArgs = hasClass ? [] : [`--class=${opts.appIconName}`]
    const allArgs = [...classArgs, ...opts.extraArgs]
    const desktop = [
      '[Desktop Entry]',
      'Type=Application',
      `Name=${opts.displayNameEn}`,
      `Name[zh_HK]=${opts.displayNameZh}`,
      `Icon=${opts.appIconName}`,
      `Exec=${JSON.stringify(opts.execPath)} ${allArgs
        .map((a) => JSON.stringify(a))
        .join(' ')}`,
      'Terminal=false',
      `StartupWMClass=${opts.appIconName}`
    ].join('\n')
    writeFileSync(
      join(appsDir, `${opts.appIconName}.desktop`),
      desktop + '\n',
      'utf8'
    )
    try {
      execFileSync('gtk-update-icon-cache', ['-f', '-t', hicolor], {
        stdio: 'ignore'
      })
    } catch {
      /* optional */
    }
    try {
      execFileSync('update-desktop-database', [appsDir], { stdio: 'ignore' })
    } catch {
      /* optional */
    }
  } catch {
    /* outer fail */
  }
}

export function applyWindowIconPure(
  // Accept BrowserWindow-like setIcon (string | NativeImage) without pulling electron types.
  win: { setIcon: (icon: never) => void },
  iconPath: string,
  createFromPath: (p: string) => { isEmpty: () => boolean },
  platform: string
): void {
  try {
    const icon = createFromPath(iconPath)
    if (icon.isEmpty()) {
      return
    }
    win.setIcon(icon as never)
    if (platform === 'linux') {
      win.setIcon(iconPath as never)
    }
  } catch {
    /* setIcon failed */
  }
}

/** Screenshot default dir: pictures → desktop → userData. */
export function resolveScreenshotDefaultDir(opts: {
  pictures: string
  desktop: string
  userData: string
  exists: (p: string) => boolean
}): string {
  try {
    if (opts.exists(opts.pictures)) return opts.pictures
    return opts.desktop
  } catch {
    return opts.userData
  }
}

/** Best-effort prisma disconnect for backup checkpoint. */
export async function disconnectPrismaSafe(
  client: { $disconnect: () => Promise<void> } | null
): Promise<null> {
  if (!client) return null
  try {
    await client.$disconnect()
  } catch {
    /* ignore */
  }
  return null
}

/** Non-fatal gateway ensure when any provider is grok-gateway. */
export async function ensureGatewayIfNeeded(runtime: {
  settingsStore: { load: () => unknown }
  invoke: (channel: string) => Promise<unknown>
} | null): Promise<void> {
  if (!runtime) return
  try {
    const s = runtime.settingsStore.load() as Record<string, unknown>
    const needsGw =
      s.llmProvider === 'grok-gateway' ||
      s.imageProvider === 'grok-gateway' ||
      s.videoProvider === 'grok-gateway'
    if (needsGw) {
      await runtime.invoke('gateway:ensure')
    }
  } catch {
    /* non-fatal — UI will surface gateway status */
  }
}

/** Best-effort stop for embedded web server on quit. */
export async function stopEmbeddedServerSafe(
  stop: () => Promise<unknown>
): Promise<void> {
  try {
    await stop()
  } catch {
    /* ignore */
  }
}

/** Import-overwrite confirm copy (windowed vs bare dialog). */
export function fullBackupImportMessage(
  lang: 'en' | string,
  bare: boolean
): string {
  if (lang === 'en') {
    return bare
      ? 'This will replace the database, media library, and settings, then restart.'
      : 'This will replace the database, media library, and settings on this computer, then restart the app.'
  }
  return bare
    ? '此操作會覆寫本機資料庫、媒體庫與設定，然後重新啟動。'
    : '此操作會覆寫本機資料庫、媒體庫與設定，然後重新啟動應用程式。'
}

/** Create nativeImage only when path exists; else undefined. */
export function createNativeIconIfPresent(
  iconPath: string | undefined,
  exists: (p: string) => boolean,
  createFromPath: (p: string) => unknown
): unknown {
  if (iconPath && exists(iconPath)) return createFromPath(iconPath)
  return undefined
}

/** Log icon install or missing-file warn. */
export function reportAppIconPath(
  iconPath: string | undefined,
  log: (...a: unknown[]) => void = console.log,
  warn: (...a: unknown[]) => void = console.warn
): void {
  if (iconPath) log('[icon] installing', iconPath)
  else warn('[icon] no icon file found')
}
