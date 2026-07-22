/**
 * Manage local Grok CLI Gateway (gctoac) for InstantDrama.
 * - Bundled via npm dependency: grok-cli-to-openai-compatible
 * - Requires system "Grok Build" CLI (`grok`) for actual model access
 * - App starts the gateway itself (no manual `gctoac start` for end users)
 * - Every ensureRunning / start path re-applies {@link IDM_GATEWAY_PRESET}
 */
import { spawn, execFile, type ChildProcess } from 'child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { promisify } from 'util'
import { GROK_GATEWAY_BASE_URL } from '../../domain/gatewayDefaults'
import { homedir } from 'os'
import { AppError } from '../../types/errors'

const execFileAsync = promisify(execFile)

/**
 * InstantDrama fixed gateway profile — applied on every start / ensure.
 * Values use gctoac schema maxima where relevant.
 * Note: express-rate-limit v7 treats max:0 as "block all" — never use 0 for key rate.
 */
export const IDM_GATEWAY_PRESET = {
  /** Per-key chat rate (gctoac DTO max) */
  keyRateLimit: 10_000,
  /** Global / IP rate window */
  rateLimitWindowMs: 60_000,
  rateLimitMax: 100_000,
  rateLimitIpMax: 100_000,
  chatBurstMax: 10_000,
  velocityMaxRequests: 1_000_000,
  maxConcurrentPerIp: 10_000,
  rateHitThreshold: 10_000,
  failedAuthThreshold: 10_000,
  /** Queue (gctoac schema max: global 64, per-key 16, depth 10000 / 1000) */
  queueGlobalConcurrency: 64,
  queuePerKeyConcurrency: 16,
  queueMaxDepth: 10_000,
  queueMaxDepthPerKey: 1_000,
  queueMaxWaitMs: 3_600_000,
  queueMaxAttempts: 5,
  /** Grok process env */
  grokMaxConcurrent: 16,
  grokTimeoutMs: 600_000,
  bodyLimit: '50mb',
  uploadMaxBytes: 52_428_800
} as const

export type GrokInstallState =
  | 'ready'
  | 'gateway_starting'
  | 'gateway_missing'
  | 'grok_build_missing'
  | 'unhealthy'
  | 'error'

export interface GrokGatewayStatus {
  state: GrokInstallState
  message: string
  /** gctoac CLI path if found */
  gctoacPath: string | null
  /** grok (Grok Build) binary path if found */
  grokPath: string | null
  /** Gateway health */
  healthOk: boolean
  port: number
  baseUrl: string
  adminUrl: string
  version?: string
  details?: string
}

const DEFAULT_PORT = 3847


/** PATH lookup for residual unit tests (catch → null). */
export function whichOnPath(
  command: string,
  opts: {
    platform?: string
    execSync?: (cmd: string, o: { encoding: BufferEncoding }) => string
    exists?: (p: string) => boolean
  } = {}
): string | null {
  const platform = opts.platform ?? process.platform
  const exec =
    opts.execSync ??
    ((cmd: string, o: { encoding: BufferEncoding }) => {
      const { execSync } = require('child_process') as typeof import('child_process')
      return execSync(cmd, o)
    })
  const exists = opts.exists ?? ((p: string) => existsSync(p))
  try {
    const which = exec(
      platform === 'win32' ? `where ${command}` : `command -v ${command}`,
      { encoding: 'utf-8' as const }
    )
      .trim()
      .split('\n')[0]
    if (which && exists(which)) return which
  } catch {
    /* not on PATH */
  }
  return null
}

export class GrokGatewayService {
  private child: ChildProcess | null = null
  private starting: Promise<GrokGatewayStatus> | null = null
  /** Coalesce concurrent preset applies (many IPC callers). */
  private applyingPreset: Promise<void> | null = null
  private lastPresetAt = 0

  constructor(
    private readonly port = DEFAULT_PORT,
    private readonly projectRoot = process.cwd()
  ) {}

  get baseUrl(): string {
    return `http://127.0.0.1:${this.port}/v1`
  }

  get adminUrl(): string {
    return `http://127.0.0.1:${this.port}/admin/`
  }

  /** Resolve bundled or PATH gctoac. */
  resolveGctoacPath(): string | null {
    const candidates = [
      join(this.projectRoot, 'node_modules', '.bin', 'gctoac'),
      join(this.projectRoot, 'node_modules', 'grok-cli-to-openai-compatible', 'dist', 'cli', 'index.js'),
      // asar unpacked / electron
      join(process.resourcesPath ?? '', 'app.asar.unpacked', 'node_modules', '.bin', 'gctoac'),
      join(process.resourcesPath ?? '', 'app.asar.unpacked', 'node_modules', 'grok-cli-to-openai-compatible', 'dist', 'cli', 'index.js')
    ]
    for (const p of candidates) {
      if (p && existsSync(p)) return p
    }
    // PATH
    return whichOnPath('gctoac')
  }

