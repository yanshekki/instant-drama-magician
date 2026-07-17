import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { getApi } from '../../lib/api'
import { parseIpcError } from '../../lib/ipc'
import { useApp } from '../context/AppContext'
import { Button } from './ui'

export function FirstRunModal(): JSX.Element | null {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const { stories, loading, refreshStories, setActiveStoryId } = useApp()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (loading) return
    void getApi()
      .settings.get()
      .then((s) => {
        if (!s.firstRunSeen && stories.length === 0) setOpen(true)
      })
      .catch(() => undefined)
  }, [loading, stories.length])

  if (!open) return null

  const dismiss = async (): Promise<void> => {
    await getApi().settings.set({ firstRunSeen: true })
    setOpen(false)
  }

  const loadDemo = async (): Promise<void> => {
    setBusy(true)
    setError(null)
    try {
      const locale = i18n.language === 'en' ? 'en' : 'zh-HK'
      const result = await getApi().stories.seedDemo(locale)
      await getApi().settings.set({ firstRunSeen: true })
      await refreshStories()
      setActiveStoryId(result.storyId)
      setOpen(false)
      navigate('/timeline')
    } catch (e) {
      setError(parseIpcError(e).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-md rounded-2xl border border-ink-700 bg-ink-900 p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-ink-50">{t('onboarding.welcome')}</h2>
        <p className="mt-2 text-sm text-ink-300">{t('onboarding.body')}</p>
        <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-ink-400">
          <li>{t('stories.step1')}</li>
          <li>{t('stories.step2')}</li>
          <li>{t('stories.step3')}</li>
        </ol>
        {error && (
          <p className="mt-3 rounded-lg bg-rose-950/50 px-3 py-2 text-sm text-rose-200">
            {error}
          </p>
        )}
        <div className="mt-5 flex flex-wrap gap-2">
          <Button onClick={() => void loadDemo()} disabled={busy}>
            {t('stories.loadDemo')}
          </Button>
          <Button variant="secondary" onClick={() => void dismiss()} disabled={busy}>
            {t('onboarding.skip')}
          </Button>
        </div>
        <p className="mt-3 text-[11px] text-ink-500">{t('onboarding.progressNote')}</p>
      </div>
    </div>
  )
}
