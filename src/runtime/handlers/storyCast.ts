/**
 * Domain IPC handlers (split for maintainability).
 */
import { StoryCastService } from '../../application/services'
import type { HandlerContext } from './context'

export function registerStorycastHandlers(ctx: HandlerContext): void {
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

// ─── Story cast (M2M link/unlink) ──────────────────────────
const cast = (): StoryCastService => new StoryCastService(host.getPrisma())
reg(
  'stories:linkCharacter',
  (
    async (
      payload: {
        storyId: string
        characterId: string
        roleNote?: string
        costumeId?: string | null
      }
    ) =>
      cast().linkCharacter(payload.storyId, payload.characterId, {
        roleNote: payload.roleNote,
        costumeId: payload.costumeId
      })
  )
)
reg(
  'stories:setCharacterCostume',
  (
    async (
      payload: {
        storyId: string
        characterId: string
        costumeId: string | null
      }
    ) =>
      cast().setCharacterCostume(
        payload.storyId,
        payload.characterId,
        payload.costumeId
      )
  )
)
reg(
  'stories:unlinkCharacter',
  (
    async ( payload: { storyId: string; characterId: string }) =>
      cast().unlinkCharacter(payload.storyId, payload.characterId)
  )
)
reg(
  'stories:linkScene',
  (
    async (
      payload: { storyId: string; sceneId: string; sceneNumber?: number }
    ) =>
      cast().linkScene(payload.storyId, payload.sceneId, {
        sceneNumber: payload.sceneNumber
      })
  )
)
reg(
  'stories:unlinkScene',
  (
    async ( payload: { storyId: string; sceneId: string }) =>
      cast().unlinkScene(payload.storyId, payload.sceneId)
  )
)
reg(
  'stories:linkProp',
  (
    async ( payload: { storyId: string; propId: string }) =>
      cast().linkProp(payload.storyId, payload.propId)
  )
)
reg(
  'stories:unlinkProp',
  (
    async ( payload: { storyId: string; propId: string }) =>
      cast().unlinkProp(payload.storyId, payload.propId)
  )
)
reg(
  'stories:linkAction',
  (
    async (payload: { storyId: string; actionId: string }) =>
      cast().linkAction(payload.storyId, payload.actionId)
  )
)
reg(
  'stories:unlinkAction',
  (
    async (payload: { storyId: string; actionId: string }) =>
      cast().unlinkAction(payload.storyId, payload.actionId)
  )
)
reg(
  'stories:listCast',
  (async ( storyId: string) => {
    const c = cast()
    return {
      characters: await c.listCharactersForStory(storyId),
      scenes: await c.listScenesForStory(storyId),
      props: await c.listPropsForStory(storyId),
      actions: await c.listActionsForStory(storyId)
    }
  })
)

}
