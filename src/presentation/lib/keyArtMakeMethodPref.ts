import {
  coerceKeyArtMakeMethod,
  type KeyArtMakeMethodId
} from '../../domain/keyArtMakeMethods'

export const KEY_ART_MAKE_METHOD_KEY = 'idm.keyArtMakeMethod.v1'

function storage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

export function readKeyArtMakeMethod(): KeyArtMakeMethodId {
  try {
    return coerceKeyArtMakeMethod(storage()?.getItem(KEY_ART_MAKE_METHOD_KEY))
  } catch {
    return 'fresh'
  }
}

export function writeKeyArtMakeMethod(method: KeyArtMakeMethodId): void {
  try {
    storage()?.setItem(KEY_ART_MAKE_METHOD_KEY, method)
  } catch {
    /* ignore */
  }
}
