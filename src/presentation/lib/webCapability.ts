/**
 * Web runtime UI capability gates — hide/disable actions that need OS desktop.
 */
import { isWebRuntime } from '../../lib/api'

export type WebCapability =
  | 'filePickUpload'
  | 'openExportFolder'
  | 'nativeUpdates'
  | 'webServerAdmin'
  | 'rebuildMenu'

/** True when the capability is available in the current runtime. */
export function canUse(cap: WebCapability): boolean {
  if (!isWebRuntime()) {
    // Desktop Electron: all capabilities present
    return true
  }
  switch (cap) {
    case 'filePickUpload':
      // Browser file input + /api/upload (httpAppClient)
      return true
    case 'openExportFolder':
    case 'nativeUpdates':
    case 'webServerAdmin':
    case 'rebuildMenu':
      return false
    default:
      return false
  }
}

export function isWebUi(): boolean {
  return isWebRuntime()
}
