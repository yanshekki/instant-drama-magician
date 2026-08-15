/**
 * Native (Electron main) UI copy — menus + system dialogs.
 * Ten UI languages; no en/zh ternary at call sites.
 */

export type NativeLang =
  | 'en'
  | 'zh-HK'
  | 'zh-CN'
  | 'ja'
  | 'es'
  | 'fr'
  | 'pt-BR'
  | 'ru'
  | 'hi'
  | 'ar'

export const NATIVE_COPY_KEYS = [
  'file',
  'newStory',
  'importStory',
  'exportStory',
  'exportFull',
  'importFull',
  'openUserData',
  'openMedia',
  'preferences',
  'quit',
  'edit',
  'undo',
  'redo',
  'cut',
  'copy',
  'paste',
  'selectAll',
  'view',
  'navStories',
  'navCharacters',
  'navCostumes',
  'navScenes',
  'navProps',
  'navActions',
  'navComics',
  'navTimeline',
  'navTimelineTrack',
  'navTimelineBoard',
  'navTimelineV2',
  'navAudit',
  'navSettings',
  'reload',
  'forceReload',
  'actualSize',
  'zoomIn',
  'zoomOut',
  'toggleFullscreen',
  'toggleDevTools',
  'captureScreenshot',
  'window',
  'minimize',
  'zoom',
  'close',
  'help',
  'about',
  'disclaimer',
  'terms',
  'exportSupport',
  'checkUpdates',
  'yskWebsite',
  'supportDonate',
  'appMenu',
  'services',
  'hide',
  'hideOthers',
  'unhide',
  'quitMac',
  'appName',
  'exportAllAppData',
  'exportComplete',
  'exportSaved',
  'showInFolder',
  'ok',
  'exportFailed',
  'restoreFromFullBackup',
  'overwriteAllLocalData',
  'exportFirstHint',
  'cancel',
  'restoreAndRestart',
  'restoreFailed',
  'exportSupportReport',
  'screenshotFailed',
  'couldNotCapture',
  'saveScreenshot',
  'updates',
  'updateStatus',
  'aboutTitle',
  'creatorLine',
  'supportDonateBlurb',
  'openDataFolder',
  'importMsgWindowed',
  'importMsgBare'
] as const

export type NativeCopyKey = (typeof NATIVE_COPY_KEYS)[number]
export type NativeCopyTable = Record<NativeCopyKey, string>

const en: NativeCopyTable = {
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
  navComics: 'Comics',
  navTimeline: 'Timeline',
  navTimelineTrack: 'Track view',
  navTimelineBoard: 'Board view',
  navTimelineV2: 'Timeline · Board',
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
  quitMac: 'Quit InstantDrama Magician',
  appName: 'InstantDrama Magician',
  exportAllAppData: 'Export all app data',
  exportComplete: 'Export complete',
  exportSaved: 'Full backup saved:\n{{path}}',
  showInFolder: 'Show in folder',
  ok: 'OK',
  exportFailed: 'Export failed',
  restoreFromFullBackup: 'Restore from full backup',
  overwriteAllLocalData: 'Overwrite all local data?',
  exportFirstHint:
    'Export a full backup first if you need to keep the current data.',
  cancel: 'Cancel',
  restoreAndRestart: 'Restore and Restart',
  restoreFailed: 'Restore failed',
  exportSupportReport: 'Export support report',
  screenshotFailed: 'Screenshot failed',
  couldNotCapture: 'Could not capture the window.',
  saveScreenshot: 'Save screenshot',
  updates: 'Updates',
  updateStatus: 'Status: {{status}} ({{channel}})',
  aboutTitle: 'About {{name}}',
  creatorLine: 'Creator: Ki (yanshekki) · YSK Limited',
  supportDonateBlurb:
    'Support / Donate — if InstantDrama Magician helps your short-drama workflow, consider buying me a coffee!',
  openDataFolder: 'Open data folder',
  importMsgWindowed:
    'This will replace the database, media library, and settings on this computer, then restart the app.',
  importMsgBare:
    'This will replace the database, media library, and settings, then restart.'
}

