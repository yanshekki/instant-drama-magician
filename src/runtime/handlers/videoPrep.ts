/**
 * Video prep IPC handlers (create / regenStill / confirm).
 */
import type { HandlerContext } from './context'
import { registerVideoPrepCreate } from './videoPrep/create'
import { registerVideoPrepRegenStill } from './videoPrep/regenStill'
import { registerVideoPrepConfirm } from './videoPrep/confirm'

export function registerVideoprepHandlers(ctx: HandlerContext): void {
  registerVideoPrepCreate(ctx)
  registerVideoPrepRegenStill(ctx)
  registerVideoPrepConfirm(ctx)
}
