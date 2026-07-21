/**
 * registerScenesCrud
 */
import type { HandlerContext } from '../context'
import type { CreateSceneInput, UpdateSceneInput } from '../../../types/domain'

export function registerScenesCrud(ctx: HandlerContext): void {
  const {
    reg,
    scenes
  } = ctx

reg(
  'scenes:list',
  (
    async (
      storyIdOrOpts?: string | { storyId?: string; q?: string; forStory?: boolean }
    ) => {
      if (typeof storyIdOrOpts === 'string' && storyIdOrOpts) {
        return scenes().listForStory(storyIdOrOpts)
      }
      if (
        storyIdOrOpts &&
        typeof storyIdOrOpts === 'object' &&
        storyIdOrOpts.forStory &&
        storyIdOrOpts.storyId
      ) {
        return scenes().listForStory(storyIdOrOpts.storyId)
      }
      const q =
        storyIdOrOpts && typeof storyIdOrOpts === 'object'
          ? storyIdOrOpts.q
          : undefined
      return scenes().list({ q })
    }
  )
)

reg(
  'scenes:create',
  (async ( input: CreateSceneInput) => scenes().create(input))
)

reg(
  'scenes:update',
  (async ( id: string, data: UpdateSceneInput) => scenes().update(id, data))
)

reg(
  'scenes:delete',
  (async ( id: string) => scenes().delete(id))
)
}