const zhHK: NativeCopyTable = {
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
  navComics: '漫畫',
  navTimeline: '時間軸',
  navTimelineTrack: '軌道顯示',
  navTimelineBoard: '流程顯示',
  navTimelineV2: '時間軸 · 流程',
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
  quitMac: '結束瞬劇魔法師',
  appName: '瞬劇魔法師',
  exportAllAppData: '匯出全部應用資料',
  exportComplete: '匯出完成',
  exportSaved: '已匯出全部應用資料：\n{{path}}',
  showInFolder: '在資料夾中顯示',
  ok: '確定',
  exportFailed: '匯出失敗',
  restoreFromFullBackup: '從全部資料還原',
  overwriteAllLocalData: '覆寫本機全部資料？',
  exportFirstHint: '如需保留現有資料，請先「匯出全部應用資料」。',
  cancel: '取消',
  restoreAndRestart: '還原並重新啟動',
  restoreFailed: '還原失敗',
  exportSupportReport: '匯出支援報告',
  screenshotFailed: '截圖失敗',
  couldNotCapture: '無法擷取視窗畫面。',
  saveScreenshot: '儲存截圖',
  updates: '更新',
  updateStatus: '狀態：{{status}}（{{channel}}）',
  aboutTitle: '關於{{name}}',
  creatorLine: '創作者：Ki (yanshekki) · YSK Limited',
  supportDonateBlurb:
    'Support / Donate — 如果「瞬劇魔法師」幫到你的短劇創作，歡迎請我喝杯咖啡！',
  openDataFolder: '開啟資料資料夾',
  importMsgWindowed:
    '此操作會覆寫本機資料庫、媒體庫與設定，然後重新啟動應用程式。',
  importMsgBare: '此操作會覆寫本機資料庫、媒體庫與設定，然後重新啟動。'
}

function hans(s: string): string {
  return s
    .replaceAll('檔', '档')
    .replaceAll('匯', '汇')
    .replaceAll('備', '备')
    .replaceAll('從', '从')
    .replaceAll('還', '还')
    .replaceAll('開', '开')
    .replaceAll('啟', '启')
    .replaceAll('夾', '夹')
    .replaceAll('設', '设')
    .replaceAll('結', '结')
    .replaceAll('編', '编')
    .replaceAll('輯', '辑')
    .replaceAll('選', '选')
    .replaceAll('檢', '检')
    .replaceAll('視', '视')
    .replaceAll('戲', '戏')
    .replaceAll('場', '场')
    .replaceAll('動', '动')
    .replaceAll('時', '时')
    .replaceAll('軸', '轴')
    .replaceAll('顯', '显')
    .replaceAll('錄', '录')
    .replaceAll('載', '载')
    .replaceAll('強', '强')
    .replaceAll('際', '际')
    .replaceAll('換', '换')
    .replaceAll('螢', '荧')
    .replaceAll('發', '发')
    .replaceAll('窗', '窗')
    .replaceAll('關', '关')
    .replaceAll('閉', '闭')
    .replaceAll('說', '说')
    .replaceAll('於', '于')
    .replaceAll('劇', '剧')
    .replaceAll('師', '师')
    .replaceAll('責', '责')
    .replaceAll('聲', '声')
    .replaceAll('則', '则')
    .replaceAll('報', '报')
    .replaceAll('查', '查')
    .replaceAll('網', '网')
    .replaceAll('隱', '隐')
    .replaceAll('藏', '藏')
    .replaceAll('務', '务')
    .replaceAll('應', '应')
    .replaceAll('資', '资')
    .replaceAll('料', '料')
    .replaceAll('完', '完')
    .replaceAll('確', '确')
    .replaceAll('敗', '败')
    .replaceAll('覆', '覆')
    .replaceAll('寫', '写')
    .replaceAll('機', '机')
    .replaceAll('請', '请')
    .replaceAll('現', '现')
    .replaceAll('並', '并')
    .replaceAll('圖', '图')
    .replaceAll('無', '无')
    .replaceAll('擷', '撷')
    .replaceAll('儲', '储')
    .replaceAll('狀', '状')
    .replaceAll('態', '态')
    .replaceAll('創', '创')
    .replaceAll('作', '作')
    .replaceAll('幫', '帮')
    .replaceAll('歡', '欢')
    .replaceAll('迎', '迎')
    .replaceAll('庫', '库')
    .replaceAll('與', '与')
    .replaceAll('這', '这')
    .replaceAll('個', '个')
    .replaceAll('畫', '画')
}

const zhCN: NativeCopyTable = Object.fromEntries(
  Object.entries(zhHK).map(([k, v]) => [k, hans(v)])
) as NativeCopyTable

