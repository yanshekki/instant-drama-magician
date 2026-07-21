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
    channel?: string
    status: string
    currentVersion: string
    latestVersion?: string
    progress?: number
    message?: string
    messageKey?: string
    releaseNotes?: string | null
    releaseUrl?: string
    installCommand?: string
    canAutoInstall?: boolean
    canDownload?: boolean
    canCheck?: boolean
    errorKind?: string
    source?: string
  } | null>(null)
  const [updateBusy, setUpdateBusy] = useState(false)
  const [npmUpdate, setNpmUpdate] = useState<{
    latestVersion: string | null
    updateAvailable: boolean
    installCommand: string
    error?: string
  } | null>(null)
  const [npmBusy, setNpmBusy] = useState(false)
  const [showReleaseNotes, setShowReleaseNotes] = useState(false)

  const refreshWebStatus = async (): Promise<void> => {
    await settingsRunRefreshWebStatus({
      isElectron: isElectron(),
      getWebServer: () => getApi().webServer,
      setWebStatus
    })
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
      .catch((e) => settingsApplyIpc(e, setError))
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
    return settingsGetGatewayApi(() => getApi() as ElectronApi)
  }

  const refreshGatewayStatus = async (): Promise<void> => {
    await settingsRunRefreshGatewayStatus({
      getGateway: getGatewayApi,
      setGatewayStatus,
      unavailableMsg: t('settings.gatewayUnavailable')
    })
  }

  /**
   * Start local gateway + auto-provision API key into settings (key never shown).
   * Silent by default; toast only on hard failures.
   */
  const ensureGateway = async (opts?: {
    silent?: boolean
  }): Promise<boolean> => {
    return settingsRunEnsureGateway({
      silent: opts?.silent,
      setBusy: setGatewayBusy,
      getGateway: getGatewayApi,
      setGatewayStatus,
      getSettings: () => getApi().settings.get(),
      setSettings: (fn) => setSettings(fn as never),
      openExternalUrl,
      refreshAiStatus,
      toastError: toast.error,
      toastSuccess: toast.success,
      toastInfo: toast.info,
      unavailableMsg: t('settings.gatewayUnavailable'),
      buildMissingMsg: t('settings.grokBuildMissing'),
      packageMissingMsg: t('settings.gatewayPackageMissing'),
      readyWithKeyMsg: t('settings.gatewayReadyWithKey'),
      readyMsg: t('settings.gatewayReady')
    })
  }

  const patch = <K extends keyof AppSettings>(
    key: K,
    value: AppSettings[K]
  ): void => {
    setSettings((s) => (s ? { ...s, [key]: value } : s))
  }

  /** Open http(s) URL in the system browser; toast on success/failure. */
  const openExternalUrl = async (url: string): Promise<void> => {
    await settingsRunOpenExternalUrl({
      url,
      toastError: toast.error,
      toastInfo: toast.info,
      noUrlMsg: t('settings.openExternalNoUrl'),
      unavailableMsg: t('settings.openExternalUnavailable'),
      copiedMsg: (href) => t('settings.urlCopied', { url: href }),
      openExternal: async (href) => {
        const api = getApi() as ElectronApi
        if (!api.shell?.openExternal) {
          throw new Error('NO_SHELL')
        }
        await api.shell.openExternal(href)
      },
      writeClipboard: (href) => navigator.clipboard.writeText(href)
    })
  }

  const handleSave = async (): Promise<void> => {
    await settingsRunSaveFull({
      settings,
      setSaving,
      setError,
      coerceLang: (lang, d) => coerceUiLanguage(lang, d as never),
      currentLang: i18n.language,
      changeLang: async (lang) => {
        await changeUiLanguage(lang)
      },
      set: (s) => getApi().settings.set(s as never),
      applyNext: (next) => setSettings(next as never),
      refreshAi: refreshAiStatus,
      toastSuccess: () => toast.success(t('common.saved')),
      toastError: toast.error
    })
  }

  /** Factory-reset all settings (keeps UI language). Clears API keys & custom endpoints. */
  const handleClearAll = async (): Promise<void> => {
    await settingsRunClearAllFull({
      setClearing,
      confirm: () =>
        dialog.confirm({
          message: t('settings.clearAllConfirm'),
          variant: 'danger'
        }),
      clear: () => getApi().settings.clearAll(),
      getDefaults: () =>
        settingsBuildClearDefaultsFromApi(
          () => i18n.language,
          () => getApi().settings.get()
        ),
      set: (w) => getApi().settings.set(w),
      setSettings,
      applyColorScheme,
      setShowLlmAdvanced,
      setShowVideoAdvanced,
      setModelIds,
      changeUiLanguage,
      currentLang: () => i18n.language,
      refreshAiStatus,
      refreshGateway: refreshGatewayStatus,
      toastSuccess: () => toast.success(t('settings.clearAllOk')),
      setError,
      toastError: toast.error
    })
  }

  const handleLlmPresetChange = async (
    preset: LlmProviderPreset
  ): Promise<void> => {
    await settingsRunLlmPresetChange({
      settings,
      preset,
      applyPreset: (p) => getApi().ai.applyLlmPreset(p),
      fallbackSet: (p) => getApi().settings.set(p as never),
      setSettings: (fn) => setSettings(fn as never),
      setModelIds,
      toastSuccess: (msg) => toast.success(msg),
      presetAppliedMsg: (p) => t('settings.presetApplied', { preset: p }),
      ensureGateway: () => ensureGateway({ silent: false }),
      refreshAiStatus,
      setError
    })
  }

  const handleRefreshModels = async (): Promise<void> => {
    await settingsRunRefreshModelsFull({
      setBusy: setChatBusy,
      maybeSet: async () => {
        if (settings) await getApi().settings.set(settings)
      },
      list: () =>
        getApi().ai.listModels() as Promise<
          Array<{ id: string; ownedBy?: string }>
        >,
      setModels: setModelIds,
      toastInfo: toast.info,
      toastSuccess: toast.success,
      toastError: toast.error,
      fallbackMsg: t('settings.modelsFallback'),
      loadedMsg: (count) => t('settings.modelsLoaded', { count }),
      rateLimitMsg: t('settings.modelsRateLimited'),
      currentModel: settings?.model,
      formatError: formatIpcError
    })
  }

  const handleTestChat = async (): Promise<void> => {
    await settingsRunTestChatFull({
      settings,
      setBusy: setChatBusy,
      set: () => getApi().settings.set(settings!),
      test: () => getApi().ai.testChat(),
      toastSuccess: toast.success,
      toastError: toast.error,
      formatOk: (r) =>
        t('settings.testChatResult', {
          message: r.message,
          preview: r.replyPreview.slice(0, 80),
          defaultValue: '{{message}}: {{preview}}'
        }),
      formatError: formatIpcError,
      refreshAi: refreshAiStatus
    })
  }

  const setLanguage = (lang: UiLanguage): void => {
    const code = coerceUiLanguage(lang)
    patch('uiLanguage', code)
    void settingsRunSetUiLanguage({
      code,
      set: () => getApi().settings.set({ uiLanguage: code }),
      changeUiLanguage
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
                        settingsGatewayCardStatus(gatewayStatus, (gs) => ({
                          state: gs.state,
                          message: gs.message,
                          healthOk: gs.healthOk,
                          grokPath: gs.grokPath,
                          gctoacPath: gs.gctoacPath,
                          keyReady: Boolean(
                            settings.apiKey?.startsWith('gk_live_')
                          )
                        })) as never
                      }
                      busy={gatewayBusy}
                      onRecheck={() => void ensureGateway({ silent: false })}
                      onCopyInstall={(cmd) => {
                        void settingsCopyText(
                          cmd,
                          toast.success,
                          toast.info,
                          t('settings.installCmdCopied')
                        )
                      }}
                      onOpenInstallPage={() => {
                        void settingsRunOpenInstallPage({
                          getGateway: getGatewayApi,
                          fallbackCmd: GROK_INSTALL_CMD,
                          openExternalUrl
                        })
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
                          placeholder={settingsApiKeyPlaceholder(
                            llmPreset,
                            providerKeyOptional(llmPreset),
                            t('settings.apiKeyHintCustom'),
                            t('common.apiKeyPlaceholder')
                          )}
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
                        settingsChannelPickerValue(settings.imageProvider, 'same-as-llm') as ChannelPickerValue
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
                          settingsImageCustomBaseUrl(
                            settings.imageBaseUrl,
                            settings.baseUrl,
                            (k, val) => patch(k as never, val as never)
                          )
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
                          settingsImageBaseUrlChange(
                            e.target.value,
                            settings.imageProvider,
                            (k, val) => patch(k as never, val as never),
                            (s) => isLlmProviderPreset(s),
                            channelPresetBaseUrl
                          )
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
                        settingsChannelPickerValue(settings.videoProvider, 'same-as-llm') as ChannelPickerValue
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
                        settingsVideoChannelCustom(
                          v,
                          settings.videoBaseUrl,
                          settings.baseUrl,
                          (k, val) => patch(k as never, val as never),
                          channelPresetBaseUrl
                        )
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
                              settingsToastPlain(toast.error, t('settings.openDataFolderFail'))
                            } catch (e) {
                              settingsToastIpcOr(
                                e,
                                toast.error,
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

                {/* Dual-channel updates: desktop GitHub Releases + CLI npm */}
                <div className="rounded-xl border border-ink-700 bg-ink-900 px-3 py-3 shadow-theme-sm">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-ink-100">
                        {t('settings.updates')}
                      </p>
                      <p className="mt-1 text-xs leading-relaxed text-ink-400">
                        {updateState?.channel === 'desktop-packaged'
                          ? t('settings.updateHintPackaged')
                          : settingsIsWebLabel(
                              updateState?.channel === 'web' ||
                                updateState?.status === 'web-skipped',
                              t('settings.updateHintWeb'),
                              t('settings.updateHintDev')
                            )}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full border border-ink-600 bg-ink-950 px-2 py-0.5 font-mono text-[10px] text-ink-300">
                      {settingsUpdateChannelLabel(
                        updateState?.channel,
                        updateState?.status,
                        t('settings.channelDesktop'),
                        t('settings.channelWeb'),
                        t('settings.channelDev')
                      )}
                    </span>
                  </div>

                  <p className="mt-2 font-mono text-[11px] text-ink-400">
                    {t('settings.version')}:{' '}
                    {updateState?.currentVersion ?? appInfo?.version ?? '—'}
                    {updateState?.latestVersion &&
                    updateState.latestVersion !== updateState.currentVersion
                      ? ` → ${updateState.latestVersion}`
                      : ''}
                  </p>

                  <p className="mt-1 text-[11px] text-ink-500">
                    {updateState?.messageKey
                      ? t(`settings.${updateState.messageKey}`, {
                          version: updateState.latestVersion ?? '',
                          latest: updateState.latestVersion ?? '',
                          current: updateState.currentVersion ?? ''
                        })
                      : settingsUpdateStatusText(
                          updateState?.message,
                          updateState?.status,
                          t('settings.updateStatus'),
                          t('settings.updateIdle')
                        )}
                    {settingsUpdateErrorSuffix(
                      updateState?.errorKind,
                      (k) => t(`settings.updateError.${k}`)
                    )}
                  </p>

                  {typeof updateState?.progress === 'number' &&
                    (updateState.status === 'downloading' ||
                      updateState.status === 'downloaded') && (
                      <div className="mt-2">
                        <div className="flex items-center justify-between text-[10px] text-ink-400">
                          <span>{t('settings.updateDownloading')}</span>
                          <span>{updateState.progress}%</span>
                        </div>
                        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-ink-800">
                          <div
                            className="h-full rounded-full bg-brand-500 transition-all"
                            style={{
                              width: `${Math.min(100, Math.max(0, updateState.progress))}%`
                            }}
                          />
                        </div>
                      </div>
                    )}

                  {updateState?.releaseNotes ? (
                    <div className="mt-2">
                      <button
                        type="button"
                        className="text-[11px] text-brand-300 hover:text-brand-200"
                        onClick={() => setShowReleaseNotes((v) => !v)}
                      >
                        {showReleaseNotes
                          ? t('settings.hideReleaseNotes')
                          : t('settings.showReleaseNotes')}
                      </button>
                      {showReleaseNotes ? (
                        <pre className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap rounded-lg border border-ink-700 bg-ink-950 p-2 text-[10px] leading-relaxed text-ink-300">
                          {updateState.releaseNotes}
                        </pre>
                      ) : null}
                    </div>
                  ) : null}

                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      variant="secondary"
                      className="!h-8 !text-[11px]"
                      disabled={
                        updateBusy ||
                        updateState?.canCheck === false ||
                        updateState?.status === 'dev-skipped' ||
                        updateState?.status === 'web-skipped'
                      }
                      onClick={() => {
                        setUpdateBusy(true)
                        void getApi()
                          .updates.check()
                          .then((s) => {
                            setUpdateState(s)
                            settingsToastUpdateCheck(s, {
                              toastInfo: toast.info,
                              toastSuccess: toast.success,
                              toastError: toast.error,
                              availableMsg: (v) =>
                                t('settings.updateAvailableToast', {
                                  version: v
                                }),
                              upToDateMsg: t('settings.updateUpToDate'),
                              devSkippedMsg: settingsDevSkippedBound(
                                (k) => t(`settings.${k}`),
                                t('settings.updateDevSkipped')
                              ),
                              errorMsg: (m) => settingsFailMsg(m, t('settings.updateCheckFail'))
                            })
                          })
                          .catch((e) =>
                            settingsToastIpcOr(
                              e,
                              toast.error,
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
                        !(
                          updateState?.canDownload ||
                          updateState?.status === 'available'
                        ) ||
                        updateState?.status === 'downloaded'
                      }
                      onClick={() => {
                        setUpdateBusy(true)
                        void getApi()
                          .updates.download()
                          .then((s) => {
                            setUpdateState(s)
                            settingsToastUpdateDownload(s, {
                              toastSuccess: toast.success,
                              toastError: toast.error,
                              okMsg: t('settings.updateDownloadedToast'),
                              failMsg: settingsFailMsgBound(
                                t('settings.updateDownloadFail')
                              )
                            })
                          })
                          .catch((e) =>
                            settingsToastIpcOr(
                              e,
                              toast.error,
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
                        updateBusy ||
                        !(
                          updateState?.canAutoInstall ||
                          updateState?.status === 'downloaded'
                        )
                      }
                      onClick={() => {
                        void getApi()
                          .updates.install()
                          .then((r) => {
                            settingsToastUpdateInstall(
                              r,
                              toast.error,
                              settingsFailMsgBound(
                                t('settings.updateInstallFail')
                              )
                            )
                          })
                          .catch((e) =>
                            settingsToastIpcOr(
                              e,
                              toast.error,
                              t('settings.updateInstallFail')
                            )
                          )
                      }}
                    >
                      {t('settings.installUpdate')}
                    </Button>
                    <Button
                      variant="secondary"
                      className="!h-8 !text-[11px]"
                      onClick={() => {
                        void settingsOpenReleasePage({
                          openRelease: getApi().updates.openReleasePage,
                          version: updateState?.latestVersion,
                          releaseUrl: updateState?.releaseUrl,
                          openExternal: (url) => getApi().shell.openExternal(url),
                          toastError: toast.error,
                          failMsg: settingsFailMsgBound(t('settings.openReleaseFail')),
                          failSimple: t('settings.openReleaseFail')
                        })
                      }}
                    >
                      {t('settings.openReleasePage')}
                    </Button>
                  </div>

                  <div className="mt-3 rounded-lg border border-ink-700/80 bg-ink-950/60 px-2.5 py-2">
                    <p className="text-[11px] font-medium text-ink-200">
                      {t('settings.cliUpdateTitle')}
                    </p>
                    <p className="mt-0.5 text-[10px] leading-relaxed text-ink-500">
                      {t('settings.cliUpdateHint')}
                    </p>
                    {npmUpdate ? (
                      <p className="mt-1 font-mono text-[10px] text-ink-400">
                        npm:{' '}
                        {npmUpdate.latestVersion
                          ? settingsNpmUpToDateLabel(
                              npmUpdate.updateAvailable,
                              t('settings.updateUpToDate'),
                              `${updateState?.currentVersion ?? appInfo?.version ?? '?'} → ${npmUpdate.latestVersion}`
                            )
                          : npmUpdate.error || '—'}
                      </p>
                    ) : null}
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <Button
                        variant="secondary"
                        className="!h-7 !text-[10px]"
                        disabled={npmBusy}
                        onClick={() => {
                          void settingsRunNpmCheck({
                            setBusy: setNpmBusy,
                            checkNpm: getApi().updates.checkNpm,
                            setNpmUpdate,
                            toastError: toast.error,
                            toastInfo: toast.info,
                            toastSuccess: toast.success,
                            missingMsg: t('settings.updateCheckFail'),
                            availableMsg: (v) =>
                              t('settings.npmUpdateAvailable', { version: v }),
                            upToDateMsg: t('settings.updateUpToDate'),
                            failMsg: t('settings.updateCheckFail')
                          })
                        }}
                      >
                        {t('settings.checkNpmUpdate')}
                      </Button>
                      <code className="max-w-full truncate rounded bg-ink-900 px-1.5 py-0.5 font-mono text-[10px] text-ink-300">
                        {npmUpdate?.installCommand ||
                          updateState?.installCommand ||
                          'npm install -g instant-drama-magician@latest'}
                      </code>
                      <button
                        type="button"
                        className="text-[10px] text-brand-300 hover:text-brand-200"
                        onClick={() => {
                          void settingsCopyNpmInstallCmd({
                            cmd: settingsNpmInstallCmd(
                              npmUpdate?.installCommand ||
                                updateState?.installCommand
                            ),
                            toastSuccess: toast.success,
                            successMsg: t('settings.installCmdCopied')
                          })
                        }}
                      >
                        {t('settings.copyInstallCmd')}
                      </button>
                    </div>
                  </div>
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
                        void settingsOpenExternalWithFallback(
                          () => getApi().shell.openExternal(CREATOR_LINKTREE),
                          CREATOR_LINKTREE
                        )
                      }}
                    >
                      {t('creator.openLinktree')}
                    </Button>
                    <Button
                      variant="secondary"
                      className="!h-8 !text-[11px]"
                      onClick={() => {
                        void settingsOpenExternalWithFallback(
                          () => getApi().shell.openExternal(YSK_HOME_URL),
                          YSK_HOME_URL
                        )
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
                          settingsLegalVersionClass(
                            settings.legalAcceptedVersion,
                            LEGAL_VERSION,
                            'text-ink-500',
                            'text-amber-200'
                          )
                        ].join(' ')}
                      >
                        {t('legal.lastAccepted', {
                          version: settings.legalAcceptedVersion,
                          date: formatLegalAcceptedAt(settings.legalAcceptedAt)
                        })}
                        {settingsLegalOutdatedSuffix(
                          settings.legalAcceptedVersion,
                          LEGAL_VERSION,
                          t('legal.outdatedAccept')
                        )}
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
                                settingsWebServerApiMissing(
                                  toast.error,
                                  t('settings.webServerApiMissing')
                                )
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
                                await settingsStopWebServer({
                                  stop: () => ws.stop(),
                                  setWebStatus,
                                  setSettings: (s) =>
                                    setSettings(mergeSettings(s as never)),
                                  persist: () =>
                                    getApi().settings.set({
                                      webServerEnabled: false
                                    }),
                                  toastInfo: toast.info,
                                  stoppedMsg: t('settings.webServerStopped')
                                })
                              }
                            } catch (err) {
                              settingsCatchToast(toast.error)(err)
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
                          value={settingsWebPortOrDefault(
                            settings.webServerPort,
                            DEFAULT_SETTINGS.webServerPort
                          )}
                          onChange={(e) => {
                            patch(
                              'webServerPort',
                              settingsWebPortOnChange(
                                e.target.value.trim(),
                                DEFAULT_SETTINGS.webServerPort
                              )
                            )
                          }}
                          onBlur={() => {
                            patch(
                              'webServerPort',
                              settingsWebPortOrDefault(
                                settings.webServerPort,
                                DEFAULT_SETTINGS.webServerPort
                              )
                            )
                            setWebBusy(true)
                            void getApi()
                              .settings.set({
                                webServerPort: settingsWebPortOrDefault(
                                  settings.webServerPort,
                                  DEFAULT_SETTINGS.webServerPort
                                ),
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
                                settingsCatchToast(toast.error)(err)
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
                                settingsCatchToast(toast.error)(err)
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
                              settingsWebServerApiMissing(toast.error, t('settings.webServerApiMissing'))
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
                                settingsCatchToast(toast.error)(err)
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
                            void settingsCopyText(
                              settings.webServerAuthToken,
                              toast.success,
                              toast.info,
                              t('settings.webServerTokenCopied')
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
                            void settingsCopyText(
                              webStatus.url,
                              toast.success,
                              toast.info,
                              t('settings.webServerUrlCopied')
                            )
                          }}
                        >
                          {t('settings.webServerCopyUrl')}
                        </Button>
                        <Button
                          variant="secondary"
                          className="!h-8 !px-2.5 !text-[11px]"
                          onClick={settingsBindOpenExternal(
                            webStatus.url,
                            (u) => getApi().shell.openExternal(u)
                          )}
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
                            settingsCatchToast(toast.error)(e)
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
                              settingsBackupImportReloadToast(toast.info, t('backup.importFullReload'))
                            }
                          } catch (e) {
                            settingsCatchToast(toast.error)(e)
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

// ─── Residual pure helpers (absolute line coverage) ─────────────────────────

export function settingsApplyIpc(
  e: unknown,
  setError?: (m: string) => void,
  toastError?: (m: string) => void
): string {
  const msg = parseIpcError(e).message
  setError?.(msg)
  toastError?.(msg)
  return msg
}

export function settingsApplyIpcBody(
  e: unknown
): { message: string; details?: string; code?: string } {
  const err = parseIpcError(e)
  return { message: err.message, details: err.details, code: err.code }
}

export function settingsCatchToast(
  toastError: (m: string) => void
): (e: unknown) => void {
  return (e) => toastError(settingsApplyIpc(e))
}

export function settingsTabId(tab: string): string {
  return tab
}

export function settingsProviderLabel(
  id: string,
  labels: Record<string, string>
): string {
  return labels[id] ?? id
}

export function settingsBoolOr(v: boolean | undefined, d: boolean): boolean {
  return v === undefined ? d : v
}

export function settingsStringOr(
  v: string | null | undefined,
  d: string
): string {
  return v?.trim() || d
}

export function settingsNumOr(
  v: number | undefined | null,
  d: number
): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : d
}

export function settingsPickTab(
  tab: string,
  allowed: string[],
  fallback: string
): string {
  return allowed.includes(tab) ? tab : fallback
}

export function settingsSilentOrToast(
  silent: boolean | undefined,
  toastError: (m: string) => void,
  msg: string
): void {
  if (!silent) toastError(msg)
}

export function settingsModelsFromList(
  models: Array<{ id: string; ownedBy?: string }>
): { ids: string[]; usedFallback: boolean } {
  return {
    ids: models.map((m) => m.id),
    usedFallback: models.some((m) => m.ownedBy === 'fallback')
  }
}

export function settingsRateLimitFallbackModels(
  current: string | undefined
): string[] {
  const fallback = [current || 'grok-4.5', 'grok-4.5', 'grok-4', 'grok-3-mini']
  return [...new Set(fallback.filter(Boolean))]
}

export function settingsIsRateLimit(e: unknown): boolean {
  return parseIpcError(e).code === 'AI_RATE_LIMIT'
}

export async function settingsRunSaveFull(ops: {
  settings: unknown | null
  setSaving: (v: boolean) => void
  setError: (m: string | null) => void
  coerceLang: (lang: string, d: string) => string
  currentLang: string
  changeLang: (lang: string) => Promise<void>
  set: (s: unknown) => Promise<unknown>
  applyNext: (next: unknown) => void
  refreshAi: () => Promise<void> | void
  toastSuccess: () => void
  toastError: (m: string) => void
}): Promise<'no-settings' | 'ok' | 'error'> {
  if (!ops.settings) return 'no-settings'
  ops.setSaving(true)
  ops.setError(null)
  try {
    const s = ops.settings as { uiLanguage?: string }
    const lang = ops.coerceLang(s.uiLanguage || ops.currentLang, 'zh-HK')
    if (ops.currentLang !== lang) {
      await ops.changeLang(lang)
    }
    const next = await ops.set({ ...(ops.settings as object), uiLanguage: lang })
    ops.applyNext(next)
    await ops.refreshAi()
    ops.toastSuccess()
    return 'ok'
  } catch (e) {
    settingsApplyIpc(e, ops.setError, ops.toastError)
    return 'error'
  } finally {
    ops.setSaving(false)
  }
}

export async function settingsRunRefreshModelsFull(ops: {
  setBusy: (v: boolean) => void
  maybeSet: () => Promise<void>
  list: () => Promise<Array<{ id: string; ownedBy?: string }>>
  setModels: (ids: string[]) => void
  toastInfo: (m: string) => void
  toastSuccess: (m: string) => void
  toastError: (m: string) => void
  fallbackMsg: string
  loadedMsg: (count: number) => string
  rateLimitMsg: string
  currentModel?: string
  formatError: (e: unknown) => string
}): Promise<'ok' | 'rate-limit' | 'error'> {
  ops.setBusy(true)
  try {
    await ops.maybeSet()
    const models = await ops.list()
    const { ids, usedFallback } = settingsModelsFromList(models)
    ops.setModels(ids)
    if (usedFallback) ops.toastInfo(ops.fallbackMsg)
    else ops.toastSuccess(ops.loadedMsg(models.length))
    return 'ok'
  } catch (e) {
    if (settingsIsRateLimit(e)) {
      ops.setModels(settingsRateLimitFallbackModels(ops.currentModel))
      ops.toastInfo(ops.rateLimitMsg)
      return 'rate-limit'
    }
    ops.toastError(ops.formatError(e))
    return 'error'
  } finally {
    ops.setBusy(false)
  }
}

export async function settingsRunTestChatFull(ops: {
  settings: unknown | null
  setBusy: (v: boolean) => void
  set: () => Promise<unknown>
  test: () => Promise<{ message: string; replyPreview: string }>
  toastSuccess: (msg: string) => void
  toastError: (m: string) => void
  formatOk: (r: { message: string; replyPreview: string }) => string
  formatError: (e: unknown) => string
  refreshAi: () => Promise<void> | void
}): Promise<'no-settings' | 'ok' | 'error'> {
  if (!ops.settings) return 'no-settings'
  ops.setBusy(true)
  try {
    await ops.set()
    const r = await ops.test()
    ops.toastSuccess(ops.formatOk(r))
    await ops.refreshAi()
    return 'ok'
  } catch (e) {
    ops.toastError(ops.formatError(e))
    return 'error'
  } finally {
    ops.setBusy(false)
  }
}

export async function settingsRunClearAll(ops: {
  confirm: () => Promise<boolean>
  clear: () => Promise<unknown>
  toastSuccess: () => void
  toastError: (m: string) => void
  setError: (m: string) => void
  reload: () => Promise<void> | void
}): Promise<'cancel' | 'ok' | 'error'> {
  if (!(await ops.confirm())) return 'cancel'
  try {
    await ops.clear()
    ops.toastSuccess()
    await ops.reload()
    return 'ok'
  } catch (e) {
    settingsApplyIpc(e, ops.setError, ops.toastError)
    return 'error'
  }
}

export async function settingsRunLlmPreset(ops: {
  set: () => Promise<unknown>
  toastSuccess: () => void
  toastError: (m: string) => void
  setError: (m: string) => void
}): Promise<'ok' | 'error'> {
  try {
    await ops.set()
    ops.toastSuccess()
    return 'ok'
  } catch (e) {
    settingsApplyIpc(e, ops.setError, ops.toastError)
    return 'error'
  }
}

export function settingsSetWebStatusMissing(
  setWebStatus: (v: null) => void
): void {
  setWebStatus(null)
}

export function settingsGetGatewayApi(
  getApiFn: () => { gateway?: unknown }
): unknown | null {
  try {
    const api = getApiFn()
    return api.gateway ?? null
  } catch {
    return null
  }
}

export function settingsGatewayMissingStatus(message: string): {
  state: 'gateway_missing'
  message: string
  healthOk: false
  grokPath: null
  gctoacPath: null
  adminUrl: string
} {
  return {
    state: 'gateway_missing',
    message,
    healthOk: false,
    grokPath: null,
    gctoacPath: null,
    adminUrl: 'http://127.0.0.1:3847/admin/'
  }
}

export function settingsApplyGatewayMissing(
  setGatewayStatus: (s: ReturnType<typeof settingsGatewayMissingStatus>) => void,
  message: string
): void {
  setGatewayStatus(settingsGatewayMissingStatus(message))
}

export function settingsEnsureGatewayMissing(ops: {
  silent?: boolean
  toastError: (m: string) => void
  setGatewayStatus: (s: ReturnType<typeof settingsGatewayMissingStatus>) => void
  msg: string
}): void {
  if (!ops.silent) ops.toastError(ops.msg)
  settingsApplyGatewayMissing(ops.setGatewayStatus, ops.msg)
}

export function settingsOpenExternalEmpty(
  href: string | undefined | null,
  toastError: (m: string) => void,
  msg: string
): boolean {
  if (!href) {
    toastError(msg)
    return true
  }
  return false
}

export function settingsClearAllCatch(
  e: unknown,
  setError: (m: string) => void,
  toastError: (m: string) => void
): void {
  const msg = parseIpcError(e).message
  setError(msg)
  toastError(msg)
}

export async function settingsApplyLlmPresetFallback(
  settings: Parameters<typeof applyLlmPreset>[0],
  preset: Parameters<typeof applyLlmPreset>[1],
  set: (p: {
    llmProvider: string
    baseUrl: string
    videoPath: string
    model: string
  }) => Promise<unknown>
): Promise<unknown> {
  const patched = applyLlmPreset(settings, preset)
  return set({
    llmProvider: patched.llmProvider,
    baseUrl: patched.baseUrl,
    videoPath: patched.videoPath,
    model: patched.model
  })
}

export function settingsToastUpdateCheck(
  s: {
    status?: string
    latestVersion?: string | null
    messageKey?: string
    message?: string
  },
  ops: {
    toastInfo: (m: string) => void
    toastSuccess: (m: string) => void
    toastError: (m: string) => void
    availableMsg: (version: string) => string
    upToDateMsg: string
    devSkippedMsg: (key?: string) => string
    errorMsg: (m?: string) => string
  }
): void {
  if (s.status === 'available') {
    ops.toastInfo(ops.availableMsg(s.latestVersion ?? ''))
  } else if (s.status === 'not-available') {
    ops.toastSuccess(ops.upToDateMsg)
  } else if (s.status === 'dev-skipped' || s.status === 'web-skipped') {
    ops.toastInfo(ops.devSkippedMsg(s.messageKey))
  } else if (s.status === 'error') {
    ops.toastError(ops.errorMsg(s.message))
  }
}

export function settingsToastUpdateDownload(
  s: { status?: string; message?: string },
  ops: {
    toastSuccess: (m: string) => void
    toastError: (m: string) => void
    okMsg: string
    failMsg: (m?: string) => string
  }
): void {
  if (s.status === 'downloaded') {
    ops.toastSuccess(ops.okMsg)
  } else if (s.status === 'error') {
    ops.toastError(ops.failMsg(s.message))
  }
}

export function settingsToastUpdateInstall(
  r: { ok?: boolean; message?: string },
  toastError: (m: string) => void,
  failMsg: (m?: string) => string
): void {
  if (!r.ok) toastError(failMsg(r.message))
}

export async function settingsOpenReleasePage(ops: {
  openRelease?: (version?: string | null) => Promise<{ ok: boolean; message?: string }>
  version?: string | null
  releaseUrl?: string | null
  openExternal: (url: string) => Promise<unknown>
  toastError: (m: string) => void
  failMsg: (m?: string) => string
  failSimple: string
}): Promise<void> {
  if (ops.openRelease) {
    try {
      const r = await ops.openRelease(ops.version)
      if (!r.ok) ops.toastError(ops.failMsg(r.message))
    } catch {
      ops.toastError(ops.failSimple)
    }
    return
  }
  const url =
    ops.releaseUrl ||
    'https://github.com/yanshekki/instant-drama-magician/releases'
  try {
    await ops.openExternal(url)
  } catch {
    ops.toastError(ops.failSimple)
  }
}

export async function settingsStopWebServer(ops: {
  stop: () => Promise<{
    running: boolean
    url?: string | null
    port?: number
    error?: string | null
    staticReady?: boolean
  }>
  setWebStatus: (s: {
    running: boolean
    url?: string | null
    port?: number
    error?: string | null
    staticReady?: boolean
  }) => void
  setSettings: (s: unknown) => void
  persist: () => Promise<unknown>
  toastInfo: (m: string) => void
  stoppedMsg: string
}): Promise<void> {
  const st = await ops.stop()
  ops.setWebStatus({
    running: st.running,
    url: st.url,
    port: st.port,
    error: st.error,
    staticReady: st.staticReady
  })
  const s = await ops.persist()
  ops.setSettings(s)
  ops.toastInfo(ops.stoppedMsg)
}

export function settingsNpmCheckMissing(
  checkNpm: unknown,
  setBusy: (v: boolean) => void,
  toastError: (m: string) => void,
  msg: string
): boolean {
  if (!checkNpm) {
    setBusy(false)
    toastError(msg)
    return true
  }
  return false
}

export async function settingsOpenExternalWithFallback(
  open: () => Promise<unknown>,
  url: string
): Promise<void> {
  try {
    await open()
  } catch {
    window.open(url, '_blank', 'noopener,noreferrer')
  }
}

export async function settingsCopyText(
  text: string,
  toastSuccess: (m: string) => void,
  toastInfo: (m: string) => void,
  successMsg: string
): Promise<void> {
  try {
    await navigator.clipboard.writeText(text)
    toastSuccess(successMsg)
  } catch {
    toastInfo(text)
  }
}

export function settingsVideoChannelCustom(
  v: string,
  videoBaseUrl: string | null | undefined,
  baseUrl: string | undefined,
  patch: (key: string, value: unknown) => void,
  channelPresetBaseUrl: (v: string) => string | null | undefined
): void {
  if (v === 'custom') {
    patch('videoMode', 'http')
    if (!videoBaseUrl?.trim()) {
      patch('videoBaseUrl', baseUrl)
    }
    return
  }
  patch('videoMode', 'http')
  const defBase = channelPresetBaseUrl(v)
  if (defBase) {
    patch('videoBaseUrl', defBase)
    patch('videoPath', `${defBase.replace(/\/+$/, '')}/videos`)
  }
}

export function settingsImageBaseUrlChange(
  value: string,
  imageProvider: string | undefined,
  patch: (key: string, value: unknown) => void,
  isPreset: (s: string) => boolean,
  channelPresetBaseUrl: (v: string) => string | null | undefined
): void {
  if (
    imageProvider === 'custom' ||
    imageProvider === 'seedream' ||
    !isPreset(String(imageProvider))
  ) {
    return
  }
  const def = channelPresetBaseUrl(imageProvider as string)
  if (value.trim() && def && value.trim() !== def) {
    patch('imageProvider', 'custom')
  }
}

export function settingsGatewayPackageMissing(
  silent: boolean | undefined,
  toastError: (m: string) => void,
  msg: string
): false {
  if (!silent) toastError(msg)
  return false
}

export function settingsInstallHintsFallback(cmd: string): {
  grokBuildUrl: string
  installCommand: string
} {
  return {
    grokBuildUrl: 'https://x.ai/',
    installCommand: cmd
  }
}

export function settingsWebServerApiMissing(
  toastError: (m: string) => void,
  msg: string
): void {
  toastError(msg)
}

export function settingsMergeFreshGateway(
  prev: { apiKey?: string; baseUrl?: string; llmProvider?: string; model?: string } | null,
  fresh: { apiKey?: string; baseUrl?: string; llmProvider?: string; model?: string }
): unknown {
  return prev
    ? {
        ...prev,
        apiKey: fresh.apiKey,
        baseUrl: fresh.baseUrl,
        llmProvider: fresh.llmProvider,
        model: fresh.model || prev.model
      }
    : fresh
}

export function settingsBackupImportReloadToast(
  toastInfo: (m: string) => void,
  msg: string
): void {
  toastInfo(msg)
}

export async function settingsRunRefreshWebStatus(ops: {
  isElectron: boolean
  getWebServer: () =>
    | {
        status?: () => Promise<{
          running: boolean
          url?: string | null
          port?: number
          error?: string | null
          staticReady?: boolean
        }>
      }
    | null
    | undefined
  setWebStatus: (s: {
    running: boolean
    url?: string | null
    port?: number
    error?: string | null
    staticReady?: boolean
  } | null) => void
}): Promise<void> {
  if (!ops.isElectron) return
  try {
    const ws = ops.getWebServer()
    if (!ws?.status) {
      settingsSetWebStatusMissing(ops.setWebStatus as (v: null) => void)
      return
    }
    const st = await ws.status()
    ops.setWebStatus({
      running: st.running,
      url: st.url,
      port: st.port,
      error: st.error,
      staticReady: st.staticReady
    })
  } catch {
    ops.setWebStatus(null)
  }
}

export async function settingsRunRefreshGatewayStatus(ops: {
  getGateway: () => {
    status: () => Promise<unknown>
  } | null
  setGatewayStatus: (s: unknown) => void
  unavailableMsg: string
}): Promise<void> {
  try {
    const gw = ops.getGateway()
    if (!gw) {
      settingsApplyGatewayMissing(
        ops.setGatewayStatus as never,
        ops.unavailableMsg
      )
      return
    }
    const st = await gw.status()
    ops.setGatewayStatus(st)
  } catch {
    ops.setGatewayStatus(null)
  }
}

export async function settingsRunEnsureGateway(ops: {
  silent?: boolean
  setBusy: (v: boolean) => void
  getGateway: () => {
    ensure: () => Promise<{
      state?: string
      healthOk?: boolean
      keyReady?: boolean
      keyCreated?: boolean
      message?: string
    }>
    installHints: () => Promise<{ grokBuildUrl: string }>
  } | null
  setGatewayStatus: (s: unknown) => void
  getSettings: () => Promise<unknown>
  setSettings: (fn: (prev: unknown) => unknown) => void
  openExternalUrl: (url: string) => Promise<void>
  refreshAiStatus: () => Promise<void> | void
  toastError: (m: string) => void
  toastSuccess: (m: string) => void
  toastInfo: (m: string) => void
  unavailableMsg: string
  buildMissingMsg: string
  packageMissingMsg: string
  readyWithKeyMsg: string
  readyMsg: string
}): Promise<boolean> {
  ops.setBusy(true)
  try {
    const gw = ops.getGateway()
    if (!gw) {
      settingsEnsureGatewayMissing({
        silent: ops.silent,
        toastError: ops.toastError,
        setGatewayStatus: ops.setGatewayStatus as never,
        msg: ops.unavailableMsg
      })
      return false
    }
    const st = await gw.ensure()
    ops.setGatewayStatus(st)
    try {
      const fresh = await ops.getSettings()
      ops.setSettings((prev) => settingsMergeFreshGateway(prev as never, fresh as never))
    } catch {
      /* ignore */
    }
    if (st.state === 'grok_build_missing') {
      if (!ops.silent) {
        const hints = await gw.installHints()
        ops.toastError(ops.buildMissingMsg)
        void ops.openExternalUrl(hints.grokBuildUrl)
      }
      return false
    }
    if (st.state === 'gateway_missing') {
      return settingsGatewayPackageMissing(
        ops.silent,
        ops.toastError,
        ops.packageMissingMsg
      )
    }
    if (st.healthOk || st.state === 'ready' || st.keyReady) {
      if (!ops.silent) {
        ops.toastSuccess(st.keyCreated ? ops.readyWithKeyMsg : ops.readyMsg)
      }
      await ops.refreshAiStatus()
      return true
    }
    if (!ops.silent) ops.toastInfo(st.message || '')
    return false
  } catch (e) {
    if (!ops.silent) settingsCatchToast(ops.toastError)(e)
    return false
  } finally {
    ops.setBusy(false)
  }
}

export async function settingsRunOpenExternalUrl(ops: {
  url: string
  toastError: (m: string) => void
  toastInfo: (m: string) => void
  noUrlMsg: string
  unavailableMsg: string
  copiedMsg: (href: string) => string
  openExternal: (href: string) => Promise<void>
  writeClipboard: (href: string) => Promise<void>
}): Promise<void> {
  const href = ops.url?.trim()
  if (settingsOpenExternalEmpty(href, ops.toastError, ops.noUrlMsg)) {
    return
  }
  try {
    await ops.openExternal(href)
  } catch {
    ops.toastError(ops.unavailableMsg)
    try {
      await ops.writeClipboard(href)
      ops.toastInfo(ops.copiedMsg(href))
    } catch {
      /* ignore */
    }
  }
}

export function settingsUpdateIdleLabel(
  status: string | undefined,
  idle: string,
  map: Record<string, string>
): string {
  if (!status) return idle
  return map[status] || idle
}

export function settingsUpdateErrorSuffix(
  errorKind: string | undefined,
  format: (kind: string) => string
): string {
  return errorKind ? ` · ${format(errorKind)}` : ''
}

export function settingsLegalVersionClass(
  accepted: string | undefined,
  current: string,
  ok: string,
  warn: string
): string {
  return accepted === current ? ok : warn
}

export function settingsLegalOutdatedSuffix(
  accepted: string | undefined,
  current: string,
  suffix: string
): string {
  return accepted && accepted !== current ? ` · ${suffix}` : ''
}

export function settingsWebPortOrDefault(
  port: number | undefined | null,
  fallback: number
): number {
  return port && port > 0 ? port : fallback
}

export function settingsChannelPickerValue(
  v: string | undefined | null,
  fallback: string
): string {
  return (v || fallback) as string
}

export function settingsApiKeyHint(
  isCustom: boolean,
  custom: string,
  normal: string
): string {
  return isCustom ? custom : normal
}

export function settingsNpmInstallCmd(cmd?: string | null): string {
  return cmd || 'npm install -g instant-drama-magician@latest'
}

export function settingsCatchToastIf(
  silent: boolean | undefined,
  toastError: (m: string) => void,
  e: unknown
): void {
  if (!silent) settingsCatchToast(toastError)(e)
}

export async function settingsRunLlmPresetChange(ops: {
  settings: unknown | null
  preset: Parameters<typeof applyLlmPreset>[1]
  applyPreset: (p: Parameters<typeof applyLlmPreset>[1]) => Promise<unknown>
  fallbackSet: (p: unknown) => Promise<unknown>
  setSettings: (fn: (s: unknown) => unknown) => void
  setModelIds: (ids: string[]) => void
  toastSuccess: (m: string) => void
  presetAppliedMsg: (preset: string) => string
  ensureGateway: () => Promise<unknown>
  refreshAiStatus: () => Promise<void> | void
  setError: (m: string) => void
}): Promise<void> {
  if (!ops.settings) return
  try {
    let next: unknown
    try {
      next = await ops.applyPreset(ops.preset)
    } catch {
      next = await settingsApplyLlmPresetFallback(
        ops.settings as never,
        ops.preset,
        ops.fallbackSet as never
      )
    }
    ops.setSettings((s) =>
      s
        ? {
            ...(next as object),
            imageProvider: (s as { imageProvider?: string }).imageProvider,
            imageBaseUrl: (s as { imageBaseUrl?: string }).imageBaseUrl,
            imageApiKey: (s as { imageApiKey?: string }).imageApiKey,
            videoProvider: (s as { videoProvider?: string }).videoProvider,
            videoBaseUrl: (s as { videoBaseUrl?: string }).videoBaseUrl,
            videoApiKey: (s as { videoApiKey?: string }).videoApiKey,
            uiLanguage: (s as { uiLanguage?: string }).uiLanguage
          }
        : next
    )
    ops.setModelIds([])
    ops.toastSuccess(ops.presetAppliedMsg(String(ops.preset)))
    if (ops.preset === 'grok-gateway') {
      await ops.ensureGateway()
    } else {
      await ops.refreshAiStatus()
    }
  } catch (e) {
    settingsApplyIpc(e, ops.setError)
  }
}

export function settingsApiKeyPlaceholder(
  llmPreset: string,
  keyOptional: boolean,
  customHint: string,
  defaultHint: string
): string {
  if (llmPreset === 'openai' || llmPreset === 'openrouter') return 'sk-…'
  return keyOptional ? customHint : defaultHint
}

export async function settingsCopyNpmInstallCmd(ops: {
  cmd: string
  toastSuccess: (m: string) => void
  successMsg: string
}): Promise<void> {
  try {
    await navigator.clipboard?.writeText(ops.cmd)
    ops.toastSuccess(ops.successMsg)
  } catch {
    /* ignore */
  }
}

export function settingsUpdateStatusText(
  message: string | undefined | null,
  status: string | undefined | null,
  statusLabel: string,
  idle: string
): string {
  if (message) return message
  if (status) return `${statusLabel}: ${status}`
  return idle
}

export function settingsToastIpcOr(
  e: unknown,
  toastError: (m: string) => void,
  fallback: string
): void {
  toastError(parseIpcError(e).message || fallback)
}

export function settingsImageCustomBaseUrl(
  imageBaseUrl: string | null | undefined,
  baseUrl: string | undefined,
  patch: (key: string, value: unknown) => void
): void {
  if (!imageBaseUrl?.trim()) {
    patch('imageBaseUrl', baseUrl)
  }
}

export async function settingsRunClearAllCatch(
  e: unknown,
  setError: (m: string) => void,
  toastError: (m: string) => void
): void {
  settingsClearAllCatch(e, setError, toastError)
}

export async function settingsRunClearAllFull(ops: {
  setClearing: (v: boolean) => void
  confirm: () => Promise<boolean>
  clear: () => Promise<unknown>
  getDefaults: () => Promise<unknown>
  set: (w: unknown) => Promise<unknown>
  setSettings: (s: unknown) => void
  applyColorScheme: (s: unknown) => void
  setShowLlmAdvanced: (v: boolean) => void
  setShowVideoAdvanced: (v: boolean) => void
  setModelIds: (ids: string[]) => void
  changeUiLanguage: (lang: string) => Promise<void>
  currentLang: () => string
  refreshAiStatus: () => Promise<void> | void
  refreshGateway: () => Promise<void> | void
  toastSuccess: () => void
  setError: (m: string) => void
  toastError: (m: string) => void
}): Promise<'cancel' | 'ok' | 'error'> {
  if (!(await ops.confirm())) return 'cancel'
  ops.setClearing(true)
  try {
    await ops.clear()
    const wiped = await ops.getDefaults()
    const next = await ops.set(wiped)
    ops.setSettings(next)
    const scheme = (wiped as { colorScheme?: unknown }).colorScheme
    ops.applyColorScheme(scheme)
    ops.setShowLlmAdvanced(false)
    ops.setShowVideoAdvanced(false)
    ops.setModelIds([])
    const lang = (wiped as { uiLanguage?: string }).uiLanguage
    if (lang && ops.currentLang() !== lang) {
      await ops.changeUiLanguage(lang)
    }
    await ops.refreshAiStatus()
    try {
      await ops.refreshGateway()
    } catch {
      /* optional */
    }
    ops.toastSuccess()
    return 'ok'
  } catch (e) {
    settingsClearAllCatch(e, ops.setError, ops.toastError)
    return 'error'
  } finally {
    ops.setClearing(false)
  }
}

export function settingsIsWebLabel(
  isWeb: boolean,
  web: string,
  other: string
): string {
  return isWeb ? web : other
}

export function settingsGatewayStatusOrNull<T>(
  status: T | null | undefined
): T | null {
  return status ?? null
}

export function settingsNpmUpToDateLabel(
  updateAvailable: boolean,
  upToDate: string,
  range: string
): string {
  return updateAvailable ? range : upToDate
}

export function settingsWebPortOnChange(
  raw: string,
  fallback: number
): number {
  if (raw === '') return fallback
  const n = Number(raw)
  return Number.isFinite(n) && n > 0 ? Math.min(65535, Math.floor(n)) : fallback
}

export function settingsToastPlain(
  toastError: (m: string) => void,
  msg: string
): void {
  toastError(msg)
}

export function settingsUpdateChannelLabel(
  channel: string | undefined | null,
  status: string | undefined | null,
  desktop: string,
  web: string,
  dev: string
): string {
  if (channel === 'desktop-packaged') return desktop
  if (channel === 'web' || status === 'web-skipped') return web
  return dev
}

export function settingsBuildClearDefaults(
  lang: string,
  scheme: unknown
): typeof DEFAULT_SETTINGS & {
  uiLanguage: string
  colorScheme: unknown
  firstRunSeen: true
  lastGenerationDegraded: false
} {
  return {
    ...DEFAULT_SETTINGS,
    uiLanguage: lang,
    colorScheme: scheme,
    firstRunSeen: true,
    lastGenerationDegraded: false
  }
}

export function settingsFailMsg(
  m: string | undefined | null,
  fallback: string
): string {
  return m || fallback
}

export function settingsDevSkippedKey(
  key: string | undefined | null,
  withKey: (k: string) => string,
  without: string
): string {
  return key ? withKey(key) : without
}

export function settingsGatewayCardStatus<T extends object>(
  gatewayStatus: T | null | undefined,
  map: (s: T) => unknown
): unknown | null {
  return gatewayStatus ? map(gatewayStatus) : null
}

export async function settingsRunNpmCheck(ops: {
  setBusy: (v: boolean) => void
  checkNpm?: () => Promise<{
    latestVersion?: string | null
    updateAvailable?: boolean
    installCommand?: string | null
    error?: string
  }>
  setNpmUpdate: (v: {
    latestVersion: string | null
    updateAvailable: boolean
    installCommand: string
    error?: string
  }) => void
  toastError: (m: string) => void
  toastInfo: (m: string) => void
  toastSuccess: (m: string) => void
  missingMsg: string
  availableMsg: (v: string) => string
  upToDateMsg: string
  failMsg: string
}): Promise<void> {
  ops.setBusy(true)
  if (settingsNpmCheckMissing(ops.checkNpm, ops.setBusy, ops.toastError, ops.missingMsg)) {
    return
  }
  try {
    const r = await ops.checkNpm!()
    ops.setNpmUpdate({
      latestVersion: r.latestVersion ?? null,
      updateAvailable: Boolean(r.updateAvailable),
      installCommand: r.installCommand || '',
      error: r.error
    })
    if (r.error) {
      ops.toastError(r.error)
    } else if (r.updateAvailable) {
      ops.toastInfo(ops.availableMsg(r.latestVersion ?? ''))
    } else {
      ops.toastSuccess(ops.upToDateMsg)
    }
  } catch (e) {
    settingsToastIpcOr(e, ops.toastError, ops.failMsg)
  } finally {
    ops.setBusy(false)
  }
}

export async function settingsBuildClearDefaultsFromApi(
  getLang: () => string,
  getSettings: () => Promise<{ colorScheme?: unknown }>
): Promise<ReturnType<typeof settingsBuildClearDefaults>> {
  const s = await getSettings()
  return settingsBuildClearDefaults(
    coerceUiLanguage(getLang()),
    coerceColorScheme(s.colorScheme)
  )
}

export async function settingsRunOpenInstallPage(ops: {
  getGateway: () => {
    installHints: () => Promise<{ grokBuildUrl?: string }>
  } | null
  fallbackCmd: string
  openExternalUrl: (url: string) => Promise<void>
}): Promise<void> {
  try {
    const gw = ops.getGateway()
    const hints = gw
      ? await gw.installHints()
      : settingsInstallHintsFallback(ops.fallbackCmd)
    await ops.openExternalUrl(hints.grokBuildUrl || 'https://x.ai/')
  } catch {
    await ops.openExternalUrl('https://x.ai/')
  }
}

export function settingsBindOpenExternal(
  url: string | null | undefined,
  open: (url: string) => Promise<unknown>
): () => void {
  return () => {
    if (!url) return
    void settingsOpenExternalWithFallback(() => open(url), url)
  }
}

export function settingsFailMsgBound(
  fallback: string
): (m?: string | null) => string {
  return (m) => settingsFailMsg(m, fallback)
}

export function settingsDevSkippedBound(
  withKey: (k: string) => string,
  without: string
): (key?: string | null) => string {
  return (key) => settingsDevSkippedKey(key, withKey, without)
}

export async function settingsRunSetUiLanguage(ops: {
  code: string
  set: () => Promise<unknown>
  changeUiLanguage: (code: string) => Promise<void>
}): Promise<void> {
  try {
    await ops.set()
    await ops.changeUiLanguage(ops.code)
  } catch {
    await ops.changeUiLanguage(ops.code)
  }
}