  /** Resolve Grok Build TUI binary (`grok`). */
  resolveGrokBuildPath(): string | null {
    const which = whichOnPath('grok')
    if (which) return which
    // Common install locations
    const home = process.env.HOME || process.env.USERPROFILE || ''
    const candidates = [
      join(home, '.local', 'bin', 'grok'),
      join(home, '.grok', 'bin', 'grok'),
      '/usr/local/bin/grok'
    ]
    for (const p of candidates) {
      if (existsSync(p)) return p
    }
    return null
  }

  async healthCheck(timeoutMs = 2500): Promise<boolean> {
    try {
      const ctrl = new AbortController()
      const t = setTimeout(() => ctrl.abort(), timeoutMs)
      const res = await fetch(`http://127.0.0.1:${this.port}/health`, {
        signal: ctrl.signal
      })
      clearTimeout(t)
      return res.ok
    } catch {
      return false
    }
  }

  async getStatus(): Promise<GrokGatewayStatus> {
    const gctoacPath = this.resolveGctoacPath()
    const grokPath = this.resolveGrokBuildPath()
    const healthOk = await this.healthCheck()
    const base = {
      gctoacPath,
      grokPath,
      healthOk,
      port: this.port,
      baseUrl: this.baseUrl,
      adminUrl: this.adminUrl
    }

    if (!gctoacPath) {
      return {
        ...base,
        state: 'gateway_missing',
        message:
          'Gateway package missing. Reinstall InstantDrama Magician (includes grok-cli-to-openai-compatible).'
      }
    }

    if (!grokPath) {
      return {
        ...base,
        state: 'grok_build_missing',
        message:
          'Grok Build CLI not found. Install Grok Build (the `grok` command), then restart this app.'
      }
    }

    if (healthOk) {
      return {
        ...base,
        state: 'ready',
        message: `Grok Gateway online · :${this.port}`
      }
    }

    if (this.starting) {
      return {
        ...base,
        state: 'gateway_starting',
        message: 'Starting Grok Gateway…'
      }
    }

    return {
      ...base,
      state: 'unhealthy',
      message: `Grok Gateway not running on :${this.port}`
    }
  }

  /**
   * Ensure gateway is up: setup once, start in background if needed,
   * then always re-check and apply InstantDrama gateway preset.
   */
  async ensureRunning(): Promise<GrokGatewayStatus> {
    const pre = await this.getStatus()
    if (pre.state === 'gateway_missing' || pre.state === 'grok_build_missing') {
      return pre
    }

    if (pre.state === 'ready') {
      await this.applyIdmGatewayPreset()
      return this.getStatus()
    }

    if (this.starting) {
      const st = await this.starting
      if (st.state === 'ready' || st.healthOk) {
        await this.applyIdmGatewayPreset()
      }
      return this.getStatus()
    }

    this.starting = this.startInternal()
      .then(async () => {
        // Wait for health
        for (let i = 0; i < 30; i++) {
          await sleep(500)
          if (await this.healthCheck()) {
            break
          }
        }
        await this.applyIdmGatewayPreset()
        return this.getStatus()
      })
      .finally(() => {
        this.starting = null
      })

    return this.starting
  }

  /** Probe whether a gateway API key is accepted (GET /v1/models). */
  async validateApiKey(apiKey: string | null | undefined): Promise<boolean> {
    const key = apiKey?.trim()
    if (!key) return false
    try {
      const ctrl = new AbortController()
      const t = setTimeout(() => ctrl.abort(), 4000)
      // baseUrl already includes /v1 → /v1/models
      const res = await fetch(`${this.baseUrl}/models`, {
        headers: { Authorization: `Bearer ${key}` },
        signal: ctrl.signal
      })
      clearTimeout(t)
      return res.ok
    } catch {
      return false
    }
  }

  /** Extract plaintext gk_live_… key from gctoac key create output. */
  static parseCreatedApiKey(text: string): string | null {
    if (!text) return null
    const labeled = text.match(/^\s*key:\s+(gk_live_[A-Za-z0-9_-]+)\s*$/im)
    if (labeled?.[1]) return labeled[1]
    // Fallback: longest gk_live_ token (prefix lines are shorter)
    const all = [...text.matchAll(/\b(gk_live_[A-Za-z0-9_-]{16,})\b/g)].map(
      (m) => m[1]
    )
    if (all.length === 0) return null
    return all.sort((a, b) => b.length - a.length)[0]
  }

