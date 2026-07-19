/**
 * Simple token gate for self-hosted web mode (not shown in Electron).
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
import { Button, Input } from './ui'

export function WebAuthGate({ children }: { children: ReactNode }): JSX.Element {
  const { t } = useTranslation()
  const [ready, setReady] = useState(isElectron())
  const [token, setToken] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

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

  const onSubmit = (e: FormEvent): void => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    void loginWithToken(token.trim())
      .then((ok) => {
        if (ok) {
          setStoredAuthToken(token.trim())
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
        <div>
          <h1 className="text-lg font-semibold text-brand-200">
            {t('web.authTitle')}
          </h1>
          <p className="mt-1 text-sm text-ink-400">{t('web.authHint')}</p>
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
            placeholder="IDM_AUTH_TOKEN"
          />
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
