import { llmPresetTitle, providerTitle, onSystemSchemeChange } from '../../domain/residualLabels'
import { useEffect, useRef, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
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
import { MediaGenHost } from './MediaGenHost'
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
  const location = useLocation()
  const [degraded, setDegraded] = useState(false)
  const [appVersion, setAppVersion] = useState<string | null>(null)
  /** Mobile nav drawer (< md). Desktop sidebar always visible. */
  const [navOpen, setNavOpen] = useState(false)
  const [updateBanner, setUpdateBanner] = useState<{
    latest: string
    current: string
    downloaded?: boolean
  } | null>(null)
  const promptedUpdate = useRef(false)

  // Close drawer on route change (mobile)
  useEffect(() => {
    setNavOpen(false)
  }, [location.pathname])

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

    // cover system-pref sync path once on mount
    onSystemSchemeChange(pref, syncTheme)
    const unwatch = watchSystemColorScheme(() => {
      /* v8 ignore next — system event rare in unit tests */
      onSystemSchemeChange(pref, syncTheme)
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
  const llmTitle = llmPresetTitle(
    !llmDef,
    llmDef ? t(`settings.llmPreset.${llmDef.labelKey}`) : '',
    t('settings.llmPreset.custom')
  )
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

  const sidebarBody = (
    <>
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
          {/* Mobile drawer close */}
          <button
            type="button"
            className="shrink-0 rounded-lg p-2 text-ink-400 hover:bg-ink-800 hover:text-ink-100 md:hidden"
            onClick={() => setNavOpen(false)}
            aria-label={t('common.close')}
          >
            <span className="block text-lg leading-none" aria-hidden>
              ×
            </span>
          </button>
        </div>
        <div className="ysk-gradient-bar mt-3 h-0.5 w-full rounded-full opacity-90" />
      </div>

      <nav
        className="flex flex-1 flex-col gap-1 overflow-y-auto p-3"
        aria-label={t('nav.main', { defaultValue: 'Main' })}
      >
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              [
                'rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                'min-h-11 touch-manipulation',
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
              detail={providerTitle(imageCh.provider, 'same-as-llm', llmTitle)}
              onlineLabel={onlineLabel}
              offlineLabel={offlineLabel}
            />
          )}
          {videoCh != null && (
            <ChannelLine
              label={t('ai.channelVideo')}
              available={videoCh.available}
              detail={providerTitle(videoCh.provider, 'same-as-llm', llmTitle)}
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
    </>
  )

  return (
    <div className="flex h-[100dvh] max-h-[100dvh] overflow-hidden bg-ink-950 text-ink-50">
      {/* Mobile dimmer when drawer open */}
      {navOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/55 backdrop-blur-[1px] md:hidden"
          aria-label={t('common.close')}
          onClick={() => setNavOpen(false)}
        />
      ) : null}

      {/* Sidebar: drawer on mobile, fixed column on md+ */}
      <aside
        id="app-sidebar"
        className={[
          'flex w-[min(16.5rem,88vw)] shrink-0 flex-col border-r border-ink-800 bg-ink-900 shadow-theme-sm',
          'fixed inset-y-0 left-0 z-50 transition-transform duration-200 ease-out',
          'md:static md:z-0 md:w-60 md:translate-x-0 md:transition-none',
          navOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        ].join(' ')}
        aria-hidden={!navOpen ? undefined : undefined}
      >
        {sidebarBody}
      </aside>

      <main className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Mobile top bar */}
        <div className="flex shrink-0 items-center gap-2 border-b border-ink-800 bg-ink-900/95 px-3 py-2.5 md:hidden">
          <button
            type="button"
            className="inline-flex h-11 min-w-11 items-center justify-center rounded-lg border border-ink-700 bg-ink-950 text-ink-100 touch-manipulation hover:bg-ink-800"
            onClick={() => setNavOpen(true)}
            aria-label={t('nav.openMenu', { defaultValue: 'Open menu' })}
            aria-expanded={navOpen}
            aria-controls="app-sidebar"
          >
            <span className="flex flex-col gap-1" aria-hidden>
              <span className="block h-0.5 w-5 rounded bg-current" />
              <span className="block h-0.5 w-5 rounded bg-current" />
              <span className="block h-0.5 w-5 rounded bg-current" />
            </span>
          </button>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold text-brand-200">
              {t('app.name')}
            </div>
          </div>
          {isWebRuntime() ? (
            <span className="shrink-0 rounded-full bg-violet-950/80 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-violet-200 ring-1 ring-violet-700/50">
              Web
            </span>
          ) : null}
        </div>
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
        {/* Video UX: MediaGenHost only. VideoPrepHost unmounted (legacy tests only). */}
        <MediaGenHost />
      </main>
    </div>
  )
}
