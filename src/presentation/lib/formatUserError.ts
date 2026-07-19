/**
 * Map IPC / job error strings to the active UI language.
 * Main process stores stable keys (errors.*) or English; UI translates.
 */

type TFn = (key: string, opts?: Record<string, unknown>) => string

/** Stable machine keys thrown as AppError.message from main/IPC. */
const ERROR_KEYS = new Set([
  'errors.costumeNoBaseImage',
  'errors.costumeSwapNoBase',
  'errors.sourceImageRequired',
  'errors.videoUnavailable',
  'errors.ideaOrDraftRequired',
  'errors.cannotRemoveCharacterOnTimeline',
  'errors.cannotRemoveSceneOnTimeline',
  'errors.cannotRemovePropOnTimeline',
  'errors.cannotRemoveActionOnTimeline',
  'errors.characterNameRequired',
  'errors.nameRequired',
  'errors.descriptionRequired',
  'errors.storyIdRequired',
  'errors.sceneIdRequired',
  'errors.propIdRequired',
  'errors.actionIdRequired',
  'errors.characterIdRequired',
  'errors.costumeIdRequired',
  'errors.storyNotFound',
  'errors.timelineEntryNotFound',
  'errors.timelineBeatNotFound',
  'errors.sceneNotLinked',
  'errors.propNotLinked',
  'errors.draftNotFound',
  'errors.mediaNotFound',
  'errors.pathOutsideDataDir',
  'errors.cancelled',
  'errors.unauthorized',
  'errors.sourceSceneNoGallery',
  'errors.atmosphereRequired',
  'errors.costumeDescRequired',
  'errors.ideaOrImageRequired',
  'errors.invalidSoulUrl',
  'errors.soulFileMustBeMd',
  'errors.invalidSoulHubId',
  'errors.networkFailed',
  'errors.aiUnavailable'
])

/** Legacy English → i18n key (jobs already failed before key migration). */
const LEGACY_EN_TO_KEY: Array<{ re: RegExp; key: string }> = [
  {
    re: /no base image for costume dress/i,
    key: 'errors.costumeNoBaseImage'
  },
  {
    re: /no base image for costume swap/i,
    key: 'errors.costumeSwapNoBase'
  },
  {
    re: /source image is required/i,
    key: 'errors.sourceImageRequired'
  },
  {
    re: /video generation is not available|video generation is unavailable/i,
    key: 'errors.videoUnavailable'
  },
  {
    re: /idea or draft required/i,
    key: 'errors.ideaOrDraftRequired'
  },
  {
    re: /cannot remove character:.*timeline/i,
    key: 'errors.cannotRemoveCharacterOnTimeline'
  },
  {
    re: /cannot remove scene:.*timeline/i,
    key: 'errors.cannotRemoveSceneOnTimeline'
  },
  {
    re: /cannot remove prop:.*timeline/i,
    key: 'errors.cannotRemovePropOnTimeline'
  },
  {
    re: /cannot remove action:.*timeline/i,
    key: 'errors.cannotRemoveActionOnTimeline'
  },
  {
    re: /character name is required/i,
    key: 'errors.characterNameRequired'
  },
  {
    re: /\bname is required\b/i,
    key: 'errors.nameRequired'
  },
  {
    re: /description is required/i,
    key: 'errors.descriptionRequired'
  },
  {
    re: /storyid is required/i,
    key: 'errors.storyIdRequired'
  },
  {
    re: /story not found/i,
    key: 'errors.storyNotFound'
  },
  {
    re: /timeline entry not found/i,
    key: 'errors.timelineEntryNotFound'
  },
  {
    re: /timeline beat not found/i,
    key: 'errors.timelineBeatNotFound'
  },
  {
    re: /scene not linked/i,
    key: 'errors.sceneNotLinked'
  },
  {
    re: /prop is not linked|prop not linked/i,
    key: 'errors.propNotLinked'
  },
  {
    re: /draft .+ not found|draft sheet file not found|draft plate file not found|draft cover file not found/i,
    key: 'errors.draftNotFound'
  },
  {
    re: /media (file )?not found/i,
    key: 'errors.mediaNotFound'
  },
  {
    re: /path outside data directory/i,
    key: 'errors.pathOutsideDataDir'
  },
  {
    re: /^cancelled$/i,
    key: 'errors.cancelled'
  },
  {
    re: /^unauthorized$/i,
    key: 'errors.unauthorized'
  },
  {
    re: /source scene has no gallery/i,
    key: 'errors.sourceSceneNoGallery'
  },
  {
    re: /atmosphere description is required/i,
    key: 'errors.atmosphereRequired'
  },
  {
    re: /costume description is required/i,
    key: 'errors.costumeDescRequired'
  },
  {
    re: /idea, draft, or reference image is required|idea, profile draft|idea, draft, reference image/i,
    key: 'errors.ideaOrImageRequired'
  },
  {
    re: /url must start with http/i,
    key: 'errors.invalidSoulUrl'
  },
  {
    re: /selected file must be a \.md/i,
    key: 'errors.soulFileMustBeMd'
  },
  {
    re: /invalid soulmd-hub id/i,
    key: 'errors.invalidSoulHubId'
  },
  {
    // Browser / undici / TypeError network failures (image API, web server, etc.)
    re: /failed to fetch|fetch failed|networkerror|load failed|net::err_/i,
    key: 'errors.networkFailed'
  },
  {
    re: /cannot reach the ai gateway|cannot reach.*gateway/i,
    key: 'errors.aiUnavailable'
  }
]

export function formatUserError(
  message: string | null | undefined,
  t: TFn,
  fallbackKey = 'aiJobs.failed'
): string {
  const raw = (message ?? '').trim()
  if (!raw) return t(fallbackKey)

  if (raw === 'interrupted_on_reload' || /interrupted/i.test(raw)) {
    return t('aiJobs.interruptedReload')
  }

  // Direct i18n key
  if (ERROR_KEYS.has(raw) || raw.startsWith('errors.')) {
    const tr = t(raw)
    if (tr !== raw) return tr
  }

  // "errors.foo — details" combined form from AiJobsContext
  const split = raw.match(/^(errors\.[a-zA-Z0-9_.]+)\s*[—\-]\s*(.+)$/)
  if (split) {
    const tr = t(split[1])
    if (tr !== split[1]) {
      return split[2] ? `${tr} — ${split[2]}` : tr
    }
  }

  for (const { re, key } of LEGACY_EN_TO_KEY) {
    if (re.test(raw)) {
      const tr = t(key)
      if (tr !== key) return tr
    }
  }

  const lower = raw.toLowerCase()
  if (
    /no_image_in_sandbox|no image file was found in the sandbox|image_no_sandbox/.test(
      lower
    )
  ) {
    return t('aiJobs.errImageNoSandbox')
  }
  if (/imagesapi|image api is disabled|image_api_off/.test(lower)) {
    return t('aiJobs.errImageApiOff')
  }
  if (/failed to fetch|fetch failed|networkerror|load failed|net::err_/.test(lower)) {
    const tr = t('errors.networkFailed')
    if (tr !== 'errors.networkFailed') return tr
  }

  return raw
}