  /** Name used for the app-managed API key (findable via `gctoac key list`). */
  static readonly APP_KEY_NAME = 'instant-drama-magician'

  /**
   * express-rate-limit v7: max must be ≥1. gctoac key DTO max is 10000.
   * Using 0 blocks every chat request — do not use 0.
   */
  private static readonly MAX_KEY_RATE = String(IDM_GATEWAY_PRESET.keyRateLimit)

  /**
   * @deprecated Prefer {@link applyIdmGatewayPreset}
   * Kept so older call sites still hit the full preset.
   */
  async ensureMediaAndLimits(): Promise<void> {
    await this.applyIdmGatewayPreset()
  }

  /**
   * Check and apply the full InstantDrama gateway preset.
   * Called every time the gateway is started or ensured online.
   * Idempotent; concurrent callers share one in-flight apply.
   */
  async applyIdmGatewayPreset(opts?: { force?: boolean }): Promise<void> {
    if (this.applyingPreset) return this.applyingPreset
    const now = Date.now()
    // Skip spam within 8s unless force (still runs on each start / cold ensure)
    if (!opts?.force && now - this.lastPresetAt < 8_000) return

    this.applyingPreset = this.runIdmGatewayPreset()
      .then(() => {
        this.lastPresetAt = Date.now()
      })
      .finally(() => {
        this.applyingPreset = null
      })
    return this.applyingPreset
  }

  private async runIdmGatewayPreset(): Promise<void> {
    const gctoac = this.resolveGctoacPath()
    if (!gctoac) return

    // 1) Persist boot defaults so next gctoac start is already maxed
    this.patchGctoacEnvFile()

    // 2) API features: open base + media on (images/video required for 出圖／出片)
    await this.safeGctoac(gctoac, ['api', 'features', 'preset', 'open'], 30_000)
    await this.safeGctoac(
      gctoac,
      [
        'api',
        'features',
        'set',
        '--openai-chat',
        'on',
        '--openai-responses',
        'on',
        '--tools',
        'on',
        '--vision',
        'on',
        '--structured-output',
        'on',
        '--images-api',
        'on',
        '--video-api',
        'on',
        '--audio-api',
        'on',
        '--web-search',
        'on',
        '--usage-estimate',
        'on'
      ],
      30_000
    )

    // 3) DDoS / rate walls → schema max, auto-ban off (local app must not 429)
    const p = IDM_GATEWAY_PRESET
    await this.safeGctoac(
      gctoac,
      [
        'ddos',
        'policy',
        'set',
        '--rate-limit-max',
        String(p.rateLimitMax),
        '--rate-limit-ip-max',
        String(p.rateLimitIpMax),
        '--chat-burst-max',
        String(p.chatBurstMax),
        '--velocity-max-requests',
        String(p.velocityMaxRequests),
        '--max-concurrent-per-ip',
        String(p.maxConcurrentPerIp),
        '--rate-hit-threshold',
        String(p.rateHitThreshold),
        '--failed-auth-threshold',
        String(p.failedAuthThreshold),
        '--auto-ban',
        'off'
      ],
      20_000
    )

    // 4) Queue: high concurrency, not paused/draining
    await this.safeGctoac(gctoac, ['queue', 'undrain'], 15_000)
    await this.safeGctoac(gctoac, ['queue', 'resume'], 15_000)
    await this.safeGctoac(
      gctoac,
      [
        'queue',
        'policy',
        'set',
        '--enabled',
        'on',
        '--paused',
        'off',
        '--drain-mode',
        'off',
        '--global-concurrency',
        String(p.queueGlobalConcurrency),
        '--per-key-concurrency',
        String(p.queuePerKeyConcurrency),
        '--max-queue-depth',
        String(p.queueMaxDepth),
        '--max-queue-depth-per-key',
        String(p.queueMaxDepthPerKey),
        '--max-wait-ms',
        String(p.queueMaxWaitMs),
        '--max-attempts',
        String(p.queueMaxAttempts)
      ],
      20_000
    )

    // 5) Safety: agent-friendly (global safe off) + long timeout
    await this.safeGctoac(
      gctoac,
      [
        'settings',
        'set',
        '--global-safe',
        'off',
        '--timeout-ms',
        String(p.grokTimeoutMs),
        '--default-model',
        'grok-4.5'
      ],
      15_000
    )

    // 6) Every active API key → max rate + admin/agent (whatever key the app holds)
    await this.upgradeAllKeysToMax(gctoac)
  }