const ja: NativeCopyTable = {
  ...en,
  file: 'ファイル',
  newStory: '新しい物語',
  importStory: '物語バックアップを読み込む…',
  exportStory: '現在の物語を書き出す…',
  exportFull: 'アプリデータをすべて書き出す…',
  importFull: '全バックアップから復元…',
  openUserData: 'データフォルダを開く',
  openMedia: 'メディアフォルダを開く',
  preferences: '環境設定…',
  quit: '終了',
  edit: '編集',
  undo: '取り消す',
  redo: 'やり直す',
  cut: 'カット',
  copy: 'コピー',
  paste: 'ペースト',
  selectAll: 'すべて選択',
  view: '表示',
  navStories: '物語',
  navCharacters: 'キャラクター',
  navCostumes: '衣装',
  navScenes: '場面',
  navProps: '小道具',
  navActions: '動作',
  navComics: '漫画',
  navTimeline: 'タイムライン',
  navTimelineTrack: 'トラック表示',
  navTimelineBoard: 'フロー表示',
  navTimelineV2: 'タイムライン · フロー',
  navAudit: '活動ログ',
  navSettings: '設定',
  reload: '再読み込み',
  forceReload: '強制再読み込み',
  actualSize: '実際のサイズ',
  zoomIn: '拡大',
  zoomOut: '縮小',
  toggleFullscreen: 'フルスクリーン切替',
  toggleDevTools: '開発者ツール',
  captureScreenshot: 'ウィンドウをキャプチャ…',
  window: 'ウィンドウ',
  minimize: '最小化',
  zoom: 'ズーム',
  close: '閉じる',
  help: 'ヘルプ',
  about: 'InstantDrama Magician について',
  disclaimer: '免責事項…',
  terms: '利用規則…',
  exportSupport: 'サポート報告を書き出す…',
  checkUpdates: '更新を確認…',
  yskWebsite: 'YSK サイト',
  supportDonate: 'Support / Donate…',
  appMenu: 'InstantDrama Magician',
  services: 'サービス',
  hide: 'InstantDrama Magician を隠す',
  hideOthers: 'ほかを隠す',
  unhide: 'すべて表示',
  quitMac: 'InstantDrama Magician を終了',
  appName: 'InstantDrama Magician',
  exportAllAppData: 'アプリデータをすべて書き出す',
  exportComplete: '書き出し完了',
  exportSaved: '全バックアップを保存しました：\n{{path}}',
  showInFolder: 'フォルダで表示',
  ok: 'OK',
  exportFailed: '書き出し失敗',
  restoreFromFullBackup: '全バックアップから復元',
  overwriteAllLocalData: 'このパソコンのデータを上書きしますか？',
  exportFirstHint: '今のデータを残すなら、先に全バックアップを書き出してください。',
  cancel: 'キャンセル',
  restoreAndRestart: '復元して再起動',
  restoreFailed: '復元失敗',
  exportSupportReport: 'サポート報告を書き出す',
  screenshotFailed: 'スクリーンショット失敗',
  couldNotCapture: 'ウィンドウをキャプチャできませんでした。',
  saveScreenshot: 'スクリーンショットを保存',
  updates: '更新',
  updateStatus: '状態：{{status}}（{{channel}}）',
  aboutTitle: '{{name}} について',
  creatorLine: '作者：Ki (yanshekki) · YSK Limited',
  supportDonateBlurb:
    'Support / Donate — InstantDrama Magician が制作の助けになったら、コーヒーをおごってください。',
  openDataFolder: 'データフォルダを開く',
  importMsgWindowed:
    'データベース・メディア庫・設定を置き換えてからアプリを再起動します。',
  importMsgBare: 'データベース・メディア庫・設定を置き換えて再起動します。'
}

const es: NativeCopyTable = {
  ...en,
  file: 'Archivo',
  newStory: 'Nueva historia',
  importStory: 'Importar copia de historia…',
  exportStory: 'Exportar historia actual…',
  exportFull: 'Exportar todos los datos…',
  importFull: 'Restaurar desde copia completa…',
  openUserData: 'Abrir carpeta de datos',
  openMedia: 'Abrir carpeta de medios',
  preferences: 'Preferencias…',
  quit: 'Salir',
  edit: 'Editar',
  undo: 'Deshacer',
  redo: 'Rehacer',
  cut: 'Cortar',
  copy: 'Copiar',
  paste: 'Pegar',
  selectAll: 'Seleccionar todo',
  view: 'Ver',
  navStories: 'Historias',
  navCharacters: 'Personajes',
  navCostumes: 'Vestuario',
  navScenes: 'Escenas',
  navProps: 'Atrezzo',
  navActions: 'Acciones',
  navComics: 'Cómic',
  navTimeline: 'Línea de tiempo',
  navTimelineTrack: 'Vista de pista',
  navTimelineBoard: 'Vista de flujo',
  navTimelineV2: 'Línea de tiempo · Flujo',
  navAudit: 'Registro de actividad',
  navSettings: 'Ajustes',
  reload: 'Recargar',
  forceReload: 'Forzar recarga',
  actualSize: 'Tamaño real',
  zoomIn: 'Acercar',
  zoomOut: 'Alejar',
  toggleFullscreen: 'Pantalla completa',
  toggleDevTools: 'Herramientas de desarrollo',
  captureScreenshot: 'Capturar ventana…',
  window: 'Ventana',
  minimize: 'Minimizar',
  zoom: 'Zoom',
  close: 'Cerrar',
  help: 'Ayuda',
  about: 'Acerca de InstantDrama Magician',
  disclaimer: 'Aviso legal…',
  terms: 'Uso aceptable…',
  exportSupport: 'Exportar informe de soporte…',
  checkUpdates: 'Buscar actualizaciones…',
  yskWebsite: 'Sitio YSK',
  appMenu: 'InstantDrama Magician',
  services: 'Servicios',
  hide: 'Ocultar InstantDrama Magician',
  hideOthers: 'Ocultar otros',
  unhide: 'Mostrar todo',
  quitMac: 'Salir de InstantDrama Magician',
  exportAllAppData: 'Exportar todos los datos',
  exportComplete: 'Exportación completa',
  exportSaved: 'Copia completa guardada:\n{{path}}',
  showInFolder: 'Mostrar en carpeta',
  ok: 'Aceptar',
  exportFailed: 'Error al exportar',
  restoreFromFullBackup: 'Restaurar desde copia completa',
  overwriteAllLocalData: '¿Sobrescribir todos los datos locales?',
  exportFirstHint:
    'Exporte primero una copia completa si necesita conservar los datos actuales.',
  cancel: 'Cancelar',
  restoreAndRestart: 'Restaurar y reiniciar',
  restoreFailed: 'Error al restaurar',
  exportSupportReport: 'Exportar informe de soporte',
  screenshotFailed: 'Error de captura',
  couldNotCapture: 'No se pudo capturar la ventana.',
  saveScreenshot: 'Guardar captura',
  updates: 'Actualizaciones',
  updateStatus: 'Estado: {{status}} ({{channel}})',
  aboutTitle: 'Acerca de {{name}}',
  creatorLine: 'Creador: Ki (yanshekki) · YSK Limited',
  supportDonateBlurb:
    'Support / Donate — si InstantDrama Magician te ayuda, ¡invítame a un café!',
  openDataFolder: 'Abrir carpeta de datos',
  importMsgWindowed:
    'Esto reemplazará la base de datos, la biblioteca de medios y los ajustes de este equipo, y reiniciará la app.',
  importMsgBare:
    'Esto reemplazará la base de datos, la biblioteca de medios y los ajustes, y reiniciará.'
}

