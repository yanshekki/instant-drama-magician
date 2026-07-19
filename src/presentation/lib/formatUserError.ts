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
  'errors.ideaOrDraftRequired'
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
    re: /video generation is not available/i,
    key: 'errors.videoUnavailable'
  },
  {
    re: /idea or draft required/i,
    key: 'errors.ideaOrDraftRequired'
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

  return raw
}
