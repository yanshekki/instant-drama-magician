/**
 * registerCharactersCrud
 */
import type { HandlerContext } from '../context'
import type { CreateCharacterInput, UpdateCharacterInput } from '../../../types/domain'

export function registerCharactersCrud(ctx: HandlerContext): void {
  const {
    reg,
    characters
  } = ctx

reg(
  'characters:list',
  (
    async (
      storyIdOrOpts?: string | { storyId?: string; q?: string; forStory?: boolean }
    ) => {
      // Back-compat: list(storyId) → listForStory; list() / list({q}) → global
      if (typeof storyIdOrOpts === 'string' && storyIdOrOpts) {
        return characters().listForStory(storyIdOrOpts)
      }
      if (
        storyIdOrOpts &&
        typeof storyIdOrOpts === 'object' &&
        storyIdOrOpts.forStory &&
        storyIdOrOpts.storyId
      ) {
        return characters().listForStory(storyIdOrOpts.storyId)
      }
      const q =
        storyIdOrOpts && typeof storyIdOrOpts === 'object'
          ? storyIdOrOpts.q
          : undefined
      return characters().list({ q })
    }
  )
)

reg(
  'characters:get',
  (async (id: string) => characters().get(id))
)

reg(
  'characters:create',
  (async ( input: CreateCharacterInput) => characters().create(input))
)

reg(
  'characters:update',
  (async ( id: string, data: UpdateCharacterInput) =>
    characters().update(id, data)
  )
)

reg(
  'characters:delete',
  (async ( id: string) => characters().delete(id))
)
/** Suggest wardrobe + art style from story plot (chosen story + segment). */
}
