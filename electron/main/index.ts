import {
  app,
  BrowserWindow,
  ipcMain,
  dialog,
  shell,
  protocol,
  nativeImage
} from 'electron'
import { homedir } from 'os'
import { extname, join, resolve as pathResolve, sep } from 'path'

import {
  ensureDirsNonFatal,
  resolveAppIconPathFrom,
  collectAllowedMediaRoots,
  installLinuxDesktopIconPure,
  applyWindowIconPure
} from './pureHelpers'
import {
  createReadStream,
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync
} from 'fs'
import { Readable } from 'stream'
import { execFileSync } from 'child_process'
import { PrismaClient } from '../../src/types/prisma'
import { appUpdateService } from '../../src/infrastructure/update/AppUpdateService'
import { registerIpcHandlers } from './ipc'
import {
  coerceMenuLang,
  installAppMenu,
  sendMenuActionToRenderer,
  type AppMenuHandlers,
  type MenuLang
} from './appMenu'
import { SettingsStore } from '../../src/infrastructure/settings/SettingsStore'
import {
  AppDataBackupService,
  defaultFullBackupFileName,
  migrateAppDataIfNeeded
} from '../../src/application/services'
import { resolveAppPaths, type AppPaths } from '../../src/domain/appPaths'
import { ActivityLog } from '../../src/infrastructure/activity/ActivityLog'
import {
  redactSettings,
  supportReportPath,
  writeSupportReportJson
} from '../../src/infrastructure/support/SupportReport'

/** MIME for idm-media responses (video needs correct type + Range). */
function mimeForMediaPath(filePath: string): string {
  switch (extname(filePath).toLowerCase()) {
    case '.mp4':
    case '.m4v':
      return 'video/mp4'
    case '.webm':
      return 'video/webm'
    case '.mov':
      return 'video/quicktime'
    case '.mkv':
      return 'video/x-matroska'
    case '.png':
      return 'image/png'
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg'
    case '.webp':
      return 'image/webp'
    case '.gif':
      return 'image/gif'
    case '.svg':
      return 'image/svg+xml'
    case '.wav':
      return 'audio/wav'
    case '.mp3':
      return 'audio/mpeg'
    default:
      return 'application/octet-stream'
  }
}

/**
 * Serve local media with Accept-Ranges / 206 Partial Content so Chromium
 * <video> can stream past the first buffer (otherwise playback often stops ~1s).
 */
function serveLocalMediaFile(
  filePath: string,
  request: Request
): Response {
  const st = statSync(filePath)
  const size = st.size
  const type = mimeForMediaPath(filePath)
  const rangeHeader =
    request.headers.get('Range') ?? request.headers.get('range')

  if (rangeHeader) {
    const m = /^bytes=(\d*)-(\d*)$/i.exec(rangeHeader.trim())
    if (!m) {
      return new Response('invalid range', { status: 416 })
    }
    let start = m[1] !== '' ? Number.parseInt(m[1], 10) : 0
    let end = m[2] !== '' ? Number.parseInt(m[2], 10) : size - 1
    if (
      !Number.isFinite(start) ||
      !Number.isFinite(end) ||
      start < 0 ||
      start >= size ||
      end < start
    ) {
      return new Response('range not satisfiable', {
        status: 416,
        headers: {
          'Content-Range': `bytes */${size}`,
          'Accept-Ranges': 'bytes'
        }
      })
    }
    end = Math.min(end, size - 1)
    const chunkSize = end - start + 1
    const nodeStream = createReadStream(filePath, { start, end })
    const webStream = Readable.toWeb(nodeStream) as ReadableStream
    return new Response(webStream, {
      status: 206,
      headers: {
        'Content-Type': type,
        'Content-Length': String(chunkSize),
        'Content-Range': `bytes ${start}-${end}/${size}`,
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'private, max-age=0, must-revalidate'
      }
    })
  }

  const nodeStream = createReadStream(filePath)
  const webStream = Readable.toWeb(nodeStream) as ReadableStream
  return new Response(webStream, {
    status: 200,
    headers: {
      'Content-Type': type,
      'Content-Length': String(size),
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'private, max-age=0, must-revalidate'
    }
  })
}

const isDev = !app.isPackaged

/**
 * Unified OS data root (see src/domain/appPaths.ts).
 * - Packaged: …/instant-drama-magician
 * - Dev:      …/instant-drama-magician-dev  (unless IDM_PROFILE / IDM_DATA_DIR)
 * DB + settings + media always live under the same root (no prisma/dev.db).
 * Must set userData before the first app.getPath('userData').
 */
