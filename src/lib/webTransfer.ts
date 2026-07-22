import { AppError } from '../types/errors'
/**
 * Browser helpers for web runtime: file pick, upload, download.
 * (Does not import httpAppClient — avoids circular deps.)
 */

const TOKEN_KEY = 'idm_auth_token'

function getToken(): string {
  try {
    return localStorage.getItem(TOKEN_KEY) ?? ''
  } catch {
    return ''
  }
}

function apiBase(): string {
  const env = (import.meta as { env?: { VITE_IDM_API_BASE?: string } }).env
  return (env?.VITE_IDM_API_BASE ?? '').replace(/\/+$/, '')
}

function authHeaders(): Record<string, string> {
  const token = getToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

/** Append token to same-origin API file URLs for <a download> / window.open. */
export function withAuthQuery(url: string): string {
  if (!url || url.startsWith('blob:') || url.startsWith('data:')) return url
  const token = getToken()
  if (!token) return url
  if (url.includes('token=')) return url
  const abs = url.startsWith('http')
    ? url
    : `${apiBase()}${url.startsWith('/') ? '' : '/'}${url}`
  return `${abs}${abs.includes('?') ? '&' : '?'}token=${encodeURIComponent(token)}`
}

export function triggerBrowserDownload(
  url: string,
  fileName?: string
): void {
  const href = withAuthQuery(url)
  const a = document.createElement('a')
  a.href = href
  a.download = fileName || ''
  a.rel = 'noopener'
  a.target = '_blank'
  document.body.appendChild(a)
  a.click()
  a.remove()
}

export function openInBrowserTab(url: string): void {
  // External product links (GitHub Releases, docs) must not get API ?token=
  if (/^https?:\/\//i.test(url) && !/\/api\//i.test(url)) {
    window.open(url, '_blank', 'noopener,noreferrer')
    return
  }
  window.open(withAuthQuery(url), '_blank', 'noopener,noreferrer')
}

export function pickFile(accept?: string): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    if (accept) input.accept = accept
    input.style.display = 'none'
    input.onchange = () => {
      const f = input.files?.[0] ?? null
      input.remove()
      resolve(f)
    }
    input.oncancel = () => {
      input.remove()
      resolve(null)
    }
    document.body.appendChild(input)
    input.click()
  })
}

export async function uploadBrowserFile(
  file: File,
  opts?: { subdir?: string }
): Promise<{ filePath: string; fileName: string }> {
  const name = file.name || `upload-${Date.now()}`
  const q = new URLSearchParams({
    name,
    ...(opts?.subdir ? { subdir: opts.subdir } : {})
  })
  const res = await fetch(`${apiBase()}/api/upload?${q.toString()}`, {
    method: 'POST',
    headers: {
      ...authHeaders(),
      'Content-Type': file.type || 'application/octet-stream'
    },
    body: file
  })
  const text = await res.text()
  let body: unknown = null
  try {
    body = text ? JSON.parse(text) : null
  } catch {
    body = { message: text }
  }
  if (!res.ok) {
    const msg =
      (body as { message?: string; error?: { message?: string } })?.error
        ?.message ||
      (body as { message?: string })?.message ||
      `Upload failed HTTP ${res.status}`
    throw new Error(msg)
  }
  const r = body as {
    filePath?: string
    fileName?: string
    result?: { filePath?: string; fileName?: string }
  }
  const filePath = r.filePath || r.result?.filePath
  if (!filePath) throw new AppError('VALIDATION', 'errors.uploadMissingFilePath')
  return {
    filePath,
    fileName: r.fileName || r.result?.fileName || name
  }
}

/** If API result includes downloadUrl, start browser download. */
export function maybeDownloadResult(result: unknown): void {
  if (!result || typeof result !== 'object') return
  const r = result as {
    downloadUrl?: string
    fileName?: string
    openUrl?: string
  }
  if (r.downloadUrl) {
    triggerBrowserDownload(r.downloadUrl, r.fileName)
  }
}