  /**
   * Write InstantDrama env defaults into ~/.gctoac/.env so cold starts
   * inherit max limits before any live policy reload.
   */
  private patchGctoacEnvFile(): void {
    try {
      const home = process.env.GCTOAC_HOME || join(homedir(), '.gctoac')
      const envPath = join(home, '.env')
      if (!existsSync(home)) mkdirSync(home, { recursive: true })
      const p = IDM_GATEWAY_PRESET
      const updates: Record<string, string> = {
        RATE_LIMIT_WINDOW_MS: String(p.rateLimitWindowMs),
        RATE_LIMIT_MAX: String(p.rateLimitMax),
        RATE_LIMIT_IP_MAX: String(p.rateLimitIpMax),
        CHAT_BURST_MAX: String(p.chatBurstMax),
        BLOCK_FAILED_AUTH_THRESHOLD: String(p.failedAuthThreshold),
        GROK_MAX_CONCURRENT: String(p.grokMaxConcurrent),
        GROK_TIMEOUT_MS: String(p.grokTimeoutMs),
        GROK_ALWAYS_APPROVE: 'true',
        GROK_SAFE_MODE: 'false',
        BODY_LIMIT: p.bodyLimit,
        UPLOAD_MAX_BYTES: String(p.uploadMaxBytes),
        PORT: String(this.port),
        HOST: '0.0.0.0'
      }
      let raw = existsSync(envPath) ? readFileSync(envPath, 'utf8') : ''
      for (const [key, val] of Object.entries(updates)) {
        const re = new RegExp(`^${key}=.*$`, 'm')
        if (re.test(raw)) {
          raw = raw.replace(re, `${key}=${val}`)
        } else {
          raw = raw.trimEnd() + (raw.endsWith('\n') || !raw ? '' : '\n') + `${key}=${val}\n`
        }
      }
      writeFileSync(envPath, raw.endsWith('\n') ? raw : raw + '\n', { mode: 0o600 })
    } catch {
      /* non-fatal */
    }
  }

  /** Update every listed API key to max rate + admin/agent + active. */
  private async upgradeAllKeysToMax(gctoacPath: string): Promise<void> {
    const { stdout, stderr } = await this.runGctoac(
      gctoacPath,
      ['key', 'list'],
      15_000
    )
    const text = `${stdout}\n${stderr}`
    const lines = text.split('\n')
    for (const line of lines) {
      const id = line.trim().split(/\s+/)[0]
      if (!id || !/^[0-9a-f-]{36}$/i.test(id)) continue
      try {
        await this.runGctoac(
          gctoacPath,
          [
            'key',
            'update',
            id,
            '-r',
            'admin',
            '-m',
            'agent',
            '--rate-limit',
            GrokGatewayService.MAX_KEY_RATE,
            '--active',
            'on'
          ],
          15_000
        )
      } catch {
        /* skip row */
      }
    }
  }

  private async safeGctoac(
    gctoacPath: string,
    args: string[],
    timeoutMs: number
  ): Promise<void> {
    try {
      await this.runGctoac(gctoacPath, args, timeoutMs)
    } catch {
      /* gateway may be mid-start or CLI flag unsupported */
    }
  }

  /**
   * Create a new InstantDrama-managed API key (plaintext printed once by gctoac).
   * Admin + agent + max rate so images/video work without user setup.
   */
  async createAppApiKey(): Promise<string | null> {
    const gctoac = this.resolveGctoacPath()
    if (!gctoac) return null
    try {
      try {
        await this.runGctoac(gctoac, ['seed'], 30_000)
      } catch {
        /* already seeded */
      }
      await this.applyIdmGatewayPreset({ force: true })
      const { stdout, stderr } = await this.runGctoac(
        gctoac,
        [
          'key',
          'create',
          '-n',
          GrokGatewayService.APP_KEY_NAME,
          '-r',
          'admin',
          '-m',
          'agent',
          // Max per-key cap (gctoac DTO); 0 blocks all in express-rate-limit v7
          '--rate-limit',
          GrokGatewayService.MAX_KEY_RATE
        ],
        30_000
      )
      const text = `${stdout}\n${stderr}`
      return GrokGatewayService.parseCreatedApiKey(text)
    } catch {
      return null
    }
  }

  private async sleep(ms: number): Promise<void> {
    await new Promise((r) => setTimeout(r, ms))
  }

  /**
   * Validate with a few short retries (key registry / gateway warm-up races).
   */
  private async validateApiKeyWithRetry(
    apiKey: string,
    attempts = 4,
    delayMs = 250
  ): Promise<boolean> {
    for (let i = 0; i < attempts; i++) {
      if (await this.validateApiKey(apiKey)) return true
      if (i < attempts - 1) await this.sleep(delayMs)
    }
    return false
  }