const appPaths: AppPaths = resolveAppPaths({
  isDevRuntime: isDev,
  envDataDir: process.env.IDM_DATA_DIR,
  profile: process.env.IDM_PROFILE || null
})
app.setPath('userData', appPaths.dataRoot)
ensureDirsNonFatal([
  appPaths.dataRoot,
  appPaths.mediaRoot,
  appPaths.logsDir,
  appPaths.cacheDir,
  appPaths.exportsDir
])

/**
 * Dev under electron-vite can leave stdout/stderr closed when the parent
 * reloads or a second instance dies. Writing then throws write EPIPE and
 * Electron shows a fatal "JavaScript error in the main process" dialog.
 * Swallow pipe errors only — real crashes still surface.
 */
function isBenignPipeError(err: unknown): boolean {
  const code =
    err && typeof err === 'object' && 'code' in err
      ? String((err as { code?: unknown }).code)
      : ''
  return code === 'EPIPE' || code === 'EIO' || code === 'ERR_STREAM_DESTROYED'
}

for (const stream of [process.stdout, process.stderr]) {
  stream?.on?.('error', (err: Error) => {
    if (isBenignPipeError(err)) return
    // Leave other stream errors for uncaughtException
  })
}

process.on('uncaughtException', (err) => {
  if (isBenignPipeError(err)) return
  // Keep Electron default for genuine bugs (log; dialog may still show)
  try {
    // eslint-disable-next-line no-console
    console.error('[main] uncaughtException', err)
  } catch {
    /* pipe already dead */
  }
})

process.on('unhandledRejection', (reason) => {
  if (isBenignPipeError(reason)) return
  try {
    // eslint-disable-next-line no-console
    console.error('[main] unhandledRejection', reason)
  } catch {
    /* pipe already dead */
  }
})

/**
 * SQLite always under data root.
 * Ignore repo-relative DATABASE_URL from .env (e.g. file:./prisma/dev.db) —
 * that was the old split-brain layout and hides the OS data-root library.
 * Explicit absolute DATABASE_URL or IDM_DATABASE_URL still wins.
 */
function isLegacyRepoDatabaseUrl(url: string): boolean {
  const u = url.trim()
  if (!u.startsWith('file:')) return false
  const rest = u.slice('file:'.length).replace(/^\/\/\//, '/').replace(/^\/\//, '')
  return (
    rest.includes('prisma/dev.db') ||
    rest.startsWith('./') ||
    rest.startsWith('../') ||
    (!rest.startsWith('/') && !/^[A-Za-z]:[\\/]/.test(rest))
  )
}

function resolveDatabaseUrl(): string {
  const explicit =
    process.env.IDM_DATABASE_URL?.trim() ||
    process.env.DATABASE_URL?.trim() ||
    ''
  if (explicit && !isLegacyRepoDatabaseUrl(explicit)) {
    return explicit
  }
  return appPaths.databaseUrl
}

process.env.DATABASE_URL = resolveDatabaseUrl()
// eslint-disable-next-line no-console
console.log('[appPaths] dataRoot=', appPaths.dataRoot)
// eslint-disable-next-line no-console
console.log('[appPaths] DATABASE_URL=', process.env.DATABASE_URL)

// Must be called before app ready
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'idm-media',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      stream: true,
      bypassCSP: true
    }
  }
])

let mainWindow: BrowserWindow | null = null
let prisma: PrismaClient | null = null

function getPrisma(): PrismaClient {
  if (!prisma) {
    prisma = new PrismaClient({
      datasources: { db: { url: process.env.DATABASE_URL } }
    })
  }
  return prisma
}

function resolveDbFilePath(): string {
  const url = process.env.DATABASE_URL ?? resolveDatabaseUrl()
  if (!url.startsWith('file:')) return url
  // Prisma: file:/abs, file:./rel, file:///abs
  let rest = url.slice('file:'.length)
  if (rest.startsWith('///')) rest = rest.slice(2)
  else if (rest.startsWith('//')) {
    // file://host/path → drop host
    rest = rest.replace(/^\/\/[^/]*/, '') || rest
  }
  return rest
}

function loadMenuLang(): MenuLang {
  try {
    const store = new SettingsStore(
      join(app.getPath('userData'), 'settings.json')
    )
    return coerceMenuLang(store.load().uiLanguage)
  } catch {
    return 'zh-HK'
  }
}

