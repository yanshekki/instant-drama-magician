/**
 * Simple token gate for self-hosted web mode (not shown in Electron).
 * Language can be switched before login (browser default + localStorage).
 */
import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import {
  clearStoredAuthToken,
  getStoredAuthToken,
  loginWithToken,
  setStoredAuthToken
} from '../../lib/httpAppClient'
import { isElectron } from '../../lib/api'
import { changeUiLanguage } from '../../lib/i18n'
import {
  UI_LANGUAGES,
  coerceUiLanguage,
  type UiLanguage
} from '../../domain/uiLanguages'
import { Button, Input } from './ui'

export function WebAuthGate({ children }: { children: ReactNode }): JSX.Element {
  const { t, i18n } = useTranslation()
  const [ready, setReady] = useState(isElectron())
  const [token, setToken] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [lang, setLang] = useState<UiLanguage>(() =>
    coerceUiLanguage(i18n.language)
  )

  useEffect(() => {
    if (isElectron()) {
      setReady(true)
      return
    }
    const existing = getStoredAuthToken()
    if (!existing) {
      // Try unauthenticated health — server may allow loopback without token
      void fetch('/api/health')
        .then((r) => r.json())
        .then((h: { authRequired?: boolean }) => {
          if (h.authRequired === false) {
            setReady(true)
            return
          }
          setReady(false)
        })
        .catch(() => setReady(false))
      return
    }
    void loginWithToken(existing).then((ok) => {
      if (ok) setReady(true)
      else {
        clearStoredAuthToken()
        setReady(false)
      }
    })
  }, [])

  if (isElectron() || ready) {
    return <>{children}</>
  }

  const onLangChange = (code: string): void => {
    const next = coerceUiLanguage(code)
    setLang(next)
    void changeUiLanguage(next)
  }

  const onSubmit = (e: FormEvent): void => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    void loginWithToken(token.trim())
      .then((ok) => {
        if (ok) {
          setStoredAuthToken(token.trim())
          // Keep login-screen language after enter
          void changeUiLanguage(lang)
          setReady(true)
        } else {
          setError(t('web.authFail'))
        }
      })
      .finally(() => setBusy(false))
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-950 px-4 text-ink-50">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-md space-y-4 rounded-2xl border border-ink-700 bg-ink-900 p-6 shadow-theme-lg"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-semibold text-brand-200">
              {t('web.authTitle')}
            </h1>
            <p className="mt-1 text-sm text-ink-400">{t('web.authHint')}</p>
          </div>
          <div className="shrink-0">
            <label className="mb-1 block text-[10px] text-ink-500">
              {t('web.language')}
            </label>
            <select
              className="max-w-[9.5rem] rounded-lg border border-ink-600 bg-ink-950 px-2 py-1.5 text-xs text-ink-100 outline-none focus:border-brand-500"
              value={lang}
              onChange={(e) => onLangChange(e.target.value)}
              aria-label={t('web.language')}
            >
              {UI_LANGUAGES.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.nativeLabel}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className="mb-1 block text-xs text-ink-400">
            {t('web.authToken')}
          </label>
          <Input
            type="password"
            autoComplete="current-password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder={t('web.authTokenPlaceholder')}
          />
          <p className="mt-1.5 text-[11px] leading-relaxed text-ink-500">
            {t('web.authHintDetail')}
          </p>
        </div>
        {error && (
          <p className="text-sm text-rose-300" role="alert">
            {error}
          </p>
        )}
        <Button type="submit" disabled={busy || !token.trim()} className="w-full">
          {busy ? t('common.loading') : t('web.authSubmit')}
        </Button>
      </form>
    </div>
  )
}
