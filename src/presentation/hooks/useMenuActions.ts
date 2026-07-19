/**
 * Bridge native Electron menu actions → React router / app handlers.
 */
import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { getApi, isElectron } from '../../lib/api'
import { parseIpcError } from '../../lib/ipc'
import type { MenuAction } from '../../types/electron-api'
import { useApp } from '../context/AppContext'
import { useToast } from '../context/ToastContext'
import { useDialog } from '../context/DialogContext'
import { openLegalDocument } from '../components/LegalDocumentModal'

/** Custom event StoriesPage listens for to open the create form. */
export const MENU_NEW_STORY_EVENT = 'idm:menu-new-story'
export const MENU_IMPORT_STORY_EVENT = 'idm:menu-import-story'

export function useMenuActions(): void {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { activeStoryId, refreshStories } = useApp()
  const toast = useToast()
  const dialog = useDialog()

  useEffect(() => {
    if (!isElectron()) return
    let unsub: (() => void) | undefined
    try {
      unsub = getApi().app.onMenuAction((action: MenuAction) => {
        void handleAction(action)
      })
    } catch {
      return
    }
    return () => {
      unsub?.()
    }

    async function handleAction(action: MenuAction): Promise<void> {
      switch (action.type) {
        case 'navigate':
          navigate(action.path)
          break
        case 'preferences':
          navigate('/settings')
          break
        case 'new-story':
          navigate('/')
          // Defer so StoriesPage mounts / is ready
          setTimeout(() => {
            window.dispatchEvent(new CustomEvent(MENU_NEW_STORY_EVENT))
          }, 50)
          break
        case 'import-story':
          navigate('/')
          setTimeout(() => {
            window.dispatchEvent(new CustomEvent(MENU_IMPORT_STORY_EVENT))
          }, 50)
          break
        case 'export-story': {
          if (!activeStoryId) {
            toast.error(t('menu.needActiveStory'))
            navigate('/')
            return
          }
          const ok = await dialog.confirm({
            title: t('stories.exportBackupConfirmTitle'),
            message: t('stories.exportBackupConfirm'),
            confirmLabel: t('stories.exportBackup')
          })
          if (!ok) return
          try {
            const r = (await getApi().project.exportBackup(
              activeStoryId
            )) as { filePath?: string; fileName?: string; downloadUrl?: string } | null
            if (r?.filePath || r?.downloadUrl) {
              toast.success(
                t('menu.storyBackupExported', {
                  path: r.fileName || r.filePath || ''
                })
              )
            }
          } catch (e) {
            toast.error(parseIpcError(e).message)
          }
          break
        }
        case 'export-full':
          try {
            const r = (await getApi().app.exportFullBackup()) as {
              filePath?: string
              fileName?: string
              downloadUrl?: string
            } | null
            if (r?.filePath || r?.downloadUrl || r) {
              toast.success(
                t('backup.fullExported', {
                  path: r?.fileName || r?.filePath || ''
                })
              )
            }
          } catch (e) {
            toast.error(parseIpcError(e).message)
          }
          break
        case 'import-full':
          try {
            await getApi().app.importFullBackup()
            toast.success(t('backup.importFullOk'))
          } catch (e) {
            toast.error(parseIpcError(e).message)
          }
          break
        case 'export-support':
          try {
            const r = await getApi().support.exportReport()
            if (r?.filePath) {
              toast.success(t('settings.supportExported', { path: r.filePath }))
            }
          } catch (e) {
            toast.error(parseIpcError(e).message)
          }
          break
        case 'full-backup-exported':
          toast.success(
            t('backup.fullExported', { path: action.filePath })
          )
          break
        case 'screenshot-saved':
          toast.success(t('menu.screenshotSaved', { path: action.filePath }))
          break
        case 'open-legal':
          openLegalDocument(action.kind === 'terms' ? 'terms' : 'disclaimer')
          break
        case 'open-user-data':
        case 'open-media':
        case 'about':
        case 'check-updates':
          // Handled in main process
          break
        default:
          break
      }
      // Story import may need list refresh when main finishes via StoriesPage
      if (action.type === 'import-story') {
        // refresh after a beat (StoriesPage does the import)
        setTimeout(() => {
          void refreshStories()
        }, 2000)
      }
    }
  }, [navigate, activeStoryId, refreshStories, t, toast, dialog])
}
