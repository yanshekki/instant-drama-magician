/**
 * characters:renderPhotoBook — slideshow (ffmpeg) or AI clips then concat.
 */
import { PromptCatalog } from '../../../prompts'
import { existsSync, readFileSync } from 'fs'
import { dirname, basename } from 'path'
import type { HandlerContext } from '../context'
import { AppError } from '../../../types/errors'
import { FfmpegService } from '../../../infrastructure/ffmpeg/FfmpegService'
import { SoulMdHubClient } from '../../../infrastructure/soulmd/SoulMdHubClient'
import { buildCharacterIntroVideoPrompt } from '../../../domain/characterMasterPrompt'
import {
  mergePhotoBookIntoProfileJson,
  parsePhotoBook,
  resolvePhotoBookAlbum,
  setAlbumFilm,
  setPhotoBookShotClip,
  shotsWithStills,
  type PhotoBook,
  type PhotoBookVideoMode
} from '../../../domain/characterPhotoBook'
import {
  introTemplatePolishBlock,
  parseIntroVideoTemplateId
} from '../../../domain/introVideoTemplates'

export function registerCharactersPhotoBook(ctx: HandlerContext): void {
  const { reg, characters, generation, activity } = ctx

  reg(
    'characters:renderPhotoBook',
    async (payload: {
      characterId: string
      mode: PhotoBookVideoMode
      shotIds?: string[]
      locale?: string
      durationSeconds?: number
      introTemplateId?: string
      /** GUI: stitch existing clipPath files after MediaGen confirms. */
      concatOnly?: boolean
      albumId?: string
    }) => {
      const characterId = payload.characterId?.trim()
      if (!characterId) {
        throw new AppError('VALIDATION', 'errors.characterIdRequired')
      }
      const mode: PhotoBookVideoMode =
        payload.mode === 'ai-clips' ? 'ai-clips' : 'slideshow'
      const row = await characters().get(characterId)
      const book = parsePhotoBook(
        (row as { profileJson?: string | null }).profileJson
      )
      const album = resolvePhotoBookAlbum(book, {
        albumId: payload.albumId,
        shotIds: payload.shotIds
      })
      const selected = shotsWithStills(book, payload.shotIds, album.id)
      const stills = selected
        .map((s) => s.stillPath?.trim() || '')
        .filter((p) => p && existsSync(p))
      if (stills.length === 0) {
        throw new AppError('VALIDATION', 'errors.photoBookNeedStill')
      }

      const store = generation().getMediaStore()
      store.ensureLibraryDirs()
      const ffmpeg = new FfmpegService()
      const locale = PromptCatalog.locale(payload.locale)
      const seconds =
        typeof payload.durationSeconds === 'number' &&
        Number.isFinite(payload.durationSeconds)
          ? Math.max(2, payload.durationSeconds)
          : 8

      let nextBook: PhotoBook = book
      let videoPath: string

      if (mode === 'slideshow') {
        videoPath = store.characterVideoPath(row.id, 'photoshoot', '.mp4')
        await ffmpeg.stitchStillsSlideshow({
          stillPaths: stills,
          outputPath: videoPath,
          secondsPerStill: Math.min(4, Math.max(2, seconds / 2)),
          aspectRatio:
            ctx.settings.aspectRatio === '9:16' ? '9:16' : '16:9'
        })
      } else if (payload.concatOnly === true) {
        const clipPaths = selected
          .map((s) => s.clipPath?.trim() || '')
          .filter((p) => p && existsSync(p))
        if (
          clipPaths.length === 0 ||
          clipPaths.length !== selected.length
        ) {
          throw new AppError('VALIDATION', 'errors.photoBookNeedClip')
        }
        const aspectRatio =
          ctx.settings.aspectRatio === '9:16' ||
          ctx.settings.aspectRatio === '16:9'
            ? ctx.settings.aspectRatio
            : '16:9'
        videoPath = store.characterVideoPath(row.id, 'photoshoot', '.mp4')
        await ffmpeg.exportConcat({
          outDir: dirname(videoPath),
          fileName: basename(videoPath),
          title: `${row.name} photo book`,
          clips: clipPaths.map((mediaPath, i) => ({
            startTime: 0,
            endTime: seconds,
            label: `Shot ${i + 1}`,
            mediaPath
          })),
          aspectRatio
        })
      } else {
        if (!ctx.aiClient.generateVideo) {
          throw new AppError(
            'AI_UNAVAILABLE',
            'errors.videoUnavailable',
            'Enable Grok gateway videoApi and use a key with agent/admin mode'
          )
        }
        const {
          polishThenGenerateVideo
        } = await import('../../../application/video/polishVideoPrompt')
        const {
          buildIntroVideoPolishUserPrompt,
          truncateForVideoPrompt
        } = await import('../../../domain/videoPromptPolish')

        let spokenLanguages: string[] | undefined
        try {
          const raw = (row as { spokenLanguages?: string | null })
            .spokenLanguages
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

        let soulExcerpt = ''
        try {
          const soulPath = (row as { soulMdPath?: string | null }).soulMdPath
          const soulHubId = (row as { soulHubId?: number | null }).soulHubId
          if (soulHubId != null || soulPath?.trim()) {
            const soulHub = new SoulMdHubClient()
            if (soulHubId != null && Number.isFinite(soulHubId)) {
              const detail = await soulHub.getSoul(soulHubId)
              soulExcerpt = SoulMdHubClient.flattenContent(
                detail.content,
                detail.file_type
              ).trim()
            } else if (soulPath?.startsWith('soulmd-hub://')) {
              const id = Number(soulPath.replace('soulmd-hub://', ''))
              if (Number.isFinite(id)) {
                const detail = await soulHub.getSoul(id)
                soulExcerpt = SoulMdHubClient.flattenContent(
                  detail.content,
                  detail.file_type
                ).trim()
              }
            } else if (soulPath && existsSync(soulPath)) {
              soulExcerpt = readFileSync(soulPath, 'utf-8').trim()
            }
          }
        } catch {
          soulExcerpt = ''
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
          seedPrompt:
            (row as { seedPrompt?: string | null }).seedPrompt ?? undefined,
          artStyle:
            (row as { artStyle?: string | null }).artStyle ?? undefined,
          spokenLanguages
        }
        const skipDefaultCamera = Boolean(
          parseIntroVideoTemplateId(payload.introTemplateId) ||
            selected.some((shot) =>
              parseIntroVideoTemplateId(shot.cameraTemplateId)
            )
        )
        const fallbackPrompt = buildCharacterIntroVideoPrompt(
          profile,
          locale,
          { soulExcerpt, skipDefaultCamera }
        )
        const aspectRatio =
          ctx.settings.aspectRatio === '9:16' ||
          ctx.settings.aspectRatio === '16:9'
            ? ctx.settings.aspectRatio
            : '16:9'

        const clipPaths: string[] = []
        for (const shot of selected) {
          const still = shot.stillPath!.trim()
          if (!existsSync(still)) continue
          const outPath = store.characterVideoPath(
            row.id,
            'photoshoot-clip',
            '.mp4'
          )
          const templateId =
            parseIntroVideoTemplateId(payload.introTemplateId) ??
            parseIntroVideoTemplateId(shot.cameraTemplateId)
          const templateBlock = templateId
            ? introTemplatePolishBlock(templateId, locale)
            : ''
          const result = await polishThenGenerateVideo({
            ai: ctx.aiClient,
            locale,
            fallbackPrompt,
            hardRules: row.hardRules ?? null,
            polishUserContent: [
              buildIntroVideoPolishUserPrompt({
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
                hardRules: row.hardRules ?? null
              }),
              templateBlock
            ]
              .filter(Boolean)
              .join('\n\n'),
            videoRequest: {
              durationSeconds: seconds,
              refImagePath: still,
              outputPath: outPath,
              aspectRatio
            }
          })
          clipPaths.push(result.outputPath)
          nextBook = setPhotoBookShotClip(
            nextBook,
            shot.id,
            result.outputPath
          )
        }
        if (clipPaths.length === 0) {
          /* v8 ignore next */
          throw new AppError('VALIDATION', 'errors.photoBookNeedStill')
        }
        videoPath = store.characterVideoPath(row.id, 'photoshoot', '.mp4')
        await ffmpeg.exportConcat({
          outDir: dirname(videoPath),
          fileName: basename(videoPath),
          title: `${row.name} photo book`,
          clips: clipPaths.map((mediaPath, i) => ({
            startTime: 0,
            endTime: seconds,
            label: `Shot ${i + 1}`,
            mediaPath
          })),
          aspectRatio
        })
      }

      nextBook = setAlbumFilm(nextBook, album.id, videoPath, mode)
      const profileJson = mergePhotoBookIntoProfileJson(
        (row as { profileJson?: string | null }).profileJson,
        nextBook
      )
      const updated = await characters().update(row.id, { profileJson })
      activity.append({
        kind: 'character',
        message: 'renderPhotoBook',
        meta: {
          characterId: row.id,
          mode,
          path: videoPath,
          shots: stills.length,
          albumId: album.id
        }
      })
      return {
        character: updated,
        path: videoPath,
        videoMode: mode,
        photoBook: nextBook
      }
    }
  )
}
