/**
 * Domain IPC handlers (split for maintainability).
 */
import type { CreateTimelineEntryInput, UpdateTimelineEntryInput } from '../../types/domain'
import type { HandlerContext } from './context'

export function registerTimelineHandlers(ctx: HandlerContext): void {
  const {
    reg,
    timeline
  } = ctx

// ─── Timeline ──────────────────────────────────────────────
reg(
  'timeline:list',
  (async ( storyId: string) => timeline().list(storyId))
)
reg(
  'timeline:create',
  (async ( input: CreateTimelineEntryInput) => timeline().create(input))
)
reg(
  'timeline:update',
  (async ( id: string, data: UpdateTimelineEntryInput) =>
    timeline().update(id, data)
  )
)
reg(
  'timeline:delete',
  (async ( id: string) => timeline().delete(id))
)
reg(
  'timeline:reorder',
  (async ( storyId: string, orderedIds: string[]) =>
    timeline().reorder(storyId, orderedIds)
  )
)

reg(
  'timeline:setMedia',
  (
    async (
      id: string,
      data: {
        mediaPath?: string | null
        mediaStatus: 'EMPTY' | 'QUEUED' | 'GENERATING' | 'READY' | 'FAILED'
        mediaError?: string | null
      }
    ) => timeline().setMedia(id, data)
  )
)

}