const fr: NativeCopyTable = {
  ...en,
  file: 'Fichier',
  newStory: 'Nouvelle histoire',
  importStory: 'Importer une sauvegarde d’histoire…',
  exportStory: 'Exporter l’histoire actuelle…',
  exportFull: 'Exporter toutes les données…',
  importFull: 'Restaurer depuis une sauvegarde complète…',
  openUserData: 'Ouvrir le dossier des données',
  openMedia: 'Ouvrir le dossier médias',
  preferences: 'Préférences…',
  quit: 'Quitter',
  edit: 'Édition',
  undo: 'Annuler',
  redo: 'Rétablir',
  cut: 'Couper',
  copy: 'Copier',
  paste: 'Coller',
  selectAll: 'Tout sélectionner',
  view: 'Affichage',
  navStories: 'Histoires',
  navCharacters: 'Personnages',
  navCostumes: 'Costumes',
  navScenes: 'Scènes',
  navProps: 'Accessoires',
  navActions: 'Actions',
  navComics: 'BD',
  navTimeline: 'Chronologie',
  navTimelineTrack: 'Vue piste',
  navTimelineBoard: 'Vue flux',
  navTimelineV2: 'Chronologie · Flux',
  navAudit: 'Journal d’activité',
  navSettings: 'Réglages',
  reload: 'Recharger',
  forceReload: 'Forcer le rechargement',
  actualSize: 'Taille réelle',
  zoomIn: 'Zoom avant',
  zoomOut: 'Zoom arrière',
  toggleFullscreen: 'Plein écran',
  toggleDevTools: 'Outils de développement',
  captureScreenshot: 'Capturer la fenêtre…',
  window: 'Fenêtre',
  minimize: 'Réduire',
  zoom: 'Zoom',
  close: 'Fermer',
  help: 'Aide',
  about: 'À propos d’InstantDrama Magician',
  disclaimer: 'Avertissement…',
  terms: 'Conditions d’usage…',
  exportSupport: 'Exporter le rapport de support…',
  checkUpdates: 'Rechercher des mises à jour…',
  yskWebsite: 'Site YSK',
  services: 'Services',
  hide: 'Masquer InstantDrama Magician',
  hideOthers: 'Masquer les autres',
  unhide: 'Tout afficher',
  quitMac: 'Quitter InstantDrama Magician',
  exportAllAppData: 'Exporter toutes les données',
  exportComplete: 'Export terminé',
  exportSaved: 'Sauvegarde complète enregistrée :\n{{path}}',
  showInFolder: 'Afficher dans le dossier',
  ok: 'OK',
  exportFailed: 'Échec de l’export',
  restoreFromFullBackup: 'Restaurer depuis une sauvegarde complète',
  overwriteAllLocalData: 'Écraser toutes les données locales ?',
  exportFirstHint:
    'Exportez d’abord une sauvegarde complète si vous devez conserver les données actuelles.',
  cancel: 'Annuler',
  restoreAndRestart: 'Restaurer et redémarrer',
  restoreFailed: 'Échec de la restauration',
  exportSupportReport: 'Exporter le rapport de support',
  screenshotFailed: 'Échec de la capture',
  couldNotCapture: 'Impossible de capturer la fenêtre.',
  saveScreenshot: 'Enregistrer la capture',
  updates: 'Mises à jour',
  updateStatus: 'État : {{status}} ({{channel}})',
  aboutTitle: 'À propos de {{name}}',
  creatorLine: 'Créateur : Ki (yanshekki) · YSK Limited',
  supportDonateBlurb:
    'Support / Donate — si InstantDrama Magician vous aide, offrez-moi un café !',
  openDataFolder: 'Ouvrir le dossier des données',
  importMsgWindowed:
    'Ceci remplacera la base, la médiathèque et les réglages de cet ordinateur, puis redémarrera l’app.',
  importMsgBare:
    'Ceci remplacera la base, la médiathèque et les réglages, puis redémarrera.'
}

