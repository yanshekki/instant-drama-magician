import { useEffect, useRef, useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { getApi, isWebRuntime } from '../../lib/api'
import type { AppSettings } from '../../types/settings'
import {
  applyColorScheme,
  coerceColorScheme,
  watchSystemColorScheme,
  type ColorSchemePref
} from '../../domain/colorScheme'
import {
  coerceUiLanguage,
  readStoredUiLanguage
} from '../../domain/uiLanguages'
import {
  coerceLlmProviderPreset,
  getLlmPresetDef
} from '../../domain/openaiCompatible'
import { changeUiLanguage } from '../../lib/i18n'
import { useApp } from '../context/AppContext'
import { useToast } from '../context/ToastContext'
import { useMenuActions } from '../hooks/useMenuActions'
import { AiJobHud } from './AiJobHud'
import { VideoPrepHost } from './VideoPrepHost'
import { AiDraftModal } from './AiDraftModal'
import yskLogo from '../../assets/ysk-logo.svg'
import {
  CREATOR_LINKTREE,
  YSK_HOME_URL
} from '../../domain/creatorSupport'

const YSK_HOME = YSK_HOME_URL

const navItems: { to: string; key: string; end?: boolean }[] = [
  { to: '/', key: 'stories', end: true },
  { to: '/characters', key: 'characters' },
  { to: '/costumes', key: 'costumes' },
  { to: '/scenes', key: 'scenes' },
  { to: '/props', key: 'props' },
  { to: '/actions', key: 'actions' },
  { to: '/timeline', key: 'timeline' },
  { to: '/audit', key: 'audit' },
  { to: '/settings', key: 'settings' }
]

function ChannelLine({
  label,
  available,
  detail,
  onlineLabel,
  offlineLabel
}: {
  label: string
  available: boolean
  detail?: string
  onlineLabel: string
  offlineLabel: string
}): JSX.Element {
  return (
    <div className="mt-1 flex flex-wrap items-baseline gap-x-1.5 text-[10px]">
      <span className="text-ink-400">{label}:</span>
      <span
        className={
          available
            ? 'font-medium text-emerald-200'
            : 'font-medium text-amber-200'
        }
      >
        {available ? onlineLabel : offlineLabel}
      </span>
      {detail && (
        <span className="truncate opacity-70" title={detail}>
          · {detail}
        </span>
      )}
    </div>
  )
}

export function Layout(): JSX.Element {
  const { t, i18n } = useTranslation()
  const { aiStatus } = useApp()
  const toast = useToast()
  const navigate = useNavigate()
  const [degraded, setDegraded] = useState(false)
  const [appVersion, setAppVersion] = useState<string | null>(null)
  const [updateBanner, setUpdateBanner] = useState<{
    latest: string
    current: string
    downloaded?: boolean
  } | null>(null)
  const promptedUpdate = useRef(false)

  // Native File / View / Help menu → navigate & app actions
  useMenuActions()

  // Mount-only: applying language on every i18n change would fight Settings
  // and snap the UI back to the last saved language while switching.
  useEffect(() => {
    let pref: ColorSchemePref = 'system'
    const syncTheme = (): void => {
      applyColorScheme(pref)
    }
    void getApi()
      .settings.get()
      .then((s: AppSettings) => {
        setDegraded(s.lastGenerationDegraded)
        // Web login language (localStorage) wins over default settings until user
        // changes language in Settings (which also writes storage).
        const lang = coerceUiLanguage(
          readStoredUiLanguage() || s.uiLanguage
        )
        if (lang !== i18n.language) {
          void changeUiLanguage(lang)
        }
        pref = coerceColorScheme(s.colorScheme)
        syncTheme()
      })
      .catch(() => {
        syncTheme()
      })
    void getApi()
      .app.getInfo()
      .then((info) => {
        setAppVersion(info.version)
      })
      .catch(() => undefined)

    const handleUpdateState = (s: {
      status: string
      currentVersion: string
      latestVersion?: string
      message?: string
    }): void => {
      if (s.status === 'available' && s.latestVersion) {
        setUpdateBanner({
          latest: s.latestVersion,
          current: s.currentVersion
        })
        if (!promptedUpdate.current) {
          promptedUpdate.current = true
          toast.info(
            t('settings.updateAvailableToast', {
              version: s.latestVersion
            }),
            8000
          )
        }
      } else if (s.status === 'downloaded' && s.latestVersion) {
        setUpdateBanner({
          latest: s.latestVersion,
          current: s.currentVersion,
          downloaded: true
        })
        if (!promptedUpdate.current) {
          promptedUpdate.current = true
          toast.success(t('settings.updateDownloadedToast'), 8000)
        }
      }
    }

    void getApi()
      .updates.status()
      .then(handleUpdateState)
      .catch(() => undefined)
    const unsubUpdate =
      getApi().updates.onState?.(handleUpdateState) ?? (() => undefined)

    const unwatch = watchSystemColorScheme(() => {
      if (pref === 'system') syncTheme()
    })
    return () => {
      unwatch()
      unsubUpdate()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only
  }, [])

  const chatOk = aiStatus?.chat?.available ?? aiStatus?.available ?? false
  const imageCh = aiStatus?.image
  const videoCh = aiStatus?.video
  const onlineLabel = t('common.onlineShort')
  const offlineLabel = t('common.offlineShort')
  // Sidebar title follows the active chat LLM (not always “Grok CLI”).
  const llmPreset = coerceLlmProviderPreset(
    aiStatus?.llmProvider,
    aiStatus?.baseUrl ?? ''
  )
  const llmDef = getLlmPresetDef(llmPreset)
  const llmTitle = llmDef
    ? t(`settings.llmPreset.${llmDef.labelKey}`)
    : t('settings.llmPreset.custom')
  const llmStatusLine = chatOk
    ? t('ai.providerOnline', { name: llmTitle })
    : t('ai.providerOffline', { name: llmTitle })

  const openYsk = (): void => {
    void getApi()
      .shell.openExternal(YSK_HOME)
      .catch(() => {
        window.open(YSK_HOME, '_blank', 'noopener,noreferrer')
      })
  }

  return (
    <div className="flex h-screen overflow-hidden bg-ink-950 text-ink-50">
      <aside className="flex w-60 shrink-0 flex-col border-r border-ink-800 bg-ink-900 shadow-theme-sm">
        {/* Top-left: YSK logo + product name */}
        <div className="border-b border-ink-800 px-4 py-4">
          <div className="flex items-start gap-2.5">
            <button
              type="button"
              onClick={openYsk}
              className="mt-0.5 shrink-0 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/50"
              title="YSK Limited"
              aria-label="YSK Limited"
            >
              <img
                src={yskLogo}
                alt="YSK Limited"
                width={36}
                height={36}
                className="h-9 w-9 object-contain"
                draggable={false}
              />
            </button>
            <div className="min-w-0 flex-1">
              <div className="text-base font-semibold tracking-tight text-brand-300">
                {t('app.name')}
              </div>
              <p className="mt-0.5 text-[11px] leading-snug text-ink-400">
                {t('app.tagline')}
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                {appVersion ? (
                  <p className="font-mono text-[10px] text-ink-500">
                    v{appVersion}
                  </p>
                ) : null}
                {isWebRuntime() ? (
                  <span className="rounded-full bg-violet-950/80 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-violet-200 ring-1 ring-violet-700/50">
                    Web
                  </span>
                ) : null}
              </div>
            </div>
          </div>
          <div className="ysk-gradient-bar mt-3 h-0.5 w-full rounded-full opacity-90" />
        </div>

        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                [
                  'rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-brand-950 text-brand-100 ring-1 ring-brand-500/40'
                    : 'text-ink-300 hover:bg-ink-800 hover:text-ink-50'
                ].join(' ')
              }
            >
              {t(`nav.${item.key}`)}
            </NavLink>
          ))}
        </nav>

        <div className="space-y-3 border-t border-ink-800 p-4 text-xs">
          <div
            className={[
              'rounded-lg border px-3 py-2',
              chatOk
                ? 'border-emerald-600/30 bg-emerald-950 text-emerald-200'
                : 'border-amber-600/30 bg-amber-950 text-amber-200'
            ].join(' ')}
          >
            <div className="font-medium" title={aiStatus?.baseUrl ?? undefined}>
              {llmStatusLine}
            </div>
            {aiStatus?.model ? (
              <div className="mt-0.5 truncate font-mono text-[10px] opacity-70">
                {aiStatus.model}
              </div>
            ) : null}
            <ChannelLine
              label={t('ai.channelChat')}
              available={chatOk}
              onlineLabel={onlineLabel}
              offlineLabel={offlineLabel}
            />
            {imageCh != null && (
              <ChannelLine
                label={t('ai.channelImage')}
                available={imageCh.available}
                detail={
                  imageCh.provider === 'same-as-llm'
                    ? llmTitle
                    : imageCh.provider
                }
                onlineLabel={onlineLabel}
                offlineLabel={offlineLabel}
              />
            )}
            {videoCh != null && (
              <ChannelLine
                label={t('ai.channelVideo')}
                available={videoCh.available}
                detail={
                  videoCh.provider === 'same-as-llm'
                    ? llmTitle
                    : videoCh.provider
                }
                onlineLabel={onlineLabel}
                offlineLabel={offlineLabel}
              />
            )}
            {degraded && (
              <div className="mt-1 text-[10px] text-amber-200/90">
                {t('ai.lastStub')}
              </div>
            )}
          </div>

          {/* Support / Donate + Powered by YSK */}
          <button
            type="button"
            onClick={() => {
              void getApi()
                .shell.openExternal(CREATOR_LINKTREE)
                .catch(() => {
                  window.open(CREATOR_LINKTREE, '_blank', 'noopener,noreferrer')
                })
            }}
            className="group flex w-full flex-col gap-0.5 rounded-lg border border-brand-500/30 bg-brand-950/40 px-2.5 py-2 text-left transition hover:border-brand-400/50 hover:bg-brand-950/70"
            title={CREATOR_LINKTREE}
          >
            <span className="text-[10px] font-semibold text-brand-200 group-hover:text-brand-100">
              ☕ {t('creator.sidebarDonate')}
            </span>
            <span className="text-[9px] leading-snug text-ink-400 group-hover:text-ink-300">
              {t('creator.supportBlurb')}
            </span>
          </button>
          <button
            type="button"
            onClick={openYsk}
            className="group flex w-full items-center gap-2 rounded-lg border border-ink-800 bg-ink-950/60 px-2.5 py-2 text-left transition hover:border-brand-500/40 hover:bg-brand-950/50"
            title={YSK_HOME}
          >
            <img
              src={yskLogo}
              alt=""
              width={18}
              height={18}
              className="h-[18px] w-[18px] shrink-0 object-contain opacity-90"
              draggable={false}
              aria-hidden
            />
            <span className="min-w-0 text-[10px] leading-snug text-ink-400 group-hover:text-brand-300">
              {t('app.poweredBy')}
            </span>
          </button>
        </div>
      </aside>

      <main className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
        {updateBanner ? (
          <div
            className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-brand-500/40 bg-brand-950/90 px-4 py-2 text-sm text-brand-50"
            role="status"
          >
            <p className="min-w-0 flex-1 text-xs leading-snug sm:text-sm">
              {updateBanner.downloaded
                ? t('settings.updateDownloadedBanner', {
                    version: updateBanner.latest
                  })
                : t('settings.updateAvailableBanner', {
                    latest: updateBanner.latest,
                    current: updateBanner.current
                  })}
            </p>
            <div className="flex shrink-0 flex-wrap gap-2">
              {!updateBanner.downloaded ? (
                <button
                  type="button"
                  className="rounded-lg bg-brand-600 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-brand-500"
                  onClick={() => {
                    void getApi()
                      .updates.download()
                      .then((s) => {
                        if (s.status === 'downloaded') {
                          setUpdateBanner({
                            latest: s.latestVersion || updateBanner.latest,
                            current: s.currentVersion,
                            downloaded: true
                          })
                          toast.success(t('settings.updateDownloadedToast'))
                        }
                      })
                      .catch(() => toast.error(t('settings.updateDownloadFail')))
                  }}
                >
                  {t('settings.downloadUpdate')}
                </button>
              ) : (
                <button
                  type="button"
                  className="rounded-lg bg-brand-600 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-brand-500"
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
                      .catch(() => toast.error(t('settings.updateInstallFail')))
                  }}
                >
                  {t('settings.installUpdate')}
                </button>
              )}
              <button
                type="button"
                className="rounded-lg border border-brand-400/40 px-2.5 py-1 text-[11px] text-brand-100 hover:bg-brand-900"
                onClick={() => navigate('/settings')}
              >
                {t('settings.openUpdateSettings')}
              </button>
              <button
                type="button"
                className="rounded-lg px-2 py-1 text-[11px] text-brand-200/80 hover:text-white"
                onClick={() => setUpdateBanner(null)}
                aria-label={t('common.close')}
              >
                ×
              </button>
            </div>
          </div>
        ) : null}
        <Outlet />
        <AiJobHud />
        <AiDraftModal />
        <VideoPrepHost />
      </main>
    </div>
  )
}
