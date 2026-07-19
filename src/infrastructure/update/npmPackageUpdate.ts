/**
 * Check npm registry for a newer package version (CLI / informational).
 * Desktop installers use electron-updater + GitHub Releases instead.
 */

export const NPM_PACKAGE_NAME = 'instant-drama-magician'

export const NPM_INSTALL_CMD = `npm install -g ${NPM_PACKAGE_NAME}@latest`

export type NpmUpdateCheck = {
  packageName: string
  currentVersion: string
  latestVersion: string | null
  updateAvailable: boolean
  checkedAt: string
  installCommand: string
  error?: string
}

/** Compare semver-ish strings. Returns >0 if a>b, <0 if a<b, 0 if equal. */
export function compareSemver(a: string, b: string): number {
  const pa = parseSemver(a)
  const pb = parseSemver(b)
  for (let i = 0; i < 3; i++) {
    if (pa[i] !== pb[i]) return pa[i] - pb[i]
  }
  return 0
}

function parseSemver(v: string): [number, number, number] {
  const m = String(v)
    .trim()
    .replace(/^v/i, '')
    .match(/^(\d+)(?:\.(\d+))?(?:\.(\d+))?/)
  if (!m) return [0, 0, 0]
  return [
    Number.parseInt(m[1] || '0', 10) || 0,
    Number.parseInt(m[2] || '0', 10) || 0,
    Number.parseInt(m[3] || '0', 10) || 0
  ]
}

export async function checkNpmPackageUpdate(
  packageName: string,
  currentVersion: string,
  opts?: {
    timeoutMs?: number
    fetchImpl?: typeof fetch
  }
): Promise<NpmUpdateCheck> {
  const checkedAt = new Date().toISOString()
  const base: NpmUpdateCheck = {
    packageName,
    currentVersion,
    latestVersion: null,
    updateAvailable: false,
    checkedAt,
    installCommand: `npm install -g ${packageName}@latest`
  }
  const timeoutMs = opts?.timeoutMs ?? 8000
  const fetchFn = opts?.fetchImpl ?? globalThis.fetch
  if (typeof fetchFn !== 'function') {
    return { ...base, error: 'fetch unavailable' }
  }
  const url = `https://registry.npmjs.org/${encodeURIComponent(packageName)}/latest`
  const ac = new AbortController()
  const timer = setTimeout(() => ac.abort(), timeoutMs)
  try {
    const res = await fetchFn(url, {
      signal: ac.signal,
      headers: { Accept: 'application/json' }
    })
    if (!res.ok) {
      return { ...base, error: `HTTP ${res.status}` }
    }
    const body = (await res.json()) as { version?: string }
    const latest = body.version?.trim() || null
    if (!latest) {
      return { ...base, error: 'no version in registry response' }
    }
    return {
      ...base,
      latestVersion: latest,
      updateAvailable: compareSemver(latest, currentVersion) > 0
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return { ...base, error: message }
  } finally {
    clearTimeout(timer)
  }
}
