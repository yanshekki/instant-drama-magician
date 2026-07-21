/**
 * Check npm registry for a newer package version (CLI / informational).
 * Desktop installers use electron-updater + GitHub Releases instead.
 */
import { accessSync, constants, readFileSync } from 'fs'
import { join } from 'path'
import { spawnSync } from 'child_process'

export const NPM_PACKAGE_NAME = 'instant-drama-magician'

export const NPM_INSTALL_CMD = `npm install -g ${NPM_PACKAGE_NAME}@latest`

/** Exported for residual unit tests (win32 vs unix no-write hint). */
export function formatNoWriteHint(prefix: string, platform: string): string {
  return platform === 'win32'
    ? `No write access to ${prefix}. Run the terminal as Administrator, or use a user-owned prefix (nvm-windows / fnm).`
    : `No write access to ${prefix}. Fix with: npm config set prefix ~/.local && ensure PATH includes ~/.local/bin — or re-run with sudo (not recommended).`
}

/** Coerce spawnSync stderr which may be string | Buffer | null. */
export function coerceSpawnText(
  value: unknown,
  fallback?: string
): string | undefined {
  if (typeof value === 'string') return value
  if (value) return String(value)
  return fallback
}


export type NpmUpdateCheck = {
  packageName: string
  currentVersion: string
  latestVersion: string | null
  updateAvailable: boolean
  checkedAt: string
  installCommand: string
  error?: string
}

export type NpmGlobalWriteProbe = {
  ok: boolean
  prefix: string | null
  hint?: string
}

export type NpmInstallResult = {
  ok: boolean
  command: string
  targetVersion: string
  exitCode: number | null
  stderr?: string
  stdout?: string
  verifiedVersion?: string | null
  error?: string
  writeProbe: NpmGlobalWriteProbe
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

/** Build install command for latest or a pinned version. */
export function npmInstallCommand(
  packageName: string = NPM_PACKAGE_NAME,
  version: string = 'latest'
): string {
  const ver = version.trim() || 'latest'
  return `npm install -g ${packageName}@${ver} --no-fund --no-audit`
}

export async function checkNpmPackageUpdate(
  packageName: string,
  currentVersion: string,
  opts?: {
    timeoutMs?: number
    fetchImpl?: typeof fetch
    /** dist-tag or exact version path segment; default "latest" */
    tag?: string
  }
): Promise<NpmUpdateCheck> {
  const checkedAt = new Date().toISOString()
  const tag = opts?.tag?.trim() || 'latest'
  const base: NpmUpdateCheck = {
    packageName,
    currentVersion,
    latestVersion: null,
    updateAvailable: false,
    checkedAt,
    installCommand: npmInstallCommand(packageName, tag === 'latest' ? 'latest' : tag)
  }
  const timeoutMs = opts?.timeoutMs ?? 8000
  const fetchFn = opts?.fetchImpl ?? globalThis.fetch
  if (typeof fetchFn !== 'function') {
    return { ...base, error: 'fetch unavailable' }
  }
  const url = `https://registry.npmjs.org/${encodeURIComponent(packageName)}/${encodeURIComponent(tag)}`
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
      updateAvailable: compareSemver(latest, currentVersion) > 0,
      installCommand: npmInstallCommand(packageName, latest)
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return { ...base, error: message }
  } finally {
    clearTimeout(timer)
  }
}

/** Probe whether the global npm prefix is writable (no sudo needed). */
export function probeNpmGlobalWrite(
  spawn: typeof spawnSync = spawnSync
): NpmGlobalWriteProbe {
  try {
    const r = spawn('npm', ['prefix', '-g'], {
      encoding: 'utf8',
      shell: process.platform === 'win32'
    })
    if (r.status !== 0) {
      return {
        ok: false,
        prefix: null,
        hint: 'Could not resolve npm global prefix. Try: npm config get prefix'
      }
    }
    const prefix = String(r.stdout || '')
      .trim()
      .split(/\r?\n/)[0]
      ?.trim()
    if (!prefix) {
      return {
        ok: false,
        prefix: null,
        hint: 'Empty npm global prefix'
      }
    }
    try {
      accessSync(prefix, constants.W_OK)
      return { ok: true, prefix }
    } catch {
      return {
        ok: false,
        prefix,
        hint: formatNoWriteHint(prefix, process.platform)
      }
    }
  } catch (e) {
    return {
      ok: false,
      prefix: null,
      hint: e instanceof Error ? e.message : String(e)
    }
  }
}

