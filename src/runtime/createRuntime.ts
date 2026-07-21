/**
 * Shared application runtime for Electron main, HTTP web server, and CLI.
 * Owns dataDir, Prisma, settings, media root, and full channel → handler map.
 */
import { existsSync, mkdirSync, readFileSync, statSync } from 'fs'
import { join, resolve as pathResolve, sep } from 'path'
import { PrismaClient } from '../types/prisma'
import { SettingsStore } from '../infrastructure/settings/SettingsStore'
import { ActivityLog } from '../infrastructure/activity/ActivityLog'
import { MediaStore } from '../infrastructure/media/MediaStore'
import { normalizeSqliteDateTimes } from '../infrastructure/db/normalizeSqliteDateTimes'
import { AppError, toAppError } from '../types/errors'
import { readFile } from 'fs/promises'
import { registerAllHandlers } from './registerAllHandlers'
import type { HandlerHost } from './HandlerHost'
import { createHeadlessDialog, createHeadlessShell } from './adapters'

/**
 * Channel handlers are registered with concrete parameter types; IPC always
 * passes a loosely typed arg list. Use `any[]` so typed handlers assign cleanly
 * under strictFunctionTypes (unknown[] would reject every typed callback).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type RuntimeHandler = (...args: any[]) => Promise<unknown> | unknown

export interface RuntimeOptions {
  dataDir: string
  /** Override DB path; default file:$dataDir/instant-drama.db */
  databaseUrl?: string
  appVersion?: string
  platform?: string
  isPackaged?: boolean
  /** Override host adapters (Electron injects real dialog/shell). */
  hostOverrides?: Partial<HandlerHost>
}

export interface AppRuntime {
  dataDir: string
  mediaRoot: string
  settingsPath: string
  prisma: PrismaClient
  settingsStore: SettingsStore
  activity: ActivityLog
  media: MediaStore
  invoke: (channel: string, args?: unknown[]) => Promise<unknown>
  hasChannel: (channel: string) => boolean
  channels: () => string[]
  resolveMediaPath: (filePath: string) => string | null
  dispose: () => Promise<void>
  /** Underlying host (for advanced wiring). */
  host: HandlerHost
}

function ensureDir(p: string): void {
  mkdirSync(p, { recursive: true })
}

