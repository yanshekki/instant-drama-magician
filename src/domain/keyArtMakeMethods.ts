export type KeyArtMakeMethodId = 'fresh' | 'edit' | 'identity' | 'continue'

export type KeyArtMakeMethodDef = {
  id: KeyArtMakeMethodId
  titleKey: string
  badgeKey: string
  lockKey: string
  cameraKey: string
  materialsKey: string
  polishKey: string
  /** Own still may be the pixel edit base. */
  usesOwnEditBase: boolean
  /** Previous shot still is attached as continuity. */
  usesPreviousShot: boolean
}

export const KEY_ART_MAKE_METHODS: KeyArtMakeMethodDef[] = [
  {
    id: 'fresh',
    titleKey: 'methodFreshTitle',
    badgeKey: 'methodFreshBadge',
    lockKey: 'methodFreshLock',
    cameraKey: 'methodFreshCamera',
    materialsKey: 'methodFreshMaterials',
    polishKey: 'methodFreshPolish',
    usesOwnEditBase: false,
    usesPreviousShot: false
  },
  {
    id: 'edit',
    titleKey: 'methodEditTitle',
    badgeKey: 'methodEditBadge',
    lockKey: 'methodEditLock',
    cameraKey: 'methodEditCamera',
    materialsKey: 'methodEditMaterials',
    polishKey: 'methodEditPolish',
    usesOwnEditBase: true,
    usesPreviousShot: false
  },
  {
    id: 'identity',
    titleKey: 'methodIdentityTitle',
    badgeKey: 'methodIdentityBadge',
    lockKey: 'methodIdentityLock',
    cameraKey: 'methodIdentityCamera',
    materialsKey: 'methodIdentityMaterials',
    polishKey: 'methodIdentityPolish',
    usesOwnEditBase: false,
    usesPreviousShot: false
  },
  {
    id: 'continue',
    titleKey: 'methodContinueTitle',
    badgeKey: 'methodContinueBadge',
    lockKey: 'methodContinueLock',
    cameraKey: 'methodContinueCamera',
    materialsKey: 'methodContinueMaterials',
    polishKey: 'methodContinuePolish',
    usesOwnEditBase: false,
    usesPreviousShot: true
  }
]

const METHOD_IDS = new Set<string>(KEY_ART_MAKE_METHODS.map((m) => m.id))

export function coerceKeyArtMakeMethod(
  v?: string | null
): KeyArtMakeMethodId {
  if (v && METHOD_IDS.has(v)) return v as KeyArtMakeMethodId
  return 'fresh'
}

export function getKeyArtMakeMethod(
  v?: string | null
): KeyArtMakeMethodDef {
  const id = coerceKeyArtMakeMethod(v)
  return KEY_ART_MAKE_METHODS.find((m) => m.id === id)!
}
