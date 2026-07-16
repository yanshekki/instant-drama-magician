import { NavLink, Outlet } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useApp } from '../context/AppContext'

const navItems: { to: string; key: string; end?: boolean }[] = [
  { to: '/', key: 'stories', end: true },
  { to: '/characters', key: 'characters' },
  { to: '/scenes', key: 'scenes' },
  { to: '/props', key: 'props' },
  { to: '/timeline', key: 'timeline' },
  { to: '/settings', key: 'settings' }
]

export function Layout(): JSX.Element {
  const { t, i18n } = useTranslation()
  const { aiStatus, activeStoryId, stories } = useApp()
  const activeStory = stories.find((s) => s.id === activeStoryId)

  const toggleLang = (): void => {
    void i18n.changeLanguage(i18n.language === 'zh-HK' ? 'en' : 'zh-HK')
  }

  return (
    <div className="flex h-screen overflow-hidden bg-ink-950 text-ink-50">
      <aside className="flex w-60 shrink-0 flex-col border-r border-ink-800 bg-ink-900/80">
        <div className="border-b border-ink-800 px-5 py-5">
          <div className="text-lg font-semibold tracking-tight text-brand-300">
            {t('app.name')}
          </div>
          <p className="mt-1 text-xs text-ink-400">{t('app.tagline')}</p>
        </div>

        <nav className="flex flex-1 flex-col gap-1 p-3">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                [
                  'rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-brand-600/20 text-brand-200'
                    : 'text-ink-300 hover:bg-ink-800 hover:text-ink-50'
                ].join(' ')
              }
            >
              {t(`nav.${item.key}`)}
            </NavLink>
          ))}
        </nav>

        <div className="space-y-3 border-t border-ink-800 p-4 text-xs">
          {activeStory && (
            <div className="rounded-lg bg-ink-800/60 px-3 py-2">
              <div className="text-ink-400">Active</div>
              <div className="truncate font-medium text-ink-100">
                {activeStory.title}
              </div>
            </div>
          )}

          <div
            className={[
              'rounded-lg px-3 py-2',
              aiStatus?.available
                ? 'bg-emerald-950/50 text-emerald-300'
                : 'bg-amber-950/40 text-amber-200'
            ].join(' ')}
          >
            <div className="font-medium">
              {aiStatus?.available ? t('ai.online') : t('ai.offline')}
            </div>
            <div className="mt-0.5 text-[10px] opacity-80">
              {aiStatus?.message ?? t('ai.hint')}
            </div>
          </div>

          <button
            type="button"
            onClick={toggleLang}
            className="w-full rounded-lg border border-ink-700 px-3 py-2 text-ink-300 hover:border-ink-500 hover:text-ink-100"
          >
            {t('app.language')}: {i18n.language === 'zh-HK' ? '繁中' : 'EN'}
          </button>
        </div>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Outlet />
      </main>
    </div>
  )
}
