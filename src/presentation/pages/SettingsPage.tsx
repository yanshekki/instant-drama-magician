import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getApi } from '../../lib/api'
import { parseIpcError } from '../../lib/ipc'
import type { AppSettings, ExportProfile, VideoMode } from '../../types/settings'
import { useApp } from '../context/AppContext'
import { PageHeader } from '../components/PageHeader'
import { Button, Card, Input, Label, Select } from '../components/ui'

export function SettingsPage(): JSX.Element {
  const { t } = useTranslation()
  const { refreshAiStatus, aiStatus } = useApp()
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [probeMsg, setProbeMsg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    void getApi()
      .settings.get()
      .then(setSettings)
      .catch((e) => setError(parseIpcError(e).message))
  }, [])

  const patch = <K extends keyof AppSettings>(key: K, value: AppSettings[K]): void => {
    setSettings((s) => (s ? { ...s, [key]: value } : s))
  }

  const handleSave = async (): Promise<void> => {
    if (!settings) return
    setSaving(true)
    setError(null)
    try {
      const next = await getApi().settings.set(settings)
      setSettings(next)
      await refreshAiStatus()
      setProbeMsg(t('settings.saved'))
    } catch (e) {
      setError(parseIpcError(e).message)
    } finally {
      setSaving(false)
    }
  }

  const handleProbe = async (): Promise<void> => {
    try {
      const r = await getApi().ai.probeVideo()
      setProbeMsg(`${r.id}: ${r.available ? 'OK' : 'FAIL'} — ${r.message}`)
      await refreshAiStatus()
    } catch (e) {
      setError(parseIpcError(e).message)
    }
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <PageHeader title={t('settings.title')} subtitle={t('settings.subtitle')} />
      <div className="flex-1 overflow-y-auto px-8 py-6">
        {error && (
          <p className="mb-4 rounded-lg bg-rose-950/50 px-3 py-2 text-sm text-rose-200">
            {error}
          </p>
        )}
        {probeMsg && (
          <p className="mb-4 rounded-lg bg-ink-800 px-3 py-2 text-sm text-ink-200">
            {probeMsg}
          </p>
        )}

        {!settings ? (
          <p className="text-sm text-ink-400">{t('common.loading')}</p>
        ) : (
          <div className="grid max-w-2xl gap-4">
            <Card className="space-y-3">
              <h2 className="text-sm font-semibold text-ink-100">{t('settings.video')}</h2>
              <div>
                <Label>{t('settings.videoMode')}</Label>
                <Select
                  value={settings.videoMode}
                  onChange={(e) => patch('videoMode', e.target.value as VideoMode)}
                >
                  <option value="auto">auto</option>
                  <option value="http">http</option>
                  <option value="stub">stub</option>
                </Select>
              </div>
              <div>
                <Label>{t('settings.baseUrl')}</Label>
                <Input
                  value={settings.baseUrl}
                  onChange={(e) => patch('baseUrl', e.target.value)}
                />
              </div>
              <div>
                <Label>{t('settings.videoPath')}</Label>
                <Input
                  value={settings.videoPath}
                  onChange={(e) => patch('videoPath', e.target.value)}
                />
              </div>
              <div>
                <Label>{t('settings.apiKey')}</Label>
                <Input
                  value={settings.apiKey}
                  onChange={(e) => patch('apiKey', e.target.value)}
                />
              </div>
              <div>
                <Label>{t('settings.model')}</Label>
                <Input
                  value={settings.model}
                  onChange={(e) => patch('model', e.target.value)}
                />
              </div>
              <Button variant="secondary" onClick={() => void handleProbe()}>
                {t('settings.probeVideo')}
              </Button>
            </Card>

            <Card className="space-y-3">
              <h2 className="text-sm font-semibold text-ink-100">{t('settings.export')}</h2>
              <label className="flex items-center gap-2 text-sm text-ink-200">
                <input
                  type="checkbox"
                  checked={settings.burnSubtitles}
                  onChange={(e) => patch('burnSubtitles', e.target.checked)}
                />
                {t('settings.burnSubtitles')}
              </label>
              <label className="flex items-center gap-2 text-sm text-ink-200">
                <input
                  type="checkbox"
                  checked={settings.includeSilentAudio}
                  onChange={(e) => patch('includeSilentAudio', e.target.checked)}
                />
                {t('settings.silentAudio')}
              </label>
              <div>
                <Label>{t('settings.profile')}</Label>
                <Select
                  value={settings.exportProfile}
                  onChange={(e) =>
                    patch('exportProfile', e.target.value as ExportProfile)
                  }
                >
                  <option value="fast">fast</option>
                  <option value="balanced">balanced</option>
                </Select>
              </div>
            </Card>

            <Card className="text-xs text-ink-400">
              <div className="font-medium text-ink-200">{t('ai.status')}</div>
              <p className="mt-1">{aiStatus?.message ?? '—'}</p>
            </Card>

            <Button onClick={() => void handleSave()} disabled={saving}>
              {saving ? t('common.loading') : t('common.save')}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
