/**
 * Scenes IPC handlers (CRUD, AI fill, plate, intro video, atmosphere, gallery).
 */
import type { HandlerContext } from './context'
import { registerScenesCrud } from './scenes/crud'
import { registerScenesAiFill } from './scenes/aiFill'
import { registerScenesPlate } from './scenes/plate'
import { registerScenesIntroVideo } from './scenes/introVideo'
import { registerScenesAtmosphere } from './scenes/atmosphere'
import { registerScenesGallery } from './scenes/gallery'

export function registerScenesHandlers(ctx: HandlerContext): void {
  registerScenesCrud(ctx)
  registerScenesAiFill(ctx)
  registerScenesPlate(ctx)
  registerScenesIntroVideo(ctx)
  registerScenesAtmosphere(ctx)
  registerScenesGallery(ctx)
}
