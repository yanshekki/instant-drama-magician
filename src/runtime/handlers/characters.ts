/**
 * Domain IPC handlers (split for maintainability).
 */
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { ensureHardRules } from '../../domain/promptHardRules'
import type { CreateCharacterInput, UpdateCharacterInput } from '../../types/domain'
import { chatContentText } from '../../types/domain'
import { SoulMdHubClient } from '../../infrastructure/soulmd/SoulMdHubClient'
import { buildCharacterIntroVideoPrompt, buildCharacterMasterSystemPrompt, buildCharacterMasterUserPrompt, buildCharacterSheetEditPrompt, buildCharacterSheetImagePrompt, extractCharacterProfileJson } from '../../domain/characterMasterPrompt'
import { buildSoulGenerateSystemPrompt, buildSoulGenerateUserPrompt, normalizeSoulMarkdown, profileHasSoulSource } from '../../domain/soulGenerate'
import { appendGalleryItem, MAX_IMAGE_EDIT_REFERENCES, parseCharacterGallery, primaryGalleryPath, serializeCharacterGallery, setGalleryIntroVideo } from '../../domain/characterGallery'
import { AppError } from '../../types/errors'
import { extractNameFromSoulMd } from '../../domain/character'
import type { HandlerContext } from './context'

export function registerCharactersHandlers(ctx: HandlerContext): void {
  const {
    reg,
    host,
    stories,
    characters,
    scenes,
    props,
    actions,
    costumes,
    timeline,
    generation,
    rebindAi,
    mediaRoot,
    activity,
    userDataPath,
    settingsStore
  } = ctx

// ─── Characters ────────────────────────────────────────────
reg(
  'characters:list',
  (
    async (
      storyIdOrOpts?: string | { storyId?: string; q?: string; forStory?: boolean }
    ) => {
      // Back-compat: list(storyId) → listForStory; list() / list({q}) → global
      if (typeof storyIdOrOpts === 'string' && storyIdOrOpts) {
        return characters().listForStory(storyIdOrOpts)
      }
      if (
        storyIdOrOpts &&
        typeof storyIdOrOpts === 'object' &&
        storyIdOrOpts.forStory &&
        storyIdOrOpts.storyId
      ) {
        return characters().listForStory(storyIdOrOpts.storyId)
      }
      const q =
        storyIdOrOpts && typeof storyIdOrOpts === 'object'
          ? storyIdOrOpts.q
          : undefined
      return characters().list({ q })
    }
  )
)
reg(
  'characters:get',
  (async (id: string) => characters().get(id))
)
reg(
  'characters:create',
  (async ( input: CreateCharacterInput) => characters().create(input))
)
reg(
  'characters:update',
  (async ( id: string, data: UpdateCharacterInput) =>
    characters().update(id, data)
  )
)
reg(
  'characters:delete',
  (async ( id: string) => characters().delete(id))
)
/** Suggest wardrobe + art style from story plot (chosen story + segment). */
reg(
  'characters:suggestWardrobe',
  (
    async (
      payload: {
        characterId?: string
        storyId?: string
        /** all | scene:<id> | beat:<timelineEntryId> */
        segmentKey?: string | null
        locale?: 'zh-HK' | 'en'
        name?: string
        appearance?: string | null
        costume?: string | null
        ageRange?: string | null
        gender?: string | null
        description?: string | null
        personality?: string | null
        visualTags?: string | null
        mannerisms?: string | null
        soulExcerpt?: string | null
        userRequest?: string | null
        existingCostumeNames?: string[]
      }
    ) => {
      const locale = payload.locale ?? 'zh-HK'
      let storyTitle: string | undefined
      let styleNote: string | null | undefined
      let storyId = payload.storyId
      let characterName = payload.name?.trim() || ''
      let appearance = payload.appearance
      let costume = payload.costume
      let ageRange = payload.ageRange
      let gender = payload.gender
      let description = payload.description
      let personality = payload.personality
      let visualTags = payload.visualTags
      let mannerisms = payload.mannerisms
      let soulExcerpt = payload.soulExcerpt
      const userRequest = payload.userRequest
      let existingNames = payload.existingCostumeNames ?? []
      let sceneSnippets: string[] = []
      let segmentLabel: string | null = null

      if (payload.characterId) {
        const row = await characters().get(payload.characterId)
        characterName = characterName || row.name
        appearance = appearance ?? row.appearance
        costume = costume ?? row.costume
        ageRange = ageRange ?? row.ageRange
        gender = gender ?? row.gender
        description = description ?? row.description
        personality = personality ?? row.personality
        visualTags = visualTags ?? row.visualTags
        mannerisms = mannerisms ?? row.mannerisms
        if (!existingNames.length) {
          const { parseCharacterCostumes } = await import(
            '../../domain/characterCostumes'
          )
          existingNames = parseCharacterCostumes(
            (row as { costumesJson?: string | null }).costumesJson
          ).map((c) => c.name)
        }
      }
      if (!characterName) {
        throw new AppError('VALIDATION', 'errors.characterNameRequired')
      }
      if (storyId) {
        const story = await host.getPrisma().story.findUnique({
          where: { id: storyId },
          include: {
            storyScenes: {
              orderBy: { sceneNumber: 'asc' },
              take: 40,
              include: { scene: true }
            },
            timeline: {
              orderBy: { order: 'asc' },
              take: 80,
              include: {
                character: true,
                scene: true,
                prop: true
              }
            }
          }
        })
        if (!story) throw new AppError('NOT_FOUND', 'errors.storyNotFound', String(storyId))
        storyTitle = story.title
        styleNote = story.styleNote
        const seg = (payload.segmentKey ?? 'all').trim() || 'all'

        if (seg === 'all') {
          segmentLabel =
            locale === 'en' ? 'Entire story (all scenes)' : '全劇（所有場次）'
          sceneSnippets = story.storyScenes.map((link) => {
            const s = link.scene
            const script = link.scriptOverride ?? s.script
            return [
              `Scene ${link.sceneNumber}: ${s.title || s.description}`,
              s.description,
              script ? String(script).slice(0, 500) : ''
            ]
              .filter(Boolean)
              .join('\n')
          })
          // Also fold short dialogue beats when available
          for (const beat of story.timeline.slice(0, 12)) {
            if (!beat.dialogue?.trim()) continue
            const who = beat.character?.name ?? '?'
            sceneSnippets.push(
              `Beat ${beat.order + 1} [${who}]: ${beat.dialogue.slice(0, 300)}`
            )
          }
        } else if (seg.startsWith('scene:')) {
          const sceneId = seg.slice('scene:'.length)
          const link = story.storyScenes.find((l) => l.sceneId === sceneId)
          if (!link) {
            throw new AppError('VALIDATION', 'errors.sceneNotLinked')
          }
          const s = link.scene
          const script = link.scriptOverride ?? s.script
          segmentLabel =
            locale === 'en'
              ? `Scene ${link.sceneNumber}: ${s.title || s.description.slice(0, 40)}`
              : `第 ${link.sceneNumber} 場：${s.title || s.description.slice(0, 40)}`
          sceneSnippets = [
            [
              segmentLabel,
              s.description,
              script ? String(script).slice(0, 800) : '',
              s.mood ? `mood: ${s.mood}` : '',
              s.timeOfDay ? `time: ${s.timeOfDay}` : '',
              s.weather ? `weather: ${s.weather}` : ''
            ]
              .filter(Boolean)
              .join('\n')
          ]
          for (const beat of story.timeline) {
            if (beat.sceneId !== sceneId || !beat.dialogue?.trim()) continue
            const who = beat.character?.name ?? '?'
            sceneSnippets.push(
              `Dialogue [${who}]: ${beat.dialogue.slice(0, 400)}`
            )
          }
        } else if (seg.startsWith('beat:')) {
          const entryId = seg.slice('beat:'.length)
          const beat = story.timeline.find((e) => e.id === entryId)
          if (!beat) {
            throw new AppError('VALIDATION', 'errors.timelineBeatNotFound')
          }
          const who = beat.character?.name ?? (locale === 'en' ? 'Unknown' : '未指定')
          const where =
            beat.scene?.title || beat.scene?.description?.slice(0, 40) || ''
          segmentLabel =
            locale === 'en'
              ? `Beat ${beat.order + 1} · ${who}${where ? ` @ ${where}` : ''}`
              : `段落 ${beat.order + 1} · ${who}${where ? ` @ ${where}` : ''}`
          sceneSnippets = [
            [
              segmentLabel,
              beat.dialogue ? `Dialogue: ${beat.dialogue}` : '',
              beat.scene
                ? `Location: ${beat.scene.description}`
                : '',
              beat.prop ? `Prop: ${beat.prop.name}` : ''
            ]
              .filter(Boolean)
              .join('\n')
          ]
        } else {
          throw new AppError('VALIDATION', 'errors.unknownSegmentKey', String(seg))
        }
      } else {
        segmentLabel =
          locale === 'en' ? 'No story selected' : '未選故事（僅角色資料）'
      }

      const {
        buildWardrobeSuggestSystemPrompt,
        buildWardrobeSuggestUserPrompt,
        extractWardrobeSuggestionJson
      } = await import('../../domain/wardrobeSuggest')
      const completion = await ctx.aiClient.chat({
        messages: [
          {
            role: 'system',
            content: buildWardrobeSuggestSystemPrompt(locale)
          },
          {
            role: 'user',
            content: buildWardrobeSuggestUserPrompt({
              characterName,
              appearance,
              currentCostume: costume,
              ageRange,
              gender,
              description,
              personality,
              visualTags,
              mannerisms,
              soulExcerpt: soulExcerpt ?? null,
              userRequest: userRequest ?? null,
              storyTitle: storyTitle ?? null,
              styleNote: styleNote ?? null,
              sceneSnippets,
              segmentLabel,
              locale,
              existingCostumeNames: existingNames
            })
          }
        ],
        max_tokens: 1200
      })
      const text = chatContentText(completion.choices[0]?.message.content)
      const suggestion = extractWardrobeSuggestionJson(text)
      activity.append({
        kind: 'character',
        message: 'suggestWardrobe',
        storyId: storyId ?? undefined,
        meta: {
          characterId: payload.characterId ?? null,
          name: suggestion.name,
          artStyle: suggestion.artStyle,
          segmentKey: payload.segmentKey ?? 'all'
        }
      })
      return { suggestion, raw: text, segmentLabel, storyTitle }
    }
  )
)

reg(
  'characters:aiFill',
  (
    async (
      payload: {
        idea?: string
        storyId?: string
        locale?: 'zh-HK' | 'en'
        /** Current form fields — enables create + edit refine */
        existingDraft?: Record<string, unknown>
        /** Full soul.md / hub markdown for identity merge */
        soulContent?: string | null
        /** Gallery / external still — vision fill from image alone is allowed */
        referenceImagePath?: string | null
      }
    ) => {
      const idea = payload.idea?.trim() ?? ''
      const draft = payload.existingDraft
      const soulContent = payload.soulContent?.trim() ?? ''
      const hasDraft = Boolean(
        draft &&
          Object.values(draft).some((v) => {
            if (typeof v === 'string') return v.trim().length > 0
            if (Array.isArray(v)) return v.length > 0
            return v != null && String(v).trim().length > 0
          })
      )
      const hasSoul = soulContent.length > 0
      const {
        buildVisionUserContent,
        resolveReadableImagePath,
        visionFillUserPreamble
      } = await import('../../domain/chatVision')
      const refPath = resolveReadableImagePath(payload.referenceImagePath)
      const hasImage = Boolean(refPath)
      if (!idea && !hasDraft && !hasSoul && !hasImage) {
        throw new AppError(
          'VALIDATION',
          'errors.ideaOrImageRequired'
        )
      }
      // Character invent uses only idea + form + soul (not the open story’s style).
      // Scene / clip / wardrobe flows own story continuity.
      const { shouldInjectStoryContextForCharacter } = await import(
        '../../domain/storyContextPolicy'
      )
      let storyTitle: string | undefined
      let styleNote: string | null | undefined
      if (payload.storyId && shouldInjectStoryContextForCharacter()) {
        const story = await host.getPrisma().story.findUnique({
          where: { id: payload.storyId }
        })
        storyTitle = story?.title
        styleNote = story?.styleNote
      }
      const locale = payload.locale ?? 'zh-HK'
      const str = (k: string): string | undefined => {
        const v = draft?.[k]
        if (typeof v === 'string' && v.trim()) return v.trim()
        return undefined
      }
      const spokenRaw = draft?.spokenLanguages
      const spokenLanguages = Array.isArray(spokenRaw)
        ? spokenRaw.filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
        : typeof spokenRaw === 'string' && spokenRaw.trim()
          ? spokenRaw.split(/[,，]/).map((s) => s.trim()).filter(Boolean)
          : undefined
      const existingDraft = hasDraft
        ? {
            name: str('name'),
            description: str('description'),
            appearance: str('appearance'),
            personality: str('personality'),
            backstory: str('backstory'),
            costume: str('costume'),
            ageRange: str('ageRange'),
            gender: str('gender'),
            voiceDesc: str('voiceDesc'),
            spokenLanguages:
              spokenLanguages && spokenLanguages.length > 0
                ? spokenLanguages
                : undefined,
            mannerisms: str('mannerisms'),
            relationships: str('relationships'),
            visualTags: str('visualTags')
          }
        : null
      const ideaForPrompt =
        idea ||
        (hasImage
          ? locale === 'en'
            ? 'Describe and invent a full character profile from the attached reference photo.'
            : '請根據附上的參考圖，完整填寫角色資料。'
          : locale === 'en'
            ? 'Polish and merge all fields'
            : '全面潤飾並合併所有欄位')
      const textPrompt = [
        hasImage ? visionFillUserPreamble(locale, 'character') : null,
        buildCharacterMasterUserPrompt({
          idea: ideaForPrompt,
          storyTitle,
          styleNote,
          locale,
          existingDraft,
          soulContent: hasSoul ? soulContent : null
        })
      ]
        .filter(Boolean)
        .join('\n\n')
      const completion = await ctx.aiClient.chat({
        messages: [
          {
            role: 'system',
            content: buildCharacterMasterSystemPrompt(locale)
          },
          {
            role: 'user',
            content: buildVisionUserContent(textPrompt, refPath)
          }
        ],
        max_tokens: 3000
      })
      const text = chatContentText(completion.choices[0]?.message.content)
      let profile = extractCharacterProfileJson(text)
      const { fillMissingProfileFields } = await import(
        '../../domain/profileFillMissing'
      )
      const { CHARACTER_PROFILE_JSON_KEYS: charKeys } = await import(
        '../../domain/characterMasterPrompt'
      )
      const charRequired = charKeys.filter((k) => k !== 'spokenLanguages' && k !== 'hardRules')
      const charPatch = await fillMissingProfileFields({
        profile: profile as unknown as Record<string, unknown>,
        requiredKeys: charRequired,
        locale,
        chat: (req) => ctx.aiClient.chat(req),
        referenceImagePath: refPath,
        maxTokens: 1200
      })
      profile = charPatch.profile as unknown as typeof profile
      const rawOut = charPatch.raw
        ? `${text}\n---missing-fill---\n${charPatch.raw}`
        : text
      activity.append({
        kind: 'character',
        message: hasImage
          ? 'aiFillFromImage'
          : hasDraft || hasSoul
            ? 'aiRefine'
            : 'aiFill',
        storyId: payload.storyId,
        meta: {
          name: profile.name,
          usedSoul: hasSoul,
          usedDraft: hasDraft,
          usedImage: hasImage,
          patchedKeys: charPatch.patchedKeys
        }
      })
      return {
        profile,
        profileJson: JSON.stringify(profile, null, 2),
        raw: rawOut
      }
    }
  )
)

/** Generate local soul.md markdown from character profile fields (Gateway chat). */
reg(
  'characters:generateSoul',
  (
    async (
      payload: {
        storyId?: string
        locale?: 'zh-HK' | 'en'
        profile: Record<string, unknown>
        existingSoul?: string | null
        userRequest?: string | null
      }
    ) => {
      const spokenRaw = payload.profile?.spokenLanguages
      const spokenLanguages = Array.isArray(spokenRaw)
        ? spokenRaw.filter(
            (x): x is string => typeof x === 'string' && x.trim().length > 0
          )
        : undefined
      const str = (k: string): string | undefined => {
        const v = payload.profile?.[k]
        return typeof v === 'string' && v.trim() ? v.trim() : undefined
      }
      const profile = {
        name: str('name'),
        description: str('description'),
        appearance: str('appearance'),
        personality: str('personality'),
        backstory: str('backstory'),
        costume: str('costume'),
        ageRange: str('ageRange'),
        gender: str('gender'),
        voiceDesc: str('voiceDesc'),
        spokenLanguages,
        mannerisms: str('mannerisms'),
        relationships: str('relationships'),
        visualTags: str('visualTags')
      }
      const hasExistingSoul = Boolean(payload.existingSoul?.trim())
      if (!profileHasSoulSource(profile) && !hasExistingSoul) {
        throw new AppError(
          'VALIDATION',
          'errors.ideaOrDraftRequired',
          'Fill name or appearance / personality first'
        )
      }
      // Soul from profile + existing soul + user request only.
      const locale = payload.locale ?? 'zh-HK'
      const completion = await ctx.aiClient.chat({
        messages: [
          {
            role: 'system',
            content: buildSoulGenerateSystemPrompt(locale)
          },
          {
            role: 'user',
            content: buildSoulGenerateUserPrompt({
              profile,
              locale,
              existingSoul: payload.existingSoul,
              userRequest: payload.userRequest
            })
          }
        ],
        max_tokens: 4000
      })
      const raw = chatContentText(completion.choices[0]?.message.content)
      const content = normalizeSoulMarkdown(raw)
      if (!content || content.length < 40) {
        throw new AppError(
          'AI_FAILED',
          'errors.aiUnavailable',
          'Retry or fill more profile fields'
        )
      }
      // Persist draft under media/tmp so reload path works without Hub id
      const store = generation().getMediaStore()
      store.ensureTmpDir()
      const slug = (profile.name ?? 'character')
        .replace(/[^\w\u4e00-\u9fff-]+/g, '_')
        .slice(0, 40)
      const filePath = store.tmpImagePath(`soul_${slug}`, '.md')
      writeFileSync(filePath, content, 'utf8')
      const title =
        extractNameFromSoulMd(content) || profile.name?.trim() || 'Soul'
      activity.append({
        kind: 'character',
        message: 'generateSoul',
        storyId: payload.storyId,
        meta: { title, path: filePath, chars: content.length }
      })
      return {
        content,
        filePath,
        title,
        raw
      }
    }
  )
)

reg(
  'characters:generateSheet',
  (
    async (
      payload: {
        characterId: string
        variant?: string
        /** Prefer this gallery path as edit reference (still capped by API). */
        referenceImagePath?: string | null
        /** Multi-select identity stills; first path is edit base */
        referenceImagePaths?: string[] | null
        /**
         * When false (default for UI), write draft under media/tmp and do not
         * update Character — user confirms via commitSheet.
         */
        persist?: boolean
        /** Visual art style id (photo_cinematic, anime_modern, …) */
        artStyle?: string | null
        /**
         * When true, image_edit with identity ref.
         * When false/omit, pure generateImage so sheet layout can change freely.
         */
        useIdentityEdit?: boolean
        /** Full prompt override from confirm modal */
        promptOverride?: string | null
      }
    ) => {
      const row = await characters().get(payload.characterId)
      const persist = payload.persist === true
      const profile = {
        name: row.name,
        description: row.description,
        appearance: row.appearance ?? undefined,
        personality: row.personality ?? undefined,
        costume: row.costume ?? undefined,
        ageRange: row.ageRange ?? undefined,
        gender: row.gender ?? undefined,
        voiceDesc: row.voiceDesc ?? undefined,
        mannerisms: row.mannerisms ?? undefined,
        visualTags: row.visualTags ?? undefined,
        hardRules: row.hardRules ?? undefined
      }
      const { getSheetVariant } = await import(
        '../../domain/characterSheetVariants'
      )
      const { getArtStyle } = await import(
        '../../domain/characterArtStyles'
      )
      const { resolveSheetGenMode } = await import(
        '../../domain/characterMasterPrompt'
      )
      const { allRefPaths, appendMultiRefNote, pickPrimaryRefPath } =
        await import('../../domain/imageGenConfirm')
      const variantDef = getSheetVariant(payload.variant)
      const variant = variantDef.id
      const artStyle = getArtStyle(
        payload.artStyle ?? row.artStyle ?? undefined
      ).id
      // Sizes / enhance from Settings (all have defaults)
      const {
        aspectFromImageSize,
        imageSizeForSheetVariant
      } = await import('../../types/settings')
      const size = imageSizeForSheetVariant(ctx.settings, variant)
      const aspectRatio = aspectFromImageSize(size)

      const gallery = parseCharacterGallery(row.refGalleryJson, {
        refImagePath: row.refImagePath,
        refSheetPath: row.refSheetPath
      })
      // Body / base / bare packages: never image_edit — clothed refs clone old sheets.
      const forcePureLayout =
        variantDef.wardrobeLayer === 'nude' ||
        variantDef.wardrobeLayer === 'base' ||
        Boolean(variantDef.requiresUnclothedSupport)
      const refList = allRefPaths(
        payload.referenceImagePath,
        payload.referenceImagePaths
      ).filter((p) => existsSync(p))
      const identityPrimary =
        !forcePureLayout
          ? pickPrimaryRefPath(payload.referenceImagePath, refList)
          : null
      const refPath =
        identityPrimary && existsSync(identityPrimary)
          ? identityPrimary
          : null
      const hasValidRef = Boolean(refPath)
      const usedEdit =
        !forcePureLayout &&
        resolveSheetGenMode({
          useIdentityEdit: payload.useIdentityEdit,
          hasValidRef
        }) === 'edit'
      const override =
        typeof payload.promptOverride === 'string' &&
        payload.promptOverride.trim()
          ? payload.promptOverride.trim()
          : null
      let prompt =
        override ??
        (usedEdit
          ? buildCharacterSheetEditPrompt(profile, variant, artStyle)
          : buildCharacterSheetImagePrompt(profile, variant, artStyle))
      if (!override && refList.length > 1) {
        prompt = appendMultiRefNote(prompt, refList, 'en')
      }
      prompt = ensureHardRules(prompt, profile.hardRules ?? row.hardRules)

      // Persist style before long gen so reload/UI stay in sync
      if (payload.artStyle || row.artStyle !== artStyle) {
        await characters().update(row.id, { artStyle })
      }

      const img = usedEdit
        ? await ctx.aiClient.editImage({
            prompt,
            imagePath: refPath!,
            size,
            aspectRatio
          })
        : await ctx.aiClient.generateImage({
            prompt,
            size,
            aspectRatio
          })

      const store = generation().getMediaStore()
      let outPath: string
      if (persist) {
        store.ensureLibraryDirs()
        outPath = store.characterImagePath(row.id,
          `sheet_${variant}`,
          '.png'
        )
      } else {
        store.ensureTmpDir()
        outPath = store.tmpImagePath(`sheet_${variant}`, '.png')
      }
      writeFileSync(outPath, Buffer.from(img.b64, 'base64'))

      // Grok native ~720p/1k; optional 2× Lanczos+unsharp (Settings → Photo)
      const { enhanceCharacterImage } = await import(
        '../../infrastructure/media/imageEnhance'
      )
      const enhanced = enhanceCharacterImage(outPath, {
        enabled: ctx.settings.imageEnhance,
        maxEdge: ctx.settings.imageEnhanceMaxEdge,
        scale: ctx.settings.imageEnhanceScale
      })

      const label = variantDef.galleryLabel

      if (!persist) {
        activity.append({
          kind: 'character',
          message: 'generateSheetDraft',
          storyId: undefined,
          meta: {
            characterId: row.id,
            path: outPath,
            size: img.sizeUsed,
            aspect: img.aspectUsed,
            usedEdit,
            enhance: enhanced
          }
        })
        // Remember last art style even for drafts
        if (payload.artStyle) {
          await characters().update(row.id, { artStyle })
        }
        return {
          character: row,
          path: outPath,
          size: img.sizeUsed,
          aspect: img.aspectUsed,
          gallery: gallery,
          usedEdit,
          referencePath: usedEdit ? refPath : null,
          enhance: enhanced,
          draft: true,
          label,
          variant,
          artStyle,
          layer: variantDef.wardrobeLayer
        }
      }

      const nextGallery = appendGalleryItem(gallery, {
        path: outPath,
        kind: 'sheet',
        label,
        layer: variantDef.wardrobeLayer
      })
      const coverPath = primaryGalleryPath(nextGallery)
      const updated = await characters().update(row.id, {
        refSheetPath: outPath,
        refImagePath: coverPath,
        refGalleryJson: serializeCharacterGallery(nextGallery),
        artStyle
      })
      activity.append({
        kind: 'character',
        message: 'generateSheet',
        storyId: undefined,
        meta: {
          characterId: row.id,
          path: outPath,
          size: img.sizeUsed,
          aspect: img.aspectUsed,
          gallery: nextGallery.length,
          usedEdit,
          refPath: usedEdit ? refPath : null,
          refCap: MAX_IMAGE_EDIT_REFERENCES,
          enhance: enhanced,
          artStyle,
          layer: variantDef.wardrobeLayer
        }
      })
      return {
        character: updated,
        path: outPath,
        size: img.sizeUsed,
        aspect: img.aspectUsed,
        gallery: nextGallery,
        usedEdit,
        referencePath: usedEdit ? refPath : null,
        enhance: enhanced,
        draft: false,
        label,
        variant,
        artStyle,
        layer: variantDef.wardrobeLayer
      }
    }
  )
)

/**
 * Image → self-intro video for one gallery still.
 * Uses full character bible in the prompt; identity locked to the source image.
 */
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
      } = await import('../../application/video/polishVideoPrompt')
      const {
        buildIntroVideoPolishUserPrompt,
        truncateForVideoPrompt
      } = await import('../../domain/videoPromptPolish')

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
reg(
  'characters:commitSheet',
  (
    async (
      payload: {
        characterId: string
        path: string
        variant?: string
        label?: string
        layer?: string
        /** When set, also update Character.costume after commit (costume-swap). */
        costumeDescription?: string | null
      }
    ) => {
      const row = await characters().get(payload.characterId)
      if (!payload.path || !existsSync(payload.path)) {
        throw new AppError('NOT_FOUND', 'errors.draftNotFound')
      }
      const store = generation().getMediaStore()
      const kind = `sheet_${payload.variant ?? 'bible'}`
      const finalPath = store.promoteTmpImage(
        null,
        row.id,
        payload.path,
        kind
      )
      const gallery = parseCharacterGallery(row.refGalleryJson, {
        refImagePath: row.refImagePath,
        refSheetPath: row.refSheetPath
      })
      const { getSheetVariant, isSheetVariantId } = await import(
        '../../domain/characterSheetVariants'
      )
      const knownLayers = new Set([
        'identity',
        'nude',
        'base',
        'costume',
        'detail'
      ])
      const explicitLayer =
        typeof payload.layer === 'string' && knownLayers.has(payload.layer)
          ? (payload.layer as
              | 'identity'
              | 'nude'
              | 'base'
              | 'costume'
              | 'detail')
          : undefined
      const variantLayer =
        payload.variant === 'costume_swap'
          ? ('costume' as const)
          : isSheetVariantId(payload.variant)
            ? getSheetVariant(payload.variant).wardrobeLayer
            : undefined
      const layer = explicitLayer ?? variantLayer
      const nextGallery = appendGalleryItem(gallery, {
        path: finalPath,
        kind: 'sheet',
        label: payload.label ?? 'Sheet',
        ...(layer ? { layer } : {})
      })
      const primary = primaryGalleryPath(nextGallery)
      const costumeText =
        typeof payload.costumeDescription === 'string'
          ? payload.costumeDescription.trim()
          : ''
      let costumesJsonPatch: { costumesJson?: string } = {}
      if (costumeText) {
        const {
          ensureCostumeInLibrary,
          parseCharacterCostumes,
          serializeCharacterCostumes,
          upsertCostume,
          createCostumeEntry
        } = await import('../../domain/characterCostumes')
        let lib = parseCharacterCostumes(
          (row as { costumesJson?: string | null }).costumesJson
        )
        lib = ensureCostumeInLibrary(lib, costumeText, {
          name: payload.label?.replace(/^Costume swap ·\s*/i, '') || 'Look'
        })
        // Link latest dress image to matching costume entry
        const hit = lib.find(
          (c) =>
            c.description.trim().toLowerCase() === costumeText.toLowerCase()
        )
        if (hit) {
          lib = upsertCostume(lib, {
            ...hit,
            imagePath: finalPath,
            updatedAt: new Date().toISOString()
          })
        } else {
          lib = [
            createCostumeEntry({
              name: 'Look',
              description: costumeText,
              imagePath: finalPath
            }),
            ...lib
          ]
        }
        costumesJsonPatch = {
          costumesJson: serializeCharacterCostumes(lib)
        }
      }
      const costumePatch = costumeText ? { costume: costumeText } : {}
      const updated = await characters().update(row.id, {
        refSheetPath: finalPath,
        refImagePath: primary,
        refGalleryJson: serializeCharacterGallery(nextGallery),
        ...costumePatch,
        ...costumesJsonPatch
      })
      activity.append({
        kind: 'character',
        message: 'commitSheet',
        storyId: undefined,
        meta: {
          characterId: row.id,
          path: finalPath,
          layer: layer ?? null,
          costumeUpdated: Boolean(costumeText)
        }
      })
      return {
        character: updated,
        path: finalPath,
        gallery: nextGallery
      }
    }
  )
)

