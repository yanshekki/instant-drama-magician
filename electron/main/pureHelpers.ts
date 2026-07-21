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
  win: { setIcon: (icon: unknown) => void },
  iconPath: string,
  createFromPath: (p: string) => { isEmpty: () => boolean },
  platform: string
): void {
  try {
    const icon = createFromPath(iconPath)
    if (icon.isEmpty()) {
      return
    }
    win.setIcon(icon)
    if (platform === 'linux') {
      win.setIcon(iconPath)
    }
  } catch {
    /* setIcon failed */
  }
}
