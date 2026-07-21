import { describe, expect, it } from 'vitest'
import { formatUserError } from './formatUserError'

const t = (key: string) => `T:${key}`
/** Identity translator — simulates missing i18n entries */
const tIdentity = (key: string) => key

describe('formatUserError', () => {
  it('translates stable errors.* keys', () => {
    expect(formatUserError('errors.costumeNoBaseImage', t)).toBe(
      'T:errors.costumeNoBaseImage'
    )
  })

  it('maps legacy English costume dress error', () => {
    expect(
      formatUserError(
        'No base image for costume dress. Generate a character reference sheet first.',
        t
      )
    ).toBe('T:errors.costumeNoBaseImage')
  })

  it('uses fallback when empty', () => {
    expect(formatUserError('', t)).toBe('T:aiJobs.failed')
    expect(formatUserError(null, t)).toBe('T:aiJobs.failed')
    expect(formatUserError(undefined, t)).toBe('T:aiJobs.failed')
    expect(formatUserError('   ', t, 'custom.fallback')).toBe(
      'T:custom.fallback'
    )
  })

  it('maps legacy English timeline unlink errors', () => {
    expect(
      formatUserError('Cannot remove scene: still used on the timeline', t)
    ).toBe('T:errors.cannotRemoveSceneOnTimeline')
    expect(
      formatUserError('Cannot remove character: still used on the timeline', t)
    ).toBe('T:errors.cannotRemoveCharacterOnTimeline')
    expect(
      formatUserError('Cannot remove prop: still used on the timeline', t)
    ).toBe('T:errors.cannotRemovePropOnTimeline')
    expect(
      formatUserError('Cannot remove action: still used on the timeline', t)
    ).toBe('T:errors.cannotRemoveActionOnTimeline')
  })

  it('translates cannot-remove keys', () => {
    expect(formatUserError('errors.cannotRemoveSceneOnTimeline', t)).toBe(
      'T:errors.cannotRemoveSceneOnTimeline'
    )
  })

  it('maps Failed to fetch network errors', () => {
    expect(formatUserError('Failed to fetch', t)).toBe('T:errors.networkFailed')
    expect(formatUserError('TypeError: Failed to fetch', t)).toBe(
      'T:errors.networkFailed'
    )
    expect(formatUserError('fetch failed: ECONNREFUSED', t)).toBe(
      'T:errors.networkFailed'
    )
    expect(formatUserError('NetworkError when attempting', t)).toBe(
      'T:errors.networkFailed'
    )
    expect(formatUserError('Load failed', t)).toBe('T:errors.networkFailed')
    expect(formatUserError('net::ERR_CONNECTION_REFUSED', t)).toBe(
      'T:errors.networkFailed'
    )
  })

  it('translates both message and details when combined errors.* keys', () => {
    expect(
      formatUserError('errors.networkFailed — errors.aiUnavailable', t)
    ).toBe('T:errors.networkFailed — T:errors.aiUnavailable')
    expect(
      formatUserError('errors.networkFailed - errors.aiUnavailable', t)
    ).toBe('T:errors.networkFailed — T:errors.aiUnavailable')
  })

  it('translates vision and grok CLI error keys', () => {
    expect(formatUserError('errors.visionImageUnreadable', t)).toBe(
      'T:errors.visionImageUnreadable'
    )
    expect(
      formatUserError(
        'errors.visionImageUnreadable — errors.visionImageUnreadableDetail',
        t
      )
    ).toBe(
      'T:errors.visionImageUnreadable — T:errors.visionImageUnreadableDetail'
    )
    expect(formatUserError('errors.grokCliFailed — errors.grokCliFailedHint', t)).toBe(
      'T:errors.grokCliFailed — T:errors.grokCliFailedHint'
    )
  })

  it('maps legacy grok CLI exit text', () => {
    expect(formatUserError('Grok CLI exited with code 1', t)).toBe(
      'T:errors.grokCliFailed'
    )
    expect(formatUserError('produced no stdout from agent', t)).toBe(
      'T:errors.grokCliFailed'
    )
    expect(formatUserError('grok_error: timeout', t)).toBe(
      'T:errors.grokCliFailed'
    )
  })

  it('handles interrupted reload', () => {
    expect(formatUserError('interrupted_on_reload', t)).toBe(
      'T:aiJobs.interruptedReload'
    )
    expect(formatUserError('Job was interrupted mid-flight', t)).toBe(
      'T:aiJobs.interruptedReload'
    )
  })

  it('translates mixed English — errors.* trailing form', () => {
    expect(
      formatUserError('Something went wrong — errors.aiUnavailable', t)
    ).toBe('Something went wrong — T:errors.aiUnavailable')
  })

  it('maps many legacy English phrases', () => {
    const cases: Array<[string, string]> = [
      ['No base image for costume swap', 'T:errors.costumeSwapNoBase'],
      ['Source image is required for this action', 'T:errors.sourceImageRequired'],
      ['Video generation is not available', 'T:errors.videoUnavailable'],
      ['Video generation is unavailable right now', 'T:errors.videoUnavailable'],
      ['Idea or draft required', 'T:errors.ideaOrDraftRequired'],
      ['Character name is required', 'T:errors.characterNameRequired'],
      ['Name is required', 'T:errors.nameRequired'],
      ['Description is required', 'T:errors.descriptionRequired'],
      ['storyId is required', 'T:errors.storyIdRequired'],
      ['Story not found', 'T:errors.storyNotFound'],
      ['Timeline entry not found', 'T:errors.timelineEntryNotFound'],
      ['Timeline beat not found', 'T:errors.timelineBeatNotFound'],
      ['Scene not linked to story', 'T:errors.sceneNotLinked'],
      ['Prop is not linked', 'T:errors.propNotLinked'],
      ['Prop not linked', 'T:errors.propNotLinked'],
      ['Draft abc not found', 'T:errors.draftNotFound'],
      ['draft sheet file not found', 'T:errors.draftNotFound'],
      ['draft plate file not found', 'T:errors.draftNotFound'],
      ['draft cover file not found', 'T:errors.draftNotFound'],
      ['Media file not found', 'T:errors.mediaNotFound'],
      ['Media not found', 'T:errors.mediaNotFound'],
      ['Path outside data directory', 'T:errors.pathOutsideDataDir'],
      ['cancelled', 'T:errors.cancelled'],
      ['Unauthorized', 'T:errors.unauthorized'],
      ['Source scene has no gallery images', 'T:errors.sourceSceneNoGallery'],
      // description is required matches before atmosphere/costume-specific phrases
      ['Atmosphere description is required', 'T:errors.descriptionRequired'],
      ['Costume description is required', 'T:errors.descriptionRequired'],
      [
        'Idea, draft, or reference image is required',
        'T:errors.ideaOrImageRequired'
      ],
      ['URL must start with http', 'T:errors.invalidSoulUrl'],
      ['Selected file must be a .md document', 'T:errors.soulFileMustBeMd'],
      ['Invalid soulmd-hub id', 'T:errors.invalidSoulHubId'],
      ['Cannot reach the AI gateway', 'T:errors.aiUnavailable'],
      ['Cannot reach local gateway', 'T:errors.aiUnavailable'],
      ['Reference image not found', 'T:errors.visionImageUnreadable'],
      ['Reference image unreadable', 'T:errors.visionImageUnreadable'],
      ['Vision image unreadable', 'T:errors.visionImageUnreadable']
    ]
    for (const [msg, expected] of cases) {
      expect(formatUserError(msg, t), msg).toBe(expected)
    }
  })

  it('maps image sandbox and image API off messages', () => {
    expect(formatUserError('no_image_in_sandbox', t)).toBe(
      'T:aiJobs.errImageNoSandbox'
    )
    expect(
      formatUserError('No image file was found in the sandbox', t)
    ).toBe('T:aiJobs.errImageNoSandbox')
    expect(formatUserError('IMAGE_NO_SANDBOX', t)).toBe(
      'T:aiJobs.errImageNoSandbox'
    )
    expect(formatUserError('ImagesAPI disabled', t)).toBe(
      'T:aiJobs.errImageApiOff'
    )
    expect(formatUserError('Image API is disabled', t)).toBe(
      'T:aiJobs.errImageApiOff'
    )
    expect(formatUserError('image_api_off', t)).toBe('T:aiJobs.errImageApiOff')
  })

  it('returns raw when no mapping matches', () => {
    expect(formatUserError('Totally unknown error XYZ', t)).toBe(
      'Totally unknown error XYZ'
    )
  })

  it('returns raw key when translator is identity', () => {
    expect(formatUserError('errors.costumeNoBaseImage', tIdentity)).toBe(
      'errors.costumeNoBaseImage'
    )
    expect(
      formatUserError('errors.foo — errors.bar', tIdentity)
    ).toBe('errors.foo — errors.bar')
    expect(
      formatUserError('No base image for costume dress', tIdentity)
    ).toBe('No base image for costume dress')
    // network path with identity leaves raw after lower-case branch also identity
    expect(formatUserError('Failed to fetch', tIdentity)).toBe('Failed to fetch')
  })

  it('handles empty detail after dash in combined form', () => {
    // Trailing whitespace-only detail: left key still translates via other paths or returns mixed
    const out = formatUserError('errors.networkFailed —  ', t)
    expect(out).toContain('errors.networkFailed')
  })

  it('translates dynamic errors.* keys not in the set via regex', () => {
    expect(formatUserError('errors.someNewKey', t)).toBe('T:errors.someNewKey')
  })
})
