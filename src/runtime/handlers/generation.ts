/**
 * Domain IPC handlers (split for maintainability).
 */
import type { HandlerContext } from './context'

export function registerGenerationHandlers(ctx: HandlerContext): void {
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

// ─── Generation ────────────────────────────────────────────
reg(
  'generation:run',
  (
    async (
      storyId: string,
      opts?: { onlyFailedVideos?: boolean; interactiveVideo?: boolean }
    ) => {
      activity.append({
        kind: 'generation',
        message: opts?.onlyFailedVideos
          ? 'retry failed'
          : opts?.interactiveVideo
            ? 'run pipeline (interactive video)'
            : 'run pipeline',
        storyId
      })
      const result = await generation().run(
        storyId,
        (payload) => {
          host.emitGenerationProgress?.(payload)
        },
        opts
      )
      const degraded = result.steps.some((s) => s.degraded)
      settingsStore.save({ lastGenerationDegraded: degraded })
      activity.append({
        kind: 'generation',
        message: result.success ? 'pipeline ok' : 'pipeline failed',
        storyId,
        meta: { degraded, steps: result.steps.length }
      })
      return result
    }
  )
)

reg(
  'generation:cancel',
  (async () => {
    generation().cancel()
    activity.append({ kind: 'generation', message: 'cancelled' })
    return { ok: true as const }
  })
)

/** Last progress snapshot (push events on electron via host.emitGenerationProgress). */
reg(
  'generation:progress',
  (async () => host.getLastGenerationProgress?.() ?? null)
)

reg(
  'generation:runClip',
  (async (
    storyId: string,
    entryId: string,
    opts?: { revisionPrompt?: string | null }
  ) => {
    activity.append({
      kind: 'generation',
      message: 'run clip',
      storyId,
      meta: {
        entryId,
        hasRevision: Boolean(opts?.revisionPrompt?.trim())
      }
    })
    const result = await generation().generateClip(
      storyId,
      entryId,
      (payload) => {
        host.emitGenerationProgress?.(payload)
      },
      opts
    )
    if (result.degraded) {
      settingsStore.save({ lastGenerationDegraded: true })
    }
    activity.append({
      kind: 'generation',
      message: result.degraded ? 'clip stub' : 'clip ok',
      storyId,
      meta: { entryId }
    })
    return result
  })
)

reg(
  'ai:status',
  (async () => ctx.aiClient.getStatus())
)

}
