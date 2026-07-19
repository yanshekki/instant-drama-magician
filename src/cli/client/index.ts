import type { CliGlobalOptions, IdmClient } from '../types'
import { createLocalClient } from './local'
import { createRemoteClient } from './remote'

/**
 * Resolve client:
 * - --local or no URL → local headless runtime
 * - URL set (and not --local) → remote HTTP
 */
export async function resolveClient(
  globals: CliGlobalOptions
): Promise<IdmClient> {
  if (globals.local || !globals.url) {
    return createLocalClient({ dataDir: globals.dataDir })
  }
  return createRemoteClient({
    url: globals.url,
    token: globals.token
  })
}
