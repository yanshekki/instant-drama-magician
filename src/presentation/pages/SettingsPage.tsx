import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getApi, isElectron } from '../../lib/api'
import {
  LEGAL_EFFECTIVE_DATE,
  LEGAL_VERSION,
  formatLegalAcceptedAt
} from '../../domain/legal'
import {
  CREATOR_LINKTREE,
  DONATE_ADDRESSES,
  YSK_HOME_URL
} from '../../domain/creatorSupport'
import { openLegalDocument } from '../components/LegalDocumentModal'
import { formatIpcError, parseIpcError } from '../../lib/ipc'
import { formatUserError } from '../lib/formatUserError'
import {
  applyLlmPreset,
  coerceLlmProviderPreset,
  isLlmProviderPreset,
  providerDocsUrl,
  providerKeyOptional,
  type LlmProviderPreset
} from '../../domain/openaiCompatible'
import { channelPresetBaseUrl } from '../../domain/providerEndpoints'
import { LlmProviderPicker } from '../components/LlmProviderPicker'
import {
  GrokGatewaySetupCard,
  GROK_INSTALL_CMD
} from '../components/GrokGatewaySetupCard'
import {
  ProviderChannelPicker,
  type ChannelPickerValue
} from '../components/ProviderChannelPicker'
import type {
  AppSettings,
  ImagePixelSize,
  ImageProviderMode,
  TransitionMode,
  UiLanguage,
  VideoMode,
  VideoProviderMode
} from '../../types/settings'
import type { ElectronApi } from '../../types/electron-api'
import {
  DEFAULT_SETTINGS,
  IMAGE_PIXEL_SIZES,
  VIDEO_ASPECT_RATIOS,
  mergeSettings
} from '../../types/settings'
import {
  applyColorScheme,
  coerceColorScheme,
  type ColorSchemePref
} from '../../domain/colorScheme'
import {
  UI_LANGUAGES,
  coerceUiLanguage
} from '../../domain/uiLanguages'
import { changeUiLanguage } from '../../lib/i18n'
import { useApp } from '../context/AppContext'
import { useToast } from '../context/ToastContext'
import { useDialog } from '../context/DialogContext'
import { PageHeader } from '../components/PageHeader'
import { Button, Card, Input, Label, Select } from '../components/ui'

type SettingsTab = 'llm' | 'image' | 'video' | 'app'