const ptBR: NativeCopyTable = {
  ...en,
  file: 'Arquivo',
  newStory: 'Nova história',
  importStory: 'Importar backup da história…',
  exportStory: 'Exportar história atual…',
  exportFull: 'Exportar todos os dados…',
  importFull: 'Restaurar do backup completo…',
  openUserData: 'Abrir pasta de dados',
  openMedia: 'Abrir pasta de mídia',
  preferences: 'Preferências…',
  quit: 'Sair',
  edit: 'Editar',
  undo: 'Desfazer',
  redo: 'Refazer',
  cut: 'Recortar',
  copy: 'Copiar',
  paste: 'Colar',
  selectAll: 'Selecionar tudo',
  view: 'Exibir',
  navStories: 'Histórias',
  navCharacters: 'Personagens',
  navCostumes: 'Figurinos',
  navScenes: 'Cenas',
  navProps: 'Objetos',
  navActions: 'Ações',
  navComics: 'Quadrinhos',
  navTimeline: 'Linha do tempo',
  navTimelineTrack: 'Vista de faixa',
  navTimelineBoard: 'Vista de fluxo',
  navTimelineV2: 'Linha do tempo · Fluxo',
  navAudit: 'Registro de atividade',
  navSettings: 'Configurações',
  reload: 'Recarregar',
  forceReload: 'Forçar recarga',
  actualSize: 'Tamanho real',
  zoomIn: 'Ampliar',
  zoomOut: 'Reduzir',
  toggleFullscreen: 'Tela cheia',
  toggleDevTools: 'Ferramentas de desenvolvedor',
  captureScreenshot: 'Capturar janela…',
  window: 'Janela',
  minimize: 'Minimizar',
  zoom: 'Zoom',
  close: 'Fechar',
  help: 'Ajuda',
  about: 'Sobre o InstantDrama Magician',
  disclaimer: 'Aviso legal…',
  terms: 'Uso aceitável…',
  exportSupport: 'Exportar relatório de suporte…',
  checkUpdates: 'Verificar atualizações…',
  yskWebsite: 'Site YSK',
  services: 'Serviços',
  hide: 'Ocultar InstantDrama Magician',
  hideOthers: 'Ocultar outros',
  unhide: 'Mostrar tudo',
  quitMac: 'Sair do InstantDrama Magician',
  exportAllAppData: 'Exportar todos os dados',
  exportComplete: 'Exportação concluída',
  exportSaved: 'Backup completo salvo:\n{{path}}',
  showInFolder: 'Mostrar na pasta',
  ok: 'OK',
  exportFailed: 'Falha ao exportar',
  restoreFromFullBackup: 'Restaurar do backup completo',
  overwriteAllLocalData: 'Substituir todos os dados locais?',
  exportFirstHint:
    'Exporte primeiro um backup completo se precisar manter os dados atuais.',
  cancel: 'Cancelar',
  restoreAndRestart: 'Restaurar e reiniciar',
  restoreFailed: 'Falha ao restaurar',
  exportSupportReport: 'Exportar relatório de suporte',
  screenshotFailed: 'Falha na captura',
  couldNotCapture: 'Não foi possível capturar a janela.',
  saveScreenshot: 'Salvar captura',
  updates: 'Atualizações',
  updateStatus: 'Status: {{status}} ({{channel}})',
  aboutTitle: 'Sobre {{name}}',
  creatorLine: 'Criador: Ki (yanshekki) · YSK Limited',
  supportDonateBlurb:
    'Support / Donate — se o InstantDrama Magician ajuda você, me pague um café!',
  openDataFolder: 'Abrir pasta de dados',
  importMsgWindowed:
    'Isso substituirá o banco, a biblioteca de mídia e as configurações deste computador e reiniciará o app.',
  importMsgBare:
    'Isso substituirá o banco, a biblioteca de mídia e as configurações e reiniciará.'
}

