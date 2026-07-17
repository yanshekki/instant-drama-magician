import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getApi } from '../../lib/api'
import { parseIpcError } from '../../lib/ipc'
import type {
  AppSettings,
  ExportProfile,
  TransitionMode,
  VideoMode
} from '../../types/settings'
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
  const [ffmpegMsg, setFfmpegMsg] = useState<string | null>(null)
  const [appInfo, setAppInfo] = useState<{
    version: string
    name: string
    electron: string
    userData: string
    mediaRoot: string
    isPackaged: boolean
    platform: string
  } | null>(null)

  useEffect(() => {
    void getApi()
      .settings.get()
      .then(setSettings)
      .catch((e) => setError(parseIpcError(e).message))
    void getApi()
      .media.checkFfmpeg()
      .then((r) =>
        setFfmpegMsg(r.available ? t('settings.ffmpegOk') : r.message)
      )
      .catch(() => setFfmpegMsg(t('pipeline.needFfmpeg')))
    void getApi()
      .app.getInfo()
      .then(setAppInfo)
      .catch(() => undefined)
  }, [t])

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
      const d = await getApi().diagnostics.full()
      setProbeMsg(
        [
          d.app
            ? `App: v${d.app.version} · ${d.app.isPackaged ? t('app.packaged') : t('app.dev')}`
            : null,
          `Chat: ${d.chat.available ? 'OK' : 'OFFLINE'} — ${d.chat.message}`,
          `Video (${d.videoMode}): ${d.video.available ? 'OK' : 'FAIL'} — ${d.video.message}`,
          `FFmpeg: ${d.ffmpeg.available ? 'OK' : 'FAIL'} — ${d.ffmpeg.message}`,
          d.tips.length ? `${t('settings.tips')}:\n- ${d.tips.join('\n- ')}` : '',
          t('settings.gatewayHint')
        ]
          .filter(Boolean)
          .join('\n')
      )
      setFfmpegMsg(d.ffmpeg.message)
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
          <pre className="mb-4 whitespace-pre-wrap rounded-lg bg-ink-800 px-3 py-2 text-sm text-ink-200">
            {probeMsg}
          </pre>
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
              <div>
                <Label>{t('settings.aspectRatio')}</Label>
                <Select
                  value={settings.aspectRatio}
                  onChange={(e) => patch('aspectRatio', e.target.value)}
                >
                  <option value="16:9">16:9</option>
                  <option value="9:16">9:16</option>
                  <option value="1:1">1:1</option>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>{t('settings.videoConcurrency')}</Label>
                  <Input
                    type="number"
                    min={1}
                    max={4}
                    value={settings.videoConcurrency}
                    onChange={(e) =>
                      patch('videoConcurrency', Number(e.target.value) || 1)
                    }
                  />
                </div>
                <div>
                  <Label>{t('settings.videoMaxRetries')}</Label>
                  <Input
                    type="number"
                    min={0}
                    max={8}
                    value={settings.videoMaxRetries}
                    onChange={(e) =>
                      patch('videoMaxRetries', Number(e.target.value) || 0)
                    }
                  />
                </div>
              </div>
              <Button variant="secondary" onClick={() => void handleProbe()}>
                {t('settings.probeAll')}
              </Button>
            </Card>

            <Card className="space-y-3">
              <h2 className="text-sm font-semibold text-ink-100">{t('settings.audio')}</h2>
              <div className="text-xs text-ink-400">
                BGM: {settings.bgmPath ?? t('settings.noBgm')}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="secondary"
                  onClick={() =>
                    void getApi()
                      .media.pickBgm()
                      .then((r) => {
                        if (r) patch('bgmPath', r.filePath)
                      })
                  }
                >
                  {t('settings.pickBgm')}
                </Button>
                {settings.bgmPath && (
                  <Button variant="ghost" onClick={() => patch('bgmPath', null)}>
                    {t('settings.clearBgm')}
                  </Button>
                )}
              </div>
              <div>
                <Label>
                  {t('settings.bgmVolume')} ({Math.round(settings.bgmVolume * 100)}%)
                </Label>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={Math.round(settings.bgmVolume * 100)}
                  onChange={(e) => patch('bgmVolume', Number(e.target.value) / 100)}
                  className="w-full"
                />
              </div>
              <div>
                <Label>
                  {t('settings.dialogueVolume')} (
                  {Math.round(settings.dialogueVolume * 100)}%)
                </Label>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={Math.round(settings.dialogueVolume * 100)}
                  onChange={(e) =>
                    patch('dialogueVolume', Number(e.target.value) / 100)
                  }
                  className="w-full"
                />
              </div>
              <div>
                <Label>
                  {t('settings.duckRatio')} ({Math.round(settings.duckRatio * 100)}
                  %)
                </Label>
                <input
                  type="range"
                  min={5}
                  max={100}
                  value={Math.round(settings.duckRatio * 100)}
                  onChange={(e) =>
                    patch('duckRatio', Number(e.target.value) / 100)
                  }
                  className="w-full"
                />
              </div>
              <label className="flex items-center gap-2 text-sm text-ink-200">
                <input
                  type="checkbox"
                  checked={settings.ttsEnabled}
                  onChange={(e) => patch('ttsEnabled', e.target.checked)}
                />
                {t('settings.ttsEnabled')}
              </label>
              <div>
                <Label>{t('settings.ttsHttpUrl')}</Label>
                <Input
                  value={settings.ttsHttpUrl}
                  onChange={(e) => patch('ttsHttpUrl', e.target.value)}
                  placeholder="http://127.0.0.1:…/tts"
                />
              </div>
              <div>
                <Label>{t('settings.ttsVoice')}</Label>
                <Input
                  value={settings.ttsVoice}
                  onChange={(e) => patch('ttsVoice', e.target.value)}
                />
              </div>
              <label className="flex items-center gap-2 text-sm text-ink-200">
                <input
                  type="checkbox"
                  checked={settings.snapEnabled}
                  onChange={(e) => patch('snapEnabled', e.target.checked)}
                />
                {t('settings.snapEnabled')}
              </label>
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
              <label className="flex items-center gap-2 text-sm text-ink-200">
                <input
                  type="checkbox"
                  checked={settings.openExportFolder}
                  onChange={(e) => patch('openExportFolder', e.target.checked)}
                />
                {t('settings.openExportFolder')}
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
              <div>
                <Label>{t('settings.transitionMode')}</Label>
                <Select
                  value={settings.transitionMode}
                  onChange={(e) =>
                    patch('transitionMode', e.target.value as TransitionMode)
                  }
                >
                  <option value="fade">fade</option>
                  <option value="cut">cut</option>
                </Select>
              </div>
              <div>
                <Label>
                  {t('settings.transitionSec')} ({settings.transitionSec}s)
                </Label>
                <input
                  type="range"
                  min={5}
                  max={100}
                  value={Math.round(settings.transitionSec * 100)}
                  onChange={(e) =>
                    patch('transitionSec', Number(e.target.value) / 100)
                  }
                  className="w-full"
                  disabled={settings.transitionMode === 'cut'}
                />
              </div>
            </Card>

            <Card className="space-y-2 text-xs text-ink-400">
              <div className="font-medium text-ink-200">{t('settings.about')}</div>
              {appInfo ? (
                <div className="space-y-1 font-mono text-[11px] text-ink-300">
                  <div>
                    {t('settings.version')}: {appInfo.version}
                  </div>
                  <div>
                    {t('settings.buildKind')}:{' '}
                    {appInfo.isPackaged
                      ? t('app.packaged')
                      : t('app.dev')}
                  </div>
                  <div>Electron: {appInfo.electron}</div>
                  <div>
                    {t('settings.platform')}: {appInfo.platform}
                  </div>
                  <div className="break-all">
                    userData: {appInfo.userData}
                  </div>
                  <div className="break-all">
                    media: {appInfo.mediaRoot}
                  </div>
                  {appInfo.isPackaged && (
                    <p className="mt-2 text-amber-200/90">
                      {t('settings.packagedHint')}
                    </p>
                  )}
                </div>
              ) : (
                <p>—</p>
              )}
            </Card>

            <Card className="text-xs text-ink-400">
              <div className="font-medium text-ink-200">{t('ai.status')}</div>
              <p className="mt-1">{aiStatus?.message ?? '—'}</p>
              {ffmpegMsg && (
                <p className="mt-2 text-ink-300">
                  FFmpeg: {ffmpegMsg}
                </p>
              )}
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
