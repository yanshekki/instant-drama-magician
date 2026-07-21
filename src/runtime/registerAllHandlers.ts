/**
 * Full channel registry shared by Electron, web server, and CLI.
 * Handlers are split by domain under ./handlers/*
 */
import type { RuntimeHandler } from './createRuntime'
import type { HandlerHost } from './HandlerHost'
import { createHandlerContext } from './handlers/context'
import { registerStoriesHandlers } from './handlers/stories'
import { registerCharactersHandlers } from './handlers/characters'
import { registerSoulsHandlers } from './handlers/souls'
import { registerScenesHandlers } from './handlers/scenes'
import { registerStorycastHandlers } from './handlers/storyCast'
import { registerPropsHandlers } from './handlers/props'
import { registerActionsHandlers } from './handlers/actions'
import { registerCostumesHandlers } from './handlers/costumes'
import { registerVideoprepHandlers } from './handlers/videoPrep'
import { registerTimelineHandlers } from './handlers/timeline'
import { registerAdvancedprepHandlers } from './handlers/advancedPrep'
import { registerGenerationHandlers } from './handlers/generation'
import { registerGatewayHandlers } from './handlers/gateway'
import { registerSettingsHandlers } from './handlers/settings'
import { registerWebserverHandlers } from './handlers/webServer'
import { registerShellHandlers } from './handlers/shell'
import { registerMediaHandlers } from './handlers/media'
import { registerUpdatesHandlers } from './handlers/updates'
import { registerActivityHandlers } from './handlers/activity'
import { registerProjectbackupHandlers } from './handlers/projectBackup'
import { registerAppBackupHandlers } from './handlers/appBackup'

export function registerAllHandlers(
  reg: (channel: string, fn: RuntimeHandler) => void,
  host: HandlerHost
): void {
  const ctx = createHandlerContext(reg, host)
  host.activity.append({
    kind: 'app',
    level: 'info',
    message: 'handlers_registered',
    meta: { userData: host.userData, mode: host.mode }
  })

  registerStoriesHandlers(ctx)
  registerCharactersHandlers(ctx)
  registerSoulsHandlers(ctx)
  registerScenesHandlers(ctx)
  registerStorycastHandlers(ctx)
  registerPropsHandlers(ctx)
  registerActionsHandlers(ctx)
  registerCostumesHandlers(ctx)
  registerVideoprepHandlers(ctx)
  registerTimelineHandlers(ctx)
  registerAdvancedprepHandlers(ctx)
  registerGenerationHandlers(ctx)
  registerGatewayHandlers(ctx)
  registerSettingsHandlers(ctx)
  registerWebserverHandlers(ctx)
  registerShellHandlers(ctx)
  registerMediaHandlers(ctx)
  registerUpdatesHandlers(ctx)
  registerActivityHandlers(ctx)
  registerProjectbackupHandlers(ctx)
  registerAppBackupHandlers(ctx)
}

export { createHandlerContext } from './handlers/context'
export type { HandlerContext } from './handlers/context'
