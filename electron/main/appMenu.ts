/**
 * Native application menu (File / Edit / View / Window / Help).
 * Replaces Chromium's empty default shell with product actions.
 */
import {
  BrowserWindow,
  Menu,
  shell,
  type MenuItemConstructorOptions
} from 'electron'
import {
  coerceNativeLang,
  nativeLabels,
  type NativeLang
} from './nativeCopy'

export type MenuAction =
  | { type: 'navigate'; path: string }
  | { type: 'new-story' }
  | { type: 'export-full' }
  | { type: 'import-full' }
  | { type: 'export-story' }
  | { type: 'import-story' }
  | { type: 'export-support' }
  | { type: 'preferences' }
  | { type: 'about' }
  | { type: 'check-updates' }
  | { type: 'open-user-data' }
  | { type: 'open-media' }
  | { type: 'full-backup-exported'; filePath: string }
  | { type: 'screenshot-saved'; filePath: string }
  | { type: 'open-legal'; kind: 'disclaimer' | 'terms' }

export type MenuLang = NativeLang

const YSK_HOME = 'https://ysk.hk/'
const CREATOR_LINKTREE = 'https://linktr.ee/yanshekki'

export function coerceMenuLang(raw: string | undefined | null): MenuLang {
  return coerceNativeLang(raw)
}

export interface AppMenuHandlers {
  sendAction: (action: MenuAction) => void
  /** Open native About dialog (main process). */
  showAbout: () => void
  /** Run full backup export (main). */
  exportFullBackup: () => void
  /** Run full backup import + relaunch (main). */
  importFullBackup: () => void
  openUserData: () => void
  openMedia: () => void
  exportSupportReport: () => void
  checkUpdates: () => void
  /** Capture main window to PNG (save dialog). */
  captureScreenshot: () => void
  isDev: boolean
}

function accel(mac: string, other: string): string {
  return process.platform === 'darwin' ? mac : other
}

function menuT(lang: MenuLang): Record<string, string> {
  return nativeLabels(lang)
}