const ru: NativeCopyTable = {
  ...en,
  file: 'Файл',
  newStory: 'Новая история',
  importStory: 'Импорт резервной копии истории…',
  exportStory: 'Экспорт текущей истории…',
  exportFull: 'Экспорт всех данных…',
  importFull: 'Восстановить из полной копии…',
  openUserData: 'Открыть папку данных',
  openMedia: 'Открыть папку медиа',
  preferences: 'Настройки…',
  quit: 'Выход',
  edit: 'Правка',
  undo: 'Отменить',
  redo: 'Повторить',
  cut: 'Вырезать',
  copy: 'Копировать',
  paste: 'Вставить',
  selectAll: 'Выделить всё',
  view: 'Вид',
  navStories: 'Истории',
  navCharacters: 'Персонажи',
  navCostumes: 'Костюмы',
  navScenes: 'Сцены',
  navProps: 'Реквизит',
  navActions: 'Действия',
  navComics: 'Комикс',
  navTimeline: 'Таймлайн',
  navTimelineTrack: 'Вид дорожки',
  navTimelineBoard: 'Вид потока',
  navTimelineV2: 'Таймлайн · Поток',
  navAudit: 'Журнал активности',
  navSettings: 'Параметры',
  reload: 'Перезагрузить',
  forceReload: 'Принудительная перезагрузка',
  actualSize: 'Реальный размер',
  zoomIn: 'Увеличить',
  zoomOut: 'Уменьшить',
  toggleFullscreen: 'Полный экран',
  toggleDevTools: 'Инструменты разработчика',
  captureScreenshot: 'Снимок окна…',
  window: 'Окно',
  minimize: 'Свернуть',
  zoom: 'Масштаб',
  close: 'Закрыть',
  help: 'Справка',
  about: 'О InstantDrama Magician',
  disclaimer: 'Отказ от ответственности…',
  terms: 'Правила использования…',
  exportSupport: 'Экспорт отчёта поддержки…',
  checkUpdates: 'Проверить обновления…',
  yskWebsite: 'Сайт YSK',
  services: 'Службы',
  hide: 'Скрыть InstantDrama Magician',
  hideOthers: 'Скрыть остальные',
  unhide: 'Показать все',
  quitMac: 'Выйти из InstantDrama Magician',
  exportAllAppData: 'Экспорт всех данных',
  exportComplete: 'Экспорт завершён',
  exportSaved: 'Полная копия сохранена:\n{{path}}',
  showInFolder: 'Показать в папке',
  ok: 'ОК',
  exportFailed: 'Ошибка экспорта',
  restoreFromFullBackup: 'Восстановить из полной копии',
  overwriteAllLocalData: 'Перезаписать все локальные данные?',
  exportFirstHint:
    'Сначала экспортируйте полную копию, если нужно сохранить текущие данные.',
  cancel: 'Отмена',
  restoreAndRestart: 'Восстановить и перезапустить',
  restoreFailed: 'Ошибка восстановления',
  exportSupportReport: 'Экспорт отчёта поддержки',
  screenshotFailed: 'Ошибка снимка',
  couldNotCapture: 'Не удалось захватить окно.',
  saveScreenshot: 'Сохранить снимок',
  updates: 'Обновления',
  updateStatus: 'Статус: {{status}} ({{channel}})',
  aboutTitle: 'О {{name}}',
  creatorLine: 'Автор: Ki (yanshekki) · YSK Limited',
  supportDonateBlurb:
    'Support / Donate — если InstantDrama Magician помогает, угостите меня кофе!',
  openDataFolder: 'Открыть папку данных',
  importMsgWindowed:
    'Это заменит базу, медиатеку и настройки на этом компьютере и перезапустит приложение.',
  importMsgBare:
    'Это заменит базу, медиатеку и настройки и перезапустит приложение.'
}