export function SettingsPage(): JSX.Element {
  const toast = useToast()
  const dialog = useDialog()
  const { t, i18n } = useTranslation()
  const { refreshAiStatus } = useApp()
  const [tab, setTab] = useState<SettingsTab>('llm')
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [clearing, setClearing] = useState(false)
  /** Only set when FFmpeg is missing/broken — app requires FFmpeg always. */
  const [ffmpegError, setFfmpegError] = useState<string | null>(null)
  const [appInfo, setAppInfo] = useState<{
    version: string
    isPackaged: boolean
    userData: string
    mediaRoot: string
  } | null>(null)
  const [modelIds, setModelIds] = useState<string[]>([])
  const [chatBusy, setChatBusy] = useState(false)
  const [showLlmAdvanced, setShowLlmAdvanced] = useState(false)
  const [showVideoAdvanced, setShowVideoAdvanced] = useState(false)
  const [gatewayStatus, setGatewayStatus] = useState<{
    state: string
    message: string
    healthOk: boolean
    grokPath: string | null
    gctoacPath: string | null
    adminUrl: string
  } | null>(null)
  const [gatewayBusy, setGatewayBusy] = useState(false)
  const [webBusy, setWebBusy] = useState(false)
  const [webStatus, setWebStatus] = useState<{
    running: boolean
    url: string
    port: number
    error: string | null
    staticReady: boolean
  } | null>(null)
  const [updateState, setUpdateState] = useState<{
    status: string
    currentVersion: string
    latestVersion?: string
    progress?: number
    message?: string
  } | null>(null)
  const [updateBusy, setUpdateBusy] = useState(false)

  const refreshWebStatus = async (): Promise<void> => {
    if (!isElectron()) return
    try {
      const ws = getApi().webServer
      if (!ws?.status) {
        setWebStatus(null)
        return
      }
      const st = await ws.status()
      setWebStatus({
        running: st.running,
        url: st.url,
        port: st.port,
        error: st.error,
        staticReady: st.staticReady
      })
    } catch {
      setWebStatus(null)
    }
  }

  // Load once on mount — do NOT depend on i18n/t or language changes
  // will re-fetch stale uiLanguage and snap the UI back to the previous language.
  useEffect(() => {
    void getApi()
      .settings.get()
      .then((s) => {
        // Always merge defaults so new fields (webServerPort, etc.) show in UI
        const merged = mergeSettings(s)
        setSettings(merged)
        if (merged.uiLanguage) {
          const lang = coerceUiLanguage(merged.uiLanguage)
          if (lang !== i18n.language) {
            void changeUiLanguage(lang)
          }
        }
        applyColorScheme(coerceColorScheme(merged.colorScheme))
      })
      .catch((e) => setError(parseIpcError(e).message))
    void getApi()
      .media.checkFfmpeg()
      .then((r) => {
        // FFmpeg is mandatory; healthy state is silent (no useless badge).
        setFfmpegError(r.available ? null : r.message || t('settings.ffmpegRequired'))
      })
      .catch(() => setFfmpegError(t('settings.ffmpegRequired')))
    void getApi()
      .app.getInfo()
      .then((info) =>
        setAppInfo({
          version: info.version,
          isPackaged: info.isPackaged,
          userData: info.userData,
          mediaRoot: info.mediaRoot
        })
      )
      .catch(() => undefined)
    void refreshGatewayStatus()
    void refreshWebStatus()
    void getApi()
      .updates.status()
      .then((s) => setUpdateState(s))
      .catch(() => undefined)
    const unsub =
      getApi().updates.onState?.((s) => {
        setUpdateState(s)
      }) ?? (() => undefined)
    // Grok gateway: prepare (start + auto key) BEFORE listing models
    void (async () => {
      try {
        const s = await getApi().settings.get()
        const p = coerceLlmProviderPreset(s.llmProvider, s.baseUrl)
        if (p === 'grok-gateway') {
          await ensureGateway({ silent: true })
        }
        const models = await getApi().ai.listModels()
        setModelIds(models.map((x) => x.id))
      } catch {
        /* models optional until gateway/key ready */
      }
    })()
    return () => {
      unsub()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only load
  }, [])

  const getGatewayApi = (): ElectronApi['gateway'] | null => {
    try {
      const api = getApi() as ElectronApi
      return api.gateway ?? null
    } catch {
      return null
    }
  }

  const refreshGatewayStatus = async (): Promise<void> => {
    try {
      const gw = getGatewayApi()
      if (!gw) {
        setGatewayStatus({
          state: 'gateway_missing',
          message: t('settings.gatewayUnavailable'),
          healthOk: false,
          grokPath: null,
          gctoacPath: null,
          adminUrl: 'http://127.0.0.1:3847/admin/'
        })
        return
      }
      const st = await gw.status()
      setGatewayStatus(st)
    } catch {
      setGatewayStatus(null)
    }
  }

  /**
   * Start local gateway + auto-provision API key into settings (key never shown).
   * Silent by default; toast only on hard failures.
   */
  const ensureGateway = async (opts?: {
    silent?: boolean
  }): Promise<boolean> => {
    setGatewayBusy(true)
    try {
      const gw = getGatewayApi()
      if (!gw) {
        if (!opts?.silent) toast.error(t('settings.gatewayUnavailable'))
        setGatewayStatus({
          state: 'gateway_missing',
          message: t('settings.gatewayUnavailable'),
          healthOk: false,
          grokPath: null,
          gctoacPath: null,
          adminUrl: 'http://127.0.0.1:3847/admin/'
        })
        return false
      }
      const st = await gw.ensure()
      setGatewayStatus(st)
      // Reload settings so auto-written apiKey/baseUrl is in form state (still hidden)
      try {
        const fresh = await getApi().settings.get()
        setSettings((prev) =>
          prev
            ? {
                ...prev,
                apiKey: fresh.apiKey,
                baseUrl: fresh.baseUrl,
                llmProvider: fresh.llmProvider,
                model: fresh.model || prev.model
              }
            : fresh
        )
      } catch {
        /* ignore */
      }
      if (st.state === 'grok_build_missing') {
        if (!opts?.silent) {
          const hints = await gw.installHints()
          toast.error(t('settings.grokBuildMissing'))
          void openExternalUrl(hints.grokBuildUrl)
        }
        return false
      }
      if (st.state === 'gateway_missing') {
        if (!opts?.silent) toast.error(t('settings.gatewayPackageMissing'))
        return false
      }
      if (st.healthOk || st.state === 'ready' || st.keyReady) {
        if (!opts?.silent) {
          toast.success(
            st.keyCreated
              ? t('settings.gatewayReadyWithKey')
              : t('settings.gatewayReady')
          )
        }
        await refreshAiStatus()
        return true
      }
      if (!opts?.silent) toast.info(st.message)
      return false
    } catch (e) {
      if (!opts?.silent) toast.error(parseIpcError(e).message)
      return false
    } finally {
      setGatewayBusy(false)
    }
  }

  const patch = <K extends keyof AppSettings>(
    key: K,
    value: AppSettings[K]
  ): void => {
    setSettings((s) => (s ? { ...s, [key]: value } : s))
  }

  /** Open http(s) URL in the system browser; toast on success/failure. */
  const openExternalUrl = async (url: string): Promise<void> => {
    const href = url?.trim()
    if (!href) {
      toast.error(t('settings.openExternalNoUrl'))
      return
    }
    try {
      const api = getApi() as ElectronApi
      if (!api.shell?.openExternal) {
        toast.error(t('settings.openExternalUnavailable'))
        try {
          await navigator.clipboard.writeText(href)
          toast.info(t('settings.urlCopied', { url: href }))
        } catch {
          /* ignore */
        }
        return
      }
      await api.shell.openExternal(href)
      toast.success(t('settings.openExternalOk'))
    } catch (e) {
      toast.error(parseIpcError(e).message)
      try {
        await navigator.clipboard.writeText(href)
        toast.info(t('settings.urlCopied', { url: href }))
      } catch {
        /* ignore */
      }
    }
  }

  const handleSave = async (): Promise<void> => {
    if (!settings) return
    setSaving(true)
    setError(null)
    try {
      const lang = coerceUiLanguage(
        settings.uiLanguage || i18n.language,
        'zh-HK'
      )
      if (i18n.language !== lang) {
        await changeUiLanguage(lang)
      }
      const next = await getApi().settings.set({
        ...settings,
        uiLanguage: lang
      })
      setSettings(next)
      await refreshAiStatus()
      toast.success(t('common.saved'))
    } catch (e) {
      const msg = parseIpcError(e).message
      setError(msg)
      toast.error(msg)
    } finally {
      setSaving(false)
    }
  }

  /** Factory-reset all settings (keeps UI language). Clears API keys & custom endpoints. */
  const handleClearAll = async (): Promise<void> => {
    const ok = await dialog.confirm({
      message: t('settings.clearAllConfirm'),
      variant: 'danger',
      confirmLabel: t('settings.clearAll')
    })
    if (!ok) return
    setClearing(true)
    setError(null)
    try {
      const lang = coerceUiLanguage(
        settings?.uiLanguage || i18n.language,
        'zh-HK'
      )
      const scheme = coerceColorScheme(settings?.colorScheme)
      const wiped: AppSettings = {
        ...DEFAULT_SETTINGS,
        uiLanguage: lang,
        colorScheme: scheme,
        firstRunSeen: true,
        lastGenerationDegraded: false
      }
      const next = await getApi().settings.set(wiped)
      setSettings(next)
      applyColorScheme(scheme)
      setShowLlmAdvanced(false)
      setShowVideoAdvanced(false)
      setModelIds([])
      if (i18n.language !== lang) {
        await changeUiLanguage(lang)
      }
      await refreshAiStatus()
      // Refresh gateway card if back on default Grok
      try {
        const r = await getApi().gateway.status()
        setGatewayStatus({
          state: r.state,
          message: r.message,
          healthOk: r.healthOk,
          grokPath: r.grokPath,
          gctoacPath: r.gctoacPath,
          adminUrl: r.adminUrl
        })
      } catch {
        /* optional */
      }
      toast.success(t('settings.clearAllOk'))
    } catch (e) {
      const msg = parseIpcError(e).message
      setError(msg)
      toast.error(msg)
    } finally {
      setClearing(false)
    }
  }

  const handleLlmPresetChange = async (
    preset: LlmProviderPreset
  ): Promise<void> => {
    if (!settings) return
    try {
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
      setSettings((s) =>
        s
          ? {
              ...next,
              imageProvider: s.imageProvider,
              imageBaseUrl: s.imageBaseUrl,
              imageApiKey: s.imageApiKey,
              videoProvider: s.videoProvider,
              videoBaseUrl: s.videoBaseUrl,
              videoApiKey: s.videoApiKey,
              uiLanguage: s.uiLanguage
            }
          : next
      )
      setModelIds([])
      toast.success(t('settings.presetApplied', { preset }))
      // Await ensure so key is stored + AI rebound before status probe (avoids AI_UNAUTHORIZED race)
      if (preset === 'grok-gateway') {
        await ensureGateway({ silent: false })
      } else {
        await refreshAiStatus()
      }
    } catch (e) {
      setError(parseIpcError(e).message)
    }
  }

  const handleRefreshModels = async (): Promise<void> => {
    setChatBusy(true)
    try {
      if (settings) await getApi().settings.set(settings)
      const models = await getApi().ai.listModels()
      setModelIds(models.map((m) => m.id))
      const usedFallback = models.some(
        (m) => (m as { ownedBy?: string }).ownedBy === 'fallback'
      )
      if (usedFallback) {
        toast.info(t('settings.modelsFallback'))
      } else {
        toast.success(t('settings.modelsLoaded', { count: models.length }))
      }
    } catch (e) {
      // Soft fail: keep current model in dropdown
      const body = parseIpcError(e)
      if (body.code === 'AI_RATE_LIMIT') {
        const fallback = [
          settings?.model || 'grok-4.5',
          'grok-4.5',
          'grok-4',
          'grok-3-mini'
        ]
        setModelIds([...new Set(fallback.filter(Boolean))])
        toast.info(t('settings.modelsRateLimited'))
      } else {
        toast.error(formatIpcError(e))
      }
    } finally {
      setChatBusy(false)
    }
  }

  const handleTestChat = async (): Promise<void> => {
    if (!settings) return
    setChatBusy(true)
    try {
      await getApi().settings.set(settings)
      const r = await getApi().ai.testChat()
      toast.success(
        t('settings.testChatResult', {
          message: r.message,
          preview: r.replyPreview.slice(0, 80),
          defaultValue: '{{message}}: {{preview}}'
        })
      )
      await refreshAiStatus()
    } catch (e) {
      toast.error(formatIpcError(e))
    } finally {
      setChatBusy(false)
    }
  }

  const setLanguage = (lang: UiLanguage): void => {
    const code = coerceUiLanguage(lang)
    // Optimistic UI selection
    patch('uiLanguage', code)
    // Persist first, then switch i18n — avoids Layout/Settings race reloading old lang
    void getApi()
      .settings.set({ uiLanguage: code })
      .then(() => changeUiLanguage(code))
      .catch(() => {
        // Still try to switch UI even if persist fails
        void changeUiLanguage(code)
      })
  }

  const setColorScheme = (pref: ColorSchemePref): void => {
    const scheme = coerceColorScheme(pref)
    patch('colorScheme', scheme)
    applyColorScheme(scheme)
    void getApi()
      .settings.set({ colorScheme: scheme })
      .catch(() => undefined)
  }

  // Prefer form state (optimistic) so the selected card highlights immediately
  const currentLang = coerceUiLanguage(
    settings?.uiLanguage || i18n.language,
    'zh-HK'
  )
  const currentScheme = coerceColorScheme(settings?.colorScheme)

  const tabs: Array<{ id: SettingsTab; label: string }> = [
    { id: 'llm', label: t('settings.tabLlm') },
    { id: 'image', label: t('settings.tabImage') },
    { id: 'video', label: t('settings.tabVideo') },
    { id: 'app', label: t('settings.tabApp') }
  ]

  const llmPreset = settings
    ? coerceLlmProviderPreset(settings.llmProvider, settings.baseUrl)
    : 'grok-gateway'

  return (
    <div className="flex h-full flex-col overflow-hidden bg-gradient-to-b from-ink-950 via-ink-950 to-ink-900">
      <PageHeader
        title={t('settings.title')}
        subtitle={t('settings.subtitle')}
        actions={
          <>
            <Button
              variant="danger"
              loading={clearing}
              disabled={saving || !settings}
              onClick={() => void handleClearAll()}
            >
              {t('settings.clearAll')}
            </Button>
            <Button
              loading={saving}
              disabled={clearing || !settings}
              onClick={() => void handleSave()}
            >
              {t('common.save')}
            </Button>
          </>
        }
      />

      {/* Same tab chrome as Characters / other multi-tab pages */}
      <div className="border-b border-ink-800/80 px-8">
        <div className="flex gap-1">
          {tabs.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={[
                'relative px-4 py-3 text-sm font-medium transition',
                tab === id
                  ? 'text-brand-200'
                  : 'text-ink-400 hover:text-ink-200'
              ].join(' ')}
            >
              {label}
              {tab === id && (
                <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-brand-500" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Full-width content shell — identical for every settings tab */}
      <div className="relative min-h-0 flex-1 overflow-y-auto px-8 py-6">
        {error && (
          <div className="mb-4 rounded-xl border border-rose-900/50 bg-rose-950/40 px-4 py-3 text-sm text-rose-100">
            {formatUserError(error, t)}
          </div>
        )}

        {!settings ? (
          <p className="text-sm text-ink-400">{t('common.loading')}</p>
        ) : (
          <div className="w-full max-w-none space-y-4">
            {tab === 'llm' && (
              <Card className="space-y-4">
                <div>
                  <h2 className="text-sm font-semibold text-ink-100">
                    {t('settings.tabLlm')}
                  </h2>
                  <p className="mt-0.5 text-xs text-ink-500">
                    {llmPreset === 'grok-gateway'
                      ? t('settings.llmTabHintGrok')
                      : t('settings.llmTabHint')}
                  </p>
                </div>
                <LlmProviderPicker
                  value={llmPreset}
                  onChange={(p) => void handleLlmPresetChange(p)}
                />
                {/*
                  Grok 本機閘道：全自動（啟動 + 金鑰），使用者無須查看面板／key／baseUrl。
                  其他供應商才顯示金鑰與進階選項。
                */}
                {llmPreset === 'grok-gateway' ? (
                  <div className="space-y-4 border-t border-ink-800/80 pt-3">
                    <GrokGatewaySetupCard
                      status={
                        gatewayStatus
                          ? {
                              state: gatewayStatus.state,
                              message: gatewayStatus.message,
                              healthOk: gatewayStatus.healthOk,
                              grokPath: gatewayStatus.grokPath,
                              gctoacPath: gatewayStatus.gctoacPath,
                              keyReady: Boolean(
                                settings.apiKey?.startsWith('gk_live_')
                              )
                            }
                          : null
                      }
                      busy={gatewayBusy}
                      onRecheck={() => void ensureGateway({ silent: false })}
                      onCopyInstall={(cmd) => {
                        void navigator.clipboard
                          .writeText(cmd)
                          .then(() =>
                            toast.success(t('settings.installCmdCopied'))
                          )
                          .catch(() =>
                            toast.info(t('settings.urlCopied', { url: cmd }))
                          )
                      }}
                      onOpenInstallPage={() => {
                        void (async () => {
                          try {
                            const gw = getGatewayApi()
                            const hints = gw
                              ? await gw.installHints()
                              : {
                                  grokBuildUrl: 'https://x.ai/',
                                  installCommand: GROK_INSTALL_CMD
                                }
                            await openExternalUrl(
                              hints.grokBuildUrl || 'https://x.ai/'
                            )
                          } catch {
                            await openExternalUrl('https://x.ai/')
                          }
                        })()
                      }}
                    />
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
                          disabled={
                            gatewayBusy ||
                            gatewayStatus?.state === 'grok_build_missing'
                          }
                        >
                          {modelIds.map((id) => (
                            <option key={id} value={id}>
                              {id}
                            </option>
                          ))}
                        </Select>
                      ) : (
                        <Input
                          value={settings.model}
                          onChange={(e) => patch('model', e.target.value)}
                          disabled={
                            gatewayBusy ||
                            gatewayStatus?.state === 'grok_build_missing'
                          }
                        />
                      )}
                      {gatewayStatus?.state === 'grok_build_missing' && (
                        <p className="mt-1 text-[11px] text-ink-500">
                          {t('settings.grokModelAfterInstall')}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-wrap justify-end gap-2 pt-1">
                      <Button
                        variant="secondary"
                        disabled={
                          chatBusy ||
                          gatewayBusy ||
                          gatewayStatus?.state === 'grok_build_missing'
                        }
                        onClick={() => void handleRefreshModels()}
                      >
                        {t('settings.refreshModels')}
                      </Button>
                      <Button
                        disabled={
                          chatBusy ||
                          gatewayBusy ||
                          gatewayStatus?.state === 'grok_build_missing'
                        }
                        onClick={() => void handleTestChat()}
                      >
                        {t('settings.testChat')}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="space-y-3 border-t border-ink-800/80 pt-3">
                      <div>
                        <Label>{t('settings.apiKey')}</Label>
                        <Input
                          value={settings.apiKey}
                          onChange={(e) => patch('apiKey', e.target.value)}
                          placeholder={
                            llmPreset === 'openai' || llmPreset === 'openrouter'
                              ? 'sk-…'
                              : providerKeyOptional(llmPreset)
                                ? t('settings.apiKeyHintCustom')
                                : t('common.apiKeyPlaceholder')
                          }
                        />
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
                          </Select>
                        ) : (
                          <Input
                            value={settings.model}
                            onChange={(e) => patch('model', e.target.value)}
                          />
                        )}
                      </div>
                      <button
                        type="button"
                        className="text-[11px] text-brand-300 hover:underline"
                        onClick={() => setShowLlmAdvanced((v) => !v)}
                      >
                        {showLlmAdvanced
                          ? t('settings.hideAdvanced')
                          : t('settings.showAdvanced')}
                      </button>
                      {showLlmAdvanced && (
                        <div className="space-y-3">
                          <div>
                            <Label>{t('settings.baseUrl')}</Label>
                            <Input
                              value={settings.baseUrl}
                              onChange={(e) => {
                                patch('baseUrl', e.target.value)
                                patch('llmProvider', 'custom')
                              }}
                            />
                          </div>
                          <div>
                            <Label>
                              {t('settings.chatTimeoutMs')} (
                              {settings.chatTimeoutMs}ms)
                            </Label>
                            <Input
                              type="number"
                              min={5000}
                              step={1000}
                              value={settings.chatTimeoutMs}
                              onChange={(e) =>
                                patch(
                                  'chatTimeoutMs',
                                  Number(e.target.value) || 120000
                                )
                              }
                            />
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="flex flex-wrap justify-end gap-2 border-t border-ink-800/80 pt-3">
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
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() =>
                          void openExternalUrl(providerDocsUrl(llmPreset))
                        }
                      >
                        {t('settings.openProviderDocs')}
                      </Button>
                    </div>
                  </>
                )}
              </Card>
            )}

            {tab === 'image' && (
              <Card className="space-y-4">
                <div>
                  <h2 className="text-sm font-semibold text-ink-100">
                    {t('settings.tabImage')}
                  </h2>
                  <p className="mt-0.5 text-xs text-ink-500">
                    {t('settings.imageTabHint')}
                  </p>
                </div>
                <div>
                  <Label>{t('settings.imageProvider')}</Label>
                  <div className="mt-2">
                    <ProviderChannelPicker
                      channel="image"
                      value={
                        (settings.imageProvider ||
                          'same-as-llm') as ChannelPickerValue
                      }
                      onChange={(id) => {
                        const v = id as ImageProviderMode
                        patch('imageProvider', v)
                        if (v === 'same-as-llm') {
                          return
                        }
                        if (v === 'seedream') {
                          const defBase = channelPresetBaseUrl('seedream')
                          if (defBase) patch('imageBaseUrl', defBase)
                          if (!settings.imageModel?.trim()) {
                            patch('imageModel', 'doubao-seedream-4-0')
                          }
                          return
                        }
                        if (v === 'custom') {
                          if (!settings.imageBaseUrl?.trim()) {
                            patch('imageBaseUrl', settings.baseUrl)
                          }
                          return
                        }
                        const defBase = channelPresetBaseUrl(v)
                        if (defBase) {
                          patch('imageBaseUrl', defBase)
                        }
                      }}
                    />
                  </div>
                </div>
                {settings.imageProvider !== 'same-as-llm' && (
                  <>
                    <div>
                      <Label>{t('settings.imageApiKey')}</Label>
                      <Input
                        value={settings.imageApiKey}
                        onChange={(e) =>
                          patch('imageApiKey', e.target.value)
                        }
                        placeholder={t('settings.inheritLlmKey')}
                      />
                    </div>
                    <div>
                      <Label>{t('settings.imageBaseUrl')}</Label>
                      <Input
                        value={settings.imageBaseUrl}
                        onChange={(e) => {
                          patch('imageBaseUrl', e.target.value)
                          if (
                            settings.imageProvider !== 'custom' &&
                            settings.imageProvider !== 'seedream' &&
                            isLlmProviderPreset(
                              String(settings.imageProvider)
                            )
                          ) {
                            const def = channelPresetBaseUrl(
                              settings.imageProvider
                            )
                            if (
                              e.target.value.trim() &&
                              def &&
                              e.target.value.trim() !== def
                            ) {
                              patch('imageProvider', 'custom')
                            }
                          }
                        }}
                        placeholder={
                          channelPresetBaseUrl(
                            settings.imageProvider || 'same-as-llm'
                          ) || settings.baseUrl
                        }
                      />
                    </div>
                    {(settings.imageProvider === 'seedream' ||
                      settings.imageModel?.trim()) && (
                      <div>
                        <Label>{t('settings.imageModel')}</Label>
                        <Input
                          value={settings.imageModel}
                          onChange={(e) =>
                            patch('imageModel', e.target.value)
                          }
                          placeholder="doubao-seedream-4-0"
                        />
                        <p className="mt-1 text-[11px] text-ink-500">
                          {t('settings.imageModelHint')}
                        </p>
                      </div>
                    )}
                  </>
                )}
                <div className="grid gap-3 sm:grid-cols-3">
                  <div>
                    <Label>{t('settings.imageSizeWide')}</Label>
                    <Select
                      value={settings.imageSizeWide}
                      onChange={(e) =>
                        patch(
                          'imageSizeWide',
                          e.target.value as ImagePixelSize
                        )
                      }
                    >
                      {IMAGE_PIXEL_SIZES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div>
                    <Label>{t('settings.imageSizeSquare')}</Label>
                    <Select
                      value={settings.imageSizeSquare}
                      onChange={(e) =>
                        patch(
                          'imageSizeSquare',
                          e.target.value as ImagePixelSize
                        )
                      }
                    >
                      {IMAGE_PIXEL_SIZES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div>
                    <Label>{t('settings.imageSizeTall')}</Label>
                    <Select
                      value={settings.imageSizeTall}
                      onChange={(e) =>
                        patch(
                          'imageSizeTall',
                          e.target.value as ImagePixelSize
                        )
                      }
                    >
                      {IMAGE_PIXEL_SIZES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </Select>
                  </div>
                </div>
                <label className="flex items-center gap-2 text-sm text-ink-200">
                  <input
                    type="checkbox"
                    checked={settings.imageEnhance}
                    onChange={(e) =>
                      patch('imageEnhance', e.target.checked)
                    }
                  />
                  {t('settings.imageEnhance')}
                </label>
              </Card>
            )}

            {tab === 'video' && (
              <Card className="space-y-4">
                <div>
                  <h2 className="text-sm font-semibold text-ink-100">
                    {t('settings.tabVideo')}
                  </h2>
                  <p className="mt-0.5 text-xs text-ink-500">
                    {t('settings.videoTabHint')}
                  </p>
                </div>
                <div>
                  <Label>{t('settings.videoProvider')}</Label>
                  <div className="mt-2">
                    <ProviderChannelPicker
                      channel="video"
                      value={
                        (settings.videoProvider ||
                          'same-as-llm') as ChannelPickerValue
                      }
                      onChange={(id) => {
                        const v = id as VideoProviderMode
                        patch('videoProvider', v)
                        if (v === 'stub') {
                          patch('videoMode', 'stub')
                          return
                        }
                        if (v === 'same-as-llm') {
                          return
                        }
                        if (v === 'seedance') {
                          patch('videoMode', 'http')
                          const defBase = channelPresetBaseUrl('seedance')
                          if (defBase) patch('videoBaseUrl', defBase)
                          if (!settings.videoModel?.trim()) {
                            patch('videoModel', 'doubao-seedance-1-0-pro')
                          }
                          return
                        }
                        if (v === 'grok-gateway') {
                          patch('videoMode', 'auto')
                          patch(
                            'videoPath',
                            DEFAULT_SETTINGS.videoPath
                          )
                          patch(
                            'videoBaseUrl',
                            channelPresetBaseUrl('grok-gateway')
                          )
                          return
                        }
                        if (v === 'custom') {
                          patch('videoMode', 'http')
                          if (!settings.videoBaseUrl?.trim()) {
                            patch('videoBaseUrl', settings.baseUrl)
                          }
                          return
                        }
                        patch('videoMode', 'http')
                        const defBase = channelPresetBaseUrl(v)
                        if (defBase) {
                          patch('videoBaseUrl', defBase)
                          patch('videoPath', `${defBase.replace(/\/+$/, '')}/videos`)
                        }
                      }}
                    />
                  </div>
                </div>
                {settings.videoProvider !== 'same-as-llm' &&
                  settings.videoProvider !== 'stub' && (
                  <>
                    <div>
                      <Label>{t('settings.videoApiKey')}</Label>
                      <Input
                        value={settings.videoApiKey}
                        onChange={(e) =>
                          patch('videoApiKey', e.target.value)
                        }
                        placeholder={t('settings.inheritLlmKey')}
                      />
                    </div>
                    <div>
                      <Label>{t('settings.videoBaseUrl')}</Label>
                      <Input
                        value={settings.videoBaseUrl}
                        onChange={(e) =>
                          patch('videoBaseUrl', e.target.value)
                        }
                        placeholder={
                          channelPresetBaseUrl(
                            settings.videoProvider || 'same-as-llm'
                          ) || settings.baseUrl
                        }
                      />
                      {settings.videoProvider === 'seedance' && (
                        <p className="mt-1 text-[11px] text-ink-500">
                          {t('settings.seedanceBaseHint')}
                        </p>
                      )}
                    </div>
                    {(settings.videoProvider === 'seedance' ||
                      settings.videoModel?.trim()) && (
                      <div>
                        <Label>{t('settings.videoModel')}</Label>
                        <Input
                          value={settings.videoModel}
                          onChange={(e) =>
                            patch('videoModel', e.target.value)
                          }
                          placeholder="doubao-seedance-1-0-pro"
                        />
                        <p className="mt-1 text-[11px] text-ink-500">
                          {t('settings.videoModelHint')}
                        </p>
                      </div>
                    )}
                  </>
                )}
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label>{t('settings.aspectRatio')}</Label>
                    <Select
                      value={settings.aspectRatio}
                      onChange={(e) => patch('aspectRatio', e.target.value)}
                    >
                      {VIDEO_ASPECT_RATIOS.map((ar) => (
                        <option key={ar} value={ar}>
                          {ar}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div>
                    <Label>{t('settings.defaultMaxClipSeconds')}</Label>
                    <Select
                      value={String(settings.defaultMaxClipSeconds)}
                      onChange={(e) =>
                        patch(
                          'defaultMaxClipSeconds',
                          Number(e.target.value) || 6
                        )
                      }
                    >
                      <option value="6">
                        {t('settings.clipSecondsOption', { n: 6 })}
                      </option>
                      <option value="10">
                        {t('settings.clipSecondsOption', { n: 10 })}
                      </option>
                    </Select>
                  </div>
                  <div>
                    <Label>{t('settings.transitionMode')}</Label>
                    <Select
                      value={settings.transitionMode}
                      onChange={(e) =>
                        patch(
                          'transitionMode',
                          e.target.value as TransitionMode
                        )
                      }
                    >
                      <option value="cut">{t('settings.transitionCut')}</option>
                      <option value="fade">{t('settings.transitionFade')}</option>
                    </Select>
                  </div>
                </div>
                <button
                  type="button"
                  className="text-[11px] text-brand-300 hover:underline"
                  onClick={() => setShowVideoAdvanced((v) => !v)}
                >
                  {showVideoAdvanced
                    ? t('settings.hideAdvanced')
                    : t('settings.showAdvanced')}
                </button>
                {showVideoAdvanced && (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <Label>{t('settings.videoMode')}</Label>
                      <Select
                        value={settings.videoMode}
                        onChange={(e) =>
                          patch('videoMode', e.target.value as VideoMode)
                        }
                      >
                        <option value="auto">{t('settings.videoModeAuto')}</option>
                        <option value="http">{t('settings.videoModeHttp')}</option>
                        <option value="stub">{t('settings.videoModeStub')}</option>
                      </Select>
                    </div>
                    <div>
                      <Label>{t('settings.videoPath')}</Label>
                      <Input
                        value={settings.videoPath}
                        onChange={(e) => patch('videoPath', e.target.value)}
                      />
                    </div>
                    <div>
                      <Label>{t('settings.videoConcurrency')}</Label>
                      <Input
                        type="number"
                        min={1}
                        max={4}
                        value={settings.videoConcurrency}
                        onChange={(e) =>
                          patch(
                            'videoConcurrency',
                            Number(e.target.value) || 1
                          )
                        }
                      />
                    </div>
                    <div>
                      <Label>{t('settings.videoTimeoutSec')}</Label>
                      <Input
                        type="number"
                        min={30}
                        value={settings.videoTimeoutSec}
                        onChange={(e) =>
                          patch(
                            'videoTimeoutSec',
                            Number(e.target.value) || 300
                          )
                        }
                      />
                    </div>
                  </div>
                )}
              </Card>
            )}

            {tab === 'app' && (
              <Card className="space-y-4">
                <div>
                  <h2 className="text-sm font-semibold text-ink-100">
                    {t('settings.tabApp')}
                  </h2>
                  <p className="mt-0.5 text-xs text-ink-500">
                    {t('settings.appTabHint')}
                  </p>
                </div>
                <div>
                  <Label>{t('settings.uiLanguage')}</Label>
                  <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
                    {UI_LANGUAGES.map((lang) => {
                      const active = currentLang === lang.id
                      return (
                        <button
                          key={lang.id}
                          type="button"
                          onClick={() => setLanguage(lang.id)}
                          className={[
                            'rounded-xl border px-2.5 py-2 text-left transition',
                            active
                              ? 'border-brand-500 bg-brand-950 ring-1 ring-brand-500/45'
                              : 'border-ink-700 bg-ink-950 hover:border-ink-500 hover:bg-ink-900'
                          ].join(' ')}
                        >
                          <div
                            className={[
                              'text-sm font-semibold leading-tight',
                              active ? 'text-brand-100' : 'text-ink-100'
                            ].join(' ')}
                          >
                            {lang.nativeLabel}
                          </div>
                          <div className="mt-0.5 text-[10px] text-ink-500">
                            {lang.englishName}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>
                <div>
                  <Label>{t('settings.colorScheme')}</Label>
                  <p className="mt-0.5 text-[11px] text-ink-500">
                    {t('settings.colorSchemeHint')}
                  </p>
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    {(
                      [
                        {
                          id: 'system' as const,
                          label: t('settings.colorSchemeSystem')
                        },
                        {
                          id: 'light' as const,
                          label: t('settings.colorSchemeLight')
                        },
                        {
                          id: 'dark' as const,
                          label: t('settings.colorSchemeDark')
                        }
                      ] as const
                    ).map((opt) => {
                      const active = currentScheme === opt.id
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => setColorScheme(opt.id)}
                          className={[
                            'rounded-xl border px-2.5 py-2.5 text-center text-sm font-medium transition',
                            active
                              ? 'border-brand-500 bg-brand-950 text-brand-100 ring-1 ring-brand-500/45'
                              : 'border-ink-700 bg-ink-950 text-ink-200 hover:border-ink-500 hover:bg-ink-900'
                          ].join(' ')}
                        >
                          {opt.label}
                        </button>
                      )
                    })}
                  </div>
                </div>
                {ffmpegError && (
                  <div
                    className="rounded-xl border border-rose-600/40 bg-rose-950/40 px-3 py-2.5 text-xs text-rose-100 shadow-theme-sm"
                    role="alert"
                  >
                    <p className="font-semibold">{t('settings.ffmpegRequiredTitle')}</p>
                    <p className="mt-1 leading-relaxed text-rose-100/90">
                      {t('settings.ffmpegRequired')}
                    </p>
                    <p className="mt-1.5 font-mono text-[10px] text-rose-200/70 break-all">
                      {ffmpegError}
                    </p>
                  </div>
                )}
                {appInfo && (
                  <div className="rounded-xl border border-ink-700 bg-ink-900 px-3 py-2.5 shadow-theme-sm">
                    <p className="font-mono text-[11px] text-ink-400">
                      v{appInfo.version}
                      {appInfo.isPackaged
                        ? ` · ${t('app.packaged')}`
                        : ` · ${t('app.dev')}`}
                    </p>
                    <div className="mt-1.5 flex items-center gap-2">
                      <p
                        className="min-w-0 flex-1 truncate font-mono text-[11px] text-ink-500"
                        title={appInfo.userData}
                      >
                        {appInfo.userData}
                      </p>
                      <Button
                        variant="secondary"
                        className="!h-8 shrink-0 !px-2.5 !text-[11px]"
                        onClick={() => {
                          void (async () => {
                            try {
                              const r = (await getApi().shell.openPath(
                                appInfo.userData
                              )) as {
                                ok?: boolean
                                path?: string
                                isDirectory?: boolean
                                message?: string
                              }
                              if (r?.isDirectory || r?.path) {
                                const p = r.path || appInfo.userData
                                try {
                                  await navigator.clipboard.writeText(p)
                                  toast.success(
                                    t('settings.dataPathCopied', { path: p })
                                  )
                                } catch {
                                  toast.info(p)
                                }
                                return
                              }
                              toast.error(t('settings.openDataFolderFail'))
                            } catch (e) {
                              toast.error(
                                parseIpcError(e).message ||
                                  t('settings.openDataFolderFail')
                              )
                            }
                          })()
                        }}
                      >
                        {t('settings.openDataFolder')}
                      </Button>
                    </div>
                  </div>
                )}

                {/* Desktop auto-update (GitHub Releases via electron-updater) */}
                <div className="rounded-xl border border-ink-700 bg-ink-900 px-3 py-3 shadow-theme-sm">
                  <p className="text-sm font-semibold text-ink-100">
                    {t('settings.updates')}
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-ink-400">
                    {t('settings.updateHint')}
                  </p>
                  <p className="mt-2 font-mono text-[11px] text-ink-400">
                    {t('settings.version')}:{' '}
                    {updateState?.currentVersion ?? appInfo?.version ?? '—'}
                    {updateState?.latestVersion
                      ? ` → ${updateState.latestVersion}`
                      : ''}
                  </p>
                  <p className="mt-1 text-[11px] text-ink-500">
                    {updateState?.message ||
                      (updateState?.status
                        ? `${t('settings.updateStatus')}: ${updateState.status}`
                        : t('settings.updateIdle'))}
                    {typeof updateState?.progress === 'number' &&
                    updateState.status === 'downloading'
                      ? ` (${updateState.progress}%)`
                      : ''}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      variant="secondary"
                      className="!h-8 !text-[11px]"
                      disabled={updateBusy}
                      onClick={() => {
                        setUpdateBusy(true)
                        void getApi()
                          .updates.check()
                          .then((s) => {
                            setUpdateState(s)
                            if (s.status === 'available') {
                              toast.info(
                                t('settings.updateAvailableToast', {
                                  version: s.latestVersion ?? ''
                                })
                              )
                            } else if (s.status === 'not-available') {
                              toast.success(t('settings.updateUpToDate'))
                            } else if (s.status === 'dev-skipped') {
                              toast.info(t('settings.updateDevSkipped'))
                            } else if (s.status === 'error') {
                              toast.error(
                                s.message || t('settings.updateCheckFail')
                              )
                            }
                          })
                          .catch((e) =>
                            toast.error(
                              parseIpcError(e).message ||
                                t('settings.updateCheckFail')
                            )
                          )
                          .finally(() => setUpdateBusy(false))
                      }}
                    >
                      {t('settings.checkUpdate')}
                    </Button>
                    <Button
                      variant="secondary"
                      className="!h-8 !text-[11px]"
                      disabled={
                        updateBusy ||
                        (updateState?.status !== 'available' &&
                          updateState?.status !== 'downloaded')
                      }
                      onClick={() => {
                        setUpdateBusy(true)
                        void getApi()
                          .updates.download()
                          .then((s) => {
                            setUpdateState(s)
                            if (s.status === 'downloaded') {
                              toast.success(t('settings.updateDownloadedToast'))
                            }
                          })
                          .catch((e) =>
                            toast.error(
                              parseIpcError(e).message ||
                                t('settings.updateDownloadFail')
                            )
                          )
                          .finally(() => setUpdateBusy(false))
                      }}
                    >
                      {t('settings.downloadUpdate')}
                    </Button>
                    <Button
                      className="!h-8 !text-[11px]"
                      disabled={
                        updateBusy || updateState?.status !== 'downloaded'
                      }
                      onClick={() => {
                        void getApi()
                          .updates.install()
                          .then((r) => {
                            if (!r.ok) {
                              toast.error(
                                r.message || t('settings.updateInstallFail')
                              )
                            }
                          })
                          .catch((e) =>
                            toast.error(
                              parseIpcError(e).message ||
                                t('settings.updateInstallFail')
                            )
                          )
                      }}
                    >
                      {t('settings.installUpdate')}
                    </Button>
                  </div>
                  <p className="mt-2 text-[10px] leading-relaxed text-ink-500">
                    {t('settings.cliUpdateHint')}
                  </p>
                </div>

                {/* Creator · Support / Donate */}
                <div className="rounded-xl border border-brand-500/25 bg-brand-950/30 px-3 py-3 shadow-theme-sm">
                  <p className="text-sm font-semibold text-brand-100">
                    👤 {t('creator.title')}
                  </p>
                  <p className="mt-1 text-sm font-medium text-ink-100">
                    {t('creator.name')}
                  </p>
                  <p className="mt-0.5 text-xs leading-relaxed text-ink-400">
                    {t('creator.bio')}
                  </p>
                  <p className="mt-3 text-sm font-semibold text-brand-100">
                    ☕ {t('creator.supportTitle')}
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-ink-300">
                    {t('creator.supportBlurb')}
                  </p>
                  <div className="mt-2 space-y-1.5">
                    {DONATE_ADDRESSES.map((row) => {
                      const netKey =
                        row.id === 'evm'
                          ? 'creator.networkEvm'
                          : row.id === 'near'
                            ? 'creator.networkNear'
                            : 'creator.networkAda'
                      return (
                        <div
                          key={row.id}
                          className="flex flex-wrap items-center gap-2 rounded-lg border border-ink-700/80 bg-ink-950/50 px-2 py-1.5"
                        >
                          <span className="min-w-[7.5rem] text-[11px] font-medium text-ink-400">
                            {t(netKey)}
                          </span>
                          <code className="min-w-0 flex-1 truncate font-mono text-[11px] text-ink-200">
                            {row.address}
                          </code>
                          <Button
                            variant="secondary"
                            className="!h-7 shrink-0 !px-2 !text-[10px]"
                            onClick={() => {
                              void (async () => {
                                try {
                                  await navigator.clipboard.writeText(
                                    row.address
                                  )
                                  toast.success(
                                    t('creator.copied', {
                                      address: row.address
                                    })
                                  )
                                } catch {
                                  toast.info(row.address)
                                }
                              })()
                            }}
                          >
                            {t('creator.copy')}
                          </Button>
                        </div>
                      )
                    })}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      variant="secondary"
                      className="!h-8 !text-[11px]"
                      onClick={() => {
                        void getApi()
                          .shell.openExternal(CREATOR_LINKTREE)
                          .catch(() => {
                            window.open(
                              CREATOR_LINKTREE,
                              '_blank',
                              'noopener,noreferrer'
                            )
                          })
                      }}
                    >
                      {t('creator.openLinktree')}
                    </Button>
                    <Button
                      variant="secondary"
                      className="!h-8 !text-[11px]"
                      onClick={() => {
                        void getApi()
                          .shell.openExternal(YSK_HOME_URL)
                          .catch(() => {
                            window.open(
                              YSK_HOME_URL,
                              '_blank',
                              'noopener,noreferrer'
                            )
                          })
                      }}
                    >
                      {t('creator.yskSite')}
                    </Button>
                  </div>
                </div>

                {settings && (
                  <div className="rounded-xl border border-ink-700 bg-ink-900 px-3 py-3 shadow-theme-sm">
                    <p className="text-sm font-medium text-ink-100">
                      {t('legal.viewInSettings')}
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-ink-400">
                      {t('legal.viewInSettingsHint')}
                    </p>
                    <p className="mt-2 font-mono text-[11px] text-ink-400">
                      {t('legal.versionLabel', {
                        version: LEGAL_VERSION,
                        date: LEGAL_EFFECTIVE_DATE
                      })}
                    </p>
                    {settings.legalAcceptedVersion ? (
                      <p
                        className={[
                          'mt-1 text-[11px]',
                          settings.legalAcceptedVersion === LEGAL_VERSION
                            ? 'text-ink-500'
                            : 'text-amber-200'
                        ].join(' ')}
                      >
                        {t('legal.lastAccepted', {
                          version: settings.legalAcceptedVersion,
                          date: formatLegalAcceptedAt(settings.legalAcceptedAt)
                        })}
                        {settings.legalAcceptedVersion !== LEGAL_VERSION
                          ? ` · ${t('legal.outdatedAccept')}`
                          : ''}
                      </p>
                    ) : (
                      <p className="mt-1 text-[11px] text-amber-200">
                        {t('legal.notYetAccepted')}
                      </p>
                    )}
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        variant="secondary"
                        className="!h-9 !text-xs"
                        onClick={() => openLegalDocument('disclaimer')}
                      >
                        {t('legal.openDisclaimer')}
                      </Button>
                      <Button
                        variant="secondary"
                        className="!h-9 !text-xs"
                        onClick={() => openLegalDocument('terms')}
                      >
                        {t('legal.openTerms')}
                      </Button>
                    </div>
                  </div>
                )}

                {isElectron() && settings && (
                  <div className="rounded-xl border border-ink-700 bg-ink-900 px-3 py-3 shadow-theme-sm">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-ink-100">
                          {t('settings.webServerTitle')}
                        </p>
                        <p className="mt-1 text-xs leading-relaxed text-ink-400">
                          {t('settings.webServerHint')}
                        </p>
                      </div>
                      <span
                        className={[
                          'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium',
                          webStatus?.running
                            ? 'bg-emerald-950/80 text-emerald-200 ring-1 ring-emerald-700/40'
                            : 'bg-ink-800 text-ink-400 ring-1 ring-ink-700'
                        ].join(' ')}
                      >
                        {webStatus?.running
                          ? t('settings.webServerOn')
                          : t('settings.webServerOff')}
                      </span>
                    </div>

                    <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm text-ink-200">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-ink-600"
                        checked={Boolean(settings.webServerEnabled)}
                        disabled={webBusy}
                        onChange={(e) => {
                          const on = e.target.checked
                          setWebBusy(true)
                          void (async () => {
                            try {
                              const ws = getApi().webServer
                              if (
                                !ws?.start ||
                                !ws?.stop ||
                                !ws?.generateToken
                              ) {
                                toast.error(t('settings.webServerApiMissing'))
                                return
                              }
                              if (on) {
                                if (!settings.webServerAuthToken?.trim()) {
                                  const g = await ws.generateToken()
                                  setSettings(mergeSettings(g.settings))
                                }
                                const st = await ws.start()
                                setWebStatus({
                                  running: st.running,
                                  url: st.url,
                                  port: st.port,
                                  error: st.error,
                                  staticReady: st.staticReady
                                })
                                const s = await getApi().settings.get()
                                setSettings(mergeSettings(s))
                                toast.success(t('settings.webServerStarted'))
                              } else {
                                const st = await ws.stop()
                                setWebStatus({
                                  running: st.running,
                                  url: st.url,
                                  port: st.port,
                                  error: st.error,
                                  staticReady: st.staticReady
                                })
                                const s = await getApi().settings.set({
                                  webServerEnabled: false
                                })
                                setSettings(mergeSettings(s))
                                toast.info(t('settings.webServerStopped'))
                              }
                            } catch (err) {
                              toast.error(parseIpcError(err).message)
                              await refreshWebStatus()
                              const s = await getApi().settings.get()
                              setSettings(mergeSettings(s))
                            } finally {
                              setWebBusy(false)
                            }
                          })()
                        }}
                      />
                      {t('settings.webServerEnable')}
                    </label>

                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      <div>
                        <Label>{t('settings.webServerPort')}</Label>
                        <Input
                          type="number"
                          min={1}
                          max={65535}
                          placeholder={String(DEFAULT_SETTINGS.webServerPort)}
                          value={
                            settings.webServerPort &&
                            settings.webServerPort > 0
                              ? settings.webServerPort
                              : DEFAULT_SETTINGS.webServerPort
                          }
                          onChange={(e) => {
                            const raw = e.target.value.trim()
                            if (raw === '') {
                              // Keep field controlled; empty → default port
                              patch(
                                'webServerPort',
                                DEFAULT_SETTINGS.webServerPort
                              )
                              return
                            }
                            const n = Number(raw)
                            patch(
                              'webServerPort',
                              Number.isFinite(n) && n > 0
                                ? Math.min(65535, Math.floor(n))
                                : DEFAULT_SETTINGS.webServerPort
                            )
                          }}
                          onBlur={() => {
                            const port =
                              settings.webServerPort &&
                              settings.webServerPort > 0
                                ? settings.webServerPort
                                : DEFAULT_SETTINGS.webServerPort
                            patch('webServerPort', port)
                            setWebBusy(true)
                            void getApi()
                              .settings.set({
                                webServerPort: port,
                                webServerHost:
                                  settings.webServerHost ||
                                  DEFAULT_SETTINGS.webServerHost
                              })
                              .then((s) => {
                                setSettings(mergeSettings(s))
                                if (!s.webServerEnabled) return null
                                return getApi().webServer.start()
                              })
                              .then((st) => {
                                if (!st) return
                                setWebStatus({
                                  running: st.running,
                                  url: st.url,
                                  port: st.port,
                                  error: st.error,
                                  staticReady: st.staticReady
                                })
                              })
                              .catch((err) =>
                                toast.error(parseIpcError(err).message)
                              )
                              .finally(() => setWebBusy(false))
                          }}
                        />
                        <p className="mt-1 text-[11px] text-ink-500">
                          {t('settings.webServerPortHint', {
                            port: DEFAULT_SETTINGS.webServerPort
                          })}
                        </p>
                      </div>
                      <div>
                        <Label>{t('settings.webServerHost')}</Label>
                        <Select
                          value={
                            (settings.webServerHost ||
                              DEFAULT_SETTINGS.webServerHost) === '127.0.0.1'
                              ? '127.0.0.1'
                              : '0.0.0.0'
                          }
                          onChange={(e) => {
                            const host = e.target.value
                            patch('webServerHost', host)
                            setWebBusy(true)
                            void getApi()
                              .settings.set({
                                webServerHost: host,
                                webServerPort:
                                  settings.webServerPort ||
                                  DEFAULT_SETTINGS.webServerPort
                              })
                              .then((s) => {
                                setSettings(mergeSettings(s))
                                if (!s.webServerEnabled) return null
                                return getApi().webServer.start()
                              })
                              .then((st) => {
                                if (!st) return
                                setWebStatus({
                                  running: st.running,
                                  url: st.url,
                                  port: st.port,
                                  error: st.error,
                                  staticReady: st.staticReady
                                })
                              })
                              .catch((err) =>
                                toast.error(parseIpcError(err).message)
                              )
                              .finally(() => setWebBusy(false))
                          }}
                        >
                          <option value="0.0.0.0">
                            {t('settings.webServerHostLan')}
                          </option>
                          <option value="127.0.0.1">
                            {t('settings.webServerHostLocal')}
                          </option>
                        </Select>
                        <p className="mt-1 text-[11px] text-ink-500">
                          {t('settings.webServerHostHint')}
                        </p>
                      </div>
                    </div>

                    <div className="mt-2">
                      <Label>{t('settings.webServerToken')}</Label>
                      <div className="mt-1 flex flex-wrap gap-2">
                        <Input
                          className="min-w-0 flex-1 font-mono text-xs"
                          type="text"
                          readOnly
                          value={settings.webServerAuthToken || ''}
                          placeholder={t('settings.webServerTokenEmpty')}
                        />
                        <Button
                          variant="secondary"
                          className="!h-9 !text-xs"
                          disabled={webBusy}
                          onClick={() => {
                            const ws = getApi().webServer
                            if (!ws?.generateToken) {
                              toast.error(t('settings.webServerApiMissing'))
                              return
                            }
                            setWebBusy(true)
                            void ws
                              .generateToken()
                              .then(async (r) => {
                                setSettings(mergeSettings(r.settings))
                                await refreshWebStatus()
                                toast.success(t('settings.webServerTokenNew'))
                              })
                              .catch((err) =>
                                toast.error(parseIpcError(err).message)
                              )
                              .finally(() => setWebBusy(false))
                          }}
                        >
                          {t('settings.webServerTokenRegen')}
                        </Button>
                        <Button
                          variant="secondary"
                          className="!h-9 !text-xs"
                          disabled={!settings.webServerAuthToken}
                          onClick={() => {
                            void navigator.clipboard
                              .writeText(settings.webServerAuthToken)
                              .then(() =>
                                toast.success(t('settings.webServerTokenCopied'))
                              )
                              .catch(() =>
                                toast.info(settings.webServerAuthToken)
                              )
                          }}
                        >
                          {t('settings.webServerTokenCopy')}
                        </Button>
                      </div>
                      <p className="mt-1 text-[11px] text-ink-500">
                        {t('settings.webServerTokenHint')}
                      </p>
                    </div>

                    {webStatus?.running && (
                      <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-emerald-800/40 bg-emerald-950/30 px-2.5 py-2">
                        <p
                          className="min-w-0 flex-1 truncate font-mono text-[11px] text-emerald-100"
                          title={webStatus.url}
                        >
                          {webStatus.url}
                        </p>
                        <Button
                          variant="secondary"
                          className="!h-8 !px-2.5 !text-[11px]"
                          onClick={() => {
                            void navigator.clipboard
                              .writeText(webStatus.url)
                              .then(() =>
                                toast.success(t('settings.webServerUrlCopied'))
                              )
                          }}
                        >
                          {t('settings.webServerCopyUrl')}
                        </Button>
                        <Button
                          variant="secondary"
                          className="!h-8 !px-2.5 !text-[11px]"
                          onClick={() => {
                            void getApi()
                              .shell.openExternal(webStatus.url)
                              .catch(() =>
                                window.open(
                                  webStatus.url,
                                  '_blank',
                                  'noopener,noreferrer'
                                )
                              )
                          }}
                        >
                          {t('settings.webServerOpen')}
                        </Button>
                      </div>
                    )}
                    {webStatus?.error && (
                      <p className="mt-2 text-xs text-rose-300" role="alert">
                        {webStatus.error}
                      </p>
                    )}
                    {webStatus?.running && !webStatus.staticReady && (
                      <p className="mt-2 text-[11px] text-amber-200">
                        {t('settings.webServerNoSpa')}
                      </p>
                    )}
                  </div>
                )}

                <div className="rounded-xl border border-ink-700 bg-ink-900 px-3 py-3 shadow-theme-sm">
                  <p className="text-sm font-medium text-ink-100">
                    {t('backup.fullTitle')}
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-ink-400">
                    {t('backup.fullHint')}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      variant="secondary"
                      className="!h-9 !text-xs"
                      onClick={() => {
                        void getApi()
                          .app.exportFullBackup()
                          .then((r) => {
                            const x = r as {
                              downloadUrl?: string
                              fileName?: string
                              filePath?: string
                            } | null
                            if (x?.downloadUrl || x?.filePath || x) {
                              toast.success(
                                t('backup.fullExported', {
                                  path:
                                    x?.fileName ||
                                    x?.filePath ||
                                    t('backup.exportFull')
                                })
                              )
                            }
                          })
                          .catch((e) =>
                            toast.error(parseIpcError(e).message)
                          )
                      }}
                    >
                      {t('backup.exportFull')}
                    </Button>
                    <Button
                      variant="secondary"
                      className="!h-9 !text-xs !text-amber-200"
                      onClick={() => {
                        void (async () => {
                          const ok = await dialog.confirm({
                            title: t('backup.importFullTitle'),
                            message: t('backup.importFullConfirm'),
                            variant: 'danger',
                            confirmLabel: t('backup.importFullAction')
                          })
                          if (!ok) return
                          try {
                            const r = (await getApi().app.importFullBackup()) as {
                              requiresReload?: boolean
                            } | null
                            toast.success(t('backup.importFullOk'))
                            if (r?.requiresReload) {
                              toast.info(t('backup.importFullReload'))
                            }
                          } catch (e) {
                            toast.error(parseIpcError(e).message)
                          }
                        })()
                      }}
                    >
                      {t('backup.importFull')}
                    </Button>
                  </div>
                  <p className="mt-2 text-[11px] text-ink-500">
                    {t('backup.storyVsFull')}
                  </p>
                </div>
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