export function buildAppMenuTemplate(
  lang: MenuLang,
  handlers: AppMenuHandlers
): MenuItemConstructorOptions[] {
  const t = menuT(lang)
  const isMac = process.platform === 'darwin'

  const fileMenu: MenuItemConstructorOptions = {
    label: t.file,
    submenu: [
      {
        label: t.newStory,
        accelerator: accel('Cmd+N', 'Ctrl+N'),
        click: () => handlers.sendAction({ type: 'new-story' })
      },
      { type: 'separator' },
      {
        label: t.importStory,
        click: () => handlers.sendAction({ type: 'import-story' })
      },
      {
        label: t.exportStory,
        click: () => handlers.sendAction({ type: 'export-story' })
      },
      { type: 'separator' },
      {
        label: t.exportFull,
        accelerator: accel('Cmd+E', 'Ctrl+E'),
        click: () => handlers.exportFullBackup()
      },
      {
        label: t.importFull,
        accelerator: accel('Cmd+Shift+O', 'Ctrl+Shift+O'),
        click: () => handlers.importFullBackup()
      },
      { type: 'separator' },
      {
        label: t.openUserData,
        click: () => handlers.openUserData()
      },
      {
        label: t.openMedia,
        click: () => handlers.openMedia()
      },
      { type: 'separator' },
      {
        label: t.preferences,
        accelerator: accel('Cmd+,', 'Ctrl+,'),
        click: () => handlers.sendAction({ type: 'preferences' })
      },
      ...(isMac
        ? []
        : ([
            { type: 'separator' as const },
            { role: 'quit' as const, label: t.quit }
          ] as MenuItemConstructorOptions[]))
    ]
  }

  const editMenu: MenuItemConstructorOptions = {
    label: t.edit,
    submenu: [
      { role: 'undo', label: t.undo },
      { role: 'redo', label: t.redo },
      { type: 'separator' },
      { role: 'cut', label: t.cut },
      { role: 'copy', label: t.copy },
      { role: 'paste', label: t.paste },
      { role: 'selectAll', label: t.selectAll }
    ]
  }

  const viewNav: MenuItemConstructorOptions[] = [
    {
      label: t.navStories,
      accelerator: accel('Cmd+1', 'Ctrl+1'),
      click: () => handlers.sendAction({ type: 'navigate', path: '/' })
    },
    {
      label: t.navCharacters,
      accelerator: accel('Cmd+2', 'Ctrl+2'),
      click: () => handlers.sendAction({ type: 'navigate', path: '/characters' })
    },
    {
      label: t.navCostumes,
      accelerator: accel('Cmd+3', 'Ctrl+3'),
      click: () => handlers.sendAction({ type: 'navigate', path: '/costumes' })
    },
    {
      label: t.navScenes,
      accelerator: accel('Cmd+4', 'Ctrl+4'),
      click: () => handlers.sendAction({ type: 'navigate', path: '/scenes' })
    },
    {
      label: t.navProps,
      accelerator: accel('Cmd+5', 'Ctrl+5'),
      click: () => handlers.sendAction({ type: 'navigate', path: '/props' })
    },
    {
      label: t.navActions,
      accelerator: accel('Cmd+6', 'Ctrl+6'),
      click: () => handlers.sendAction({ type: 'navigate', path: '/actions' })
    },
    {
      label: t.navComics,
      click: () => handlers.sendAction({ type: 'navigate', path: '/comics' })
    },
    {
      label: t.navKeyArt,
      click: () => handlers.sendAction({ type: 'navigate', path: '/key-art' })
    },
    {
      label: t.navTimeline,
      submenu: [
        {
          label: t.navTimelineTrack,
          accelerator: accel('Cmd+7', 'Ctrl+7'),
          click: () => handlers.sendAction({ type: 'navigate', path: '/timeline' })
        },
        {
          label: t.navTimelineBoard,
          click: () =>
            handlers.sendAction({ type: 'navigate', path: '/timeline-v2' })
        }
      ]
    },
    {
      label: t.navAudit,
      accelerator: accel('Cmd+8', 'Ctrl+8'),
      click: () => handlers.sendAction({ type: 'navigate', path: '/audit' })
    },
    {
      label: t.navSettings,
      accelerator: accel('Cmd+9', 'Ctrl+9'),
      click: () => handlers.sendAction({ type: 'navigate', path: '/settings' })
    },
    { type: 'separator' },
    {
      label: t.captureScreenshot,
      accelerator: accel('Cmd+Shift+S', 'Ctrl+Shift+S'),
      click: () => handlers.captureScreenshot()
    },
    { type: 'separator' },
    { role: 'reload', label: t.reload },
    { role: 'forceReload', label: t.forceReload },
    { role: 'resetZoom', label: t.actualSize },
    { role: 'zoomIn', label: t.zoomIn },
    { role: 'zoomOut', label: t.zoomOut },
    { type: 'separator' },
    { role: 'togglefullscreen', label: t.toggleFullscreen }
  ]

  if (handlers.isDev) {
    viewNav.push(
      { type: 'separator' },
      { role: 'toggleDevTools', label: t.toggleDevTools }
    )
  }

  const viewMenu: MenuItemConstructorOptions = {
    label: t.view,
    submenu: viewNav
  }

  const windowMenu: MenuItemConstructorOptions = {
    label: t.window,
    submenu: [
      { role: 'minimize', label: t.minimize },
      { role: 'zoom', label: t.zoom },
      ...(isMac
        ? ([
            { type: 'separator' as const },
            { role: 'front' as const }
          ] as MenuItemConstructorOptions[])
        : ([
            { role: 'close' as const, label: t.close }
          ] as MenuItemConstructorOptions[]))
    ]
  }

  const helpMenu: MenuItemConstructorOptions = {
    label: t.help,
    submenu: [
      {
        label: t.about,
        click: () => handlers.showAbout()
      },
      {
        label: t.disclaimer,
        click: () =>
          handlers.sendAction({ type: 'open-legal', kind: 'disclaimer' })
      },
      {
        label: t.terms,
        click: () =>
          handlers.sendAction({ type: 'open-legal', kind: 'terms' })
      },
      { type: 'separator' },
      {
        label: t.exportSupport,
        click: () => handlers.exportSupportReport()
      },
      {
        label: t.openUserData,
        click: () => handlers.openUserData()
      },
      {
        label: t.checkUpdates,
        click: () => handlers.checkUpdates()
      },
      { type: 'separator' },
      {
        label: t.supportDonate,
        click: () => {
          void shell.openExternal(CREATOR_LINKTREE)
        }
      },
      {
        label: t.yskWebsite,
        click: () => {
          void shell.openExternal(YSK_HOME)
        }
      }
    ]
  }

  const template: MenuItemConstructorOptions[] = []

  if (isMac) {
    template.push({
      label: t.appMenu,
      submenu: [
        {
          label: t.about,
          click: () => handlers.showAbout()
        },
        { type: 'separator' },
        {
          label: t.preferences,
          accelerator: 'Cmd+,',
          click: () => handlers.sendAction({ type: 'preferences' })
        },
        { type: 'separator' },
        { role: 'services', label: t.services },
        { type: 'separator' },
        { role: 'hide', label: t.hide },
        { role: 'hideOthers', label: t.hideOthers },
        { role: 'unhide', label: t.unhide },
        { type: 'separator' },
        { role: 'quit', label: t.quitMac }
      ]
    })
  }

  template.push(fileMenu, editMenu, viewMenu, windowMenu, helpMenu)
  return template
}

export function installAppMenu(
  lang: MenuLang,
  handlers: AppMenuHandlers
): void {
  const template = buildAppMenuTemplate(lang, handlers)
  const menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)
}

/** Send a menu action to the focused (or first) renderer. */
export function sendMenuActionToRenderer(action: MenuAction): void {
  const win =
    BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
  if (!win || win.isDestroyed()) return
  win.webContents.send('menu:action', action)
}
