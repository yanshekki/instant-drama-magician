import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getApi } from '../../lib/api'
import { parseIpcError } from '../../lib/ipc'
import {
  adminUrlFromBase,
  applyLlmPreset,
  llmPresetHintKey,
  supportsLocalAdmin,
  type LlmProviderPreset
} from '../../domain/openaiCompatible'
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
  const [updateState, setUpdateState] = useState<{
    status: string
    currentVersion: string
    latestVersion?: string
    progress?: number
    message?: string
  } | null>(null)
  const [updateBusy, setUpdateBusy] = useState(false)
  const [activityLines, setActivityLines] = useState<string[]>([])
  const [modelIds, setModelIds] = useState<string[]>([])
  const [chatBusy, setChatBusy] = useState(false)

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
    void getApi()
      .updates.status()
      .then(setUpdateState)
      .catch(() => undefined)
    void getApi()
      .activity.recent(12)
      .then((rows) =>
        setActivityLines(
          rows.map((r) => `${r.ts.slice(11, 19)} [${r.kind}] ${r.message}`)
        )
      )
      .catch(() => undefined)
    void getApi()
      .ai.listModels()
      .then((m) => setModelIds(m.map((x) => x.id)))
      .catch(() => undefined)
    return getApi().updates.onState(setUpdateState)
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

  const handleCheckUpdate = async (): Promise<void> => {
    setUpdateBusy(true)
    setError(null)
    try {
      const s = await getApi().updates.check()
      setUpdateState(s)
    } catch (e) {
      setError(parseIpcError(e).message)
    } finally {
      setUpdateBusy(false)
    }
  }

  const handleDownloadUpdate = async (): Promise<void> => {
    setUpdateBusy(true)
    try {
      const s = await getApi().updates.download()
      setUpdateState(s)
    } catch (e) {
      setError(parseIpcError(e).message)
    } finally {
      setUpdateBusy(false)
    }
  }

  const handleInstallUpdate = async (): Promise<void> => {
    const r = await getApi().updates.install()
    if (!r.ok) setError(r.message ?? t('settings.updateInstallFail'))
  }

  const handleSupportReport = async (): Promise<void> => {
    try {
      const r = await getApi().support.exportReport()
      if (r) {
        setProbeMsg(t('settings.supportExported', { path: r.filePath }))
        void getApi().shell.showItemInFolder(r.filePath)
      }
    } catch (e) {
      setError(parseIpcError(e).message)
    }
  }

  const handleProbe = async (): Promise<void> => {
    try {
      const d = await getApi().diagnostics.full()
      const modelCount = d.chatProbe?.models?.length
      setProbeMsg(
        [
          d.app
            ? `App: v${d.app.version} · ${d.app.isPackaged ? t('app.packaged') : t('app.dev')}`
            : null,
          `Chat (OpenAI-compatible): ${d.chat.available ? 'OK' : 'OFFLINE'} — ${d.chat.message}`,
          d.chatProbe
            ? `  probe: ${d.chatProbe.message}${typeof d.chatProbe.latencyMs === 'number' ? ` (${d.chatProbe.latencyMs}ms)` : ''}${typeof modelCount === 'number' ? ` · models=${modelCount}` : ''}${d.chatProbe.healthOk === false ? ' · health=fail' : ''}`
            : null,
          `Video (${d.videoMode}): ${d.video.available ? 'OK' : 'FAIL'} — ${d.video.message}`,
          `FFmpeg: ${d.ffmpeg.available ? 'OK' : 'FAIL'} — ${d.ffmpeg.message}`,
          d.tips.length ? `${t('settings.tips')}:\n- ${d.tips.join('\n- ')}` : '',
          t('settings.llmHintGeneric')
        ]
          .filter(Boolean)
          .join('\n')
      )
      setFfmpegMsg(d.ffmpeg.message)
      if (d.chatProbe?.models?.length) {
        setModelIds(d.chatProbe.models.map((m) => m.id))
      }
      await refreshAiStatus()
    } catch (e) {
      setError(parseIpcError(e).message)
    }
  }

  const handleLlmPresetChange = async (
    preset: LlmProviderPreset
  ): Promise<void> => {
    if (!settings) return
    setError(null)
    try {
      // Prefer IPC so main rebinds AI; fall back to local apply + set
      let next: AppSettings
      try {
        next = await getApi().ai.applyLlmPreset(preset)
      } catch {
        const patched = applyLlmPreset(settings, preset)
        next = await getApi().settings.set({
          llmProvider: patched.llmProvider,
          baseUrl: patched.baseUrl,
          videoPath: patched.videoPath,
          model: patched.model
        })
      }
      setSettings(next)
      setModelIds([])
      setProbeMsg(t('settings.presetApplied', { preset }))
      await refreshAiStatus()
    } catch (e) {
      setError(parseIpcError(e).message)
    }
  }

  const handleRefreshModels = async (): Promise<void> => {
    setChatBusy(true)
    setError(null)
    try {
      const models = await getApi().ai.listModels()
      setModelIds(models.map((m) => m.id))
      setProbeMsg(
        t('settings.modelsLoaded', { count: models.length })
      )
    } catch (e) {
      const err = parseIpcError(e)
      setError(`${err.message}${err.details ? ` — ${err.details}` : ''}`)
    } finally {
      setChatBusy(false)
    }
  }

  const handleTestChat = async (): Promise<void> => {
    if (!settings) return
    setChatBusy(true)
    setError(null)
    try {
      // Persist current form so test uses latest key/url
      await getApi().settings.set(settings)
      const r = await getApi().ai.testChat()
      setProbeMsg(
        `${r.message}\nmodel=${r.model}\nreply: ${r.replyPreview}`
      )
      await refreshAiStatus()
    } catch (e) {
      const err = parseIpcError(e)
      setError(`${err.message}${err.details ? ` — ${err.details}` : ''}`)
    } finally {
      setChatBusy(false)
    }
  }

  const handleOpenAdmin = (): void => {
    if (!settings) return
    void getApi().shell.openExternal(adminUrlFromBase(settings.baseUrl))
  }

  const handleOpenDocs = (): void => {
    if (settings?.llmProvider === 'openai') {
      void getApi().shell.openExternal('https://platform.openai.com/docs')
      return
    }
    void getApi().shell.openExternal(
      'https://github.com/yanshekki/Grok-Cli-to-OpenAI-compatible'
    )
  }

  const keyPlaceholder =
    settings?.llmProvider === 'openai'
      ? 'sk-…'
      : settings?.llmProvider === 'grok-gateway'
        ? 'gk_live_…'
        : 'API key'

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
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h2 className="text-sm font-semibold text-ink-100">
                    {t('settings.llm')}
                  </h2>
                  <p className="mt-0.5 text-xs text-ink-500">
                    {t('settings.llmSubtitle')}
                  </p>
                </div>
                <Button variant="ghost" onClick={handleOpenDocs}>
                  {t('settings.openProviderDocs')}
                </Button>
              </div>

              <div>
                <Label>{t('settings.llmProvider')}</Label>
                <Select
                  value={settings.llmProvider}
                  onChange={(e) =>
                    void handleLlmPresetChange(
                      e.target.value as LlmProviderPreset
                    )
                  }
                >
                  <option value="grok-gateway">
                    {t('settings.llmPreset.grokGateway')}
                  </option>
                  <option value="openai">
                    {t('settings.llmPreset.openai')}
                  </option>
                  <option value="custom">
                    {t('settings.llmPreset.custom')}
                  </option>
                </Select>
                <p className="mt-1 text-[11px] text-ink-500">
                  {t(`settings.${llmPresetHintKey(settings.llmProvider)}`)}
                </p>
              </div>

              <div>
                <Label>{t('settings.baseUrl')}</Label>
                <Input
                  value={settings.baseUrl}
                  onChange={(e) => {
                    patch('baseUrl', e.target.value)
                    patch('llmProvider', 'custom')
                  }}
                  placeholder="http://127.0.0.1:3847/v1"
                  disabled={settings.llmProvider === 'openai'}
                />
              </div>
              <div>
                <Label>{t('settings.apiKey')}</Label>
                <Input
                  value={settings.apiKey}
                  onChange={(e) => patch('apiKey', e.target.value)}
                  placeholder={keyPlaceholder}
                />
                <p className="mt-1 text-[11px] text-ink-500">
                  {settings.llmProvider === 'openai'
                    ? t('settings.apiKeyHintOpenAI')
                    : settings.llmProvider === 'grok-gateway'
                      ? t('settings.apiKeyHint')
                      : t('settings.apiKeyHintCustom')}
                </p>
              </div>
              <div>
                <Label>{t('settings.model')}</Label>
                {modelIds.length > 0 ? (
                  <Select
                    value={
                      modelIds.includes(settings.model)
                        ? settings.model
                        : modelIds[0]
                    }
                    onChange={(e) => patch('model', e.target.value)}
                  >
                    {modelIds.map((id) => (
                      <option key={id} value={id}>
                        {id}
                      </option>
                    ))}
                    {!modelIds.includes(settings.model) && settings.model && (
                      <option value={settings.model}>{settings.model}</option>
                    )}
                  </Select>
                ) : (
                  <Input
                    value={settings.model}
                    onChange={(e) => patch('model', e.target.value)}
                    placeholder={
                      settings.llmProvider === 'openai'
                        ? 'gpt-4o-mini'
                        : 'grok-4.5'
                    }
                  />
                )}
              </div>
              <div>
                <Label>
                  {t('settings.chatTimeoutMs')} (
                  {settings.chatTimeoutMs || 120000}
                  ms)
                </Label>
                <Input
                  type="number"
                  min={5000}
                  max={600000}
                  step={1000}
                  value={settings.chatTimeoutMs || 120000}
                  onChange={(e) =>
                    patch('chatTimeoutMs', Number(e.target.value) || 120000)
                  }
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="secondary"
                  disabled={chatBusy}
                  onClick={() => void handleRefreshModels()}
                >
                  {t('settings.refreshModels')}
                </Button>
                <Button
                  disabled={chatBusy}
                  onClick={() => void handleTestChat()}
                >
                  {t('settings.testChat')}
                </Button>
                {supportsLocalAdmin(settings.llmProvider) && (
                  <Button variant="ghost" onClick={handleOpenAdmin}>
                    {t('settings.openAdmin')}
                  </Button>
                )}
                <Button variant="secondary" onClick={() => void handleProbe()}>
                  {t('settings.probeAll')}
                </Button>
              </div>
            </Card>

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
                <Label>{t('settings.videoPath')}</Label>
                <Input
                  value={settings.videoPath}
                  onChange={(e) => patch('videoPath', e.target.value)}
                  placeholder="http://127.0.0.1:3847/v1/videos"
                />
                <p className="mt-1 text-[11px] text-ink-500">
                  {t('settings.videoPathHint')}
                </p>
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

            <Card className="space-y-3">
              <h2 className="text-sm font-semibold text-ink-100">
                {t('settings.updates')}
              </h2>
              <p className="text-xs text-ink-400">
                {updateState?.message ?? t('settings.updateIdle')}
              </p>
              {updateState && (
                <div className="font-mono text-[11px] text-ink-300">
                  {t('settings.version')}: {updateState.currentVersion}
                  {updateState.latestVersion
                    ? ` → ${updateState.latestVersion}`
                    : ''}
                  {typeof updateState.progress === 'number'
                    ? ` · ${updateState.progress}%`
                    : ''}
                  {` · ${updateState.status}`}
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="secondary"
                  disabled={updateBusy}
                  onClick={() => void handleCheckUpdate()}
                >
                  {t('settings.checkUpdate')}
                </Button>
                <Button
                  variant="secondary"
                  disabled={
                    updateBusy || updateState?.status !== 'available'
                  }
                  onClick={() => void handleDownloadUpdate()}
                >
                  {t('settings.downloadUpdate')}
                </Button>
                <Button
                  disabled={updateState?.status !== 'downloaded'}
                  onClick={() => void handleInstallUpdate()}
                >
                  {t('settings.installUpdate')}
                </Button>
              </div>
              <p className="text-[11px] text-ink-500">{t('settings.updateHint')}</p>
            </Card>

            <Card className="space-y-3">
              <h2 className="text-sm font-semibold text-ink-100">
                {t('settings.support')}
              </h2>
              <Button
                variant="secondary"
                onClick={() => void handleSupportReport()}
              >
                {t('settings.exportSupport')}
              </Button>
              {activityLines.length > 0 && (
                <pre className="max-h-28 overflow-auto rounded bg-ink-950/80 p-2 text-[10px] text-ink-400">
                  {activityLines.join('\n')}
                </pre>
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
