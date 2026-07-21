import { imageSizeForClass, draftHasNameOrDescription, mergeCostumeRaw } from '../../domain/residualLabels'
/**
 * Domain IPC handlers (split for maintainability).
 */
import { existsSync, writeFileSync } from 'fs'
import { ensureHardRules } from '../../domain/promptHardRules'
import { chatContentText } from '../../types/domain'
import { buildCostumeIntroVideoPrompt } from '../../domain/costumeSwap'
import {
  parseCharacterGallery,
  serializeCharacterGallery,
  setGalleryIntroVideo
} from '../../domain/characterGallery'
import { AppError } from '../../types/errors'
import type { HandlerContext } from './context'

export function registerCostumesHandlers(ctx: HandlerContext): void {
  const {
    reg,
    characters,
    costumes,
    generation,
    activity
  } = ctx

// ─── Costumes (global wardrobe) ─────────────────────────────
reg(
  'costumes:list',
  (
    async (
      opts?: { q?: string; characterId?: string; unlinkedOnly?: boolean }
    ) => costumes().list(opts)
  )
)
reg(
  'costumes:get',
  (async ( id: string) => costumes().get(id))
)
reg(
  'costumes:create',
  (
    async (
      input: {
        name: string
        description: string
        artStyle?: string | null
        refImagePath?: string | null
        characterIds?: string[]
      }
    ) => costumes().create(input)
  )
)
reg(
  'costumes:update',
  (
    async (
      id: string,
      data: {
        name?: string
        description?: string
        hardRules?: string | null
        artStyle?: string | null
        refImagePath?: string | null
        refGalleryJson?: string | null
        seedPrompt?: string | null
        characterIds?: string[]
      }
    ) => costumes().update(id, data)
  )
)
reg(
  'costumes:delete',
  (async ( id: string) => costumes().delete(id))
)
reg(
  'costumes:linkCharacter',
  (
    async ( payload: { costumeId: string; characterId: string }) =>
      costumes().linkCharacter(payload.costumeId, payload.characterId)
  )
)
reg(
  'costumes:unlinkCharacter',
  (
    async ( payload: { costumeId: string; characterId: string }) =>
      costumes().unlinkCharacter(payload.costumeId, payload.characterId)
  )
)
reg(
  'costumes:setActive',
  (
    async ( payload: { costumeId: string; characterId: string }) =>
      costumes().setActiveOnCharacter(payload.costumeId, payload.characterId)
  )
)
reg(
  'costumes:listForCharacter',
  (async ( characterId: string) => {
    const list = await costumes().list({ characterId })
    const char = await characters().get(characterId)
    const active = (char.costume ?? '').trim().toLowerCase()
    return list.map((c) => ({
      ...c,
      isActive:
        Boolean(active) &&
        c.description.trim().toLowerCase() === active,
      dressedImagePath:
        c.characterLinks.find((l) => l.characterId === characterId)
          ?.dressedImagePath ?? null
    }))
  })
)
/** AI invent / polish costume name + wardrobe description. */
reg(
  'costumes:aiFill',
  (
    async (
      payload: {
        idea?: string
        locale?: 'zh-HK' | 'en'
        existingDraft?: {
          name?: string | null
          description?: string | null
          artStyle?: string | null
          hardRules?: string | null
        }
        /** External / gallery still — vision fill from image alone is allowed */
        referenceImagePath?: string | null
      }
    ) => {
      const locale = payload.locale ?? 'zh-HK'
      const draft = payload.existingDraft
      const hasDraft = Boolean(
        draft &&
          ((draft.name && draft.name.trim()) ||
            (draft.description && draft.description.trim()))
      )
      const idea = payload.idea?.trim() ?? ''
      const {
        buildVisionUserContent,
        resolveReadableImagePath,
        visionFillUserPreamble
      } = await import('../../domain/chatVision')
      const {
        hardRulesAiInstruction,
        defaultHardRulesFallback,
        normalizeHardRules
      } = await import('../../domain/promptHardRules')
      const { coerceProfileString, extractJsonObject } = await import(
        '../../domain/jsonProfileFields'
      )
      const refPath = resolveReadableImagePath(payload.referenceImagePath)
      const hasImage = Boolean(refPath)
      if (!idea && !hasDraft && !hasImage) {
        throw new AppError(
          'VALIDATION',
          'errors.ideaOrImageRequired'
        )
      }
      const system =
        locale === 'en'
          ? [
              'You are a film wardrobe designer. Reply with ONLY compact JSON:',
              '{"name":"short label","description":"full wardrobe description for image gen (layers, fabric, colors, accessories; no brand logos)","artStyle":"optional style id or empty string","hardRules":"3-8 MUST/MUST-NOT lines"}',
              'Every key present as a JSON string (not null/array). No markdown.',
              hardRulesAiInstruction('en'),
              'If an image is provided, describe THAT outfit faithfully for short-drama generation.'
            ].join(' ')
          : [
              '你是影視造型指導。只回覆緊湊 JSON：',
              '{"name":"短名稱","description":"完整戲服描述（分層、布料、顏色、配飾；無品牌 Logo）","artStyle":"可選風格 id 或空字串","hardRules":"3–8 句必須／禁止"}',
              '每個鍵必須是 JSON 字串（不可 null／陣列）。不要 markdown。',
              hardRulesAiInstruction('zh-HK'),
              '若有參考圖，請按圖如實描述該造型，供短劇出圖使用。'
            ].join(' ')
      const userParts = [
        hasImage ? visionFillUserPreamble(locale, 'costume') : null,
        idea
          ? locale === 'en'
            ? `Idea: ${idea}`
            : `構思：${idea}`
          : !hasImage
            ? locale === 'en'
              ? 'Polish the draft wardrobe.'
              : '潤飾以下戲服草稿。'
            : null,
        hasDraft
          ? `Draft:\nname: ${draft?.name ?? ''}\ndescription: ${draft?.description ?? ''}\nartStyle: ${draft?.artStyle ?? ''}\nhardRules: ${draft?.hardRules ?? ''}`
          : null,
        locale === 'en'
          ? 'Required keys: name, description, artStyle, hardRules. Missing keys = invalid.'
          : '必填鍵：name, description, artStyle, hardRules。缺鍵無效。'
      ].filter(Boolean)
      const textPrompt = userParts.join('\n\n')
      const completion = await ctx.aiClient.chat({
        messages: [
          { role: 'system', content: system },
          {
            role: 'user',
            content: buildVisionUserContent(textPrompt, refPath)
          }
        ],
        max_tokens: 900
      })
      const text = chatContentText(completion.choices[0]?.message.content)
      let name = ''
      let description = ''
      let artStyle: string | null = null
      let hardRules =
        defaultHardRulesFallback('costume', locale)
      try {
        const j = extractJsonObject(text)
        name = coerceProfileString(j.name) ?? ''
        description = coerceProfileString(j.description) ?? ''
        artStyle = coerceProfileString(j.artStyle) ?? null
        hardRules =
          normalizeHardRules(coerceProfileString(j.hardRules)) ||
          hardRules
      } catch {
        /* fall through */
      }
      if (!description) {
        description = text.trim().slice(0, 2000)
      }
      if (!name) {
        name = description.slice(0, 32) || (locale === 'en' ? 'Look' : '造型')
      }
      const { fillMissingProfileFields } = await import(
        '../../domain/profileFillMissing'
      )
      const costumePatch = await fillMissingProfileFields({
        profile: {
          name,
          description,
          artStyle: artStyle ?? '',
          hardRules
        },
        requiredKeys: ['name', 'description'],
        locale,
        chat: (req) => ctx.aiClient.chat(req),
        referenceImagePath: refPath,
        maxTokens: 600
      })
      name = String(costumePatch.profile.name || name)
      description = String(costumePatch.profile.description || description)
      hardRules =
        normalizeHardRules(
          typeof costumePatch.profile.hardRules === 'string'
            ? costumePatch.profile.hardRules
            : hardRules
        ) || hardRules
      const costumeRaw = costumePatch.raw
        ? `${text}\n---missing-fill---\n${costumePatch.raw}`
        : text
      activity.append({
        kind: 'costume',
        message: hasImage
          ? 'aiFillCostumeFromImage'
          : hasDraft
            ? 'aiRefineCostume'
            : 'aiFillCostume',
        meta: {
          name,
          usedImage: hasImage,
          patchedKeys: costumePatch.patchedKeys
        }
      })
      return {
        name,
        description,
        artStyle,
        hardRules,
        raw: costumeRaw
      }
    }
  )
)

/**
 * Dress a character in this costume using character ref images (identity lock).
 * Reuses characters:swapCostume pipeline; stores dressed path on the join.
 */
reg(
  'costumes:generateDressed',
  (
    async (
      payload: {
        costumeId: string
        characterId: string
        baseImagePath?: string | null
        pose?: string | null
        /** Full prompt override from confirm modal */
        promptOverride?: string | null
      }
    ) => {
      const cos = await costumes().get(payload.costumeId)
      // Ensure link exists
      await costumes().linkCharacter(payload.costumeId, payload.characterId)
      // Invoke same logic as swapCostume by calling the service path inline
      // (duplicate thin wrapper around IPC handler internals)
      const row = await characters().get(payload.characterId)
      const costumeDescription = cos.description.trim()
      const {
        buildCostumeSwapPrompt,
        costumeSwapGalleryLabel,
        getCostumeSwapPose,
        pickBestBaseImage
      } = await import('../../domain/costumeSwap')
      const { getArtStyle } = await import(
        '../../domain/characterArtStyles'
      )
      const { aspectFromImageSize } = await import(
        '../../types/settings'
      )
      const {
        appendGalleryItem,
        parseCharacterGallery,
        serializeCharacterGallery
      } = await import('../../domain/characterGallery')

      const gallery = parseCharacterGallery(row.refGalleryJson, {
        refImagePath: row.refImagePath,
        refSheetPath: row.refSheetPath
      })
      // Only stills that still exist on disk (gallery JSON can go stale).
      const existingGallery = gallery.filter(
        (g) => typeof g.path === 'string' && g.path && existsSync(g.path)
      )
      // Ignore preferred path if the file was deleted (dropdown may still list it).
      const preferredRaw = payload.baseImagePath?.trim() || null
      const preferredPath =
        preferredRaw && existsSync(preferredRaw) ? preferredRaw : null
      const picked = pickBestBaseImage(existingGallery, {
        ageRange: row.ageRange,
        preferredPath
      })
      if (!picked.item?.path || !existsSync(picked.item.path)) {
        throw new AppError('VALIDATION', 'errors.costumeNoBaseImage')
      }
      const basePath = picked.item.path
      const artStyle = getArtStyle(
        cos.artStyle ?? row.artStyle ?? undefined
      ).id
      const pose = getCostumeSwapPose(payload.pose)
      const override =
        typeof payload.promptOverride === 'string' &&
        payload.promptOverride.trim()
          ? payload.promptOverride.trim()
          : null
      let prompt =
        override ??
        buildCostumeSwapPrompt({
        name: row.name,
        newCostume: costumeDescription,
        artStyle,
        pose: pose.id,
        appearance: row.appearance,
        ageRange: row.ageRange,
        gender: row.gender,
        visualTags: row.visualTags,
        mannerisms: row.mannerisms,
        hardRules: cos.hardRules ?? row.hardRules
      })
      prompt = ensureHardRules(prompt, cos.hardRules ?? row.hardRules)
      const size =
        imageSizeForClass(
          pose.sizeClass === 'wide'
            ? 'wide'
            : pose.sizeClass === 'square'
              ? 'square'
              : 'tall',
          {
            tall: ctx.settings.imageSizeTall,
            square: ctx.settings.imageSizeSquare,
            wide: ctx.settings.imageSizeWide
          }
        )
      const aspectRatio = aspectFromImageSize(size)
      const img = await ctx.aiClient.editImage({
        prompt,
        imagePath: basePath,
        size,
        aspectRatio
      })
      const store = generation().getMediaStore()
      store.ensureLibraryDirs()
      const buf = Buffer.from(img.b64, 'base64')
      // Canonical permanent file lives under costume library (not tmp).
      const costumePath = store.costumeImagePath(cos.id, 'dressed', '.png')
      writeFileSync(costumePath, buf)
      // Also keep a character-library copy for character continuity / wardrobe layer.
      const charPath = store.characterImagePath(
        row.id,
        'costume_dressed',
        '.png'
      )
      writeFileSync(charPath, buf)

      const label = costumeSwapGalleryLabel(costumeDescription)
      const nextCharGallery = appendGalleryItem(gallery, {
        path: charPath,
        kind: 'gen',
        label,
        layer: 'costume'
      })
      await characters().update(row.id, {
        refGalleryJson: serializeCharacterGallery(nextCharGallery),
        refImagePath: row.refImagePath || charPath
      })
      await costumes().setDressedImage(
        payload.costumeId,
        payload.characterId,
        costumePath
      )

      // Always attach to costume gallery + set hero cover (permanent paths).
      const cosGallery = parseCharacterGallery(cos.refGalleryJson, {
        refImagePath: cos.refImagePath
      })
      const nextCosGallery = appendGalleryItem(cosGallery, {
        path: costumePath,
        kind: 'gen',
        label,
        layer: 'costume'
      })
      const updatedCostume = await costumes().update(payload.costumeId, {
        refImagePath: costumePath,
        refGalleryJson: serializeCharacterGallery(nextCosGallery)
      })
      activity.append({
        kind: 'costume',
        message: 'generateDressed',
        meta: {
          costumeId: payload.costumeId,
          characterId: payload.characterId,
          path: costumePath,
          charPath
        }
      })
      return {
        path: costumePath,
        costume: updatedCostume,
        characterId: payload.characterId,
        gallery: nextCosGallery
      }
    }
  )
)

/**
 * Image → costume look intro video for one gallery still.
 * Uses costume description; wardrobe locked to the source still.
 */
reg(
  'costumes:generateIntroVideo',
  (
    async (
      payload: {
        costumeId: string
        sourceImagePath: string
        durationSeconds?: number
        locale?: 'zh-HK' | 'en'
      }
    ) => {
      const row = await costumes().get(payload.costumeId)
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

      const profile = {
        name: row.name,
        description: row.description || row.name,
        artStyle: row.artStyle ?? undefined
      }
      const locale = payload.locale === 'en' ? 'en' : 'zh-HK'
      const fallbackPrompt = buildCostumeIntroVideoPrompt(profile, locale)
      const store = generation().getMediaStore()
      store.ensureLibraryDirs()
      const outPath = store.costumeVideoPath(row.id, 'intro', '.mp4')
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
      } = await import('../../application/video/polishVideoPrompt')
      const {
        buildCostumeIntroVideoPolishUserPrompt
      } = await import('../../domain/videoPromptPolish')

      const costumeHardRules = row.hardRules ?? null
      const result = await polishThenGenerateVideo({
        ai: ctx.aiClient,
        locale,
        fallbackPrompt,
        hardRules: costumeHardRules,
        polishUserContent: buildCostumeIntroVideoPolishUserPrompt({
          locale,
          seconds,
          aspectRatio,
          hasRefImage: true,
          fallbackPrompt,
          name: profile.name,
          description: profile.description,
          artStyle: profile.artStyle,
          hardRules: costumeHardRules
        }),
        videoRequest: {
          durationSeconds: seconds,
          refImagePath: sourceImagePath,
          outputPath: outPath,
          aspectRatio
        }
      })

      const gallery = parseCharacterGallery(row.refGalleryJson, {
        refImagePath: row.refImagePath
      })
      const nextGallery = setGalleryIntroVideo(
        gallery,
        sourceImagePath,
        result.outputPath
      )
      const updated = await costumes().update(row.id, {
        refGalleryJson: serializeCharacterGallery(nextGallery)
      })
      activity.append({
        kind: 'costume',
        message: 'generateIntroVideo',
        meta: {
          costumeId: row.id,
          sourceImagePath,
          path: result.outputPath,
          seconds,
          degraded: result.degraded ?? false,
          polished: result.polished,
          promptPreview: result.promptUsed.slice(0, 200)
        }
      })
      return {
        costume: updated,
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

}