const hi: NativeCopyTable = {
  ...en,
  file: 'फ़ाइल',
  newStory: 'नई कहानी',
  importStory: 'कहानी बैकअप आयात करें…',
  exportStory: 'वर्तमान कहानी निर्यात करें…',
  exportFull: 'सभी ऐप डेटा निर्यात करें…',
  importFull: 'पूर्ण बैकअप से पुनर्स्थापित करें…',
  openUserData: 'डेटा फ़ोल्डर खोलें',
  openMedia: 'मीडिया फ़ोल्डर खोलें',
  preferences: 'वरीयताएँ…',
  quit: 'बाहर निकलें',
  edit: 'संपादन',
  undo: 'पूर्ववत',
  redo: 'फिर से करें',
  cut: 'काटें',
  copy: 'कॉपी',
  paste: 'चिपकाएँ',
  selectAll: 'सभी चुनें',
  view: 'दृश्य',
  navStories: 'कहानियाँ',
  navCharacters: 'पात्र',
  navCostumes: 'पोशाक',
  navScenes: 'दृश्य',
  navProps: 'प्रॉप्स',
  navActions: 'क्रियाएँ',
  navComics: 'कॉमिक',
  navTimeline: 'टाइमलाइन',
  navTimelineTrack: 'ट्रैक दृश्य',
  navTimelineBoard: 'प्रवाह दृश्य',
  navTimelineV2: 'टाइमलाइन · प्रवाह',
  navAudit: 'गतिविधि लॉग',
  navSettings: 'सेटिंग्स',
  reload: 'पुनः लोड',
  forceReload: 'ज़बरदस्ती पुनः लोड',
  actualSize: 'वास्तविक आकार',
  zoomIn: 'ज़ूम इन',
  zoomOut: 'ज़ूम आउट',
  toggleFullscreen: 'पूर्ण स्क्रीन',
  toggleDevTools: 'डेवलपर टूल',
  captureScreenshot: 'विंडो कैप्चर करें…',
  window: 'विंडो',
  minimize: 'छोटा करें',
  zoom: 'ज़ूम',
  close: 'बंद करें',
  help: 'सहायता',
  about: 'InstantDrama Magician के बारे में',
  disclaimer: 'अस्वीकरण…',
  terms: 'स्वीकार्य उपयोग…',
  exportSupport: 'सहायता रिपोर्ट निर्यात करें…',
  checkUpdates: 'अपडेट जाँचें…',
  yskWebsite: 'YSK वेबसाइट',
  services: 'सेवाएँ',
  hide: 'InstantDrama Magician छिपाएँ',
  hideOthers: 'अन्य छिपाएँ',
  unhide: 'सभी दिखाएँ',
  quitMac: 'InstantDrama Magician बंद करें',
  exportAllAppData: 'सभी ऐप डेटा निर्यात करें',
  exportComplete: 'निर्यात पूरा',
  exportSaved: 'पूर्ण बैकअप सहेजा गया:\n{{path}}',
  showInFolder: 'फ़ोल्डर में दिखाएँ',
  ok: 'ठीक',
  exportFailed: 'निर्यात असफल',
  restoreFromFullBackup: 'पूर्ण बैकअप से पुनर्स्थापित करें',
  overwriteAllLocalData: 'सभी स्थानीय डेटा अधिलेखित करें?',
  exportFirstHint:
    'वर्तमान डेटा रखना हो तो पहले पूर्ण बैकअप निर्यात करें।',
  cancel: 'रद्द',
  restoreAndRestart: 'पुनर्स्थापित करें और पुनः प्रारंभ',
  restoreFailed: 'पुनर्स्थापना असफल',
  exportSupportReport: 'सहायता रिपोर्ट निर्यात करें',
  screenshotFailed: 'स्क्रीनशॉट असफल',
  couldNotCapture: 'विंडो कैप्चर नहीं हो सकी।',
  saveScreenshot: 'स्क्रीनशॉट सहेजें',
  updates: 'अपडेट',
  updateStatus: 'स्थिति: {{status}} ({{channel}})',
  aboutTitle: '{{name}} के बारे में',
  creatorLine: 'निर्माता: Ki (yanshekki) · YSK Limited',
  supportDonateBlurb:
    'Support / Donate — अगर InstantDrama Magician मदद करे तो मुझे कॉफ़ी पिला दें!',
  openDataFolder: 'डेटा फ़ोल्डर खोलें',
  importMsgWindowed:
    'यह इस कंप्यूटर का डेटाबेस, मीडिया पुस्तकालय और सेटिंग बदलकर ऐप पुनः प्रारंभ करेगा।',
  importMsgBare:
    'यह डेटाबेस, मीडिया पुस्तकालय और सेटिंग बदलकर पुनः प्रारंभ करेगा।'
}

