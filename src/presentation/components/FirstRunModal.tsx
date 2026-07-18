import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { getApi } from '../../lib/api'
import { useApp } from '../context/AppContext'
import { Button } from './ui'

export function FirstRunModal(): JSX.Element | null {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { stories, loading } = useApp()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)

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
    setBusy(true)
    try {
      await getApi().settings.set({ firstRunSeen: true })
      setOpen(false)
    } finally {
      setBusy(false)
    }
  }

  const goNewStory = async (): Promise<void> => {
    setBusy(true)
    try {
      await getApi().settings.set({ firstRunSeen: true })
      setOpen(false)
      navigate('/stories')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-overlay/70 p-4">
      <div className="max-h-[min(90vh,52rem)] w-full max-w-md overflow-y-auto rounded-2xl border border-ink-700 bg-ink-900 p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-ink-50">
          {t('onboarding.welcome')}
        </h2>
        <p className="mt-2 text-sm text-ink-300">{t('onboarding.body')}</p>
        <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-ink-400">
          <li>{t('stories.step1')}</li>
          <li>{t('stories.step2')}</li>
          <li>{t('stories.step3')}</li>
        </ol>
        <div className="mt-5 flex flex-wrap gap-2">
          <Button onClick={() => void goNewStory()} disabled={busy}>
            {t('stories.new')}
          </Button>
          <Button
            variant="secondary"
            onClick={() => void dismiss()}
            disabled={busy}
          >
            {t('onboarding.skip')}
          </Button>
        </div>
        <p className="mt-3 text-[11px] text-ink-500">
          {t('onboarding.progressNote')}
        </p>
      </div>
    </div>
  )
}
