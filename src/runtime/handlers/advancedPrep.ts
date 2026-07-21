/**
 * Domain IPC handlers (split for maintainability).
 */
import type { HandlerContext } from './context'

export function registerAdvancedprepHandlers(ctx: HandlerContext): void {
  const {
    reg,
    host,
    stories,
    characters,
    scenes,
    props,
    actions,
    costumes,
    timeline,
    generation,
    rebindAi,
    mediaRoot,
    activity,
    userDataPath,
    settingsStore
  } = ctx

// ─── Advanced prep (cast looks + storyboard stills) ────────
reg(
  'timeline:getAdvancedPrep',
  (async ( storyId: string) => {
    const { AdvancedPrepService } = await import(
      '../../application/services/AdvancedPrepService'
    )
    const svc = new AdvancedPrepService(
      host.getPrisma(),
      generation().getMediaStore(),
      () => ctx.aiClient as never,
      () => ctx.settings
    )
    return svc.getSnapshot(storyId)
  })
)
reg(
  'timeline:setCastPrep',
  (
    async (
      storyId: string,
      prep: { version?: number; characters?: Record<string, unknown> }
    ) => {
      const {
        parseStoryCastPrep,
        serializeStoryCastPrep
      } = await import('../../domain/advancedPrep')
      const store = generation().getMediaStore()
      const normalized = parseStoryCastPrep(JSON.stringify(prep ?? {}))
      store.writeStoryCastPrepJson(
        storyId,
        serializeStoryCastPrep(normalized)
      )
      return normalized
    }
  )
)
reg(
  'timeline:clearEntryStill',
  (async ( storyId: string, entryId: string) => {
    const { AdvancedPrepService } = await import(
      '../../application/services/AdvancedPrepService'
    )
    const svc = new AdvancedPrepService(
      host.getPrisma(),
      generation().getMediaStore(),
      () => ctx.aiClient as never,
      () => ctx.settings
    )
    return svc.clearEntryStill(storyId, entryId)
  })
)
reg(
  'videoPrep:openFromStill',
  (
    async (
      payload: {
        storyId: string
        entryId: string
        locale?: 'zh-HK' | 'en'
        forcePolish?: boolean
      }
    ) => {
      const { AdvancedPrepService } = await import(
        '../../application/services/AdvancedPrepService'
      )
      const svc = new AdvancedPrepService(
        host.getPrisma(),
        generation().getMediaStore(),
        () => ctx.aiClient as never,
        () => ctx.settings
      )
      return svc.openFromStill({
        storyId: payload.storyId,
        entryId: payload.entryId,
        locale: payload.locale,
        forcePolish: payload.forcePolish
      })
    }
  )
)

}