const ar: NativeCopyTable = {
  ...en,
  file: 'ملف',
  newStory: 'قصة جديدة',
  importStory: 'استيراد نسخة القصة…',
  exportStory: 'تصدير القصة الحالية…',
  exportFull: 'تصدير كل بيانات التطبيق…',
  importFull: 'استعادة من نسخة كاملة…',
  openUserData: 'فتح مجلد البيانات',
  openMedia: 'فتح مجلد الوسائط',
  preferences: 'التفضيلات…',
  quit: 'إنهاء',
  edit: 'تحرير',
  undo: 'تراجع',
  redo: 'إعادة',
  cut: 'قص',
  copy: 'نسخ',
  paste: 'لصق',
  selectAll: 'تحديد الكل',
  view: 'عرض',
  navStories: 'قصص',
  navCharacters: 'شخصيات',
  navCostumes: 'أزياء',
  navScenes: 'مشاهد',
  navProps: 'إكسسوارات',
  navActions: 'حركات',
  navComics: 'قصص مصورة',
  navTimeline: 'الخط الزمني',
  navTimelineTrack: 'عرض المسار',
  navTimelineBoard: 'عرض التدفق',
  navTimelineV2: 'الخط الزمني · التدفق',
  navAudit: 'سجل النشاط',
  navSettings: 'الإعدادات',
  reload: 'إعادة التحميل',
  forceReload: 'إعادة تحميل قسرية',
  actualSize: 'الحجم الفعلي',
  zoomIn: 'تكبير',
  zoomOut: 'تصغير',
  toggleFullscreen: 'ملء الشاشة',
  toggleDevTools: 'أدوات المطوّر',
  captureScreenshot: 'التقاط النافذة…',
  window: 'نافذة',
  minimize: 'تصغير',
  zoom: 'تكبير',
  close: 'إغلاق',
  help: 'مساعدة',
  about: 'حول InstantDrama Magician',
  disclaimer: 'إخلاء المسؤولية…',
  terms: 'الاستخدام المقبول…',
  exportSupport: 'تصدير تقرير الدعم…',
  checkUpdates: 'التحقق من التحديثات…',
  yskWebsite: 'موقع YSK',
  services: 'الخدمات',
  hide: 'إخفاء InstantDrama Magician',
  hideOthers: 'إخفاء الآخرين',
  unhide: 'إظهار الكل',
  quitMac: 'إنهاء InstantDrama Magician',
  exportAllAppData: 'تصدير كل بيانات التطبيق',
  exportComplete: 'اكتمل التصدير',
  exportSaved: 'حُفظت النسخة الكاملة:\n{{path}}',
  showInFolder: 'إظهار في المجلد',
  ok: 'حسنًا',
  exportFailed: 'فشل التصدير',
  restoreFromFullBackup: 'استعادة من نسخة كاملة',
  overwriteAllLocalData: 'الكتابة فوق كل البيانات المحلية؟',
  exportFirstHint: 'صدّر نسخة كاملة أولًا إن أردت الاحتفاظ بالبيانات الحالية.',
  cancel: 'إلغاء',
  restoreAndRestart: 'استعادة وإعادة تشغيل',
  restoreFailed: 'فشلت الاستعادة',
  exportSupportReport: 'تصدير تقرير الدعم',
  screenshotFailed: 'فشل الالتقاط',
  couldNotCapture: 'تعذّر التقاط النافذة.',
  saveScreenshot: 'حفظ اللقطة',
  updates: 'التحديثات',
  updateStatus: 'الحالة: {{status}} ({{channel}})',
  aboutTitle: 'حول {{name}}',
  creatorLine: 'المنشئ: Ki (yanshekki) · YSK Limited',
  supportDonateBlurb:
    'Support / Donate — إن ساعدك InstantDrama Magician فادعُني إلى قهوة!',
  openDataFolder: 'فتح مجلد البيانات',
  importMsgWindowed:
    'سيستبدل هذا قاعدة البيانات ومكتبة الوسائط والإعدادات على هذا الجهاز ثم يعيد تشغيل التطبيق.',
  importMsgBare:
    'سيستبدل هذا قاعدة البيانات ومكتبة الوسائط والإعدادات ثم يعيد التشغيل.'
}

export const NATIVE_COPY: Record<NativeLang, NativeCopyTable> = {
  en,
  'zh-HK': zhHK,
  'zh-CN': zhCN,
  ja,
  es,
  fr,
  'pt-BR': ptBR,
  ru,
  hi,
  ar
}

export function coerceNativeLang(
  raw: string | undefined | null
): NativeLang {
  if (!raw) return 'zh-HK'
  const s = raw.toLowerCase().replace(/_/g, '-')
  if (s === 'zh-cn' || s.startsWith('zh-hans') || s === 'zh-sg') return 'zh-CN'
  if (s.startsWith('zh')) return 'zh-HK'
  if (s.startsWith('ja')) return 'ja'
  if (s.startsWith('es')) return 'es'
  if (s.startsWith('fr')) return 'fr'
  if (s.startsWith('pt')) return 'pt-BR'
  if (s.startsWith('ru')) return 'ru'
  if (s.startsWith('hi')) return 'hi'
  if (s.startsWith('ar')) return 'ar'
  if (s.startsWith('en')) return 'en'
  return 'en'
}

export function nativeT(
  lang: string | null | undefined,
  key: NativeCopyKey,
  vars?: Record<string, string | number | null | undefined>
): string {
  const id = coerceNativeLang(lang)
  let out = NATIVE_COPY[id][key] ?? NATIVE_COPY.en[key] ?? key
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      out = out.split(`{{${k}}}`).join(v == null ? '' : String(v))
    }
  }
  return out
}

export function nativeLabels(lang: string | null | undefined): NativeCopyTable {
  return NATIVE_COPY[coerceNativeLang(lang)]
}
