/**
 * registerCharactersIntroVideo
 */
import { existsSync, readFileSync } from 'fs'
import type { HandlerContext } from '../context'
import { AppError } from '../../../types/errors'
import { SoulMdHubClient } from '../../../infrastructure/soulmd/SoulMdHubClient'
import { buildCharacterIntroVideoPrompt } from '../../../domain/characterMasterPrompt'
import { parseCharacterGallery, serializeCharacterGallery, setGalleryIntroVideo } from '../../../domain/characterGallery'

export function registerCharactersIntroVideo(ctx: HandlerContext): void {
  const {
    reg,
    characters,
    generation,
    activity
  } = ctx

reg(
  'characters:generateIntroVideo',
  (
    async (
      payload: {
        characterId: string
        sourceImagePath: string
        durationSeconds?: number
        locale?: 'zh-HK' | 'en'
      }
    ) => {
      const row = await characters().get(payload.characterId)
      const sourceImagePath = payload.sourceImagePath?.trim()
      if (!sourceImagePath || !existsSync(sourceImagePath)) {
        throw new AppError(
          'VALIDATION',
          'errors.sourceImageRequired',
          'Select a reference still first'
        )
      }
      if (!ctx.aiClient.generateVideo) {
        throw new AppError(
          'AI_UNAVAILABLE',
          'errors.videoUnavailable',
          'Enable Grok gateway videoApi and use a key with agent/admin mode'
        )
      }

      let spokenLanguages: string[] | undefined
      try {
        const raw = (row as { spokenLanguages?: string | null }).spokenLanguages
        if (raw?.trim()) {
          const parsed = JSON.parse(raw) as unknown
          if (Array.isArray(parsed)) {
            spokenLanguages = parsed.filter(
              (x): x is string => typeof x === 'string'
            )
          }
        }
      } catch {
        spokenLanguages = undefined
      }

      // Load soul.md / hub as full performance bible (truncated for context).
      let soulExcerpt = ''
      try {
        const soulPath = (row as { soulMdPath?: string | null }).soulMdPath
        const soulHubId = (row as { soulHubId?: number | null }).soulHubId
        if (soulHubId != null || soulPath?.trim()) {
          const soulHub = new SoulMdHubClient()
          const sr = await (async () => {
            if (soulHubId != null && Number.isFinite(soulHubId)) {
              const detail = await soulHub.getSoul(soulHubId)
              return SoulMdHubClient.flattenContent(
                detail.content,
                detail.file_type
              )
            }
            const path = soulPath!.trim()
            if (path.startsWith('soulmd-hub://')) {
              const id = Number(path.replace('soulmd-hub://', ''))
              if (!Number.isFinite(id)) return ''
              const detail = await soulHub.getSoul(id)
              return SoulMdHubClient.flattenContent(
                detail.content,
                detail.file_type
              )
            }
            if (existsSync(path)) {
              return readFileSync(path, 'utf-8')
            }
            return ''
          })()
          soulExcerpt = (sr ?? '').trim()
        }
      } catch {
        /* v8 ignore next */
        soulExcerpt = ''
        /* v8 ignore next */
      }

      const profile = {
        name: row.name,
        description: row.description,
        appearance: row.appearance ?? undefined,
        personality: row.personality ?? undefined,
        backstory: row.backstory ?? undefined,
        costume: row.costume ?? undefined,
        ageRange: row.ageRange ?? undefined,
        gender: row.gender ?? undefined,
        voiceDesc: row.voiceDesc ?? undefined,
        mannerisms: row.mannerisms ?? undefined,
        relationships: row.relationships ?? undefined,
        visualTags: row.visualTags ?? undefined,
        seedPrompt: (row as { seedPrompt?: string | null }).seedPrompt ?? undefined,
        artStyle: (row as { artStyle?: string | null }).artStyle ?? undefined,
        spokenLanguages
      }
      const locale = payload.locale === 'en' ? 'en' : 'zh-HK'
      const fallbackPrompt = buildCharacterIntroVideoPrompt(profile, locale, {
        soulExcerpt
      })
      const store = generation().getMediaStore()
      store.ensureLibraryDirs()
      const outPath = store.characterVideoPath(row.id, 'intro', '.mp4')
      const seconds =
        typeof payload.durationSeconds === 'number'
          ? payload.durationSeconds
          : 10
      const aspectRatio =
        ctx.settings.aspectRatio === '9:16' || ctx.settings.aspectRatio === '16:9'
          ? ctx.settings.aspectRatio
          : '16:9'

      const {
        polishThenGenerateVideo
      } = await import('../../../application/video/polishVideoPrompt')
      const {
        buildIntroVideoPolishUserPrompt,
        truncateForVideoPrompt
      } = await import('../../../domain/videoPromptPolish')

      const charHardRules = row.hardRules ?? null
      const result = await polishThenGenerateVideo({
        ai: ctx.aiClient,
        locale,
        fallbackPrompt,
        hardRules: charHardRules,
        polishUserContent: buildIntroVideoPolishUserPrompt({
          locale,
          seconds,
          aspectRatio,
          hasRefImage: true,
          fallbackPrompt,
          name: profile.name,
          description: profile.description,
          appearance: profile.appearance,
          personality: profile.personality,
          backstory: profile.backstory,
          costume: profile.costume,
          ageRange: profile.ageRange,
          gender: profile.gender,
          voiceDesc: profile.voiceDesc,
          mannerisms: profile.mannerisms,
          relationships: profile.relationships,
          visualTags: profile.visualTags,
          artStyle: profile.artStyle,
          seedPrompt: profile.seedPrompt,
          spokenLanguages: profile.spokenLanguages,
          soulExcerpt: truncateForVideoPrompt(soulExcerpt),
          hardRules: charHardRules
        }),
        videoRequest: {
          durationSeconds: seconds,
          refImagePath: sourceImagePath,
          outputPath: outPath,
          aspectRatio
        }
      })

      const gallery = parseCharacterGallery(row.refGalleryJson, {
        refImagePath: row.refImagePath,
        refSheetPath: row.refSheetPath
      })
      const nextGallery = setGalleryIntroVideo(
        gallery,
        sourceImagePath,
        result.outputPath
      )
      const updated = await characters().update(row.id, {
        refGalleryJson: serializeCharacterGallery(nextGallery)
      })
      activity.append({
        kind: 'character',
        message: 'generateIntroVideo',
        meta: {
          characterId: row.id,
          sourceImagePath,
          path: result.outputPath,
          seconds,
          degraded: result.degraded ?? false,
          polished: result.polished,
          promptPreview: result.promptUsed.slice(0, 200)
        }
      })
      return {
        character: updated,
        path: result.outputPath,
        sourceImagePath,
        gallery: nextGallery,
        jobId: result.jobId,
        degraded: result.degraded,
        polished: result.polished
      }
    }
  )
)

/** Promote a draft sheet into the character gallery (after user confirms). */
}