/**
 * Run global npm install for a package version (or latest).
 * Does not require interactive TTY when inheritStdio is false.
 */
export function installNpmPackageUpdate(opts: {
  packageName?: string
  /** "latest" or exact semver */
  version?: string
  inheritStdio?: boolean
  spawn?: typeof spawnSync
  /** Skip actual spawn (tests) */
  dryRun?: boolean
}): NpmInstallResult {
  const packageName = opts.packageName || NPM_PACKAGE_NAME
  const targetVersion = (opts.version || 'latest').trim() || 'latest'
  const command = npmInstallCommand(packageName, targetVersion)
  const writeProbe = probeNpmGlobalWrite(opts.spawn ?? spawnSync)

  if (!writeProbe.ok) {
    return {
      ok: false,
      command,
      targetVersion,
      exitCode: null,
      error: writeProbe.hint || 'Global npm prefix is not writable',
      writeProbe
    }
  }

  if (opts.dryRun) {
    return {
      ok: true,
      command,
      targetVersion,
      exitCode: 0,
      writeProbe,
      verifiedVersion: null
    }
  }

  const spawnFn = opts.spawn ?? spawnSync
  const pkgSpec = `${packageName}@${targetVersion}`
  const r = spawnFn(
    'npm',
    ['install', '-g', pkgSpec, '--no-fund', '--no-audit'],
    {
      encoding: 'utf8',
      stdio: opts.inheritStdio ? 'inherit' : 'pipe',
      shell: process.platform === 'win32'
    }
  )

  const exitCode = r.status
  const stderr = coerceSpawnText(r.stderr, r.error?.message)
  const stdout = typeof r.stdout === 'string' ? r.stdout : undefined

  if (exitCode !== 0) {
    const summary = (stderr || r.error?.message || `exit ${exitCode ?? 'unknown'}`)
      .split(/\r?\n/)
      .filter(Boolean)
      .slice(-8)
      .join('\n')
    return {
      ok: false,
      command,
      targetVersion,
      exitCode,
      stderr: summary,
      stdout,
      error: `npm install failed. Try manually: ${command}`,
      writeProbe
    }
  }

  const verifiedVersion = verifyGlobalPackageVersion(
    packageName,
    writeProbe.prefix,
    spawnFn
  )

  return {
    ok: true,
    command,
    targetVersion,
    exitCode: 0,
    stderr,
    stdout,
    verifiedVersion,
    writeProbe
  }
}

/** Read installed global package version from prefix or `npm list -g`. */
export function verifyGlobalPackageVersion(
  packageName: string = NPM_PACKAGE_NAME,
  prefix?: string | null,
  spawn: typeof spawnSync = spawnSync
): string | null {
  if (prefix) {
    try {
      const pkgPath = join(prefix, 'lib', 'node_modules', packageName, 'package.json')
      const j = JSON.parse(readFileSync(pkgPath, 'utf8')) as { version?: string }
      if (j.version) return j.version
    } catch {
      /* try windows path / npm list */
    }
    try {
      const pkgPath = join(prefix, 'node_modules', packageName, 'package.json')
      const j = JSON.parse(readFileSync(pkgPath, 'utf8')) as { version?: string }
      if (j.version) return j.version
    } catch {
      /* fall through */
    }
  }
  try {
    const r = spawn('npm', ['list', '-g', packageName, '--depth=0', '--json'], {
      encoding: 'utf8',
      shell: process.platform === 'win32'
    })
    if (r.status === 0 && r.stdout) {
      const j = JSON.parse(String(r.stdout)) as {
        dependencies?: Record<string, { version?: string }>
      }
      const v = j.dependencies?.[packageName]?.version
      if (v) return v
    }
  } catch {
    /* ignore */
  }
  return null
}
