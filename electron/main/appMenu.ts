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

export type MenuLang = 'zh-HK' | 'en'

const YSK_HOME = 'https://ysk.hk/'
const CREATOR_LINKTREE = 'https://linktr.ee/yanshekki'

const LABELS: Record<MenuLang, Record<string, string>> = {
  'zh-HK': {
    file: '檔案',
    newStory: '新增故事',
    importStory: '匯入故事備份…',
    exportStory: '匯出目前故事備份…',
    exportFull: '匯出全部應用資料…',
    importFull: '從全部資料還原…',
    openUserData: '開啟資料資料夾',
    openMedia: '開啟媒體資料夾',
    preferences: '偏好設定…',
    quit: '結束',
    edit: '編輯',
    undo: '還原',
    redo: '重做',
    cut: '剪下',
    copy: '複製',
    paste: '貼上',
    selectAll: '全選',
    view: '檢視',
    navStories: '故事',
    navCharacters: '角色',
    navCostumes: '戲服',
    navScenes: '場景',
    navProps: '道具',
    navActions: '動作',
    navTimeline: '時間軸',
    navAudit: '活動紀錄',
    navSettings: '設定',
    reload: '重新載入',
    forceReload: '強制重新載入',
    actualSize: '實際大小',
    zoomIn: '放大',
    zoomOut: '縮小',
    toggleFullscreen: '切換全螢幕',
    toggleDevTools: '開發者工具',
    captureScreenshot: '截取視窗畫面…',
    window: '視窗',
    minimize: '最小化',
    zoom: '縮放',
    close: '關閉',
    help: '說明',
    about: '關於瞬劇魔法師',
    disclaimer: '免責聲明…',
    terms: '使用守則…',
    exportSupport: '匯出支援報告…',
    checkUpdates: '檢查更新…',
    yskWebsite: 'YSK 網站',
    supportDonate: 'Support / Donate…',
    appMenu: '瞬劇魔法師',
    services: '服務',
    hide: '隱藏瞬劇魔法師',
    hideOthers: '隱藏其他',
    unhide: '顯示全部',
    quitMac: '結束瞬劇魔法師'
  },
  en: {
    file: 'File',
    newStory: 'New Story',
    importStory: 'Import Story Backup…',
    exportStory: 'Export Current Story Backup…',
    exportFull: 'Export All App Data…',
    importFull: 'Restore from Full Backup…',
    openUserData: 'Open Data Folder',
    openMedia: 'Open Media Folder',
    preferences: 'Preferences…',
    quit: 'Quit',
    edit: 'Edit',
    undo: 'Undo',
    redo: 'Redo',
    cut: 'Cut',
    copy: 'Copy',
    paste: 'Paste',
    selectAll: 'Select All',
    view: 'View',
    navStories: 'Stories',
    navCharacters: 'Characters',
    navCostumes: 'Costumes',
    navScenes: 'Scenes',
    navProps: 'Props',
    navActions: 'Actions',
    navTimeline: 'Timeline',
    navAudit: 'Activity Log',
    navSettings: 'Settings',
    reload: 'Reload',
    forceReload: 'Force Reload',
    actualSize: 'Actual Size',
    zoomIn: 'Zoom In',
    zoomOut: 'Zoom Out',
    toggleFullscreen: 'Toggle Full Screen',
    toggleDevTools: 'Toggle Developer Tools',
    captureScreenshot: 'Capture Window Screenshot…',
    window: 'Window',
    minimize: 'Minimize',
    zoom: 'Zoom',
    close: 'Close',
    help: 'Help',
    about: 'About InstantDrama Magician',
    disclaimer: 'Disclaimer…',
    terms: 'Acceptable Use…',
    exportSupport: 'Export Support Report…',
    checkUpdates: 'Check for Updates…',
    yskWebsite: 'YSK Website',
    supportDonate: 'Support / Donate…',
    appMenu: 'InstantDrama Magician',
    services: 'Services',
    hide: 'Hide InstantDrama Magician',
    hideOthers: 'Hide Others',
    unhide: 'Show All',
    quitMac: 'Quit InstantDrama Magician'
  }
}

export function coerceMenuLang(raw: string | undefined | null): MenuLang {
  if (!raw) return 'zh-HK'
  const s = raw.toLowerCase()
  if (s.startsWith('en')) return 'en'
  if (s.startsWith('zh')) return 'zh-HK'
  return 'en'
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

export function buildAppMenuTemplate(
  lang: MenuLang,
  handlers: AppMenuHandlers
): MenuItemConstructorOptions[] {
  const t = LABELS[lang]
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
      label: t.navTimeline,
      accelerator: accel('Cmd+7', 'Ctrl+7'),
      click: () => handlers.sendAction({ type: 'navigate', path: '/timeline' })
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