export function createRuntime(opts: RuntimeOptions): AppRuntime {
  const dataDir = pathResolve(opts.dataDir)
  ensureDir(dataDir)
  const mediaRoot = join(dataDir, 'media')
  ensureDir(mediaRoot)
  ensureDir(join(dataDir, 'logs'))
  ensureDir(join(mediaRoot, 'uploads'))
  ensureDir(join(dataDir, 'exports'))

  const databaseUrl =
    opts.databaseUrl ||
    process.env.DATABASE_URL ||
    `file:${join(dataDir, 'instant-drama.db')}`
  process.env.DATABASE_URL = databaseUrl

  const ownsPrisma = !opts.hostOverrides?.getPrisma
  const prisma: PrismaClient = ownsPrisma
    ? new PrismaClient({
        datasources: { db: { url: databaseUrl } }
      })
    : (null as unknown as PrismaClient)

  /** Wait before first channel call so TEXT/INTEGER DateTime mix is fixed. */
  const dbReady: Promise<void> = ownsPrisma
    ? prisma
        .$queryRaw`SELECT 1`
        .then(() => normalizeSqliteDateTimes(prisma))
        .then(() => undefined)
        .catch(() => undefined)
    : Promise.resolve()

  const settingsStore =
    opts.hostOverrides?.settingsStore ??
    new SettingsStore(SettingsStore.defaultPath(dataDir))
  const activity =
    opts.hostOverrides?.activity ??
    new ActivityLog(ActivityLog.defaultPath(dataDir))
  const media = new MediaStore(mediaRoot)

  let lastProgress: unknown = null

  const baseHost: HandlerHost = {
    mode: 'headless',
    userData: dataDir,
    mediaRoot,
    appVersion:
      opts.appVersion ?? process.env.npm_package_version ?? '1.0.0',
    isPackaged: Boolean(opts.isPackaged),
    platform: opts.platform ?? process.platform,
    getPrisma: () => {
      if (opts.hostOverrides?.getPrisma) {
        return opts.hostOverrides.getPrisma()
      }
      return prisma
    },
    settingsStore,
    activity,
    dialog: createHeadlessDialog(),
    shell: createHeadlessShell(),
    getMainWindow: () => null,
    emitGenerationProgress: (payload) => {
      lastProgress = payload
    },
    getLastGenerationProgress: () => lastProgress
  }

  const host: HandlerHost = {
    ...baseHost,
    ...opts.hostOverrides,
    getPrisma: baseHost.getPrisma,
    settingsStore,
    activity,
    emitGenerationProgress:
      opts.hostOverrides?.emitGenerationProgress ??
      baseHost.emitGenerationProgress,
    getLastGenerationProgress:
      opts.hostOverrides?.getLastGenerationProgress ??
      (() => lastProgress)
  }

  const handlers = new Map<string, RuntimeHandler>()
  const reg = (channel: string, fn: RuntimeHandler): void => {
    handlers.set(channel, fn)
  }

  registerAllHandlers(reg, host)

  // Headless/web-friendly overrides for preview URLs (do not break electron)
  if (host.mode === 'headless') {
    reg('media:toPreviewUrl', async (filePath) => {
      const p = String(filePath ?? '')
      if (!p || !existsSync(p)) {
        throw new AppError('NOT_FOUND', `Media not found: ${p}`)
      }
      const resolved = pathResolve(p)
      const root = pathResolve(mediaRoot)
      const data = pathResolve(dataDir)
      const ok =
        resolved.startsWith(root + sep) ||
        resolved === root ||
        resolved.startsWith(data + sep) ||
        resolved === data
      if (!ok) {
        throw new AppError('VALIDATION', 'errors.pathOutsideDataDir')
      }
      return {
        url: `/api/media?p=${encodeURIComponent(resolved)}`,
        filePath: resolved
      }
    })

    reg('app:getInfo', async () => ({
      version: host.appVersion,
      name: 'InstantDrama Magician',
      electron: 'headless',
      userData: dataDir,
      mediaRoot,
      isPackaged: host.isPackaged,
      platform: host.platform,
      runtime: 'headless',
      channels: handlers.size
    }))
  }

  activity.append({
    kind: 'app',
    level: 'info',
    message: 'runtime_created',
    meta: { dataDir, mediaRoot, channels: handlers.size, mode: host.mode }
  })

  const resolveMediaPath = (filePath: string): string | null => {
    try {
      const resolved = pathResolve(decodeURIComponent(filePath))
      const root = pathResolve(mediaRoot)
      const data = pathResolve(dataDir)
      const ok =
        resolved.startsWith(root + sep) ||
        resolved === root ||
        resolved.startsWith(data + sep) ||
        resolved === data
      if (!ok || !existsSync(resolved)) return null
      const st = statSync(resolved)
      if (!st.isFile()) return null
      return resolved
    } catch {
      return null
    }
  }

  const invoke = async (
    channel: string,
    args: unknown[] = []
  ): Promise<unknown> => {
    await dbReady
    const fn = handlers.get(channel)
    if (!fn) {
      throw new AppError(
        'NOT_FOUND',
        `API channel not available: ${channel}`,
        `Registered channels: ${handlers.size}. Use idm channels list.`
      )
    }
    try {
      return await fn(...args)
    } catch (err) {
      const body = toAppError(err)
      throw new AppError(body.code, body.message, body.details)
    }
  }

  return {
    dataDir,
    mediaRoot,
    settingsPath: settingsStore.path,
    prisma: ownsPrisma ? prisma : host.getPrisma(),
    settingsStore,
    activity,
    media,
    invoke,
    hasChannel: (c) => handlers.has(c),
    channels: () => [...handlers.keys()].sort(),
    resolveMediaPath,
    host,
    dispose: async () => {
      if (ownsPrisma) {
        await prisma.$disconnect()
      }
    }
  }
}

/** Read media file for HTTP response. */
export function readMediaFile(absPath: string): Buffer {
  return readFileSync(absPath)
}

export async function readMediaFileAsync(absPath: string): Promise<Buffer> {
  return readFile(absPath)
}
