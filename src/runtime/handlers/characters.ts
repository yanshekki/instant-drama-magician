/**
 * Characters IPC handlers (CRUD, wardrobe, AI fill, soul, sheet, intro video, costume swap).
 */
import type { HandlerContext } from './context'
import { registerCharactersCrud } from './characters/crud'
import { registerCharactersWardrobe } from './characters/wardrobe'
import { registerCharactersAiFill } from './characters/aiFill'
import { registerCharactersSoul } from './characters/soul'
import { registerCharactersSheet } from './characters/sheet'
import { registerCharactersIntroVideo } from './characters/introVideo'
import { registerCharactersCostumeSwap } from './characters/costumeSwap'

export function registerCharactersHandlers(ctx: HandlerContext): void {
  registerCharactersCrud(ctx)
  registerCharactersWardrobe(ctx)
  registerCharactersAiFill(ctx)
  registerCharactersSoul(ctx)
  registerCharactersSheet(ctx)
  registerCharactersIntroVideo(ctx)
  registerCharactersCostumeSwap(ctx)
}