function fullBackupService(): AppDataBackupService {
  const userData = app.getPath('userData')
  return new AppDataBackupService({
    userData,
    databasePath: resolveDbFilePath(),
    settingsPath: join(userData, 'settings.json'),
    mediaRoot: join(userData, 'media'),
    activityLogPath: ActivityLog.defaultPath(userData),
    appVersion: app.getVersion(),
    platform: process.platform
  })
}

async function runExportFullBackup(): Promise<void> {
  const win = mainWindow
  const lang = loadMenuLang()
  const title =
    lang === 'en' ? 'Export all app data' : '匯出全部應用資料'
  const result = win
    ? await dialog.showSaveDialog(win, {
        title,
        defaultPath: defaultFullBackupFileName(),
        filters: [{ name: 'IDM Full Backup', extensions: ['zip'] }]
      })
    : await dialog.showSaveDialog({
        title,
        defaultPath: defaultFullBackupFileName(),
        filters: [{ name: 'IDM Full Backup', extensions: ['zip'] }]
      })
  if (result.canceled || !result.filePath) return
  try {
    // Best-effort checkpoint: disconnect briefly so WAL is flushable
    if (prisma) {
      try {
        await prisma.$disconnect()
      } catch {
        /* ignore */
      }
      prisma = null
    }
    const { filePath } = await fullBackupService().exportToZip(result.filePath, {
      includeSecrets: false,
      includeLogs: true
    })
    // Recreate prisma for continued use
    getPrisma()
    const msg =
      lang === 'en'
        ? `Full backup saved:\n${filePath}`
        : `已匯出全部應用資料：\n${filePath}`
    if (win && !win.isDestroyed()) {
      await dialog.showMessageBox(win, {
        type: 'info',
        title: lang === 'en' ? 'Export complete' : '匯出完成',
        message: msg,
        buttons: [lang === 'en' ? 'Show in folder' : '在資料夾中顯示', lang === 'en' ? 'OK' : '確定'],
        defaultId: 0
      }).then((r) => {
        if (r.response === 0) shell.showItemInFolder(filePath)
      })
    }
    if (win && !win.isDestroyed()) {
      win.webContents.send('menu:action', {
        type: 'full-backup-exported',
        filePath
      })
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    if (win && !win.isDestroyed()) {
      await dialog.showMessageBox(win, {
        type: 'error',
        title: lang === 'en' ? 'Export failed' : '匯出失敗',
        message
      })
    }
    getPrisma()
  }
}

async function runImportFullBackup(): Promise<void> {
  const win = mainWindow
  const lang = loadMenuLang()
  const openTitle =
    lang === 'en' ? 'Restore from full backup' : '從全部資料還原'
  const open = win
    ? await dialog.showOpenDialog(win, {
        title: openTitle,
        filters: [{ name: 'IDM Full Backup', extensions: ['zip'] }],
        properties: ['openFile']
      })
    : await dialog.showOpenDialog({
        title: openTitle,
        filters: [{ name: 'IDM Full Backup', extensions: ['zip'] }],
        properties: ['openFile']
      })
  if (open.canceled || open.filePaths.length === 0) return

  const confirm = win
    ? await dialog.showMessageBox(win, {
        type: 'warning',
        title: lang === 'en' ? 'Overwrite all local data?' : '覆寫本機全部資料？',
        message:
          lang === 'en'
            ? 'This will replace the database, media library, and settings on this computer, then restart the app.'
            : '此操作會覆寫本機資料庫、媒體庫與設定，然後重新啟動應用程式。',
        detail:
          lang === 'en'
            ? 'Export a full backup first if you need to keep the current data.'
            : '如需保留現有資料，請先「匯出全部應用資料」。',
        buttons: [
          lang === 'en' ? 'Cancel' : '取消',
          lang === 'en' ? 'Restore and Restart' : '還原並重新啟動'
        ],
        defaultId: 0,
        cancelId: 0
      })
    : await dialog.showMessageBox({
        type: 'warning',
        title: lang === 'en' ? 'Overwrite all local data?' : '覆寫本機全部資料？',
        message:
          lang === 'en'
            ? 'This will replace the database, media library, and settings, then restart.'
            : '此操作會覆寫本機資料庫、媒體庫與設定，然後重新啟動。',
        buttons: [
          lang === 'en' ? 'Cancel' : '取消',
          lang === 'en' ? 'Restore and Restart' : '還原並重新啟動'
        ],
        defaultId: 0,
        cancelId: 0
      })
  if (confirm.response !== 1) return

  try {
    if (prisma) {
      try {
        await prisma.$disconnect()
      } catch {
        /* ignore */
      }
      prisma = null
    }
    await fullBackupService().importFromZip(open.filePaths[0])
    app.relaunch()
    app.exit(0)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    getPrisma()
    if (win && !win.isDestroyed()) {
      await dialog.showMessageBox(win, {
        type: 'error',
        title: lang === 'en' ? 'Restore failed' : '還原失敗',
        message
      })
    }
  }
}

async function runExportSupportFromMenu(): Promise<void> {
  const win = mainWindow
  const lang = loadMenuLang()
  try {
    const store = new SettingsStore(
      join(app.getPath('userData'), 'settings.json')
    )
    const settings = store.load()
    const activity = new ActivityLog(
      ActivityLog.defaultPath(app.getPath('userData'))
    )
    const defaultPath = supportReportPath(app.getPath('userData'))
    const result = win
      ? await dialog.showSaveDialog(win, {
          title: lang === 'en' ? 'Export support report' : '匯出支援報告',
          defaultPath,
          filters: [{ name: 'JSON', extensions: ['json'] }]
        })
      : await dialog.showSaveDialog({
          title: lang === 'en' ? 'Export support report' : '匯出支援報告',
          defaultPath,
          filters: [{ name: 'JSON', extensions: ['json'] }]
        })
    if (result.canceled || !result.filePath) return
    writeSupportReportJson(result.filePath, {
      generatedAt: new Date().toISOString(),
      app: {
        version: app.getVersion(),
        name: app.getName(),
        isPackaged: app.isPackaged,
        platform: process.platform,
        electron: process.versions.electron ?? 'unknown',
        userData: app.getPath('userData'),
        mediaRoot: join(app.getPath('userData'), 'media')
      },
      diagnostics: {
        chat: { available: false, message: 'see in-app probe' },
        video: { available: false, message: 'see in-app probe' },
        ffmpeg: { available: false, message: 'see in-app probe' },
        videoMode: settings.videoMode ?? 'auto',
        tips: []
      },
      settings: redactSettings(settings),
      activity: activity.readRecent(200)
    })
    if (win && !win.isDestroyed()) {
      shell.showItemInFolder(result.filePath)
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    if (win && !win.isDestroyed()) {
      await dialog.showMessageBox(win, {
        type: 'error',
        title: lang === 'en' ? 'Export failed' : '匯出失敗',
        message
      })
    }
  }
}

function showAboutDialog(): void {
  const lang = loadMenuLang()
  const version = app.getVersion()
  const userData = app.getPath('userData')
  const en = lang === 'en'
  const detail = [
    `Version ${version}`,
    `Electron ${process.versions.electron ?? '?'}`,
    `Chrome ${process.versions.chrome ?? '?'}`,
    `Node ${process.versions.node ?? '?'}`,
    `Platform ${process.platform}`,
    '',
    en
      ? 'Creator: Ki (yanshekki) · YSK Limited'
      : '創作者：Ki (yanshekki) · YSK Limited',
    'linktr.ee/yanshekki · ysk.hk',
    '',
    en
      ? 'Support / Donate — if InstantDrama Magician helps your short-drama workflow, consider buying me a coffee!'
      : 'Support / Donate — 如果「瞬劇魔法師」幫到你的短劇創作，歡迎請我喝杯咖啡！',
    'EVM: yanshekki.eth',
    'NEAR: yanshekki.near',
    'ADA: $yanshekki',
    '',
    `Data: ${userData}`
  ].join('\n')
  const win = mainWindow
  const opts = {
    type: 'info' as const,
    title: en
      ? `About ${APP_DISPLAY_NAME_EN}`
      : `關於${APP_DISPLAY_NAME_ZH}`,
    message: en ? APP_DISPLAY_NAME_EN : APP_DISPLAY_NAME,
    detail,
    buttons: [
      en ? 'Support / Donate' : 'Support / Donate',
      en ? 'Open data folder' : '開啟資料資料夾',
      en ? 'OK' : '確定'
    ],
    defaultId: 2,
    cancelId: 2
  }
  const box =
    win && !win.isDestroyed()
      ? dialog.showMessageBox(win, opts)
      : dialog.showMessageBox(opts)
  void box.then((r) => {
    if (r.response === 0) {
      void shell.openExternal('https://linktr.ee/yanshekki')
    } else if (r.response === 1) {
      void shell.openPath(userData)
    }
  })
}

async function runCaptureScreenshot(): Promise<void> {
  const win = mainWindow
  if (!win || win.isDestroyed()) return
  const lang = loadMenuLang()
  try {
    const image = await win.webContents.capturePage()
    const png = image.toPNG()
    if (!png.length) {
      await dialog.showMessageBox(win, {
        type: 'error',
        title: lang === 'en' ? 'Screenshot failed' : '截圖失敗',
        message:
          lang === 'en'
            ? 'Could not capture the window.'
            : '無法擷取視窗畫面。'
      })
      return
    }
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
    let defaultDir = app.getPath('pictures')
    try {
      if (!existsSync(defaultDir)) defaultDir = app.getPath('desktop')
    } catch {
      defaultDir = app.getPath('userData')
    }
    const defaultPath = join(defaultDir, `idm-screenshot-${stamp}.png`)
    const result = await dialog.showSaveDialog(win, {
      title: lang === 'en' ? 'Save screenshot' : '儲存截圖',
      defaultPath,
      filters: [{ name: 'PNG', extensions: ['png'] }]
    })
    if (result.canceled || !result.filePath) return
    writeFileSync(result.filePath, png)
    shell.showItemInFolder(result.filePath)
    if (!win.isDestroyed()) {
      win.webContents.send('menu:action', {
        type: 'screenshot-saved',
        filePath: result.filePath
      })
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    if (!win.isDestroyed()) {
      await dialog.showMessageBox(win, {
        type: 'error',
        title: lang === 'en' ? 'Screenshot failed' : '截圖失敗',
        message
      })
    }
  }
}

function setupApplicationMenu(): void {
  const handlers: AppMenuHandlers = {
    sendAction: (action) => sendMenuActionToRenderer(action),
    showAbout: () => showAboutDialog(),
    exportFullBackup: () => {
      void runExportFullBackup()
    },
    importFullBackup: () => {
      void runImportFullBackup()
    },
    openUserData: () => {
      void shell.openPath(app.getPath('userData'))
    },
    openMedia: () => {
      const media = join(app.getPath('userData'), 'media')
      try {
        if (!existsSync(media)) mkdirSync(media, { recursive: true })
      } catch {
        /* ignore */
      }
      void shell.openPath(media)
    },
    exportSupportReport: () => {
      void runExportSupportFromMenu()
    },
    checkUpdates: () => {
      void appUpdateService.check().then((state) => {
        const lang = loadMenuLang()
        const win = mainWindow
        if (!win || win.isDestroyed()) return
        const channel = state.channel || 'desktop-dev'
        void dialog.showMessageBox(win, {
          type: state.status === 'error' ? 'error' : 'info',
          title: lang === 'en' ? 'Updates' : '更新',
          message:
            lang === 'en'
              ? `Status: ${state.status} (${channel})`
              : `狀態：${state.status}（${channel}）`,
          detail: [
            state.latestVersion != null
              ? `Latest: ${state.latestVersion}`
              : null,
            `Current: ${state.currentVersion}`,
            state.message || null,
            state.releaseUrl ? `Releases: ${state.releaseUrl}` : null
          ]
            .filter(Boolean)
            .join('\n')
        })
      })
    },
    captureScreenshot: () => {
      void runCaptureScreenshot()
    },
    isDev
  }
  installAppMenu(loadMenuLang(), handlers)
}

/** Rebuild menu after UI language change. */
export function rebuildApplicationMenu(): void {
  setupApplicationMenu()
}

/** Official display names (UI / window / menus). */
export const APP_DISPLAY_NAME_ZH = '瞬劇魔法師'
export const APP_DISPLAY_NAME_EN = 'InstantDrama Magician'
export const APP_DISPLAY_NAME = `${APP_DISPLAY_NAME_ZH} · ${APP_DISPLAY_NAME_EN}`

/**
 * Linux desktop Icon= / hicolor name / StartupWMClass / Chromium --class.
 * Must stay in sync with package.json build.linux.desktop + executableName.
 */
const APP_ICON_NAME = 'instant-drama-magician'

// Must run before app ready — otherwise panel cannot match themed icons.
if (process.platform === 'linux') {
  app.commandLine.appendSwitch('class', APP_ICON_NAME)
}

/** Resolve packaged or dev app icon (pure YSK mark). */
export function resolveAppIconPath(): string | undefined {
  return resolveAppIconPathFrom([
    join(process.resourcesPath || '', 'icon.png'),
    join(app.getAppPath(), 'resources', 'icon.png'),
    join(__dirname, '../../resources/icon.png'),
    join(__dirname, '../../../resources/icon.png'),
    join(process.cwd(), 'resources', 'icon.png'),
    join(process.cwd(), 'build', 'icon.png'),
    join(process.cwd(), 'build', 'icons', '512x512.png'),
    join(process.cwd(), 'src', 'assets', 'app-icon.png')
  ])
}

/**
 * Linux taskbars ignore BrowserWindow.icon unless a themed icon + .desktop
 * exist with matching StartupWMClass. Install user-local icons in dev/runtime.
 */
export function installLinuxDesktopIcon(iconPath: string): void {
  if (process.platform !== 'linux') return
  const home = process.env.HOME || app.getPath('home')
  installLinuxDesktopIconPure({
    iconPath,
    home,
    appIconName: APP_ICON_NAME,
    displayNameEn: APP_DISPLAY_NAME_EN,
    displayNameZh: APP_DISPLAY_NAME_ZH,
    execPath: process.execPath,
    extraArgs: process.argv.slice(1),
    iconsRootCandidates: [
      join(process.cwd(), 'build', 'icons'),
      join(process.resourcesPath || '', 'icons'),
      join(app.getAppPath(), 'build', 'icons')
    ],
    cwd: process.cwd(),
    resourcesPath: process.resourcesPath || ''
  })
}

export function applyWindowIcon(win: BrowserWindow, iconPath: string): void {
  applyWindowIconPure(
    win,
    iconPath,
    (p) => nativeImage.createFromPath(p),
    process.platform
  )
}

export { collectAllowedMediaRoots, ensureDirsNonFatal } from './pureHelpers'


function createWindow(): void {
  const version = app.getVersion()
  const iconPath = resolveAppIconPath()
  // eslint-disable-next-line no-console
  console.log('[icon] path=', iconPath || '(none)')
  const icon =
    iconPath && existsSync(iconPath)
      ? nativeImage.createFromPath(iconPath)
      : undefined
  if (iconPath && icon?.isEmpty()) {
    // eslint-disable-next-line no-console
    console.warn('[icon] loaded empty nativeImage from', iconPath)
  }

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    show: false,
    title: `${APP_DISPLAY_NAME} v${version}`,
    backgroundColor: '#020617',
    ...(icon && !icon.isEmpty() ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  if (iconPath) {
    applyWindowIcon(mainWindow, iconPath)
  }

  mainWindow.once('ready-to-show', () => {
    if (iconPath && mainWindow && !mainWindow.isDestroyed()) {
      applyWindowIcon(mainWindow, iconPath)
    }
    mainWindow?.show()
  })

  if (isDev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

app.whenReady().then(() => {
  // One-shot migration from prisma/dev.db, ~/.local/share/idm, etc.
  try {
    const mig = migrateAppDataIfNeeded({
      paths: appPaths,
      cwd: process.cwd()
    })
    if (mig.ran && mig.actions.length) {
      // eslint-disable-next-line no-console
      console.log('[appPaths] data root', appPaths.dataRoot)
      // eslint-disable-next-line no-console
      console.log('[appPaths] migration', mig.actions.join('; '))
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[appPaths] migration skipped', e)
  }

  // App name shown in taskbar / Alt-Tab / dock (not package.json "name")
  app.setName(APP_DISPLAY_NAME_EN)
  process.title = APP_DISPLAY_NAME_EN
  if (process.platform === 'win32') {
    app.setAppUserModelId('hk.ysk.instant-drama-magician')
  } else if (process.platform === 'linux') {
    // Match .desktop StartupWMClass (executableName) for panel icons
    app.setAppUserModelId(APP_ICON_NAME)
  }

  const iconPath = resolveAppIconPath()
  if (iconPath) {
    // eslint-disable-next-line no-console
    console.log('[icon] installing', iconPath)
    installLinuxDesktopIcon(iconPath)
  } else {
    // eslint-disable-next-line no-console
    console.warn('[icon] no icon file found')
  }

  const mediaRoot = join(app.getPath('userData'), 'media')
  /**
   * Allow preview of stills under this app's userData/media, plus sibling
   * InstantDrama data dirs (dev vs packaged names, path migration). Without
   * this, toPreviewUrl succeeds (file exists) but idm-media returns 403 →
   * broken "dead" thumbs in confirm modals / galleries.
   */
  const isAllowedMediaPath = (resolved: string): boolean => {
    const roots = collectAllowedMediaRoots({
      mediaRoot,
      userData: app.getPath('userData'),
      configHome: join(homedir(), '.config'),
      cwd: process.cwd()
    })
    return roots.some(
      (root) => resolved === root || resolved.startsWith(root + sep)
    )
  }
  protocol.handle('idm-media', (request) => {
    try {
      const u = new URL(request.url)
      const p = u.searchParams.get('p')
      if (!p) return new Response('missing path', { status: 400 })
      const filePath = decodeURIComponent(p)
      const resolved = pathResolve(filePath)
      if (!isAllowedMediaPath(resolved)) {
        return new Response('forbidden', { status: 403 })
      }
      if (!existsSync(resolved)) {
        return new Response('not found', { status: 404 })
      }
      return serveLocalMediaFile(resolved, request)
    } catch {
      return new Response('bad request', { status: 400 })
    }
  })

  registerIpcHandlers({
    ipcMain,
    dialog,
    shell,
    getPrisma,
    getMainWindow: () => mainWindow,
    rebuildApplicationMenu,
    resolveDatabasePath: resolveDbFilePath,
    exportFullBackup: () => runExportFullBackup(),
    importFullBackup: () => runImportFullBackup()
  })

  setupApplicationMenu()
  appUpdateService.bindWindow(() => mainWindow)
  createWindow()

  // Auto-start embedded web server if enabled in settings
  setTimeout(() => {
    void (async () => {
      try {
        const { SettingsStore } = await import(
          '../../src/infrastructure/settings/SettingsStore'
        )
        const {
          getEmbeddedWebServer,
          generateWebServerToken
        } = await import(
          '../../src/infrastructure/webserver/EmbeddedWebServer'
        )
        const store = new SettingsStore(
          join(app.getPath('userData'), 'settings.json')
        )
        let s = store.load()
        if (!s.webServerEnabled) return
        let token = s.webServerAuthToken?.trim() || ''
        if (!token) {
          token = generateWebServerToken()
          s = store.save({ webServerAuthToken: token })
        }
        const staticCandidates = [
          join(__dirname, '../renderer'),
          join(process.cwd(), 'out', 'renderer')
        ]
        let staticDir = staticCandidates[0]
        for (const c of staticCandidates) {
          if (existsSync(join(c, 'index.html'))) {
            staticDir = c
            break
          }
        }
        await getEmbeddedWebServer().start({
          dataDir: app.getPath('userData'),
          port: s.webServerPort || 8787,
          host: s.webServerHost || '0.0.0.0',
          authToken: token,
          authDisabled: false,
          staticDir,
          appVersion: app.getVersion(),
          isPackaged: app.isPackaged
        })
      } catch {
        /* non-fatal — Settings can retry */
      }
    })()
  }, 1200)

  // Auto-start local Grok Gateway + provision key via runtime (rebinds aiClient).
  // Must NOT use a separate SettingsStore — that left disk key ready while AI stayed offline.
  setTimeout(() => {
    void (async () => {
      try {
        const { getIpcRuntime } = await import('./ipc')
        const runtime = getIpcRuntime()
        if (!runtime) return
        const s = runtime.settingsStore.load()
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
    })()
  }, 1500)

  // Packaged builds: quiet check a few seconds after launch (non-blocking)
  if (app.isPackaged) {
    setTimeout(() => {
      void appUpdateService.check({ silent: true }).catch(() => undefined)
    }, 8000)
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', async () => {
  try {
    const { getEmbeddedWebServer } = await import(
      '../../src/infrastructure/webserver/EmbeddedWebServer'
    )
    await getEmbeddedWebServer().stop()
  } catch {
    /* ignore */
  }
  if (prisma) {
    await prisma.$disconnect()
  }
})

// Expose helpers for soul.md import validation in main process
export function readSoulMd(filePath: string): string | null {
  if (!existsSync(filePath)) return null
  if (!filePath.toLowerCase().endsWith('.md')) return null
  return readFileSync(filePath, 'utf-8')
}
