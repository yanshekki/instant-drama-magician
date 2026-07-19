/**
 * Shared CLI types — human + agent (OpenClaw / Hermes) friendly.
 */

export type OutputMode = 'human' | 'json'

export interface CliConfigFile {
  url?: string
  token?: string
  dataDir?: string
  defaultOutput?: OutputMode
  profiles?: Record<
    string,
    {
      url?: string
      token?: string
      dataDir?: string
    }
  >
}

export interface CliGlobalOptions {
  json: boolean
  pretty: boolean
  quiet: boolean
  url: string | null
  token: string | null
  local: boolean
  dataDir: string | null
  profile: string | null
  yes: boolean
  help: boolean
}

export type ClientMode = 'remote' | 'local'

export interface InvokeResult {
  ok: true
  channel: string
  result: unknown
  meta: {
    ms: number
    mode: ClientMode
  }
}

export interface InvokeErrorBody {
  ok: false
  channel?: string
  error: {
    code: string
    message: string
    details?: unknown
  }
  meta?: {
    ms: number
    mode: ClientMode
  }
}

export interface IdmClient {
  mode: ClientMode
  invoke: (channel: string, args?: unknown[]) => Promise<unknown>
  channels: () => Promise<string[]>
  dispose?: () => Promise<void>
  /** Extra info for doctor */
  describe: () => Record<string, unknown>
}

export const EXIT = {
  OK: 0,
  ERROR: 1,
  USAGE: 2,
  UNAUTH: 3,
  CONNECT: 4
} as const