/**
 * Costume swap: image_edit on a body/base/costume base with a new wardrobe
 * description. Writes a draft under media/tmp unless persist=true.
 */
reg(
  'characters:swapCostume',
  (
    async (
      payload: {
        characterId: string
        costumeDescription: string
        baseImagePath?: string | null
        artStyle?: string | null
        pose?: string | null
        /** When true, write gallery immediately (tests); UI uses draft. */
        persist?: boolean
        /** Also update Character.costume when persisting. */
        updateCostumeField?: boolean
      }
    ) => {
      const row = await characters().get(payload.characterId)
      const costumeDescription = (payload.costumeDescription ?? '').trim()
      if (!costumeDescription) {
        throw new AppError(
          'VALIDATION',
          'errors.costumeDescRequired'
        )
      }

      const {
        buildCostumeSwapPrompt,
        costumeSwapGalleryLabel,
        getCostumeSwapPose,
        pickBestBaseImage
      } = await import('../../domain/costumeSwap')
      const { getArtStyle } = await import(
        '../../domain/characterArtStyles'
      )
      const {
        aspectFromImageSize
      } = await import('../../types/settings')

      const gallery = parseCharacterGallery(row.refGalleryJson, {
        refImagePath: row.refImagePath,
        refSheetPath: row.refSheetPath
      })
      const existingSwapGallery = gallery.filter(
        (g) => g.path && existsSync(g.path)
      )
      const pickedExisting = pickBestBaseImage(existingSwapGallery, {
        ageRange: row.ageRange,
        preferredPath: payload.baseImagePath
      })
      if (!pickedExisting.item?.path || !existsSync(pickedExisting.item.path)) {
        throw new AppError('VALIDATION', 'errors.costumeSwapNoBase')
      }
      const basePath = pickedExisting.item.path
      const artStyle = getArtStyle(
        payload.artStyle ?? row.artStyle ?? undefined
      ).id
      const pose = getCostumeSwapPose(payload.pose)
      const prompt = buildCostumeSwapPrompt({
        name: row.name,
        newCostume: costumeDescription,
        artStyle,
        pose: pose.id,
        appearance: row.appearance,
        ageRange: row.ageRange,
        gender: row.gender,
        visualTags: row.visualTags,
        mannerisms: row.mannerisms
      })

      // Pose → image size class
      const size =
        pose.id === 'turnaround'
          ? ctx.settings.imageSizeWide
          : pose.id === 'three_quarter'
            ? ctx.settings.imageSizeSquare
            : ctx.settings.imageSizeTall
      const aspectRatio = aspectFromImageSize(size)

      const img = await ctx.aiClient.editImage({
        prompt,
        imagePath: basePath,
        size,
        aspectRatio
      })

      const store = generation().getMediaStore()
      const persist = payload.persist === true
      let outPath: string
      if (persist) {
        store.ensureLibraryDirs()
        outPath = store.characterImagePath(row.id,
          'costume_swap',
          '.png'
        )
      } else {
        store.ensureTmpDir()
        outPath = store.tmpImagePath('costume_swap', '.png')
      }
      writeFileSync(outPath, Buffer.from(img.b64, 'base64'))

      const { enhanceCharacterImage } = await import(
        '../../infrastructure/media/imageEnhance'
      )
      const enhanced = enhanceCharacterImage(outPath, {
        enabled: ctx.settings.imageEnhance,
        maxEdge: ctx.settings.imageEnhanceMaxEdge,
        scale: ctx.settings.imageEnhanceScale
      })

      const label = costumeSwapGalleryLabel(costumeDescription)

      if (payload.artStyle || row.artStyle !== artStyle) {
        await characters().update(row.id, { artStyle })
      }

      if (!persist) {
        activity.append({
          kind: 'character',
          message: 'swapCostumeDraft',
          storyId: undefined,
          meta: {
            characterId: row.id,
            path: outPath,
            basePath,
            pickReason: pickedExisting.reason,
            costume: costumeDescription.slice(0, 120),
            artStyle,
            pose: pose.id,
            enhance: enhanced
          }
        })
        return {
          character: row,
          path: outPath,
          size: img.sizeUsed,
          aspect: img.aspectUsed,
          gallery,
          basePath,
          pickReason: pickedExisting.reason,
          enhance: enhanced,
          draft: true,
          label,
          variant: 'costume_swap',
          layer: 'costume' as const,
          costumeDescription,
          artStyle,
          pose: pose.id
        }
      }

      const nextGallery = appendGalleryItem(gallery, {
        path: outPath,
        kind: 'sheet',
        label,
        layer: 'costume'
      })
      const primary = primaryGalleryPath(nextGallery)
      const updated = await characters().update(row.id, {
        refSheetPath: outPath,
        refImagePath: primary,
        refGalleryJson: serializeCharacterGallery(nextGallery),
        artStyle,
        ...(payload.updateCostumeField !== false
          ? { costume: costumeDescription }
          : {})
      })
      activity.append({
        kind: 'character',
        message: 'swapCostume',
        storyId: undefined,
        meta: {
          characterId: row.id,
          path: outPath,
          basePath,
          pickReason: pickedExisting.reason,
          costume: costumeDescription.slice(0, 120),
          artStyle,
          pose: pose.id,
          enhance: enhanced
        }
      })
      return {
        character: updated,
        path: outPath,
        size: img.sizeUsed,
        aspect: img.aspectUsed,
        gallery: nextGallery,
        basePath,
        pickReason: pickedExisting.reason,
        enhance: enhanced,
        draft: false,
        label,
        variant: 'costume_swap',
        layer: 'costume' as const,
        costumeDescription,
        artStyle,
        pose: pose.id
      }
    }
  )
)

reg(
  'media:discardSheetDraft',
  (async ( filePath: string) => {
    const store = generation().getMediaStore()
    store.discardTmp(filePath)
    return { ok: true as const }
  })
)

}