  /**
   * Start gateway (if needed), apply full InstantDrama preset,
   * and ensure a working API key for the app.
   * Never requires the user to paste a key.
   * Only returns apiKey when it actually validates against /v1/models.
   */
  async ensureRunningWithApiKey(
    existingKey?: string | null
  ): Promise<{ status: GrokGatewayStatus; apiKey: string | null; keyCreated: boolean }> {
    // ensureRunning already applies preset when online
    const status = await this.ensureRunning()
    if (
      status.state === 'gateway_missing' ||
      status.state === 'grok_build_missing'
    ) {
      // Do not claim key ready when gateway cannot serve it
      return { status, apiKey: null, keyCreated: false }
    }

    // Force one more pass after boot races (CLI policy TTL / mid-start)
    await this.applyIdmGatewayPreset({ force: true })

    const existing = existingKey?.trim() || ''
    if (existing && (await this.validateApiKeyWithRetry(existing))) {
      return {
        status: await this.getStatus(),
        apiKey: existing,
        keyCreated: false
      }
    }

    // Create up to 2 keys if parse/validate races (fresh install)
    for (let attempt = 0; attempt < 2; attempt++) {
      const created = await this.createAppApiKey()
      if (!created) continue
      if (await this.validateApiKeyWithRetry(created)) {
        return {
          status: await this.getStatus(),
          apiKey: created,
          keyCreated: true
        }
      }
    }

    // Never hand back a non-working key as "ready"
    return {
      status: await this.getStatus(),
      apiKey: null,
      keyCreated: false
    }
  }

  private async startInternal(): Promise<void> {
    const gctoac = this.resolveGctoacPath()
    if (!gctoac) {
      throw new AppError('VALIDATION', 'errors.gctoacNotFound')
    }

    // Patch env *before* start so process inherits max limits
    this.patchGctoacEnvFile()

    // Best-effort setup (idempotent)
    try {
      await this.runGctoac(gctoac, ['setup'], 60_000)
    } catch {
      /* setup may already be done */
    }

    // Prefer detached background start
    try {
      await this.runGctoac(gctoac, ['start', '--port', String(this.port)], 45_000)
    } catch (e) {
      // Fallback: spawn node on dist if bin wrapper fails
      const nodeEntry = this.resolveGctoacNodeEntry(gctoac)
      if (nodeEntry) {
        this.child = spawn(process.execPath, [nodeEntry, 'start', '--port', String(this.port)], {
          detached: true,
          stdio: 'ignore',
          env: { ...process.env },
          cwd: dirname(nodeEntry)
        })
        this.child.unref()
      } else {
        throw e
      }
    }
  }

  private resolveGctoacNodeEntry(gctoacPath: string): string | null {
    // If path is .bin/gctoac, resolve package main CLI
    const pkgCli = join(
      this.projectRoot,
      'node_modules',
      'grok-cli-to-openai-compatible',
      'dist',
      'cli',
      'index.js'
    )
    if (existsSync(pkgCli)) return pkgCli
    if (gctoacPath.endsWith('.js') && existsSync(gctoacPath)) return gctoacPath
    return null
  }

  private async runGctoac(
    gctoacPath: string,
    args: string[],
    timeoutMs: number
  ): Promise<{ stdout: string; stderr: string }> {
    const isJs = gctoacPath.endsWith('.js')
    const bin = isJs ? process.execPath : gctoacPath
    const fullArgs = isJs ? [gctoacPath, ...args] : args
    return execFileAsync(bin, fullArgs, {
      timeout: timeoutMs,
      env: { ...process.env },
      maxBuffer: 2 * 1024 * 1024
    })
  }

  /** Install hint URL for Grok Build */
  static grokBuildInstallUrl(): string {
    return 'https://x.ai/'
  }

  /** Official one-liner install (macOS / Linux). */
  static grokBuildInstallCommand(): string {
    return 'curl -fsSL https://x.ai/cli/install.sh | bash'
  }

  static gatewayDocsUrl(): string {
    return 'https://github.com/yanshekki/Grok-Cli-to-OpenAI-compatible'
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

/** Singleton for main process */
let instance: GrokGatewayService | null = null

export function getGrokGatewayService(): GrokGatewayService {
  if (!instance) {
    instance = new GrokGatewayService(DEFAULT_PORT, process.cwd())
  }
  return instance
}

export function isGrokGatewayPreset(provider: string | undefined | null): boolean {
  return !provider || provider === 'grok-gateway'
}

// Keep default base URL export for settings
void GROK_GATEWAY_BASE_URL
