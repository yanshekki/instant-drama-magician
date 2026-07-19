/**
 * Full channel registry shared by Electron, web server, and CLI.
 * Generated/adapted from electron/main/ipc.ts.
 */
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync
} from 'fs'
import { basename, dirname, extname, join } from 'path'
import { GrokCliClient } from '../infrastructure/ai/GrokCliClient'
import {
  AppDataBackupService,
  CharacterService,
  CostumeService,
  defaultFullBackupFileName,
  DemoSeedService,
  GenerationService,
  ProjectBackupService,
  PropService,
  SceneService,
  StoryCastService,
  StoryService,
  TimelinePersistenceService
} from '../application/services'
import { MediaStore } from '../infrastructure/media/MediaStore'
import { ActivityLog } from '../infrastructure/activity/ActivityLog'
import {
  redactSettings,
  supportReportPath,
  writeSupportReportJson
} from '../infrastructure/support/SupportReport'
// appUpdateService is electron-only — dynamic import in updates:* handlers
import type {
  CreateCharacterInput,
  CreatePropInput,
  CreateSceneInput,
  CreateStoryInput,
  CreateTimelineEntryInput,
  PropProfileFields,
  SceneProfileFields,
  UpdateCharacterInput,
  UpdatePropInput,
  UpdateSceneInput,
  UpdateTimelineEntryInput
} from '../types/domain'
import { SoulMdHubClient } from '../infrastructure/soulmd/SoulMdHubClient'
import {
  buildCharacterIntroVideoPrompt,
  buildCharacterMasterSystemPrompt,
  buildCharacterMasterUserPrompt,
  buildCharacterSheetEditPrompt,
  buildCharacterSheetImagePrompt,
  extractCharacterProfileJson
} from '../domain/characterMasterPrompt'
import { buildSceneIntroVideoPrompt } from '../domain/sceneMasterPrompt'
import { buildPropIntroVideoPrompt } from '../domain/propMasterPrompt'
import { buildCostumeIntroVideoPrompt } from '../domain/costumeSwap'
import {
  buildSoulGenerateSystemPrompt,
  buildSoulGenerateUserPrompt,
  normalizeSoulMarkdown,
  profileHasSoulSource
} from '../domain/soulGenerate'
import {
  appendGalleryItem,
  MAX_IMAGE_EDIT_REFERENCES,
  parseCharacterGallery,
  primaryGalleryPath,
  serializeCharacterGallery,
  setGalleryIntroVideo
} from '../domain/characterGallery'
import type { AppSettings } from '../types/settings'
import { AppError } from '../types/errors'
import {
  extractDescriptionFromSoulMd,
  extractNameFromSoulMd,
  isSoulMdPath,
  parseSoulMd
} from '../domain/character'
import type { RuntimeHandler } from './createRuntime'
import type { HandlerHost, OpenDialogOptionsLike } from './HandlerHost'

export function registerAllHandlers(
  reg: (channel: string, fn: RuntimeHandler) => void,
  host: HandlerHost
): void {
  const settingsStore = host.settingsStore
  let settings = settingsStore.load()
  let aiClient = new GrokCliClient(settings)
  const mediaRoot = (): string => host.mediaRoot
  const activity = host.activity

  activity.append({
    kind: 'app',
    level: 'info',
    message: 'handlers_registered',
    meta: { userData: host.userData, mode: host.mode }
  })

  const stories = (): StoryService => new StoryService(host.getPrisma())
  const characters = (): CharacterService => new CharacterService(host.getPrisma())
  const scenes = (): SceneService => new SceneService(host.getPrisma())
  const props = (): PropService => new PropService(host.getPrisma())
  const costumes = (): CostumeService => new CostumeService(host.getPrisma())
  const timeline = (): TimelinePersistenceService =>
    new TimelinePersistenceService(host.getPrisma())

  let generationService: GenerationService | null = null
  const generation = (): GenerationService => {
    if (!generationService) {
      generationService = new GenerationService(host.getPrisma(), aiClient, {
        mediaRoot: mediaRoot(),
        settings
      })
    }
    return generationService
  }

  const rebindAi = (next: AppSettings): void => {
    settings = next
    aiClient = new GrokCliClient(settings)
    generation().rebindAi(aiClient, settings)
  }

  const userDataPath = (): string => host.userData

// ─── Stories ───────────────────────────────────────────────
  reg(
    'stories:list',
    (async () => stories().list())
  )
  reg(
    'stories:get',
    (async ( id: string) => stories().get(id))
  )
  reg(
    'stories:create',
    (async ( input: CreateStoryInput) => stories().create(input))
  )
  reg(
    'stories:update',
    (
      async (
        id: string,
        data: {
          title?: string
          status?: string
          styleNote?: string | null
          coverPath?: string | null
          refGalleryJson?: string | null
        }
      ) => stories().update(id, data)
    )
  )

  /** Poster / list cover for a story (pure generate by default). */
  reg(
    'stories:generateCover',
    (
      async (
        payload: {
          storyId: string
          referenceImagePath?: string | null
          useIdentityEdit?: boolean
          idea?: string | null
          locale?: 'zh-HK' | 'en'
        }
      ) => {
        const locale = payload.locale === 'en' ? 'en' : 'zh-HK'
        const row = await stories().get(payload.storyId)
        const title = String(
          (row as { title?: string }).title ??
            (locale === 'en' ? 'Story' : '故事')
        )
        const styleNote =
          typeof (row as { styleNote?: string | null }).styleNote === 'string'
            ? (row as { styleNote: string }).styleNote
            : ''
        const idea = (payload.idea ?? '').trim()
        const {
          aspectFromImageSize
        } = await import('../types/settings')
        const { getArtStyle } = await import(
          '../domain/characterArtStyles'
        )
        const artStyle = getArtStyle(
          (row as { artStyle?: string | null }).artStyle ?? undefined
        )
        const size = settings.imageSizeWide || '1792x1024'
        const aspectRatio = aspectFromImageSize(size)
        // Image models follow English technical instructions best; story text
        // (title / style / idea) is kept in the user's UI language.
        const prompt =
          locale === 'en'
            ? [
                'PROFESSIONAL SHORT-DRAMA POSTER / KEY ART (16:9 cinematic still).',
                'Not a UI mockup. No text, no logo, no watermark, no title caption.',
                `Story title (mood only, do not letter it): ${title}.`,
                artStyle.promptBlock,
                styleNote ? `Style bible: ${styleNote}` : '',
                idea ? `Extra direction: ${idea}` : '',
                'Evocative establishing mood frame suitable as a library card cover.',
                'Match the art medium; strong silhouette and readable mood.'
              ]
                .filter(Boolean)
                .join(' ')
            : [
                'PROFESSIONAL SHORT-DRAMA POSTER / KEY ART (16:9 cinematic still).',
                'Not a UI mockup. No text, no logo, no watermark, no title caption.',
                `故事標題（只取氣氛，畫面勿寫出文字）：${title}。`,
                artStyle.promptBlock,
                styleNote ? `風格備註：${styleNote}` : '',
                idea ? `額外方向：${idea}` : '',
                '適合用作片庫封面的情緒建立鏡頭；強烈剪影、可讀氣氛。',
                '依藝術風格 medium 出圖；構圖清晰。'
              ]
                .filter(Boolean)
                .join(' ')
        const explicitRef =
          typeof payload.referenceImagePath === 'string' &&
          payload.referenceImagePath.trim()
            ? payload.referenceImagePath.trim()
            : null
        const refPath =
          explicitRef && existsSync(explicitRef) ? explicitRef : null
        const usedEdit = Boolean(
          payload.useIdentityEdit === true && refPath
        )
        const editPrefix =
          locale === 'en'
            ? 'IMAGE EDIT: create a new short-drama poster composition. Keep identity/mood of subjects if present. '
            : 'IMAGE EDIT：以新構圖創作短劇海報。保留主體身份／氣氛（如有）。'
        const img = usedEdit
          ? await aiClient.editImage({
              prompt: editPrefix + prompt,
              imagePath: refPath!,
              size,
              aspectRatio
            })
          : await aiClient.generateImage({ prompt, size, aspectRatio })
        const store = generation().getMediaStore()
        store.ensureTmpDir()
        const outPath = store.tmpImagePath('story_cover', '.png')
        writeFileSync(outPath, Buffer.from(img.b64, 'base64'))
        return {
          path: outPath,
          draft: true,
          usedEdit,
          label: locale === 'en' ? 'Story cover' : '故事封面'
        }
      }
    )
  )

  reg(
    'stories:commitCover',
    (
      async (
        payload: { storyId: string; path: string; label?: string }
      ) => {
        const row = await stories().get(payload.storyId)
        if (!payload.path || !existsSync(payload.path)) {
          throw new AppError('NOT_FOUND', 'Draft cover file not found')
        }
        const store = generation().getMediaStore()
        const finalPath = store.promoteTmpStoryImage(
          payload.storyId,
          payload.path,
          'cover'
        )
        const {
          appendGalleryItem,
          parseCharacterGallery,
          serializeCharacterGallery
        } = await import('../domain/characterGallery')
        const gallery = parseCharacterGallery(
          (row as { refGalleryJson?: string | null }).refGalleryJson,
          {
            refImagePath: (row as { coverPath?: string | null }).coverPath
          }
        )
        const nextGallery = appendGalleryItem(gallery, {
          path: finalPath,
          kind: 'sheet',
          label: payload.label ?? 'Story cover'
        })
        const updated = await stories().update(payload.storyId, {
          coverPath: finalPath,
          refGalleryJson: serializeCharacterGallery(nextGallery)
        })
        return {
          story: updated,
          path: finalPath,
          gallery: nextGallery
        }
      }
    )
  )
  reg(
    'stories:delete',
    (async ( id: string) => stories().delete(id))
  )
  reg(
    'stories:seedDemo',
    (async ( locale?: 'zh-HK' | 'en') => {
      const result = await new DemoSeedService(host.getPrisma()).seed(locale ?? 'zh-HK')
      settingsStore.save({ firstRunSeen: true })
      return result
    })
  )

  /** AI style bible from title / idea. */
  reg(
    'stories:aiFillMeta',
    (
      async (
        payload: {
          storyId?: string
          title?: string
          idea?: string
          existingStyleNote?: string | null
          locale?: 'zh-HK' | 'en'
        }
      ) => {
        const locale = payload.locale ?? 'zh-HK'
        let title = payload.title?.trim() || ''
        let existingStyleNote = payload.existingStyleNote
        if (payload.storyId) {
          const s = await stories().get(payload.storyId)
          title = title || s.title
          existingStyleNote =
            existingStyleNote ?? (s as { styleNote?: string | null }).styleNote
        }
        if (!title && !payload.idea?.trim()) {
          throw new AppError(
            'VALIDATION',
            'Title or idea is required',
            'Enter a story title or idea first'
          )
        }
        const {
          buildStoryMetaSystemPrompt,
          buildStoryMetaUserPrompt,
          extractStyleNoteJson
        } = await import('../domain/storyMasterPrompt')
        const contextSnippets: string[] = []
        if (payload.storyId) {
          const full = await host.getPrisma().story.findUnique({
            where: { id: payload.storyId },
            include: {
              storyCharacters: {
                take: 16,
                include: { character: true }
              },
              storyScenes: {
                take: 16,
                include: { scene: true },
                orderBy: { sceneNumber: 'asc' }
              },
              storyProps: { take: 12, include: { prop: true } }
            }
          })
          for (const link of full?.storyCharacters ?? []) {
            const c = link.character
            contextSnippets.push(
              `cast: ${c.name} — ${(c.description || c.appearance || '').slice(0, 120)}`
            )
          }
          for (const link of full?.storyScenes ?? []) {
            const s = link.scene
            contextSnippets.push(
              `scene #${link.sceneNumber}: ${(s.title || s.description || '').slice(0, 100)}`
            )
          }
          for (const link of full?.storyProps ?? []) {
            contextSnippets.push(`prop: ${link.prop.name}`)
          }
        }
        const completion = await aiClient.chat({
          messages: [
            {
              role: 'system',
              content: buildStoryMetaSystemPrompt(locale)
            },
            {
              role: 'user',
              content: buildStoryMetaUserPrompt({
                title: title || (locale === 'en' ? 'Untitled short drama' : '未命名短劇'),
                idea: payload.idea,
                existingStyleNote,
                contextSnippets,
                locale
              })
            }
          ],
          max_tokens: 800
        })
        const raw = completion.choices[0]?.message.content ?? ''
        const styleNote = extractStyleNoteJson(raw)
        activity.append({
          kind: 'story',
          message: 'aiFillMeta',
          storyId: payload.storyId,
          meta: { chars: styleNote.length }
        })
        return { styleNote, raw }
      }
    )
  )

  /**
   * AI script beats → optional replace timeline entries.
   * Maps character/scene/prop names to cast ids when possible.
   */
  reg(
    'stories:aiFillScript',
    (
      async (
        payload: {
          storyId: string
          idea?: string
          locale?: 'zh-HK' | 'en'
          /** When true, delete existing timeline then create new beats */
          replace?: boolean
        }
      ) => {
        const locale = payload.locale ?? 'zh-HK'
        if (!payload.storyId) {
          throw new AppError('VALIDATION', 'storyId is required')
        }
        const story = await stories().get(payload.storyId)
        const {
          buildStoryBeatsSystemPrompt,
          buildStoryBeatsUserPrompt,
          extractStoryBeatsJson,
          resolveBeatIds
        } = await import('../domain/storyMasterPrompt')
        const completion = await aiClient.chat({
          messages: [
            {
              role: 'system',
              content: buildStoryBeatsSystemPrompt(locale)
            },
            {
              role: 'user',
              content: buildStoryBeatsUserPrompt({
                title: story.title,
                styleNote: (story as { styleNote?: string | null }).styleNote,
                idea: payload.idea,
                characters: story.characters.map((c) => ({
                  name: c.name,
                  description: [
                    c.description,
                    c.appearance,
                    c.costume,
                    c.personality
                  ]
                    .filter(Boolean)
                    .join(' · ')
                    .slice(0, 200)
                })),
                scenes: story.scenes.map((s) => ({
                  sceneNumber: s.sceneNumber,
                  title: s.title,
                  description: [s.description, s.script]
                    .filter(Boolean)
                    .join(' | ')
                    .slice(0, 220)
                })),
                props: story.props.map((p) => ({
                  name: p.name,
                  description: p.description
                })),
                locale
              })
            }
          ],
          max_tokens: 3500
        })
        const raw = completion.choices[0]?.message.content ?? ''
        const drafts = extractStoryBeatsJson(raw, locale)
        const cast = {
          characters: story.characters.map((c) => ({
            id: c.id,
            name: c.name
          })),
          scenes: story.scenes.map((s) => ({
            id: s.id,
            sceneNumber: s.sceneNumber,
            title: s.title,
            description: s.description
          })),
          props: story.props.map((p) => ({ id: p.id, name: p.name }))
        }

        if (payload.replace !== false) {
          await host.getPrisma().timelineEntry.deleteMany({
            where: { storyId: payload.storyId }
          })
        }

        const created: Array<{
          id: string
          dialogue: string
          beatContentJson: string | null
          characterId: string | null
          sceneId: string | null
          propId: string | null
          order: number
        }> = []
        let orderBase = 0
        let timeCursor = 0
        if (payload.replace === false) {
          const max = await host.getPrisma().timelineEntry.aggregate({
            where: { storyId: payload.storyId },
            _max: { order: true, endTime: true }
          })
          orderBase = (max._max.order ?? -1) + 1
          timeCursor = max._max.endTime ?? 0
        }
        const { serializeIdList } = await import(
          '../domain/timelineBindings'
        )
        const { snapVideoSeconds } = await import(
          '../domain/videoDuration'
        )
        for (let i = 0; i < drafts.length; i++) {
          const ids = resolveBeatIds(drafts[i], cast)
          const order = orderBase + i
          // AI video hard limit is 6|10s — never create beats longer than that
          // or multi-select / dialogue save will fail validation on update.
          const dur = snapVideoSeconds(
            typeof ids.durationSeconds === 'number'
              ? ids.durationSeconds
              : 6
          )
          const start = timeCursor
          const end = start + dur
          timeCursor = end
          const row = await host.getPrisma().timelineEntry.create({
            data: {
              storyId: payload.storyId,
              startTime: start,
              endTime: end,
              order,
              dialogue: drafts[i].dialogue || drafts[i].scriptText,
              beatContentJson: drafts[i].beatContentJson,
              characterId: ids.characterId,
              sceneId: ids.sceneId,
              propId: ids.propId,
              characterIds: serializeIdList(ids.characterIds),
              sceneIds: serializeIdList(ids.sceneIds),
              propIds: serializeIdList(ids.propIds)
            }
          })
          created.push({
            id: row.id,
            dialogue: row.dialogue ?? '',
            beatContentJson:
              (row as { beatContentJson?: string | null }).beatContentJson ??
              null,
            characterId: row.characterId,
            sceneId: row.sceneId,
            propId: row.propId,
            order: row.order
          })
        }
        activity.append({
          kind: 'story',
          message: 'aiFillScript',
          storyId: payload.storyId,
          meta: { beats: created.length, replace: payload.replace !== false }
        })
        return { beats: created, drafts, raw }
      }
    )
  )

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
              '../domain/characterCostumes'
            )
            existingNames = parseCharacterCostumes(
              (row as { costumesJson?: string | null }).costumesJson
            ).map((c) => c.name)
          }
        }
        if (!characterName) {
          throw new AppError('VALIDATION', 'Character name is required')
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
          if (!story) throw new AppError('NOT_FOUND', `Story not found: ${storyId}`)
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
              throw new AppError('VALIDATION', 'Scene not linked to this story')
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
              throw new AppError('VALIDATION', 'Timeline beat not found')
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
            throw new AppError('VALIDATION', `Unknown segmentKey: ${seg}`)
          }
        } else {
          segmentLabel =
            locale === 'en' ? 'No story selected' : '未選故事（僅角色資料）'
        }

        const {
          buildWardrobeSuggestSystemPrompt,
          buildWardrobeSuggestUserPrompt,
          extractWardrobeSuggestionJson
        } = await import('../domain/wardrobeSuggest')
        const completion = await aiClient.chat({
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
        const text = completion.choices[0]?.message.content ?? ''
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
        if (!idea && !hasDraft && !hasSoul) {
          throw new AppError(
            'VALIDATION',
            'Idea, profile draft, or soul content is required'
          )
        }
        // Character invent uses only idea + form + soul (not the open story’s style).
        // Scene / clip / wardrobe flows own story continuity.
        const { shouldInjectStoryContextForCharacter } = await import(
          '../domain/storyContextPolicy'
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
        const completion = await aiClient.chat({
          messages: [
            {
              role: 'system',
              content: buildCharacterMasterSystemPrompt(locale)
            },
            {
              role: 'user',
              content: buildCharacterMasterUserPrompt({
                idea:
                  idea ||
                  (locale === 'en'
                    ? 'Polish and merge all fields'
                    : '全面潤飾並合併所有欄位'),
                storyTitle,
                styleNote,
                locale,
                existingDraft,
                soulContent: hasSoul ? soulContent : null
              })
            }
          ],
          max_tokens: 3000
        })
        const text = completion.choices[0]?.message.content ?? ''
        const profile = extractCharacterProfileJson(text)
        activity.append({
          kind: 'character',
          message: hasDraft || hasSoul ? 'aiRefine' : 'aiFill',
          storyId: payload.storyId,
          meta: {
            name: profile.name,
            usedSoul: hasSoul,
            usedDraft: hasDraft
          }
        })
        return {
          profile,
          profileJson: JSON.stringify(profile, null, 2),
          raw: text
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
            'Character profile is empty',
            'Fill name or appearance / personality first'
          )
        }
        // Soul from profile + existing soul + user request only.
        const locale = payload.locale ?? 'zh-HK'
        const completion = await aiClient.chat({
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
        const raw = completion.choices[0]?.message.content ?? ''
        const content = normalizeSoulMarkdown(raw)
        if (!content || content.length < 40) {
          throw new AppError(
            'AI_FAILED',
            'Soul generation returned empty content',
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
          visualTags: row.visualTags ?? undefined
        }
        const { getSheetVariant } = await import(
          '../domain/characterSheetVariants'
        )
        const { getArtStyle } = await import(
          '../domain/characterArtStyles'
        )
        const { resolveSheetGenMode } = await import(
          '../domain/characterMasterPrompt'
        )
        const variantDef = getSheetVariant(payload.variant)
        const variant = variantDef.id
        const artStyle = getArtStyle(
          payload.artStyle ?? row.artStyle ?? undefined
        ).id
        // Sizes / enhance from Settings (all have defaults)
        const {
          aspectFromImageSize,
          imageSizeForSheetVariant
        } = await import('../types/settings')
        const size = imageSizeForSheetVariant(settings, variant)
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
        // Only use a ref when UI explicitly requests identity edit (do not auto-pick gallery[0])
        const explicitRef =
          !forcePureLayout &&
          typeof payload.referenceImagePath === 'string' &&
          payload.referenceImagePath.trim()
            ? payload.referenceImagePath.trim()
            : null
        const refPath =
          explicitRef && existsSync(explicitRef) ? explicitRef : null
        const hasValidRef = Boolean(refPath)
        const usedEdit =
          !forcePureLayout &&
          resolveSheetGenMode({
            useIdentityEdit: payload.useIdentityEdit,
            hasValidRef
          }) === 'edit'
        const prompt = usedEdit
          ? buildCharacterSheetEditPrompt(profile, variant, artStyle)
          : buildCharacterSheetImagePrompt(profile, variant, artStyle)

        // Persist style before long gen so reload/UI stay in sync
        if (payload.artStyle || row.artStyle !== artStyle) {
          await characters().update(row.id, { artStyle })
        }

        const img = usedEdit
          ? await aiClient.editImage({
              prompt,
              imagePath: refPath!,
              size,
              aspectRatio
            })
          : await aiClient.generateImage({
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
          '../infrastructure/media/imageEnhance'
        )
        const enhanced = enhanceCharacterImage(outPath, {
          enabled: settings.imageEnhance,
          maxEdge: settings.imageEnhanceMaxEdge,
          scale: settings.imageEnhanceScale
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
        const primary = primaryGalleryPath(nextGallery)
        const updated = await characters().update(row.id, {
          refSheetPath: outPath,
          refImagePath: primary,
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
            'Source image is required',
            'Select a reference still first'
          )
        }
        if (!aiClient.generateVideo) {
          throw new AppError(
            'AI_UNAVAILABLE',
            'Video generation is not available',
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
          settings.aspectRatio === '9:16' || settings.aspectRatio === '16:9'
            ? settings.aspectRatio
            : '16:9'

        const {
          polishThenGenerateVideo
        } = await import('../application/video/polishVideoPrompt')
        const {
          buildIntroVideoPolishUserPrompt,
          truncateForVideoPrompt
        } = await import('../domain/videoPromptPolish')

        const result = await polishThenGenerateVideo({
          ai: aiClient,
          locale,
          fallbackPrompt,
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
            soulExcerpt: truncateForVideoPrompt(soulExcerpt)
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
          throw new AppError('NOT_FOUND', 'Draft sheet file not found')
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
          '../domain/characterSheetVariants'
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
          } = await import('../domain/characterCostumes')
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
            'Costume description is required for costume swap'
          )
        }

        const {
          buildCostumeSwapPrompt,
          costumeSwapGalleryLabel,
          getCostumeSwapPose,
          pickBestBaseImage
        } = await import('../domain/costumeSwap')
        const { getArtStyle } = await import(
          '../domain/characterArtStyles'
        )
        const {
          aspectFromImageSize
        } = await import('../types/settings')

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
            ? settings.imageSizeWide
            : pose.id === 'three_quarter'
              ? settings.imageSizeSquare
              : settings.imageSizeTall
        const aspectRatio = aspectFromImageSize(size)

        const img = await aiClient.editImage({
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
          '../infrastructure/media/imageEnhance'
        )
        const enhanced = enhanceCharacterImage(outPath, {
          enabled: settings.imageEnhance,
          maxEdge: settings.imageEnhanceMaxEdge,
          scale: settings.imageEnhanceScale
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

  // ─── SoulMD Hub (public catalogue) ─────────────────────────
  let soulIndexBuilding: Promise<unknown> | null = null
  const soulHub = new SoulMdHubClient()

  reg(
    'souls:list',
    (
      async (
        opts?: { page?: number; limit?: number; q?: string; role?: string }
      ) => soulHub.listSouls({ ...opts, is_nft: 0 })
    )
  )
  reg(
    'souls:get',
    (async ( id: number) => {
      const detail = await soulHub.getSoul(id)
      const flat = SoulMdHubClient.flattenContent(
        detail.content,
        detail.file_type
      )
      return { ...detail, contentFlat: flat }
    })
  )
  reg(
    'souls:categories',
    (async () => soulHub.listCategories())
  )
  reg(
    'souls:ensureIndex',
    (async ( force?: boolean) => {
      const cached = SoulMdHubClient.loadCache(userDataPath())
      if (cached && !force && cached.items.length > 0) {
        return {
          fromCache: true,
          pages: cached.pages,
          count: cached.items.length,
          builtAt: cached.builtAt,
          suggestions: cached.suggestions
        }
      }
      if (!soulIndexBuilding) {
        soulIndexBuilding = soulHub
          .buildIndex(50)
          .then((idx) => {
            SoulMdHubClient.saveCache(userDataPath(), idx)
            return idx
          })
          .finally(() => {
            soulIndexBuilding = null
          })
      }
      const idx = (await soulIndexBuilding) as Awaited<
        ReturnType<SoulMdHubClient['buildIndex']>
      >
      return {
        fromCache: false,
        pages: idx.pages,
        count: idx.items.length,
        builtAt: idx.builtAt,
        suggestions: idx.suggestions
      }
    })
  )
  reg(
    'souls:suggestions',
    (async () => {
      const cached = SoulMdHubClient.loadCache(userDataPath())
      if (cached) return cached.suggestions
      return []
    })
  )
  reg(
    'souls:searchLocal',
    (async ( q: string, limit?: number) => {
      const cached = SoulMdHubClient.loadCache(userDataPath())
      if (!cached) return { items: [] as unknown[], fromCache: false }
      return {
        items: SoulMdHubClient.filterIndex(cached, q, limit ?? 24),
        fromCache: true
      }
    })
  )
  reg(
    'characters:importSoulMd',
    (async () => {
      const win = host.getMainWindow()
      const options: OpenDialogOptionsLike = {
        title: 'Import soul.md',
        filters: [{ name: 'Markdown', extensions: ['md'] }],
        properties: ['openFile']
      }
      const result = win
        ? await host.dialog.showOpenDialog(win, options)
        : await host.dialog.showOpenDialog(options)

      if (result.canceled || result.filePaths.length === 0) return null

      const filePath = result.filePaths[0]
      if (!existsSync(filePath) || !isSoulMdPath(filePath)) {
        throw new AppError('VALIDATION', 'Selected file must be a .md soul file')
      }
      const content = readFileSync(filePath, 'utf-8')
      return { filePath, content }
    })
  )

  /**
   * Load full soul.md text for display in the editor.
   * Supports local filesystem paths and soulmd-hub://{id}.
   */
  reg(
    'characters:readSoulContent',
    (
      async (
        payload: {
          soulMdPath?: string | null
          soulHubId?: number | null
        }
      ) => {
        if (payload.soulHubId != null && Number.isFinite(payload.soulHubId)) {
          const detail = await soulHub.getSoul(payload.soulHubId)
          const flat = SoulMdHubClient.flattenContent(
            detail.content,
            detail.file_type
          )
          return {
            source: 'hub' as const,
            id: detail.id,
            title: detail.title,
            content: flat || ''
          }
        }
        const path = payload.soulMdPath?.trim()
        if (!path) {
          return { source: 'none' as const, content: '' }
        }
        if (path.startsWith('soulmd-hub://')) {
          const id = Number(path.replace('soulmd-hub://', ''))
          if (!Number.isFinite(id)) {
            throw new AppError('VALIDATION', 'Invalid soulmd-hub id')
          }
          const detail = await soulHub.getSoul(id)
          const flat = SoulMdHubClient.flattenContent(
            detail.content,
            detail.file_type
          )
          return {
            source: 'hub' as const,
            id: detail.id,
            title: detail.title,
            content: flat || ''
          }
        }
        if (!existsSync(path)) {
          throw new AppError('NOT_FOUND', `soul.md not found: ${path}`)
        }
        const content = readFileSync(path, 'utf-8')
        return {
          source: 'file' as const,
          path,
          content
        }
      }
    )
  )

  /**
   * Persist soul.md text the user edited in the character form.
   * Reuses a local path when possible; otherwise writes under media/tmp.
   */
  reg(
    'characters:writeSoulContent',
    (
      async (
        payload: {
          content: string
          filePath?: string | null
          characterId?: string | null
        }
      ) => {
        const content = payload.content ?? ''
        const store = generation().getMediaStore()
        store.ensureTmpDir()
        let dest = payload.filePath?.trim() || ''
        // Hub pseudo-paths and missing files → new local file
        if (
          !dest ||
          dest.startsWith('soulmd-hub://') ||
          dest.startsWith('http://') ||
          dest.startsWith('https://') ||
          !existsSync(dest)
        ) {
          const slug = (payload.characterId || 'character')
            .replace(/[^\w\u4e00-\u9fff-]+/g, '_')
            .slice(0, 40)
          dest = store.tmpImagePath(`soul_edit_${slug}`, '.md')
        }
        writeFileSync(dest, content, 'utf8')
        activity.append({
          kind: 'character',
          message: 'writeSoulContent',
          meta: { path: dest, chars: content.length }
        })
        return { filePath: dest, content }
      }
    )
  )

  reg(
    'characters:importSoulMdUrl',
    (async ( url: string) => {
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        throw new AppError('VALIDATION', 'URL must start with http:// or https://')
      }
      const res = await fetch(url, { signal: AbortSignal.timeout(15000) })
      if (!res.ok) {
        throw new AppError('IO', `Failed to fetch soul.md (${res.status})`)
      }
      const content = await res.text()
      const doc = parseSoulMd(content)
      return {
        url,
        content,
        name: doc.title ?? extractNameFromSoulMd(content),
        description: extractDescriptionFromSoulMd(content),
        parsed: doc
      }
    })
  )

  // ─── Scenes ────────────────────────────────────────────────
  reg(
    'scenes:list',
    (
      async (
        storyIdOrOpts?: string | { storyId?: string; q?: string; forStory?: boolean }
      ) => {
        if (typeof storyIdOrOpts === 'string' && storyIdOrOpts) {
          return scenes().listForStory(storyIdOrOpts)
        }
        if (
          storyIdOrOpts &&
          typeof storyIdOrOpts === 'object' &&
          storyIdOrOpts.forStory &&
          storyIdOrOpts.storyId
        ) {
          return scenes().listForStory(storyIdOrOpts.storyId)
        }
        const q =
          storyIdOrOpts && typeof storyIdOrOpts === 'object'
            ? storyIdOrOpts.q
            : undefined
        return scenes().list({ q })
      }
    )
  )
  reg(
    'scenes:create',
    (async ( input: CreateSceneInput) => scenes().create(input))
  )
  reg(
    'scenes:update',
    (async ( id: string, data: UpdateSceneInput) => scenes().update(id, data))
  )
  reg(
    'scenes:delete',
    (async ( id: string) => scenes().delete(id))
  )

  reg(
    'scenes:aiFill',
    (
      async (
        payload: {
          idea?: string
          storyId?: string
          /** all | scene:<id> | beat:<timelineEntryId> */
          segmentKey?: string | null
          locale?: 'zh-HK' | 'en'
          existingDraft?: Record<string, string | undefined | null>
          suggestFromStory?: boolean
          sceneNumber?: number
        }
      ) => {
        const {
          buildSceneMasterSystemPrompt,
          buildSceneMasterUserPrompt,
          buildSceneSuggestFromStoryUserPrompt,
          extractSceneProfileJson
        } = await import('../domain/sceneMasterPrompt')
        const locale = payload.locale ?? 'zh-HK'
        let storyTitle: string | undefined
        let styleNote: string | null | undefined
        const characterSnippets: string[] = []
        const propSnippets: string[] = []
        const priorSceneSnippets: string[] = []
        const existingTitles: string[] = []
        let segmentLabel: string | null = null
        let focusSnippets: string[] = []
        const draft = payload.existingDraft
        const hasDraft = Boolean(
          draft &&
            Object.values(draft).some((v) => typeof v === 'string' && v.trim())
        )
        const idea = payload.idea?.trim() ?? ''
        if (!idea && !hasDraft && !payload.suggestFromStory) {
          throw new AppError(
            'VALIDATION',
            'Idea, draft, or suggestFromStory is required'
          )
        }
        if (payload.suggestFromStory && !payload.storyId?.trim()) {
          throw new AppError('VALIDATION', 'storyId is required for suggestFromStory')
        }
        // Pure invent-from-idea: only user idea (+ empty form). Inject story
        // cast/style only when refining a draft or explicitly suggesting from story.
        const { shouldInjectStoryContext } = await import(
          '../domain/storyContextPolicy'
        )
        const injectStoryContext = shouldInjectStoryContext({
          hasDraft,
          suggestFromStory: Boolean(payload.suggestFromStory)
        })
        if (payload.storyId && injectStoryContext) {
          const story = await host.getPrisma().story.findUnique({
            where: { id: payload.storyId },
            include: {
              storyCharacters: {
                take: 12,
                include: { character: true }
              },
              storyProps: { take: 12, include: { prop: true } },
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
          if (!story) {
            throw new AppError('NOT_FOUND', `Story not found: ${payload.storyId}`)
          }
          storyTitle = story.title
          styleNote = story.styleNote
          for (const link of story.storyCharacters ?? []) {
            const c = link.character
            characterSnippets.push(
              `${c.name}: ${(c.description || '').slice(0, 120)} | costume: ${(c.costume || '').slice(0, 80)}`
            )
          }
          for (const link of story.storyProps ?? []) {
            const p = link.prop
            propSnippets.push(`${p.name}: ${(p.description || '').slice(0, 100)}`)
          }
          for (const link of story.storyScenes ?? []) {
            const s = link.scene
            existingTitles.push(s.title || s.description.slice(0, 40))
            priorSceneSnippets.push(
              `#${link.sceneNumber} ${s.title || ''}: ${s.description.slice(0, 200)}`
            )
          }

          // Resolve plot focus for suggest-from-story
          if (payload.suggestFromStory) {
            const seg = (payload.segmentKey ?? 'all').trim() || 'all'
            if (seg === 'all') {
              segmentLabel =
                locale === 'en' ? 'Entire story (all scenes)' : '全劇（所有場次）'
              focusSnippets = story.storyScenes.map((link) => {
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
              for (const beat of story.timeline.slice(0, 12)) {
                if (!beat.dialogue?.trim()) continue
                const who = beat.character?.name ?? '?'
                focusSnippets.push(
                  `Beat ${beat.order + 1} [${who}]: ${beat.dialogue.slice(0, 300)}`
                )
              }
            } else if (seg.startsWith('scene:')) {
              const sceneId = seg.slice('scene:'.length)
              const link = story.storyScenes.find((l) => l.sceneId === sceneId)
              if (!link) {
                throw new AppError(
                  'VALIDATION',
                  'Scene not linked to this story'
                )
              }
              const s = link.scene
              const script = link.scriptOverride ?? s.script
              segmentLabel =
                locale === 'en'
                  ? `Scene ${link.sceneNumber}: ${s.title || s.description.slice(0, 40)}`
                  : `第 ${link.sceneNumber} 場：${s.title || s.description.slice(0, 40)}`
              focusSnippets = [
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
                focusSnippets.push(
                  `Dialogue [${who}]: ${beat.dialogue.slice(0, 400)}`
                )
              }
            } else if (seg.startsWith('beat:')) {
              const entryId = seg.slice('beat:'.length)
              const beat = story.timeline.find((e) => e.id === entryId)
              if (!beat) {
                throw new AppError('VALIDATION', 'Timeline beat not found')
              }
              const who =
                beat.character?.name ??
                (locale === 'en' ? 'Unknown' : '未指定')
              const where =
                beat.scene?.title ||
                beat.scene?.description?.slice(0, 40) ||
                ''
              segmentLabel =
                locale === 'en'
                  ? `Beat ${beat.order + 1} · ${who}${where ? ` @ ${where}` : ''}`
                  : `段落 ${beat.order + 1} · ${who}${where ? ` @ ${where}` : ''}`
              focusSnippets = [
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
              throw new AppError('VALIDATION', `Unknown segmentKey: ${seg}`)
            }
          }
        }
        const userContent = payload.suggestFromStory
          ? buildSceneSuggestFromStoryUserPrompt({
              storyTitle: storyTitle || 'Untitled',
              styleNote,
              locale,
              sceneNumber: payload.sceneNumber ?? existingTitles.length + 1,
              existingSceneTitles: existingTitles,
              characterSnippets,
              propSnippets,
              priorSceneSnippets,
              segmentLabel,
              focusSnippets
            })
          : buildSceneMasterUserPrompt({
              idea: idea || (locale === 'en' ? 'Polish' : '全面潤飾'),
              storyTitle,
              styleNote,
              locale,
              characterSnippets,
              propSnippets,
              priorSceneSnippets,
              existingDraft: (hasDraft
                ? {
                    title: draft?.title ?? undefined,
                    description: draft?.description ?? undefined,
                    script: draft?.script ?? undefined,
                    locationType: draft?.locationType ?? undefined,
                    timeOfDay: draft?.timeOfDay ?? undefined,
                    weather: draft?.weather ?? undefined,
                    mood: draft?.mood ?? undefined,
                    lighting: draft?.lighting ?? undefined,
                    colorPalette: draft?.colorPalette ?? undefined,
                    setDressing: draft?.setDressing ?? undefined,
                    soundscape: draft?.soundscape ?? undefined,
                    cameraNotes: draft?.cameraNotes ?? undefined,
                    visualTags: draft?.visualTags ?? undefined,
                    artStyle: draft?.artStyle ?? undefined
                  }
                : null) as Partial<SceneProfileFields> | null
            })
        const completion = await aiClient.chat({
          messages: [
            {
              role: 'system',
              content: buildSceneMasterSystemPrompt(locale)
            },
            { role: 'user', content: userContent }
          ],
          max_tokens: 2500
        })
        const text = completion.choices[0]?.message.content ?? ''
        const profile = extractSceneProfileJson(text)
        activity.append({
          kind: 'scene',
          message: payload.suggestFromStory
            ? 'suggestScene'
            : hasDraft
              ? 'aiRefineScene'
              : 'aiFillScene',
          storyId: payload.storyId,
          meta: {
            title: profile.title,
            segmentKey: payload.segmentKey ?? null
          }
        })
        return {
          profile,
          profileJson: JSON.stringify(profile, null, 2),
          raw: text
        }
      }
    )
  )

  reg(
    'scenes:generatePlate',
    (
      async (
        payload: {
          sceneId: string
          variant?: string
          referenceImagePath?: string | null
          useIdentityEdit?: boolean
          persist?: boolean
          artStyle?: string | null
        }
      ) => {
        const row = await scenes().get(payload.sceneId)
        const persist = payload.persist === true
        const {
          buildScenePlateEditPrompt,
          buildScenePlateImagePrompt,
          getScenePlateVariant
        } = await import('../domain/scenePlateVariants')
        const { getArtStyle } = await import(
          '../domain/characterArtStyles'
        )
        const {
          appendSceneGalleryItem,
          parseSceneGallery,
          primarySceneGalleryPath,
          serializeSceneGallery
        } = await import('../domain/sceneGallery')
        const {
          aspectFromImageSize,
          imageSizeForScenePlate
        } = await import('../types/settings')

        const variantDef = getScenePlateVariant(payload.variant)
        const variant = variantDef.id
        const artStyle = getArtStyle(
          payload.artStyle ?? row.artStyle ?? undefined
        ).id
        const size = imageSizeForScenePlate(settings, variant)
        const aspectRatio = aspectFromImageSize(size)
        const profile = {
          title: row.title ?? undefined,
          description: row.description,
          locationType: row.locationType ?? undefined,
          timeOfDay: row.timeOfDay ?? undefined,
          weather: row.weather ?? undefined,
          mood: row.mood ?? undefined,
          lighting: row.lighting ?? undefined,
          colorPalette: row.colorPalette ?? undefined,
          setDressing: row.setDressing ?? undefined,
          visualTags: row.visualTags ?? undefined
        }
        const gallery = parseSceneGallery(row.refGalleryJson, {
          refImagePath: row.refImagePath
        })
        const explicitRef =
          typeof payload.referenceImagePath === 'string' &&
          payload.referenceImagePath.trim()
            ? payload.referenceImagePath.trim()
            : null
        const refPath =
          explicitRef && existsSync(explicitRef) ? explicitRef : null
        const { resolveSheetGenMode } = await import(
          '../domain/characterMasterPrompt'
        )
        const usedEdit =
          resolveSheetGenMode({
            useIdentityEdit: payload.useIdentityEdit,
            hasValidRef: Boolean(refPath)
          }) === 'edit'
        const prompt = usedEdit
          ? buildScenePlateEditPrompt(profile, variant, artStyle)
          : buildScenePlateImagePrompt(profile, variant, artStyle)

        if (payload.artStyle || row.artStyle !== artStyle) {
          await scenes().update(row.id, { artStyle })
        }

        const img = usedEdit
          ? await aiClient.editImage({
              prompt,
              imagePath: refPath!,
              size,
              aspectRatio
            })
          : await aiClient.generateImage({
              prompt,
              size,
              aspectRatio
            })

        const store = generation().getMediaStore()
        let outPath: string
        if (persist) {
          store.ensureLibraryDirs()
          outPath = store.sceneImagePath(row.id,
            `plate_${variant}`,
            '.png'
          )
        } else {
          store.ensureTmpDir()
          outPath = store.tmpImagePath(`scene_${variant}`, '.png')
        }
        writeFileSync(outPath, Buffer.from(img.b64, 'base64'))
        const { enhanceCharacterImage } = await import(
          '../infrastructure/media/imageEnhance'
        )
        const enhanced = enhanceCharacterImage(outPath, {
          enabled: settings.imageEnhance,
          maxEdge: settings.imageEnhanceMaxEdge,
          scale: settings.imageEnhanceScale
        })
        const label = variantDef.galleryLabel

        if (!persist) {
          activity.append({
            kind: 'scene',
            message: 'generatePlateDraft',
            storyId: undefined,
            meta: {
              sceneId: row.id,
              path: outPath,
              variant,
              artStyle,
              usedEdit
            }
          })
          return {
            scene: row,
            path: outPath,
            draft: true,
            label,
            variant,
            layer: variantDef.plateLayer,
            artStyle,
            usedEdit,
            enhance: enhanced,
            gallery
          }
        }

        const nextGallery = appendSceneGalleryItem(gallery, {
          path: outPath,
          kind: 'sheet',
          label,
          layer: variantDef.plateLayer
        })
        const primary = primarySceneGalleryPath(nextGallery)
        const updated = await scenes().update(row.id, {
          refImagePath: primary,
          refGalleryJson: serializeSceneGallery(nextGallery),
          artStyle
        })
        activity.append({
          kind: 'scene',
          message: 'generatePlate',
          storyId: undefined,
          meta: { sceneId: row.id, path: outPath, variant, artStyle }
        })
        return {
          scene: updated,
          path: outPath,
          draft: false,
          label,
          variant,
          layer: variantDef.plateLayer,
          artStyle,
          usedEdit,
          enhance: enhanced,
          gallery: nextGallery
        }
      }
    )
  )

  /**
   * Image → location intro / establishing video for one gallery still.
   * Uses full scene location bible in the prompt; space locked to the source plate.
   */
  reg(
    'scenes:generateIntroVideo',
    (
      async (
        payload: {
          sceneId: string
          sourceImagePath: string
          durationSeconds?: number
          locale?: 'zh-HK' | 'en'
        }
      ) => {
        const row = await scenes().get(payload.sceneId)
        const sourceImagePath = payload.sourceImagePath?.trim()
        if (!sourceImagePath || !existsSync(sourceImagePath)) {
          throw new AppError(
            'VALIDATION',
            'Source image is required',
            'Select a reference still first'
          )
        }
        if (!aiClient.generateVideo) {
          throw new AppError(
            'AI_UNAVAILABLE',
            'Video generation is not available',
            'Enable Grok gateway videoApi and use a key with agent/admin mode'
          )
        }

        const profile = {
          title: row.title ?? undefined,
          description: row.description || row.title || 'Scene',
          script: row.script ?? undefined,
          locationType: row.locationType ?? undefined,
          timeOfDay: row.timeOfDay ?? undefined,
          weather: row.weather ?? undefined,
          mood: row.mood ?? undefined,
          lighting: row.lighting ?? undefined,
          colorPalette: row.colorPalette ?? undefined,
          setDressing: row.setDressing ?? undefined,
          soundscape: row.soundscape ?? undefined,
          cameraNotes: row.cameraNotes ?? undefined,
          visualTags: row.visualTags ?? undefined,
          artStyle: (row as { artStyle?: string | null }).artStyle ?? undefined
        }
        const locale = payload.locale === 'en' ? 'en' : 'zh-HK'
        const fallbackPrompt = buildSceneIntroVideoPrompt(profile, locale)
        const store = generation().getMediaStore()
        store.ensureLibraryDirs()
        const outPath = store.sceneVideoPath(row.id, 'intro', '.mp4')
        const seconds =
          typeof payload.durationSeconds === 'number'
            ? payload.durationSeconds
            : 10
        const aspectRatio =
          settings.aspectRatio === '9:16' || settings.aspectRatio === '16:9'
            ? settings.aspectRatio
            : '16:9'

        const {
          polishThenGenerateVideo
        } = await import('../application/video/polishVideoPrompt')
        const {
          buildSceneIntroVideoPolishUserPrompt
        } = await import('../domain/videoPromptPolish')

        const result = await polishThenGenerateVideo({
          ai: aiClient,
          locale,
          fallbackPrompt,
          polishUserContent: buildSceneIntroVideoPolishUserPrompt({
            locale,
            seconds,
            aspectRatio,
            hasRefImage: true,
            fallbackPrompt,
            title: profile.title,
            description: profile.description,
            script: profile.script,
            locationType: profile.locationType,
            timeOfDay: profile.timeOfDay,
            weather: profile.weather,
            mood: profile.mood,
            lighting: profile.lighting,
            colorPalette: profile.colorPalette,
            setDressing: profile.setDressing,
            soundscape: profile.soundscape,
            cameraNotes: profile.cameraNotes,
            visualTags: profile.visualTags,
            artStyle: profile.artStyle,
            seedPrompt:
              (row as { seedPrompt?: string | null }).seedPrompt ?? undefined
          }),
          videoRequest: {
            durationSeconds: seconds,
            refImagePath: sourceImagePath,
            outputPath: outPath,
            aspectRatio
          }
        })

        const {
          parseSceneGallery,
          serializeSceneGallery,
          setSceneGalleryIntroVideo
        } = await import('../domain/sceneGallery')
        const gallery = parseSceneGallery(row.refGalleryJson, {
          refImagePath: row.refImagePath
        })
        const nextGallery = setSceneGalleryIntroVideo(
          gallery,
          sourceImagePath,
          result.outputPath
        )
        const updated = await scenes().update(row.id, {
          refGalleryJson: serializeSceneGallery(nextGallery)
        })
        activity.append({
          kind: 'scene',
          message: 'generateIntroVideo',
          meta: {
            sceneId: row.id,
            sourceImagePath,
            path: result.outputPath,
            seconds,
            degraded: result.degraded ?? false,
            polished: result.polished,
            promptPreview: result.promptUsed.slice(0, 200)
          }
        })
        return {
          scene: updated,
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

  reg(
    'scenes:commitPlate',
    (
      async (
        payload: {
          sceneId: string
          path: string
          variant?: string
          label?: string
          layer?: string
          atmosphereDescription?: string | null
        }
      ) => {
        const row = await scenes().get(payload.sceneId)
        if (!payload.path || !existsSync(payload.path)) {
          throw new AppError('NOT_FOUND', 'Draft plate file not found')
        }
        const store = generation().getMediaStore()
        const kind = `plate_${payload.variant ?? 'establishing'}`
        const finalPath = store.promoteTmpSceneImage(
          null,
          row.id,
          payload.path,
          kind
        )
        const {
          appendSceneGalleryItem,
          parseSceneGallery,
          primarySceneGalleryPath,
          serializeSceneGallery
        } = await import('../domain/sceneGallery')
        const { getScenePlateVariant, isScenePlateVariantId } = await import(
          '../domain/scenePlateVariants'
        )
        const gallery = parseSceneGallery(row.refGalleryJson, {
          refImagePath: row.refImagePath
        })
        const layer =
          payload.layer ||
          (payload.variant === 'atmosphere_swap'
            ? 'atmosphere'
            : isScenePlateVariantId(payload.variant)
              ? getScenePlateVariant(payload.variant).plateLayer
              : undefined)
        const nextGallery = appendSceneGalleryItem(gallery, {
          path: finalPath,
          kind: 'sheet',
          label: payload.label ?? 'Plate',
          ...(layer ? { layer } : {})
        })
        const primary = primarySceneGalleryPath(nextGallery)
        let looksPatch: { looksJson?: string } = {}
        const atmo = payload.atmosphereDescription?.trim()
        if (atmo) {
          const {
            ensureLookInLibrary,
            parseSceneLooks,
            serializeSceneLooks,
            upsertSceneLook
          } = await import('../domain/sceneLooks')
          let looks = parseSceneLooks(row.looksJson)
          looks = ensureLookInLibrary(looks, atmo, {
            name: payload.label?.replace(/^Atmosphere ·\s*/i, '') || 'Look'
          })
          const hit = looks.find(
            (l) => l.description.trim().toLowerCase() === atmo.toLowerCase()
          )
          if (hit) {
            looks = upsertSceneLook(looks, {
              ...hit,
              imagePath: finalPath,
              updatedAt: new Date().toISOString()
            })
          }
          looksPatch = { looksJson: serializeSceneLooks(looks) }
        }
        const updated = await scenes().update(row.id, {
          refImagePath: primary,
          refGalleryJson: serializeSceneGallery(nextGallery),
          ...looksPatch
        })
        activity.append({
          kind: 'scene',
          message: 'commitPlate',
          storyId: undefined,
          meta: { sceneId: row.id, path: finalPath, layer: layer ?? null }
        })
        return { scene: updated, path: finalPath, gallery: nextGallery }
      }
    )
  )

  reg(
    'scenes:swapAtmosphere',
    (
      async (
        payload: {
          sceneId: string
          atmosphereDescription: string
          baseImagePath?: string | null
          artStyle?: string | null
          pose?: string | null
          persist?: boolean
        }
      ) => {
        const row = await scenes().get(payload.sceneId)
        const atmosphereDescription = (
          payload.atmosphereDescription ?? ''
        ).trim()
        if (!atmosphereDescription) {
          throw new AppError(
            'VALIDATION',
            'Atmosphere description is required'
          )
        }
        const {
          buildAtmosphereSwapPrompt,
          atmosphereGalleryLabel,
          getAtmospherePose,
          pickBestSceneBaseImage
        } = await import('../domain/sceneAtmosphere')
        const { getArtStyle } = await import(
          '../domain/characterArtStyles'
        )
        const {
          appendSceneGalleryItem,
          parseSceneGallery,
          primarySceneGalleryPath,
          serializeSceneGallery
        } = await import('../domain/sceneGallery')
        const { aspectFromImageSize } = await import('../types/settings')

        const gallery = parseSceneGallery(row.refGalleryJson, {
          refImagePath: row.refImagePath
        })
        const picked = pickBestSceneBaseImage(
          gallery,
          payload.baseImagePath
        )
        if (!picked.item?.path || !existsSync(picked.item.path)) {
          throw new AppError(
            'VALIDATION',
            'No base plate for atmosphere swap. Generate an establishing or hero plate first.'
          )
        }
        const basePath = picked.item.path
        const artStyle = getArtStyle(
          payload.artStyle ?? row.artStyle ?? undefined
        ).id
        const pose = getAtmospherePose(payload.pose)
        const prompt = buildAtmosphereSwapPrompt({
          title: row.title ?? undefined,
          description: row.description,
          atmosphereDescription,
          artStyle,
          pose: pose.id,
          setDressing: row.setDressing,
          visualTags: row.visualTags
        })
        const size =
          pose.id === 'detail'
            ? settings.imageSizeSquare
            : settings.imageSizeWide
        const aspectRatio = aspectFromImageSize(size)
        const img = await aiClient.editImage({
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
          outPath = store.sceneImagePath(row.id,
            'atmosphere_swap',
            '.png'
          )
        } else {
          store.ensureTmpDir()
          outPath = store.tmpImagePath('atmosphere_swap', '.png')
        }
        writeFileSync(outPath, Buffer.from(img.b64, 'base64'))
        const { enhanceCharacterImage } = await import(
          '../infrastructure/media/imageEnhance'
        )
        const enhanced = enhanceCharacterImage(outPath, {
          enabled: settings.imageEnhance,
          maxEdge: settings.imageEnhanceMaxEdge,
          scale: settings.imageEnhanceScale
        })
        const label = atmosphereGalleryLabel(atmosphereDescription)
        if (payload.artStyle || row.artStyle !== artStyle) {
          await scenes().update(row.id, { artStyle })
        }
        if (!persist) {
          activity.append({
            kind: 'scene',
            message: 'swapAtmosphereDraft',
            storyId: undefined,
            meta: {
              sceneId: row.id,
              path: outPath,
              basePath,
              atmosphere: atmosphereDescription.slice(0, 120)
            }
          })
          return {
            scene: row,
            path: outPath,
            draft: true,
            label,
            variant: 'atmosphere_swap',
            layer: 'atmosphere',
            atmosphereDescription,
            artStyle,
            enhance: enhanced,
            basePath
          }
        }
        const nextGallery = appendSceneGalleryItem(gallery, {
          path: outPath,
          kind: 'sheet',
          label,
          layer: 'atmosphere'
        })
        const primary = primarySceneGalleryPath(nextGallery)
        const updated = await scenes().update(row.id, {
          refImagePath: primary,
          refGalleryJson: serializeSceneGallery(nextGallery),
          artStyle
        })
        activity.append({
          kind: 'scene',
          message: 'swapAtmosphere',
          storyId: undefined,
          meta: { sceneId: row.id, path: outPath, basePath }
        })
        return {
          scene: updated,
          path: outPath,
          draft: false,
          label,
          variant: 'atmosphere_swap',
          layer: 'atmosphere',
          atmosphereDescription,
          artStyle,
          enhance: enhanced,
          basePath,
          gallery: nextGallery
        }
      }
    )
  )

  /** Copy location plates from another scene sharing locationKey (or same title). */
  reg(
    'scenes:copyGalleryFrom',
    (
      async (
        payload: { targetSceneId: string; sourceSceneId: string }
      ) => {
        const target = await scenes().get(payload.targetSceneId)
        const source = await scenes().get(payload.sourceSceneId)
        const {
          parseSceneGallery,
          serializeSceneGallery,
          primarySceneGalleryPath
        } = await import('../domain/sceneGallery')
        const srcGallery = parseSceneGallery(source.refGalleryJson, {
          refImagePath: source.refImagePath
        })
        if (srcGallery.length === 0) {
          throw new AppError('VALIDATION', 'Source scene has no gallery images')
        }
        const updated = await scenes().update(target.id, {
          refGalleryJson: serializeSceneGallery(srcGallery),
          refImagePath:
            primarySceneGalleryPath(srcGallery) ?? source.refImagePath,
          locationKey:
            target.locationKey ||
            source.locationKey ||
            source.title ||
            target.title
        })
        activity.append({
          kind: 'scene',
          message: 'copyGalleryFrom',
          meta: {
            targetSceneId: target.id,
            sourceSceneId: source.id,
            count: srcGallery.length
          }
        })
        return { scene: updated, gallery: srcGallery }
      }
    )
  )

  // ─── Story cast (M2M link/unlink) ──────────────────────────
  const cast = (): StoryCastService => new StoryCastService(host.getPrisma())
  reg(
    'stories:linkCharacter',
    (
      async (
        payload: {
          storyId: string
          characterId: string
          roleNote?: string
          costumeId?: string | null
        }
      ) =>
        cast().linkCharacter(payload.storyId, payload.characterId, {
          roleNote: payload.roleNote,
          costumeId: payload.costumeId
        })
    )
  )
  reg(
    'stories:setCharacterCostume',
    (
      async (
        payload: {
          storyId: string
          characterId: string
          costumeId: string | null
        }
      ) =>
        cast().setCharacterCostume(
          payload.storyId,
          payload.characterId,
          payload.costumeId
        )
    )
  )
  reg(
    'stories:unlinkCharacter',
    (
      async ( payload: { storyId: string; characterId: string }) =>
        cast().unlinkCharacter(payload.storyId, payload.characterId)
    )
  )
  reg(
    'stories:linkScene',
    (
      async (
        payload: { storyId: string; sceneId: string; sceneNumber?: number }
      ) =>
        cast().linkScene(payload.storyId, payload.sceneId, {
          sceneNumber: payload.sceneNumber
        })
    )
  )
  reg(
    'stories:unlinkScene',
    (
      async ( payload: { storyId: string; sceneId: string }) =>
        cast().unlinkScene(payload.storyId, payload.sceneId)
    )
  )
  reg(
    'stories:linkProp',
    (
      async ( payload: { storyId: string; propId: string }) =>
        cast().linkProp(payload.storyId, payload.propId)
    )
  )
  reg(
    'stories:unlinkProp',
    (
      async ( payload: { storyId: string; propId: string }) =>
        cast().unlinkProp(payload.storyId, payload.propId)
    )
  )
  reg(
    'stories:listCast',
    (async ( storyId: string) => {
      const c = cast()
      return {
        characters: await c.listCharactersForStory(storyId),
        scenes: await c.listScenesForStory(storyId),
        props: await c.listPropsForStory(storyId)
      }
    })
  )

  // ─── Props ─────────────────────────────────────────────────
  reg(
    'props:list',
    (
      async (
        storyIdOrOpts?: string | { storyId?: string; q?: string; forStory?: boolean }
      ) => {
        if (typeof storyIdOrOpts === 'string' && storyIdOrOpts) {
          return props().listForStory(storyIdOrOpts)
        }
        if (
          storyIdOrOpts &&
          typeof storyIdOrOpts === 'object' &&
          storyIdOrOpts.forStory &&
          storyIdOrOpts.storyId
        ) {
          return props().listForStory(storyIdOrOpts.storyId)
        }
        const q =
          storyIdOrOpts && typeof storyIdOrOpts === 'object'
            ? storyIdOrOpts.q
            : undefined
        return props().list({ q })
      }
    )
  )
  reg(
    'props:create',
    (async ( input: CreatePropInput) => props().create(input))
  )
  reg(
    'props:update',
    (async ( id: string, data: UpdatePropInput) => props().update(id, data))
  )
  reg(
    'props:delete',
    (async ( id: string) => props().delete(id))
  )

  reg(
    'props:aiFill',
    (
      async (
        payload: {
          idea?: string
          storyId?: string
          locale?: 'zh-HK' | 'en'
          existingDraft?: Record<string, string | undefined | null>
        }
      ) => {
        const {
          buildPropMasterSystemPrompt,
          buildPropMasterUserPrompt,
          extractPropProfileJson
        } = await import('../domain/propMasterPrompt')
        const locale = payload.locale ?? 'zh-HK'
        const draft = payload.existingDraft
        const hasDraft = Boolean(
          draft &&
            Object.values(draft).some((v) => typeof v === 'string' && v.trim())
        )
        const idea = payload.idea?.trim() ?? ''
        if (!idea && !hasDraft) {
          throw new AppError('VALIDATION', 'Idea or draft required')
        }
        // Pure invent-from-idea: skip active story style (Demo rain etc.)
        const { shouldInjectStoryContext } = await import(
          '../domain/storyContextPolicy'
        )
        let storyTitle: string | undefined
        let styleNote: string | null | undefined
        if (
          payload.storyId &&
          shouldInjectStoryContext({ hasDraft })
        ) {
          const story = await host.getPrisma().story.findUnique({
            where: { id: payload.storyId }
          })
          storyTitle = story?.title
          styleNote = story?.styleNote
        }
        const completion = await aiClient.chat({
          messages: [
            {
              role: 'system',
              content: buildPropMasterSystemPrompt(locale)
            },
            {
              role: 'user',
              content: buildPropMasterUserPrompt({
                idea: idea || (locale === 'en' ? 'Polish' : '全面潤飾'),
                storyTitle,
                styleNote,
                locale,
                existingDraft: (hasDraft
                  ? {
                      name: draft?.name ?? undefined,
                      description: draft?.description ?? undefined,
                      material: draft?.material ?? undefined,
                      sizeNotes: draft?.sizeNotes ?? undefined,
                      condition: draft?.condition ?? undefined,
                      visualTags: draft?.visualTags ?? undefined,
                      artStyle: draft?.artStyle ?? undefined
                    }
                  : null) as Partial<PropProfileFields> | null
              })
            }
          ],
          max_tokens: 1500
        })
        const text = completion.choices[0]?.message.content ?? ''
        const profile = extractPropProfileJson(text)
        activity.append({
          kind: 'prop',
          message: hasDraft ? 'aiRefineProp' : 'aiFillProp',
          storyId: payload.storyId,
          meta: { name: profile.name }
        })
        return {
          profile,
          profileJson: JSON.stringify(profile, null, 2),
          raw: text
        }
      }
    )
  )

  reg(
    'props:generatePlate',
    (
      async (
        payload: {
          propId: string
          variant?: string
          referenceImagePath?: string | null
          useIdentityEdit?: boolean
          persist?: boolean
          artStyle?: string | null
        }
      ) => {
        const row = await props().get(payload.propId)
        const {
          buildPropPlateEditPrompt,
          buildPropPlateImagePrompt,
          getPropPlateVariant
        } = await import('../domain/propPlateVariants')
        const { getArtStyle } = await import(
          '../domain/characterArtStyles'
        )
        const { resolveSheetGenMode } = await import(
          '../domain/characterMasterPrompt'
        )
        const {
          appendSceneGalleryItem,
          parseSceneGallery,
          primarySceneGalleryPath,
          serializeSceneGallery
        } = await import('../domain/sceneGallery')
        const {
          aspectFromImageSize,
          imageSizeForPropPlate
        } = await import('../types/settings')

        const variantDef = getPropPlateVariant(payload.variant)
        const variant = variantDef.id
        const artStyle = getArtStyle(
          payload.artStyle ?? row.artStyle ?? undefined
        ).id
        const size = imageSizeForPropPlate(settings, variant)
        const aspectRatio = aspectFromImageSize(size)
        const profile = {
          name: row.name,
          description: row.description,
          material: row.material ?? undefined,
          sizeNotes: row.sizeNotes ?? undefined,
          condition: row.condition ?? undefined,
          visualTags: row.visualTags ?? undefined
        }
        const gallery = parseSceneGallery(row.refGalleryJson, {
          refImagePath: row.refImagePath
        })
        const explicitRef =
          typeof payload.referenceImagePath === 'string' &&
          payload.referenceImagePath.trim()
            ? payload.referenceImagePath.trim()
            : null
        const refPath =
          explicitRef && existsSync(explicitRef) ? explicitRef : null
        const usedEdit =
          resolveSheetGenMode({
            useIdentityEdit: payload.useIdentityEdit,
            hasValidRef: Boolean(refPath)
          }) === 'edit'
        const prompt = usedEdit
          ? buildPropPlateEditPrompt(profile, variant, artStyle)
          : buildPropPlateImagePrompt(profile, variant, artStyle)
        if (payload.artStyle || row.artStyle !== artStyle) {
          await props().update(row.id, { artStyle })
        }
        const img = usedEdit
          ? await aiClient.editImage({
              prompt,
              imagePath: refPath!,
              size,
              aspectRatio
            })
          : await aiClient.generateImage({ prompt, size, aspectRatio })
        const store = generation().getMediaStore()
        const persist = payload.persist === true
        let outPath: string
        if (persist) {
          store.ensureLibraryDirs()
          outPath = store.propImagePath(row.id,
            `plate_${variant}`,
            '.png'
          )
        } else {
          store.ensureTmpDir()
          outPath = store.tmpImagePath(`prop_${variant}`, '.png')
        }
        writeFileSync(outPath, Buffer.from(img.b64, 'base64'))
        const { enhanceCharacterImage } = await import(
          '../infrastructure/media/imageEnhance'
        )
        const enhanced = enhanceCharacterImage(outPath, {
          enabled: settings.imageEnhance,
          maxEdge: settings.imageEnhanceMaxEdge,
          scale: settings.imageEnhanceScale
        })
        const label = variantDef.galleryLabel
        if (!persist) {
          activity.append({
            kind: 'prop',
            message: 'generatePropPlateDraft',
            storyId: undefined,
            meta: { propId: row.id, path: outPath, variant }
          })
          return {
            prop: row,
            path: outPath,
            draft: true,
            label,
            variant,
            artStyle,
            usedEdit,
            enhance: enhanced,
            gallery
          }
        }
        const nextGallery = appendSceneGalleryItem(gallery, {
          path: outPath,
          kind: 'sheet',
          label,
          layer: 'detail'
        })
        const primary = primarySceneGalleryPath(nextGallery)
        const updated = await props().update(row.id, {
          refImagePath: primary,
          refGalleryJson: serializeSceneGallery(nextGallery),
          artStyle
        })
        activity.append({
          kind: 'prop',
          message: 'generatePropPlate',
          storyId: undefined,
          meta: { propId: row.id, path: outPath, variant }
        })
        return {
          prop: updated,
          path: outPath,
          draft: false,
          label,
          variant,
          artStyle,
          usedEdit,
          enhance: enhanced,
          gallery: nextGallery
        }
      }
    )
  )

  /**
   * Image → prop intro / hero video for one gallery still.
   * Uses prop bible; object identity locked to the source still.
   */
  reg(
    'props:generateIntroVideo',
    (
      async (
        payload: {
          propId: string
          sourceImagePath: string
          durationSeconds?: number
          locale?: 'zh-HK' | 'en'
        }
      ) => {
        const row = await props().get(payload.propId)
        const sourceImagePath = payload.sourceImagePath?.trim()
        if (!sourceImagePath || !existsSync(sourceImagePath)) {
          throw new AppError(
            'VALIDATION',
            'Source image is required',
            'Select a reference still first'
          )
        }
        if (!aiClient.generateVideo) {
          throw new AppError(
            'AI_UNAVAILABLE',
            'Video generation is not available',
            'Enable Grok gateway videoApi and use a key with agent/admin mode'
          )
        }

        const profile = {
          name: row.name,
          description: row.description || row.name,
          material: row.material ?? undefined,
          sizeNotes: row.sizeNotes ?? undefined,
          condition: row.condition ?? undefined,
          visualTags: row.visualTags ?? undefined,
          artStyle: (row as { artStyle?: string | null }).artStyle ?? undefined
        }
        const locale = payload.locale === 'en' ? 'en' : 'zh-HK'
        const fallbackPrompt = buildPropIntroVideoPrompt(profile, locale)
        const store = generation().getMediaStore()
        store.ensureLibraryDirs()
        const outPath = store.propVideoPath(row.id, 'intro', '.mp4')
        const seconds =
          typeof payload.durationSeconds === 'number'
            ? payload.durationSeconds
            : 10
        const aspectRatio =
          settings.aspectRatio === '9:16' || settings.aspectRatio === '16:9'
            ? settings.aspectRatio
            : '16:9'

        const {
          polishThenGenerateVideo
        } = await import('../application/video/polishVideoPrompt')
        const {
          buildPropIntroVideoPolishUserPrompt
        } = await import('../domain/videoPromptPolish')

        const result = await polishThenGenerateVideo({
          ai: aiClient,
          locale,
          fallbackPrompt,
          polishUserContent: buildPropIntroVideoPolishUserPrompt({
            locale,
            seconds,
            aspectRatio,
            hasRefImage: true,
            fallbackPrompt,
            name: profile.name,
            description: profile.description,
            material: profile.material,
            sizeNotes: profile.sizeNotes,
            condition: profile.condition,
            visualTags: profile.visualTags,
            artStyle: profile.artStyle,
            seedPrompt:
              (row as { seedPrompt?: string | null }).seedPrompt ?? undefined
          }),
          videoRequest: {
            durationSeconds: seconds,
            refImagePath: sourceImagePath,
            outputPath: outPath,
            aspectRatio
          }
        })

        const {
          parseSceneGallery,
          serializeSceneGallery,
          setSceneGalleryIntroVideo
        } = await import('../domain/sceneGallery')
        const gallery = parseSceneGallery(row.refGalleryJson, {
          refImagePath: row.refImagePath
        })
        const nextGallery = setSceneGalleryIntroVideo(
          gallery,
          sourceImagePath,
          result.outputPath
        )
        const updated = await props().update(row.id, {
          refGalleryJson: serializeSceneGallery(nextGallery)
        })
        activity.append({
          kind: 'prop',
          message: 'generateIntroVideo',
          meta: {
            propId: row.id,
            sourceImagePath,
            path: result.outputPath,
            seconds,
            degraded: result.degraded ?? false,
            polished: result.polished,
            promptPreview: result.promptUsed.slice(0, 200)
          }
        })
        return {
          prop: updated,
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

  reg(
    'props:commitPlate',
    (
      async (
        payload: {
          propId: string
          path: string
          variant?: string
          label?: string
        }
      ) => {
        const row = await props().get(payload.propId)
        if (!payload.path || !existsSync(payload.path)) {
          throw new AppError('NOT_FOUND', 'Draft prop plate not found')
        }
        const store = generation().getMediaStore()
        const finalPath = store.promoteTmpPropImage(
          null,
          row.id,
          payload.path,
          `plate_${payload.variant ?? 'hero'}`
        )
        const {
          appendSceneGalleryItem,
          parseSceneGallery,
          primarySceneGalleryPath,
          serializeSceneGallery
        } = await import('../domain/sceneGallery')
        const gallery = parseSceneGallery(row.refGalleryJson, {
          refImagePath: row.refImagePath
        })
        const nextGallery = appendSceneGalleryItem(gallery, {
          path: finalPath,
          kind: 'sheet',
          label: payload.label ?? 'Prop plate',
          layer: 'detail'
        })
        const primary = primarySceneGalleryPath(nextGallery)
        const updated = await props().update(row.id, {
          refImagePath: primary,
          refGalleryJson: serializeSceneGallery(nextGallery)
        })
        activity.append({
          kind: 'prop',
          message: 'commitPropPlate',
          storyId: undefined,
          meta: { propId: row.id, path: finalPath }
        })
        return { prop: updated, path: finalPath, gallery: nextGallery }
      }
    )
  )

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
          artStyle?: string | null
          refImagePath?: string | null
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
          }
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
        if (!idea && !hasDraft) {
          throw new AppError('VALIDATION', 'Idea or draft required')
        }
        const system =
          locale === 'en'
            ? 'You are a film wardrobe designer. Reply with ONLY compact JSON: {"name":"short label","description":"full wardrobe description for image gen (layers, fabric, colors, accessories; no brand logos)","artStyle":"optional style id or null"}. No markdown.'
            : '你是影視造型指導。只回覆緊湊 JSON：{"name":"短名稱","description":"完整戲服描述（分層、布料、顏色、配飾；無品牌 Logo）","artStyle":"可選風格 id 或 null"}。不要 markdown。'
        const userParts = [
          idea
            ? locale === 'en'
              ? `Idea: ${idea}`
              : `構思：${idea}`
            : locale === 'en'
              ? 'Polish the draft wardrobe.'
              : '潤飾以下戲服草稿。',
          hasDraft
            ? `Draft:\nname: ${draft?.name ?? ''}\ndescription: ${draft?.description ?? ''}\nartStyle: ${draft?.artStyle ?? ''}`
            : null
        ].filter(Boolean)
        const completion = await aiClient.chat({
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: userParts.join('\n\n') }
          ],
          max_tokens: 900
        })
        const text = completion.choices[0]?.message.content ?? ''
        let name = ''
        let description = ''
        let artStyle: string | null = null
        try {
          const m = text.match(/\{[\s\S]*\}/)
          if (m) {
            const j = JSON.parse(m[0]) as {
              name?: string
              description?: string
              artStyle?: string | null
            }
            name = (j.name ?? '').trim()
            description = (j.description ?? '').trim()
            artStyle = j.artStyle?.trim() || null
          }
        } catch {
          /* fall through */
        }
        if (!description) {
          description = text.trim().slice(0, 2000)
        }
        if (!name) {
          name = description.slice(0, 32) || (locale === 'en' ? 'Look' : '造型')
        }
        activity.append({
          kind: 'costume',
          message: hasDraft ? 'aiRefineCostume' : 'aiFillCostume',
          meta: { name }
        })
        return { name, description, artStyle, raw: text }
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
        } = await import('../domain/costumeSwap')
        const { getArtStyle } = await import(
          '../domain/characterArtStyles'
        )
        const { aspectFromImageSize } = await import(
          '../types/settings'
        )
        const {
          appendGalleryItem,
          parseCharacterGallery,
          serializeCharacterGallery
        } = await import('../domain/characterGallery')

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
        const size =
          pose.id === 'turnaround'
            ? settings.imageSizeWide
            : pose.id === 'three_quarter'
              ? settings.imageSizeSquare
              : settings.imageSizeTall
        const aspectRatio = aspectFromImageSize(size)
        const img = await aiClient.editImage({
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
            'Source image is required',
            'Select a reference still first'
          )
        }
        if (!aiClient.generateVideo) {
          throw new AppError(
            'AI_UNAVAILABLE',
            'Video generation is not available',
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
          settings.aspectRatio === '9:16' || settings.aspectRatio === '16:9'
            ? settings.aspectRatio
            : '16:9'

        const {
          polishThenGenerateVideo
        } = await import('../application/video/polishVideoPrompt')
        const {
          buildCostumeIntroVideoPolishUserPrompt
        } = await import('../domain/videoPromptPolish')

        const result = await polishThenGenerateVideo({
          ai: aiClient,
          locale,
          fallbackPrompt,
          polishUserContent: buildCostumeIntroVideoPolishUserPrompt({
            locale,
            seconds,
            aspectRatio,
            hasRefImage: true,
            fallbackPrompt,
            name: profile.name,
            description: profile.description,
            artStyle: profile.artStyle
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

  // ─── Video prep (still + professional prompt review → video) ─
  reg(
    'videoPrep:create',
    (
      async (
        payload: {
          kind:
            | 'character-intro'
            | 'scene-intro'
            | 'prop-intro'
            | 'costume-intro'
            | 'timeline-clip'
          sourceImagePath?: string | null
          characterId?: string
          sceneId?: string
          propId?: string
          costumeId?: string
          storyId?: string
          entryId?: string
          durationSeconds?: number
          locale?: 'zh-HK' | 'en'
          /** If continuity still exists, reuse it (skip image gen). */
          skipStillIfExists?: boolean
          /** Still-only: polish+still without requiring video capability. */
          stillOnly?: boolean
        }
      ) => {
        const locale = payload.locale === 'en' ? 'en' : 'zh-HK'
        let seconds =
          typeof payload.durationSeconds === 'number'
            ? payload.durationSeconds
            : 10
        const aspectRatio =
          settings.aspectRatio === '9:16' || settings.aspectRatio === '16:9'
            ? settings.aspectRatio
            : '16:9'
        let sourceImagePath = payload.sourceImagePath?.trim() || null
        if (sourceImagePath && !existsSync(sourceImagePath)) {
          throw new AppError('VALIDATION', 'errors.sourceImageRequired')
        }
        // Full video-prep needs generateVideo; still-only batch needs images only.
        if (!payload.stillOnly && !aiClient.generateVideo) {
          throw new AppError('VALIDATION', 'errors.videoUnavailable')
        }

        const {
          polishProfessionalVideoPrompt
        } = await import('../application/video/prepareVideoPrompt')
        const {
          generateVideoStillKeyframe
        } = await import('../application/video/generateVideoStill')
        const {
          materialsSummaryLines
        } = await import('../domain/videoPrep')
        const store = generation().getMediaStore()
        store.ensureLibraryDirs()
        store.ensureTmpDir()

        let fallbackPrompt = ''
        let polishUserContent = ''
        let materialsSummary = ''
        let stillOut = store.tmpImagePath('video_prep_still', '.png')
        const entityIds: {
          characterId?: string
          sceneId?: string
          propId?: string
          costumeId?: string
          storyId?: string
          entryId?: string
        } = {}

        if (payload.kind === 'character-intro') {
          if (!payload.characterId) {
            throw new AppError('VALIDATION', 'characterId is required')
          }
          const row = await characters().get(payload.characterId)
          entityIds.characterId = row.id
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
            if (soulPath?.trim() && existsSync(soulPath.trim())) {
              soulExcerpt = readFileSync(soulPath.trim(), 'utf-8')
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
            artStyle: (row as { artStyle?: string | null }).artStyle ?? undefined,
            spokenLanguages
          }
          const { buildCharacterIntroVideoPrompt } = await import(
            '../domain/characterMasterPrompt'
          )
          const {
            buildIntroVideoPolishUserPrompt,
            truncateForVideoPrompt
          } = await import('../domain/videoPromptPolish')
          fallbackPrompt = buildCharacterIntroVideoPrompt(profile, locale, {
            soulExcerpt
          })
          polishUserContent = buildIntroVideoPolishUserPrompt({
            locale,
            seconds,
            aspectRatio,
            hasRefImage: Boolean(sourceImagePath),
            fallbackPrompt,
            ...profile,
            soulExcerpt: truncateForVideoPrompt(soulExcerpt)
          })
          materialsSummary = materialsSummaryLines([
            `name: ${profile.name}`,
            profile.appearance ? `appearance: ${profile.appearance}` : null,
            profile.personality ? `personality: ${profile.personality}` : null,
            profile.costume ? `costume: ${profile.costume}` : null
          ])
          stillOut = store.characterImagePath(row.id, 'video_prep_still', '.png')
        } else if (payload.kind === 'scene-intro') {
          if (!payload.sceneId) {
            throw new AppError('VALIDATION', 'sceneId is required')
          }
          const row = await scenes().get(payload.sceneId)
          entityIds.sceneId = row.id
          const profile = {
            title: row.title ?? undefined,
            description: row.description || row.title || 'Scene',
            script: row.script ?? undefined,
            locationType: row.locationType ?? undefined,
            timeOfDay: row.timeOfDay ?? undefined,
            weather: row.weather ?? undefined,
            mood: row.mood ?? undefined,
            lighting: row.lighting ?? undefined,
            colorPalette: row.colorPalette ?? undefined,
            setDressing: row.setDressing ?? undefined,
            soundscape: row.soundscape ?? undefined,
            cameraNotes: row.cameraNotes ?? undefined,
            visualTags: row.visualTags ?? undefined,
            artStyle: (row as { artStyle?: string | null }).artStyle ?? undefined
          }
          const { buildSceneIntroVideoPrompt } = await import(
            '../domain/sceneMasterPrompt'
          )
          const {
            buildSceneIntroVideoPolishUserPrompt
          } = await import('../domain/videoPromptPolish')
          fallbackPrompt = buildSceneIntroVideoPrompt(profile, locale)
          polishUserContent = buildSceneIntroVideoPolishUserPrompt({
            locale,
            seconds,
            aspectRatio,
            hasRefImage: Boolean(sourceImagePath),
            fallbackPrompt,
            ...profile,
            seedPrompt:
              (row as { seedPrompt?: string | null }).seedPrompt ?? undefined
          })
          materialsSummary = materialsSummaryLines([
            profile.title ? `title: ${profile.title}` : null,
            `description: ${profile.description}`,
            profile.mood ? `mood: ${profile.mood}` : null
          ])
          stillOut = store.sceneImagePath(row.id, 'video_prep_still', '.png')
        } else if (payload.kind === 'prop-intro') {
          if (!payload.propId) {
            throw new AppError('VALIDATION', 'propId is required')
          }
          const row = await props().get(payload.propId)
          entityIds.propId = row.id
          const profile = {
            name: row.name,
            description: row.description || row.name,
            material: row.material ?? undefined,
            sizeNotes: row.sizeNotes ?? undefined,
            condition: row.condition ?? undefined,
            visualTags: row.visualTags ?? undefined,
            artStyle: (row as { artStyle?: string | null }).artStyle ?? undefined
          }
          const { buildPropIntroVideoPrompt } = await import(
            '../domain/propMasterPrompt'
          )
          const {
            buildPropIntroVideoPolishUserPrompt
          } = await import('../domain/videoPromptPolish')
          fallbackPrompt = buildPropIntroVideoPrompt(profile, locale)
          polishUserContent = buildPropIntroVideoPolishUserPrompt({
            locale,
            seconds,
            aspectRatio,
            hasRefImage: Boolean(sourceImagePath),
            fallbackPrompt,
            ...profile
          })
          materialsSummary = materialsSummaryLines([
            `name: ${profile.name}`,
            `description: ${profile.description}`,
            profile.material ? `material: ${profile.material}` : null
          ])
          stillOut = store.propImagePath(row.id, 'video_prep_still', '.png')
        } else if (payload.kind === 'costume-intro') {
          if (!payload.costumeId) {
            throw new AppError('VALIDATION', 'costumeId is required')
          }
          const row = await costumes().get(payload.costumeId)
          entityIds.costumeId = row.id
          const profile = {
            name: row.name,
            description: row.description || row.name,
            artStyle: row.artStyle ?? undefined
          }
          const { buildCostumeIntroVideoPrompt } = await import(
            '../domain/costumeSwap'
          )
          const {
            buildCostumeIntroVideoPolishUserPrompt
          } = await import('../domain/videoPromptPolish')
          fallbackPrompt = buildCostumeIntroVideoPrompt(profile, locale)
          polishUserContent = buildCostumeIntroVideoPolishUserPrompt({
            locale,
            seconds,
            aspectRatio,
            hasRefImage: Boolean(sourceImagePath),
            fallbackPrompt,
            ...profile
          })
          materialsSummary = materialsSummaryLines([
            `name: ${profile.name}`,
            `description: ${profile.description}`
          ])
          stillOut = store.costumeImagePath(row.id, 'video_prep_still', '.png')
        } else if (payload.kind === 'timeline-clip') {
          if (!payload.entryId || !payload.storyId) {
            throw new AppError(
              'VALIDATION',
              'storyId and entryId are required for timeline-clip'
            )
          }
          entityIds.storyId = payload.storyId
          entityIds.entryId = payload.entryId
          const story = await stories().get(payload.storyId)
          const entry = (story.timeline as Array<Record<string, unknown>>).find(
            (e) => e.id === payload.entryId
          )
          if (!entry) {
            throw new AppError('NOT_FOUND', 'Timeline entry not found')
          }
          const { parseIdList } = await import(
            '../domain/timelineBindings'
          )
          const { snapVideoSeconds } = await import(
            '../domain/videoDuration'
          )
          const {
            buildClipPrompt,
            previousClipContext,
            resolveClipRefImage,
            getPreviousTimelineEntry,
            buildContinuityLockPrompt,
            timelineBeatDisplayIndex
          } = await import('../domain/promptContinuity')
          const { characterVideoPromptBlock } = await import(
            '../domain/characterMasterPrompt'
          )
          const {
            buildClipVideoPolishUserPrompt
          } = await import('../domain/videoPromptPolish')
          const {
            beatContentToClipPromptBlock,
            parseBeatContent
          } = await import('../domain/beatContent')

          const asList = (
            multi: string | string[] | null | undefined,
            primary: string | null
          ): string[] => {
            if (Array.isArray(multi) && multi.length > 0) return multi
            if (typeof multi === 'string') return parseIdList(multi, primary)
            return parseIdList(null, primary)
          }
          const charIdList = asList(
            entry.characterIds as string | string[] | null | undefined,
            (entry.characterId as string | null) ?? null
          )
          const sceneIdList = asList(
            entry.sceneIds as string | string[] | null | undefined,
            (entry.sceneId as string | null) ?? null
          )
          const propIdList = asList(
            entry.propIds as string | string[] | null | undefined,
            (entry.propId as string | null) ?? null
          )
          const characters = story.characters as Array<Record<string, unknown>>
          const scenesList = story.scenes as Array<Record<string, unknown>>
          const propsList = story.props as Array<Record<string, unknown>>
          const chars = charIdList
            .map((id) => characters.find((c) => c.id === id))
            .filter(Boolean) as Array<Record<string, unknown>>
          const scenesBound = sceneIdList
            .map((id) => scenesList.find((s) => s.id === id))
            .filter(Boolean) as Array<Record<string, unknown>>
          const propsBound = propIdList
            .map((id) => propsList.find((p) => p.id === id))
            .filter(Boolean) as Array<Record<string, unknown>>
          const char = chars[0] ?? null
          const scene = scenesBound[0] ?? null
          const prop = propsBound[0] ?? null

          const clipSeconds =
            typeof payload.durationSeconds === 'number'
              ? payload.durationSeconds
              : snapVideoSeconds(
                  Number(entry.endTime) - Number(entry.startTime)
                )
          seconds = clipSeconds

          const parseLangs = (
            c: Record<string, unknown>
          ): string[] | undefined => {
            try {
              const raw = c.spokenLanguages as string | null | undefined
              if (!raw?.trim()) return undefined
              const parsed = JSON.parse(raw) as unknown
              return Array.isArray(parsed)
                ? parsed.filter((x): x is string => typeof x === 'string')
                : undefined
            } catch {
              return undefined
            }
          }
          const charBlocks = chars.map((c) =>
            characterVideoPromptBlock({
              name: String(c.name ?? ''),
              description: String(c.description ?? ''),
              ageRange: (c.ageRange as string | null) ?? undefined,
              gender: (c.gender as string | null) ?? undefined,
              appearance:
                ((c.appearance as string | null) ??
                  (c.description as string | null)) ||
                undefined,
              costume: (c.costume as string | null) ?? undefined,
              personality: (c.personality as string | null) ?? undefined,
              backstory: (c.backstory as string | null) ?? undefined,
              relationships: (c.relationships as string | null) ?? undefined,
              mannerisms: (c.mannerisms as string | null) ?? undefined,
              voiceDesc: (c.voiceDesc as string | null) ?? undefined,
              visualTags: (c.visualTags as string | null) ?? undefined,
              artStyle: (c.artStyle as string | null) ?? undefined,
              spokenLanguages: parseLangs(c)
            })
          )
          const multiCastNote =
            chars.length > 1 || scenesBound.length > 1 || propsBound.length > 1
              ? [
                  'MULTI-SUBJECT CLIP:',
                  chars.length
                    ? `Characters (primary first): ${chars.map((c) => c.name).join(', ')}.`
                    : null,
                  scenesBound.length > 1
                    ? `Locations: ${scenesBound.map((s) => s.title || String(s.description).slice(0, 40)).join(' | ')}.`
                    : null,
                  propsBound.length > 1
                    ? `Props: ${propsBound.map((p) => p.name).join(', ')}.`
                    : null,
                  'Keep all listed subjects visible/consistent; primary character is the action focus.'
                ]
                  .filter(Boolean)
                  .join(' ')
              : null

          const charMap = new Map(
            characters.map((c) => [String(c.id), c as never])
          )
          const sceneMap = new Map(
            scenesList.map((s) => [String(s.id), s as never])
          )
          const propMap = new Map(
            propsList.map((p) => [String(p.id), p as never])
          )
          const timelineEntries = story.timeline as never
          const prev = previousClipContext(
            timelineEntries,
            payload.entryId,
            { characters: charMap, scenes: sceneMap, props: propMap }
          )
          // Clip-to-clip continuity: use previous beat's keyframe still as image ref.
          const prevEntry = getPreviousTimelineEntry(
            timelineEntries,
            payload.entryId
          )
          let previousContinuityPath: string | null = null
          let prevBeatIndex = 0
          if (prevEntry) {
            prevBeatIndex = timelineBeatDisplayIndex(
              timelineEntries,
              prevEntry.id
            )
            const contPath = store.clipContinuityStillPath(
              payload.storyId,
              prevEntry.id
            )
            if (existsSync(contPath)) {
              previousContinuityPath = contPath
            }
          }
          // Advanced cast prep (costume look / gallery pick)
          const {
            parseStoryCastPrep,
            resolveCastRefFromPrep,
            buildClipPrepHash,
            parseEntryStillPromptCache,
            serializeEntryStillPromptCache
          } = await import('../domain/advancedPrep')
          const castPrep = parseStoryCastPrep(
            store.readStoryCastPrepJson(payload.storyId)
          )
          const castRefPath = resolveCastRefFromPrep(
            char ? String(char.id) : null,
            castPrep
          )
          const sameCharacter = Boolean(
            char &&
              prevEntry &&
              prevEntry.characterId &&
              String(char.id) === String(prevEntry.characterId)
          )
          const sameScene = Boolean(
            scene &&
              prevEntry &&
              prevEntry.sceneId &&
              String(scene.id) === String(prevEntry.sceneId)
          )
          const continuityLock = prevEntry
            ? buildContinuityLockPrompt({
                previousBeatIndex: prevBeatIndex,
                previousDialogueSnippet: prev,
                sameCharacter,
                sameScene,
                hasContinuityImage: Boolean(previousContinuityPath)
              })
            : null
          const prevWithLock = [prev, continuityLock].filter(Boolean).join('\n')

          const dialogue = (entry.dialogue as string | null) ?? null
          const beatContentJson =
            (entry.beatContentJson as string | null) ?? null
          const beatOrDialogue =
            beatContentToClipPromptBlock(
              parseBeatContent(dialogue, beatContentJson),
              dialogue
            ) ||
            dialogue ||
            null

          fallbackPrompt = [
            buildClipPrompt({
              storyTitle: story.title,
              styleNote: story.styleNote,
              character: char as never,
              scene: scene as never,
              prop: prop as never,
              dialogue,
              beatContentJson,
              seconds: clipSeconds,
              previousContext: prevWithLock || prev
            }),
            multiCastNote,
            ...charBlocks
          ]
            .filter(Boolean)
            .join('\n')

          let resolvedSource = sourceImagePath
          let resolvedRefSource: string | null = null
          if (!resolvedSource) {
            const ref = resolveClipRefImage({
              character: char as never,
              scene: scene as never,
              prop: prop as never,
              previousContinuityPath,
              castRefPath
            })
            if (ref?.path && existsSync(ref.path)) {
              resolvedSource = ref.path
              resolvedRefSource = ref.source
            }
          } else if (previousContinuityPath) {
            resolvedRefSource = 'prev-clip'
          }

          polishUserContent = buildClipVideoPolishUserPrompt({
            locale,
            seconds: clipSeconds,
            aspectRatio,
            hasRefImage: Boolean(resolvedSource),
            fallbackPrompt,
            storyTitle: story.title,
            styleNote: story.styleNote,
            characterBlocks: charBlocks,
            sceneBlock: scene
              ? [
                  `#${scene.sceneNumber ?? ''} ${scene.title || ''}`,
                  String(scene.description ?? ''),
                  scene.mood ? `mood: ${scene.mood}` : null,
                  scene.lighting ? `lighting: ${scene.lighting}` : null
                ]
                  .filter(Boolean)
                  .join('\n')
              : null,
            propBlock: prop
              ? `${prop.name}: ${prop.description}`
              : null,
            beatOrDialogue,
            previousContext: prevWithLock || prev,
            multiCastNote
          })
          const continuityMaterialsLine = previousContinuityPath
            ? `continuity: LOCKED to beat #${prevBeatIndex} keyframe (prev-clip image ref)`
            : prevEntry
              ? `continuity: text only from beat #${prevBeatIndex} (no prior still yet — gen beat ${prevBeatIndex} first for image lock)`
              : `continuity: first beat (no previous)`
          materialsSummary = materialsSummaryLines([
            `story: ${story.title}`,
            chars.length
              ? `characters: ${chars.map((c) => c.name).join(', ')}`
              : null,
            scenesBound.length
              ? `scenes: ${scenesBound.map((s) => s.title || s.description).join(' | ')}`
              : null,
            propsBound.length
              ? `props: ${propsBound.map((p) => p.name).join(', ')}`
              : null,
            beatOrDialogue
              ? `beat: ${String(beatOrDialogue).slice(0, 200)}`
              : null,
            continuityMaterialsLine,
            resolvedRefSource
              ? `imageRef: ${resolvedRefSource}`
              : null,
            prev ? `prev: ${String(prev).slice(0, 120)}` : null
          ])
          // Write this beat's continuity still so the next clip can chain from it.
          store.ensureStoryDirs(payload.storyId)
          stillOut = store.clipContinuityStillPath(
            payload.storyId,
            payload.entryId,
            '.png'
          )
          if (resolvedSource) {
            sourceImagePath = resolvedSource
          }
          // User is generating a new still — drop "removed by user" marker
          try {
            store.clearEntryStillUserCleared(
              payload.storyId,
              payload.entryId
            )
          } catch {
            /* ignore */
          }

          // Skip still gen when continuity file already exists
          if (
            payload.skipStillIfExists &&
            existsSync(stillOut) &&
            !payload.sourceImagePath
          ) {
            const existingCache = parseEntryStillPromptCache(
              store.readEntryStillPromptJson(payload.storyId, payload.entryId)
            )
            let promptOut = existingCache?.professionalPrompt?.trim() || ''
            let polishedFlag = false
            if (!promptOut) {
              const polishedOnly = await polishProfessionalVideoPrompt({
                ai: aiClient,
                locale,
                fallbackPrompt,
                polishUserContent
              })
              promptOut = polishedOnly.prompt
              polishedFlag = polishedOnly.polished
            }
            const promptHash = buildClipPrepHash({
              entryId: payload.entryId,
              dialogue,
              beatContentJson,
              characterIds: charIdList,
              sceneIds: sceneIdList,
              propIds: propIdList,
              castRefPath,
              styleNote: story.styleNote,
              seconds: clipSeconds
            })
            store.writeEntryStillPromptJson(
              payload.storyId,
              payload.entryId,
              serializeEntryStillPromptCache({
                version: 1,
                professionalPrompt: promptOut,
                userExtraPrompt: existingCache?.userExtraPrompt || '',
                materialsSummary:
                  existingCache?.materialsSummary || materialsSummary,
                sourceImagePath,
                stillPath: stillOut,
                promptHash,
                updatedAt: new Date().toISOString(),
                durationSeconds: clipSeconds,
                aspectRatio
              })
            )
            return {
              kind: payload.kind,
              entityIds,
              professionalPrompt: promptOut,
              userExtraPrompt: existingCache?.userExtraPrompt || '',
              stillPath: stillOut,
              sourceImagePath,
              durationSeconds: seconds,
              aspectRatio,
              materialsSummary:
                existingCache?.materialsSummary || materialsSummary,
              stillPromptUsed: undefined,
              polished: polishedFlag,
              skippedStill: true
            }
          }
        } else {
          throw new AppError('VALIDATION', `Unknown video prep kind`)
        }

        const polished = await polishProfessionalVideoPrompt({
          ai: aiClient,
          locale,
          fallbackPrompt,
          polishUserContent
        })

        const size =
          aspectRatio === '9:16'
            ? settings.imageSizeTall
            : aspectRatio === '16:9'
              ? settings.imageSizeWide
              : settings.imageSizeSquare || '1024x1024'

        const still = await generateVideoStillKeyframe({
          ai: aiClient,
          store,
          professionalPrompt: polished.prompt,
          sourceImagePath,
          locale,
          aspectRatio,
          size,
          outputPath: stillOut
        })

        // Persist still prompt cache for advanced prep / skip-to-video
        if (
          payload.kind === 'timeline-clip' &&
          payload.storyId &&
          payload.entryId
        ) {
          try {
            const {
              buildClipPrepHash,
              serializeEntryStillPromptCache,
              parseStoryCastPrep,
              resolveCastRefFromPrep
            } = await import('../domain/advancedPrep')
            const castPrep = parseStoryCastPrep(
              store.readStoryCastPrepJson(payload.storyId)
            )
            const entryRow = (
              (await stories().get(payload.storyId)).timeline as Array<
                Record<string, unknown>
              >
            ).find((e) => e.id === payload.entryId)
            const { parseIdList } = await import(
              '../domain/timelineBindings'
            )
            const primaryChar = (entryRow?.characterId as string) || null
            const castRef = resolveCastRefFromPrep(primaryChar, castPrep)
            const promptHash = buildClipPrepHash({
              entryId: payload.entryId,
              dialogue: (entryRow?.dialogue as string) || null,
              beatContentJson:
                (entryRow?.beatContentJson as string) || null,
              characterIds: parseIdList(
                entryRow?.characterIds as string | null,
                primaryChar
              ),
              sceneIds: parseIdList(
                entryRow?.sceneIds as string | null,
                (entryRow?.sceneId as string) || null
              ),
              propIds: parseIdList(
                entryRow?.propIds as string | null,
                (entryRow?.propId as string) || null
              ),
              castRefPath: castRef,
              styleNote: (await stories().get(payload.storyId)).styleNote,
              seconds
            })
            store.writeEntryStillPromptJson(
              payload.storyId,
              payload.entryId,
              serializeEntryStillPromptCache({
                version: 1,
                professionalPrompt: polished.prompt,
                userExtraPrompt: '',
                materialsSummary,
                sourceImagePath,
                stillPath: still.stillPath,
                promptHash,
                updatedAt: new Date().toISOString(),
                durationSeconds: seconds,
                aspectRatio
              })
            )
          } catch {
            /* best-effort cache */
          }
        }

        activity.append({
          kind: 'video',
          message: 'videoPrepCreate',
          meta: {
            kind: payload.kind,
            polished: polished.polished,
            stillPath: still.stillPath,
            entityIds
          }
        })

        return {
          kind: payload.kind,
          entityIds,
          professionalPrompt: polished.prompt,
          userExtraPrompt: '',
          stillPath: still.stillPath,
          sourceImagePath,
          durationSeconds: seconds,
          aspectRatio,
          materialsSummary,
          stillPromptUsed: still.stillPromptUsed,
          polished: polished.polished,
          skippedStill: false
        }
      }
    )
  )

  reg(
    'videoPrep:regenStill',
    (
      async (
        payload: {
          professionalPrompt: string
          improvementNotes: string
          sourceImagePath?: string | null
          stillOutputHint?: string | null
          characterId?: string
          sceneId?: string
          propId?: string
          costumeId?: string
          storyId?: string
          entryId?: string
          durationSeconds?: number
          aspectRatio?: string
          locale?: 'zh-HK' | 'en'
        }
      ) => {
        const locale = payload.locale === 'en' ? 'en' : 'zh-HK'
        const notes = payload.improvementNotes?.trim()
        if (!notes) {
          throw new AppError('VALIDATION', 'errors.ideaOrDraftRequired')
        }
        const professionalPrompt = payload.professionalPrompt?.trim()
        if (!professionalPrompt) {
          throw new AppError('VALIDATION', 'errors.ideaOrDraftRequired')
        }
        const {
          polishProfessionalVideoPrompt
        } = await import('../application/video/prepareVideoPrompt')
        const {
          generateVideoStillKeyframe
        } = await import('../application/video/generateVideoStill')
        const {
          buildStillRegenPolishUserPrompt
        } = await import('../domain/videoPrep')
        const seconds =
          typeof payload.durationSeconds === 'number'
            ? payload.durationSeconds
            : 10
        const aspectRatio =
          payload.aspectRatio === '9:16' || payload.aspectRatio === '16:9'
            ? payload.aspectRatio
            : settings.aspectRatio === '9:16' || settings.aspectRatio === '16:9'
              ? settings.aspectRatio
              : '16:9'

        const revised = await polishProfessionalVideoPrompt({
          ai: aiClient,
          locale,
          fallbackPrompt: professionalPrompt,
          polishUserContent: buildStillRegenPolishUserPrompt({
            locale,
            professionalPrompt,
            improvementNotes: notes,
            seconds,
            aspectRatio
          })
        })

        const store = generation().getMediaStore()
        store.ensureLibraryDirs()
        let stillOut = store.tmpImagePath('video_prep_still', '.png')
        if (payload.characterId) {
          stillOut = store.characterImagePath(
            payload.characterId,
            'video_prep_still',
            '.png'
          )
        } else if (payload.sceneId) {
          stillOut = store.sceneImagePath(
            payload.sceneId,
            'video_prep_still',
            '.png'
          )
        } else if (payload.propId) {
          stillOut = store.propImagePath(
            payload.propId,
            'video_prep_still',
            '.png'
          )
        } else if (payload.costumeId) {
          stillOut = store.costumeImagePath(
            payload.costumeId,
            'video_prep_still',
            '.png'
          )
        } else if (payload.storyId && payload.entryId) {
          // Timeline clip: keep continuity still path so next beat can chain.
          store.ensureStoryDirs(payload.storyId)
          stillOut = store.clipContinuityStillPath(
            payload.storyId,
            payload.entryId,
            '.png'
          )
        } else if (payload.stillOutputHint?.trim()) {
          stillOut = payload.stillOutputHint.trim()
        }

        const size =
          aspectRatio === '9:16'
            ? settings.imageSizeTall
            : aspectRatio === '16:9'
              ? settings.imageSizeWide
              : settings.imageSizeSquare || '1024x1024'

        const still = await generateVideoStillKeyframe({
          ai: aiClient,
          store,
          professionalPrompt: revised.prompt,
          sourceImagePath: payload.sourceImagePath,
          improvementNotes: notes,
          locale,
          aspectRatio,
          size,
          outputPath: stillOut
        })

        return {
          professionalPrompt: revised.prompt,
          stillPath: still.stillPath,
          stillPromptUsed: still.stillPromptUsed,
          polished: revised.polished
        }
      }
    )
  )

  reg(
    'videoPrep:confirm',
    (
      async (
        payload: {
          kind:
            | 'character-intro'
            | 'scene-intro'
            | 'prop-intro'
            | 'costume-intro'
            | 'timeline-clip'
          professionalPrompt: string
          userExtraPrompt?: string | null
          stillPath: string
          sourceImagePath?: string | null
          characterId?: string
          sceneId?: string
          propId?: string
          costumeId?: string
          storyId?: string
          entryId?: string
          durationSeconds?: number
          aspectRatio?: string
          locale?: 'zh-HK' | 'en'
        }
      ) => {
        if (!aiClient.generateVideo) {
          throw new AppError('VALIDATION', 'errors.videoUnavailable')
        }
        const stillPath = payload.stillPath?.trim()
        if (!stillPath || !existsSync(stillPath)) {
          throw new AppError('VALIDATION', 'errors.sourceImageRequired')
        }
        const {
          mergeFinalVideoPrompt
        } = await import('../domain/videoPrep')
        const seconds =
          typeof payload.durationSeconds === 'number'
            ? payload.durationSeconds
            : 10
        const aspectRatio =
          payload.aspectRatio === '9:16' || payload.aspectRatio === '16:9'
            ? payload.aspectRatio
            : '16:9'
        // User already reviewed / edited the professional prompt — do not
        // re-LLM-polish (would overwrite their revisions). Merge extras only.
        const finalPrompt = mergeFinalVideoPrompt(
          payload.professionalPrompt,
          payload.userExtraPrompt
        )
        if (!finalPrompt) {
          throw new AppError('VALIDATION', 'errors.ideaOrDraftRequired')
        }

        const store = generation().getMediaStore()
        store.ensureLibraryDirs()
        let outPath = store.tmpImagePath('video_out', '.mp4').replace(
          /\.png$/i,
          '.mp4'
        )
        // Prefer library video paths by kind
        if (payload.kind === 'character-intro' && payload.characterId) {
          outPath = store.characterVideoPath(
            payload.characterId,
            'intro',
            '.mp4'
          )
        } else if (payload.kind === 'scene-intro' && payload.sceneId) {
          outPath = store.sceneVideoPath(payload.sceneId, 'intro', '.mp4')
        } else if (payload.kind === 'prop-intro' && payload.propId) {
          outPath = store.propVideoPath(payload.propId, 'intro', '.mp4')
        } else if (payload.kind === 'costume-intro' && payload.costumeId) {
          outPath = store.costumeVideoPath(payload.costumeId, 'intro', '.mp4')
        } else if (
          payload.kind === 'timeline-clip' &&
          payload.storyId &&
          payload.entryId
        ) {
          outPath = store.clipPath(payload.storyId, payload.entryId, '.mp4')
          try {
            await timeline().setMedia(payload.entryId, {
              mediaStatus: 'GENERATING',
              mediaError: null
            })
          } catch {
            /* best-effort status */
          }
        }

        let result: {
          outputPath: string
          polished?: boolean
          promptUsed?: string
          jobId?: string
          degraded?: boolean
        }
        try {
          const video = await aiClient.generateVideo!({
            prompt: finalPrompt,
            durationSeconds: seconds,
            refImagePath: stillPath,
            outputPath: outPath,
            aspectRatio
          })
          result = {
            outputPath: video.outputPath,
            polished: false,
            promptUsed: finalPrompt,
            jobId: video.jobId,
            degraded: Boolean(video.degraded)
          }
        } catch (err) {
          if (payload.kind === 'timeline-clip' && payload.entryId) {
            try {
              await timeline().setMedia(payload.entryId, {
                mediaStatus: 'FAILED',
                mediaError:
                  err instanceof Error ? err.message : String(err)
              })
            } catch {
              /* ignore */
            }
          }
          throw err
        }

        // Attach intro video to gallery when applicable
        if (payload.kind === 'character-intro' && payload.characterId) {
          const row = await characters().get(payload.characterId)
          const {
            parseCharacterGallery,
            serializeCharacterGallery,
            setGalleryIntroVideo,
            appendGalleryItem
          } = await import('../domain/characterGallery')
          let next = parseCharacterGallery(row.refGalleryJson, {
            refImagePath: row.refImagePath,
            refSheetPath: row.refSheetPath
          })
          const source = payload.sourceImagePath?.trim() || null
          // Always keep keyframe still in gallery
          if (!next.some((g) => g.path === stillPath)) {
            next = appendGalleryItem(next, {
              path: stillPath,
              kind: 'gen',
              label: 'Video still'
            })
          }
          // Bind video onto the image the user started from (if still in gallery)
          if (source && next.some((g) => g.path === source)) {
            next = setGalleryIntroVideo(next, source, result.outputPath)
          }
          // And onto the keyframe still
          next = setGalleryIntroVideo(next, stillPath, result.outputPath)
          const updated = await characters().update(payload.characterId, {
            refGalleryJson: serializeCharacterGallery(next),
            refImagePath: row.refImagePath || source || stillPath
          })
          activity.append({
            kind: 'character',
            message: 'videoPrepConfirm',
            meta: {
              characterId: payload.characterId,
              path: result.outputPath,
              stillPath,
              sourceImagePath: source
            }
          })
          return {
            path: result.outputPath,
            gallery: next,
            entity: updated,
            polished: result.polished,
            promptUsed: result.promptUsed
          }
        }

        if (payload.kind === 'scene-intro' && payload.sceneId) {
          const row = await scenes().get(payload.sceneId)
          const {
            parseSceneGallery,
            serializeSceneGallery,
            setSceneGalleryIntroVideo,
            appendSceneGalleryItem
          } = await import('../domain/sceneGallery')
          let next = parseSceneGallery(row.refGalleryJson, {
            refImagePath: row.refImagePath
          })
          const source = payload.sourceImagePath?.trim() || null
          if (!next.some((g) => g.path === stillPath)) {
            next = appendSceneGalleryItem(next, {
              path: stillPath,
              kind: 'gen',
              label: 'Video still'
            })
          }
          if (source && next.some((g) => g.path === source)) {
            next = setSceneGalleryIntroVideo(next, source, result.outputPath)
          }
          next = setSceneGalleryIntroVideo(next, stillPath, result.outputPath)
          const updated = await scenes().update(payload.sceneId, {
            refGalleryJson: serializeSceneGallery(next),
            refImagePath: row.refImagePath || source || stillPath
          })
          return {
            path: result.outputPath,
            gallery: next,
            entity: updated,
            polished: result.polished,
            promptUsed: result.promptUsed
          }
        }

        if (payload.kind === 'prop-intro' && payload.propId) {
          const row = await props().get(payload.propId)
          const {
            parseSceneGallery,
            serializeSceneGallery,
            setSceneGalleryIntroVideo,
            appendSceneGalleryItem
          } = await import('../domain/sceneGallery')
          let next = parseSceneGallery(row.refGalleryJson, {
            refImagePath: row.refImagePath
          })
          const source = payload.sourceImagePath?.trim() || null
          if (!next.some((g) => g.path === stillPath)) {
            next = appendSceneGalleryItem(next, {
              path: stillPath,
              kind: 'gen',
              label: 'Video still'
            })
          }
          if (source && next.some((g) => g.path === source)) {
            next = setSceneGalleryIntroVideo(next, source, result.outputPath)
          }
          next = setSceneGalleryIntroVideo(next, stillPath, result.outputPath)
          const updated = await props().update(payload.propId, {
            refGalleryJson: serializeSceneGallery(next),
            refImagePath: row.refImagePath || source || stillPath
          })
          return {
            path: result.outputPath,
            gallery: next,
            entity: updated,
            polished: result.polished,
            promptUsed: result.promptUsed
          }
        }

        if (payload.kind === 'costume-intro' && payload.costumeId) {
          const row = await costumes().get(payload.costumeId)
          const {
            parseCharacterGallery,
            serializeCharacterGallery,
            setGalleryIntroVideo,
            appendGalleryItem
          } = await import('../domain/characterGallery')
          let next = parseCharacterGallery(row.refGalleryJson, {
            refImagePath: row.refImagePath
          })
          const source = payload.sourceImagePath?.trim() || null
          if (!next.some((g) => g.path === stillPath)) {
            next = appendGalleryItem(next, {
              path: stillPath,
              kind: 'gen',
              label: 'Video still'
            })
          }
          if (source && next.some((g) => g.path === source)) {
            next = setGalleryIntroVideo(next, source, result.outputPath)
          }
          next = setGalleryIntroVideo(next, stillPath, result.outputPath)
          const updated = await costumes().update(payload.costumeId, {
            refGalleryJson: serializeCharacterGallery(next),
            refImagePath: row.refImagePath || source || stillPath
          })
          return {
            path: result.outputPath,
            gallery: next,
            entity: updated,
            polished: result.polished,
            promptUsed: result.promptUsed
          }
        }

        if (payload.kind === 'timeline-clip' && payload.entryId) {
          // Persist keyframe for next-beat image lock (prep still → continuity path).
          if (payload.storyId) {
            try {
              store.ensureStoryDirs(payload.storyId)
              const contPath = store.clipContinuityStillPath(
                payload.storyId,
                payload.entryId,
                '.png'
              )
              if (stillPath !== contPath && existsSync(stillPath)) {
                copyFileSync(stillPath, contPath)
              }
            } catch {
              /* best-effort continuity write */
            }
          }
          await timeline().setMedia(payload.entryId, {
            mediaPath: result.outputPath,
            mediaStatus: 'READY',
            mediaError: result.degraded ? 'STUB_PLACEHOLDER' : null
          })
          return {
            path: result.outputPath,
            polished: result.polished,
            promptUsed: result.promptUsed,
            degraded: result.degraded
          }
        }

        return {
          path: result.outputPath,
          polished: result.polished,
          promptUsed: result.promptUsed
        }
      }
    )
  )

  // ─── Timeline ──────────────────────────────────────────────
  reg(
    'timeline:list',
    (async ( storyId: string) => timeline().list(storyId))
  )
  reg(
    'timeline:create',
    (async ( input: CreateTimelineEntryInput) => timeline().create(input))
  )
  reg(
    'timeline:update',
    (async ( id: string, data: UpdateTimelineEntryInput) =>
      timeline().update(id, data)
    )
  )
  reg(
    'timeline:delete',
    (async ( id: string) => timeline().delete(id))
  )
  reg(
    'timeline:reorder',
    (async ( storyId: string, orderedIds: string[]) =>
      timeline().reorder(storyId, orderedIds)
    )
  )

  reg(
    'timeline:setMedia',
    (
      async (
        id: string,
        data: {
          mediaPath?: string | null
          mediaStatus: 'EMPTY' | 'QUEUED' | 'GENERATING' | 'READY' | 'FAILED'
          mediaError?: string | null
        }
      ) => timeline().setMedia(id, data)
    )
  )

  // ─── Advanced prep (cast looks + storyboard stills) ────────
  reg(
    'timeline:getAdvancedPrep',
    (async ( storyId: string) => {
      const { AdvancedPrepService } = await import(
        '../application/services/AdvancedPrepService'
      )
      const svc = new AdvancedPrepService(
        host.getPrisma(),
        generation().getMediaStore(),
        () => aiClient as never,
        () => settings
      )
      return svc.getSnapshot(storyId)
    })
  )
  reg(
    'timeline:setCastPrep',
    (
      async (
        storyId: string,
        prep: { version?: number; characters?: Record<string, unknown> }
      ) => {
        const {
          parseStoryCastPrep,
          serializeStoryCastPrep
        } = await import('../domain/advancedPrep')
        const store = generation().getMediaStore()
        const normalized = parseStoryCastPrep(JSON.stringify(prep ?? {}))
        store.writeStoryCastPrepJson(
          storyId,
          serializeStoryCastPrep(normalized)
        )
        return normalized
      }
    )
  )
  reg(
    'timeline:clearEntryStill',
    (async ( storyId: string, entryId: string) => {
      const { AdvancedPrepService } = await import(
        '../application/services/AdvancedPrepService'
      )
      const svc = new AdvancedPrepService(
        host.getPrisma(),
        generation().getMediaStore(),
        () => aiClient as never,
        () => settings
      )
      return svc.clearEntryStill(storyId, entryId)
    })
  )
  reg(
    'videoPrep:openFromStill',
    (
      async (
        payload: {
          storyId: string
          entryId: string
          locale?: 'zh-HK' | 'en'
          forcePolish?: boolean
        }
      ) => {
        const { AdvancedPrepService } = await import(
          '../application/services/AdvancedPrepService'
        )
        const svc = new AdvancedPrepService(
          host.getPrisma(),
          generation().getMediaStore(),
          () => aiClient as never,
          () => settings
        )
        return svc.openFromStill({
          storyId: payload.storyId,
          entryId: payload.entryId,
          locale: payload.locale,
          forcePolish: payload.forcePolish
        })
      }
    )
  )

  // ─── Generation ────────────────────────────────────────────
  reg(
    'generation:run',
    (
      async (
        storyId: string,
        opts?: { onlyFailedVideos?: boolean; interactiveVideo?: boolean }
      ) => {
        activity.append({
          kind: 'generation',
          message: opts?.onlyFailedVideos
            ? 'retry failed'
            : opts?.interactiveVideo
              ? 'run pipeline (interactive video)'
              : 'run pipeline',
          storyId
        })
        const result = await generation().run(
          storyId,
          (payload) => {
            host.emitGenerationProgress?.(payload)
          },
          opts
        )
        const degraded = result.steps.some((s) => s.degraded)
        settingsStore.save({ lastGenerationDegraded: degraded })
        activity.append({
          kind: 'generation',
          message: result.success ? 'pipeline ok' : 'pipeline failed',
          storyId,
          meta: { degraded, steps: result.steps.length }
        })
        return result
      }
    )
  )

  reg(
    'generation:cancel',
    (async () => {
      generation().cancel()
      activity.append({ kind: 'generation', message: 'cancelled' })
      return { ok: true as const }
    })
  )

  /** Last progress snapshot (push events on electron via host.emitGenerationProgress). */
  reg(
    'generation:progress',
    (async () => host.getLastGenerationProgress?.() ?? null)
  )

  reg(
    'generation:runClip',
    (async (
      storyId: string,
      entryId: string,
      opts?: { revisionPrompt?: string | null }
    ) => {
      activity.append({
        kind: 'generation',
        message: 'run clip',
        storyId,
        meta: {
          entryId,
          hasRevision: Boolean(opts?.revisionPrompt?.trim())
        }
      })
      const result = await generation().generateClip(
        storyId,
        entryId,
        (payload) => {
          host.emitGenerationProgress?.(payload)
        },
        opts
      )
      if (result.degraded) {
        settingsStore.save({ lastGenerationDegraded: true })
      }
      activity.append({
        kind: 'generation',
        message: result.degraded ? 'clip stub' : 'clip ok',
        storyId,
        meta: { entryId }
      })
      return result
    })
  )

  reg(
    'ai:status',
    (async () => aiClient.getStatus())
  )

  // ─── Local Grok Gateway (gctoac) lifecycle ─────────────────
  reg('gateway:status', async () => {
    const {
      getGrokGatewayService
    } = await import('../infrastructure/gateway/GrokGatewayService')
    return getGrokGatewayService().getStatus()
  })

  reg('gateway:ensure', async () => {
    const {
      getGrokGatewayService
    } = await import('../infrastructure/gateway/GrokGatewayService')
    const gw = getGrokGatewayService()
    // Must use host settingsStore (cached) — a separate SettingsStore would
    // write disk while leaving in-memory settings + aiClient on a stale empty key.
    const current = settingsStore.load()
    const { status, apiKey, keyCreated } = await gw.ensureRunningWithApiKey(
      current.apiKey
    )
    // Auto-wire base URL + key into the live store and rebind AI client
    const keyReady = Boolean(apiKey?.trim())
    if (keyReady || status.healthOk) {
      const next = settingsStore.save({
        llmProvider: current.llmProvider || 'grok-gateway',
        baseUrl: gw.baseUrl,
        ...(keyReady ? { apiKey: apiKey!.trim() } : {})
      })
      rebindAi(next)
    }
    activity.append({
      kind: 'settings',
      message: `gateway ensure → ${status.state}`,
      meta: {
        healthOk: status.healthOk,
        grok: Boolean(status.grokPath),
        gctoac: Boolean(status.gctoacPath),
        keyCreated,
        keyReady
      }
    })
    return {
      ...status,
      keyReady,
      keyCreated,
      // Never return the plaintext key to the renderer
      baseUrl: gw.baseUrl
    }
  })

  reg('gateway:installHints', async () => {
    const {
      GrokGatewayService
    } = await import('../infrastructure/gateway/GrokGatewayService')
    return {
      grokBuildUrl: GrokGatewayService.grokBuildInstallUrl(),
      gatewayDocsUrl: GrokGatewayService.gatewayDocsUrl(),
      installCommand: GrokGatewayService.grokBuildInstallCommand()
    }
  })

  reg('gateway:openAdmin', async (url?: string) => {
    const {
      getGrokGatewayService
    } = await import('../infrastructure/gateway/GrokGatewayService')
    const gw = getGrokGatewayService()
    const st = await gw.ensureRunning()
    const target =
      (typeof url === 'string' && url.trim()) ||
      st.adminUrl ||
      gw.adminUrl
    if (host.openAdminWindow) {
      return host.openAdminWindow(target)
    }
    await host.shell.openExternal(target)
    return {
      ok: true as const,
      url: target,
      reused: false as const,
      state: st.state,
      healthOk: st.healthOk,
      via: 'external' as const
    }
  })

  reg(
    'ai:probeVideo',
    (async () => aiClient.videoProvider.probe())
  )

  reg(
    'ai:probeChat',
    (async () => aiClient.probeChat())
  )

  reg(
    'ai:listModels',
    (async () => aiClient.listModels())
  )

  reg(
    'ai:testChat',
    (async ( prompt?: string) => aiClient.testChat(prompt))
  )

  reg(
    'ai:applyLlmPreset',
    (async ( preset: string) => {
      const {
        applyLlmPreset,
        coerceLlmProviderPreset
      } = await import('../domain/openaiCompatible')
      const current = settingsStore.load()
      const id = coerceLlmProviderPreset(preset, current.baseUrl)
      const patched = applyLlmPreset(current, id)
      const next = settingsStore.save({
        llmProvider: patched.llmProvider,
        baseUrl: patched.baseUrl,
        videoPath: patched.videoPath,
        model: patched.model
      })
      rebindAi(next)
      if (id === 'grok-gateway') {
        void import('../infrastructure/gateway/GrokGatewayService')
          .then(({ getGrokGatewayService }) =>
            getGrokGatewayService().ensureRunning()
          )
          .catch(() => undefined)
      }
      activity.append({
        kind: 'settings',
        message: `llm preset → ${id}`,
        meta: { baseUrl: next.baseUrl }
      })
      return next
    })
  )

  /** @deprecated alias — same as applyLlmPreset('grok-gateway') */
  reg(
    'ai:applyGrokDefaults',
    (async () => {
      const { applyLlmPreset } = await import('../domain/openaiCompatible')
      const current = settingsStore.load()
      const patched = applyLlmPreset(current, 'grok-gateway')
      const next = settingsStore.save({
        llmProvider: patched.llmProvider,
        baseUrl: patched.baseUrl,
        videoPath: patched.videoPath,
        model: patched.model
      })
      rebindAi(next)
      return next
    })
  )

  // ─── Settings ──────────────────────────────────────────────
  reg(
    'settings:get',
    (async () => {
      const s = settingsStore.load()
      if (settingsStore.lastLoadMigrated) {
        activity.append({
          kind: 'settings',
          message: 'migrated gateway defaults 39281 → 3847'
        })
        settingsStore.lastLoadMigrated = false
      }
      return s
    })
  )
  reg(
    'settings:set',
    (async ( partial: Partial<AppSettings>) => {
      const prev = settingsStore.load()
      const prevLang = prev.uiLanguage
      const next = settingsStore.save(partial)
      rebindAi(next)
      // Auto-start local gateway when user switches to / saves Grok preset
      if (
        next.llmProvider === 'grok-gateway' ||
        next.imageProvider === 'grok-gateway' ||
        next.videoProvider === 'grok-gateway'
      ) {
        void import('../infrastructure/gateway/GrokGatewayService')
          .then(({ getGrokGatewayService }) =>
            getGrokGatewayService().ensureRunning()
          )
          .catch(() => undefined)
      }
      if (
        partial.uiLanguage !== undefined &&
        partial.uiLanguage !== prevLang &&
        host.rebuildApplicationMenu
      ) {
        try {
          host.rebuildApplicationMenu()
        } catch {
          /* non-fatal */
        }
      }
      // Sync embedded web server when related settings change
      const webTouched =
        partial.webServerEnabled !== undefined ||
        partial.webServerPort !== undefined ||
        partial.webServerHost !== undefined ||
        partial.webServerAuthToken !== undefined
      if (webTouched) {
        void syncEmbeddedWebServer(next).catch(() => undefined)
      }
      return next
    })
  )

  // ─── Embedded web server (browser control) ─────────────────
  async function resolveWebStaticDir(): Promise<string> {
    // Packaged: out/renderer next to main; dev: project out/renderer
    const candidates = [
      join(__dirname, '../renderer'),
      join(process.cwd(), 'out', 'renderer')
    ]
    for (const c of candidates) {
      if (existsSync(join(c, 'index.html'))) return c
    }
    return candidates[0]
  }

  async function syncEmbeddedWebServer(
    s: AppSettings
  ): Promise<import('../infrastructure/webserver/EmbeddedWebServer').WebServerStatus> {
    const {
      getEmbeddedWebServer,
      generateWebServerToken
    } = await import(
      '../infrastructure/webserver/EmbeddedWebServer'
    )
    const ws = getEmbeddedWebServer()
    if (!s.webServerEnabled) {
      return ws.stop()
    }
    let token = s.webServerAuthToken?.trim() || ''
    if (!token) {
      token = generateWebServerToken()
      settingsStore.save({ webServerAuthToken: token })
      s = settingsStore.load()
    }
    const staticDir = await resolveWebStaticDir()
    return ws.start({
      dataDir: host.userData,
      port: s.webServerPort || 8787,
      host: s.webServerHost || '0.0.0.0',
      authToken: token,
      authDisabled: false,
      staticDir,
      appVersion: host.appVersion,
      isPackaged: host.isPackaged
    })
  }

  reg(
    'webServer:status',
    (async () => {
      const { getEmbeddedWebServer } = await import(
        '../infrastructure/webserver/EmbeddedWebServer'
      )
      return getEmbeddedWebServer().getStatus()
    })
  )
  reg(
    'webServer:start',
    (async () => {
      const next = settingsStore.save({ webServerEnabled: true })
      try {
        return await syncEmbeddedWebServer(next)
      } catch (e) {
        settingsStore.save({ webServerEnabled: false })
        throw e instanceof AppError
          ? e
          : new AppError(
              'IO',
              e instanceof Error ? e.message : String(e)
            )
      }
    })
  )
  reg(
    'webServer:stop',
    (async () => {
      settingsStore.save({ webServerEnabled: false })
      const { getEmbeddedWebServer } = await import(
        '../infrastructure/webserver/EmbeddedWebServer'
      )
      return getEmbeddedWebServer().stop()
    })
  )
  reg(
    'webServer:generateToken',
    (async () => {
      const { generateWebServerToken } = await import(
        '../infrastructure/webserver/EmbeddedWebServer'
      )
      const token = generateWebServerToken()
      const next = settingsStore.save({ webServerAuthToken: token })
      if (next.webServerEnabled) {
        await syncEmbeddedWebServer(next)
      }
      return { token, settings: next }
    })
  )

  // ─── Shell helpers ─────────────────────────────────────────
  reg(
    'shell:openExternal',
    (async ( url: string) => {
      const raw = typeof url === 'string' ? url.trim() : ''
      if (!raw) {
        throw new AppError('VALIDATION', 'URL is required')
      }
      let parsed: URL
      try {
        parsed = new URL(raw)
      } catch {
        throw new AppError('VALIDATION', `Invalid URL: ${raw}`)
      }
      if (!['http:', 'https:', 'mailto:'].includes(parsed.protocol)) {
        throw new AppError(
          'VALIDATION',
          `Unsupported URL protocol: ${parsed.protocol}`
        )
      }
      const href = parsed.href
      try {
        await host.shell.openExternal(href)
        return { ok: true as const, url: href }
      } catch (first) {
        // Linux / sandboxed environments: Electron openExternal can fail
        // while xdg-open / open still works.
        const { execFile } = await import('child_process')
        const { promisify } = await import('util')
        const execFileAsync = promisify(execFile)
        try {
          if (process.platform === 'darwin') {
            await execFileAsync('open', [href])
          } else if (process.platform === 'win32') {
            await execFileAsync('cmd', ['/c', 'start', '', href])
          } else {
            await execFileAsync('xdg-open', [href])
          }
          return { ok: true as const, url: href, via: 'fallback' as const }
        } catch {
          throw new AppError(
            'IO',
            `Could not open URL in browser: ${href}`,
            first instanceof Error ? first.message : String(first)
          )
        }
      }
    })
  )

  reg(
    'shell:openPath',
    (async ( filePath: string) => {
      const err = await host.shell.openPath(filePath)
      if (err) throw new AppError('IO', err)
      return { ok: true as const }
    })
  )

  reg(
    'shell:showItemInFolder',
    (async ( filePath: string) => {
      host.shell.showItemInFolder(filePath)
      return { ok: true as const }
    })
  )

  // ─── Media ─────────────────────────────────────────────────
  reg(
    'media:pickRefImage',
    (async (filePath?: string) => {
      let src =
        typeof filePath === 'string' && filePath.trim() ? filePath.trim() : ''
      if (!src) {
        const win = host.getMainWindow()
        const options: OpenDialogOptionsLike = {
          title: 'Select reference image',
          filters: [
            { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp'] }
          ],
          properties: ['openFile']
        }
        const result = win
          ? await host.dialog.showOpenDialog(win, options)
          : await host.dialog.showOpenDialog(options)
        if (result.canceled || result.filePaths.length === 0) return null
        src = result.filePaths[0]
      }
      if (!existsSync(src)) {
        throw new AppError('NOT_FOUND', `Image not found: ${src}`)
      }
      const destDir = join(mediaRoot(), 'refs')
      mkdirSync(destDir, { recursive: true })
      const dest = join(
        destDir,
        `${Date.now()}${extname(src) || '.png'}`
      )
      copyFileSync(src, dest)
      return { filePath: dest, originalName: basename(src) }
    })
  )

  reg(
    'media:exportStoryboard',
    (async ( storyId: string) => generation().exportStoryboard(storyId))
  )

  reg(
    'media:exportConcat',
    (async ( storyId: string) => generation().exportConcat(storyId))
  )

  reg(
    'media:exportFinal',
    (
      async (
        storyId: string,
        options?: Partial<{
          exportProfile: 'balanced' | 'fast'
          burnSubtitles: boolean
          includeSilentAudio: boolean
          bgmVolume: number
          dialogueVolume: number
          openExportFolder: boolean
        }>
      ) => {
        // Remember last one-shot export choices (not a permanent Settings tab)
        if (options && typeof options === 'object') {
          const patch: Record<string, unknown> = {}
          if (options.exportProfile === 'balanced' || options.exportProfile === 'fast') {
            patch.exportProfile = options.exportProfile
          }
          if (typeof options.burnSubtitles === 'boolean') {
            patch.burnSubtitles = options.burnSubtitles
          }
          if (typeof options.includeSilentAudio === 'boolean') {
            patch.includeSilentAudio = options.includeSilentAudio
          }
          if (typeof options.bgmVolume === 'number') {
            patch.bgmVolume = options.bgmVolume
          }
          if (typeof options.dialogueVolume === 'number') {
            patch.dialogueVolume = options.dialogueVolume
          }
          if (typeof options.openExportFolder === 'boolean') {
            patch.openExportFolder = options.openExportFolder
          }
          if (Object.keys(patch).length > 0) {
            const next = settingsStore.save(patch as Partial<AppSettings>)
            rebindAi(next)
          }
        }
        const result = await generation().exportFinal(storyId, options)
        activity.append({
          kind: 'export',
          message: 'final',
          storyId,
          meta: { path: result.outputPath, options: options ?? null }
        })
        return result
      }
    )
  )

  reg(
    'media:listExports',
    (async ( storyId: string) => generation().listExports(storyId))
  )

  reg(
    'media:deleteExport',
    (async ( storyId: string, exportId: string) => {
      const result = await generation().deleteExport(storyId, exportId)
      activity.append({
        kind: 'export',
        message: 'delete',
        storyId,
        meta: { exportId, ok: result.ok }
      })
      return result
    })
  )

  reg(
    'media:toPreviewUrl',
    (async ( filePath: string) => {
      if (!filePath || !existsSync(filePath)) {
        throw new AppError('NOT_FOUND', 'Media file not found')
      }
      // Bust Chromium cache when the same path is rewritten (mtime changes).
      let bust = Date.now()
      try {
        bust = statSync(filePath).mtimeMs
      } catch {
        /* keep Date.now() */
      }
      const url = `idm-media://local/?p=${encodeURIComponent(filePath)}&t=${bust}`
      return { url, filePath }
    })
  )

  /** Save a copy of any local media file (Save as…). Optional destPath for CLI. */
  reg(
    'media:saveAs',
    (async (filePath: string, destPath?: string) => {
      if (!filePath || !existsSync(filePath)) {
        throw new AppError('NOT_FOUND', 'Media file not found')
      }
      let to =
        typeof destPath === 'string' && destPath.trim()
          ? destPath.trim()
          : process.env.IDM_SAVE_PATH || ''
      if (!to) {
        const win = host.getMainWindow()
        const ext = extname(filePath).replace(/^\./, '') || 'png'
        const filters =
          ['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(ext.toLowerCase())
            ? [
                {
                  name: 'Images',
                  extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif']
                },
                { name: 'All files', extensions: ['*'] }
              ]
            : [
                { name: 'Media', extensions: [ext] },
                { name: 'All files', extensions: ['*'] }
              ]
        const options = {
          title: 'Save as',
          defaultPath: basename(filePath),
          filters
        }
        const result = win
          ? await host.dialog.showSaveDialog(win, options)
          : await host.dialog.showSaveDialog(options)
        if (result.canceled || !result.filePath) return null
        to = result.filePath
      }
      copyFileSync(filePath, to)
      activity.append({
        kind: 'media',
        message: 'saveAs',
        meta: { from: filePath, to }
      })
      return { filePath: to }
    })
  )

  reg(
    'media:checkFfmpeg',
    (async () => {
      const { FfmpegService } = await import(
        '../infrastructure/ffmpeg/FfmpegService'
      )
      try {
        const svc = new FfmpegService()
        await svc.ensureAvailable()
        // Path kept for support/diagnostics; UI only surfaces failures
        // (FFmpeg is a hard dependency of the product).
        return {
          available: true,
          message: 'ready',
          path: svc.binaryPath
        }
      } catch (error) {
        return {
          available: false,
          message: error instanceof Error ? error.message : String(error)
        }
      }
    })
  )

  reg(
    'media:exportPreflight',
    (async ( storyId: string) => generation().exportPreflight(storyId))
  )

  reg(
    'app:getInfo',
    (async () => ({
      version: host.appVersion,
      name: 'InstantDrama Magician',
      electron: process.versions.electron ?? 'unknown',
      userData: host.userData,
      mediaRoot: mediaRoot(),
      isPackaged: host.isPackaged,
      platform: process.platform
    }))
  )

  // ─── Auto-update (electron-updater; headless returns skipped) ─
  async function loadUpdateService() {
    try {
      const mod = await import('../infrastructure/update/AppUpdateService')
      return mod.appUpdateService
    } catch {
      return null
    }
  }

  reg(
    'updates:status',
    (async () => {
      const svc = await loadUpdateService()
      if (!svc) {
        return {
          status: 'dev-skipped',
          currentVersion: host.appVersion,
          message: 'Auto-update requires Electron packaged build'
        }
      }
      return svc.getState()
    })
  )
  reg(
    'updates:check',
    (async () => {
      const svc = await loadUpdateService()
      if (!svc) {
        return {
          status: 'dev-skipped',
          currentVersion: host.appVersion,
          message: 'Auto-update requires Electron packaged build'
        }
      }
      const state = await svc.check()
      activity.append({
        kind: 'update',
        message: `check → ${state.status}`,
        meta: { latest: state.latestVersion ?? null }
      })
      return state
    })
  )
  reg(
    'updates:download',
    (async () => {
      const svc = await loadUpdateService()
      if (!svc) {
        return {
          status: 'dev-skipped',
          currentVersion: host.appVersion,
          message: 'Auto-update requires Electron packaged build'
        }
      }
      const state = await svc.download()
      activity.append({ kind: 'update', message: `download → ${state.status}` })
      return state
    })
  )
  reg(
    'updates:install',
    (async () => {
      const svc = await loadUpdateService()
      if (!svc) {
        return { ok: false, message: 'Auto-update requires Electron packaged build' }
      }
      activity.append({ kind: 'update', message: 'quitAndInstall' })
      return svc.quitAndInstall()
    })
  )

  // ─── Activity + support report ─────────────────────────────
  reg(
    'activity:recent',
    (async ( limit?: number) => activity.readRecent(limit ?? 80))
  )
  reg(
    'activity:query',
    (
      async (
        opts?: {
          limit?: number
          kind?: string
          level?: string
          q?: string
          since?: string
          until?: string
        }
      ) => {
        const entries = activity.query({
          limit: opts?.limit ?? 300,
          kind: opts?.kind,
          level: (opts?.level as 'debug' | 'info' | 'warn' | 'error' | 'all') ?? 'all',
          q: opts?.q,
          since: opts?.since,
          until: opts?.until
        })
        return {
          entries,
          totalReturned: entries.length,
          path: activity.path,
          kinds: activity.kinds()
        }
      }
    )
  )
  reg(
    'activity:clear',
    (async () => activity.clear())
  )
  reg(
    'activity:getPath',
    (async () => ({ path: activity.path }))
  )
  reg(
    'activity:openLogFolder',
    (async () => {
      const dir = dirname(activity.path)
      mkdirSync(dir, { recursive: true })
      await host.shell.openPath(dir)
      return { ok: true as const, path: dir }
    })
  )

  reg(
    'support:exportReport',
    (async (destPath?: string) => {
      const win = host.getMainWindow()
      const chat = await aiClient.getStatus()
      const video = await aiClient.videoProvider.probe()
      let ffmpeg = { available: false, message: 'unknown' }
      try {
        const { FfmpegService } = await import(
          '../infrastructure/ffmpeg/FfmpegService'
        )
        await new FfmpegService().ensureAvailable()
        ffmpeg = { available: true, message: 'ffmpeg OK' }
      } catch (error) {
        ffmpeg = {
          available: false,
          message: error instanceof Error ? error.message : String(error)
        }
      }
      const tips: string[] = []
      if (!chat.available) tips.push('Start Gateway; set baseUrl + API key.')
      if (!video.available) tips.push('Enable videoApi; agent/admin key.')
      if (!ffmpeg.available) {
        tips.push(
          'FFmpeg missing: reinstall the app (bundled binary) or set FFMPEG_PATH.'
        )
      }

      const defaultPath = supportReportPath(host.userData)
      let outPath =
        typeof destPath === 'string' && destPath.trim()
          ? destPath.trim()
          : process.env.IDM_SAVE_PATH || ''
      if (!outPath) {
        const result = win
          ? await host.dialog.showSaveDialog(win, {
              title: 'Export support report',
              defaultPath,
              filters: [{ name: 'JSON', extensions: ['json'] }]
            })
          : await host.dialog.showSaveDialog({
              title: 'Export support report',
              defaultPath,
              filters: [{ name: 'JSON', extensions: ['json'] }]
            })
        if (result.canceled || !result.filePath) {
          // Headless fallback: write default path
          if (host.mode === 'headless') outPath = defaultPath
          else return null
        } else {
          outPath = result.filePath
        }
      }

      const path = writeSupportReportJson(outPath, {
        generatedAt: new Date().toISOString(),
        app: {
          version: host.appVersion,
          name: 'InstantDrama Magician',
          isPackaged: host.isPackaged,
          platform: process.platform,
          electron: process.versions.electron ?? 'unknown',
          userData: host.userData,
          mediaRoot: mediaRoot()
        },
        diagnostics: {
          chat,
          video,
          ffmpeg,
          videoMode: settings.videoMode,
          tips
        },
        settings: redactSettings(settingsStore.load()),
        activity: activity.readRecent(120)
      })
      activity.append({ kind: 'support', message: 'export report', meta: { path } })
      return { filePath: path }
    })
  )

  reg(
    'diagnostics:full',
    (async () => {
      const chatProbe = await aiClient.probeChat()
      const chat = await aiClient.getStatus()
      const video = await aiClient.videoProvider.probe()
      let ffmpeg = { available: false, message: 'unknown' }
      try {
        const { FfmpegService } = await import(
          '../infrastructure/ffmpeg/FfmpegService'
        )
        await new FfmpegService().ensureAvailable()
        ffmpeg = { available: true, message: 'ffmpeg OK' }
      } catch (error) {
        ffmpeg = {
          available: false,
          message: error instanceof Error ? error.message : String(error)
        }
      }
      const tips: string[] = []
      if (!settings.apiKey?.trim()) {
        tips.push(
          'LLM: create API key in Grok Gateway Admin → Keys (gk_live_…), paste in Settings.'
        )
      }
      if (!chat.available) {
        tips.push(
          'Start Grok Gateway: gctoac start (default :3847). https://github.com/yanshekki/Grok-Cli-to-OpenAI-compatible'
        )
      }
      if (!video.available) {
        tips.push('Video: enable videoApi; use agent/admin key; videoPath=/v1/videos.')
      }
      if (!ffmpeg.available) {
        tips.push(
          'FFmpeg missing: reinstall the app (bundled binary) or set FFMPEG_PATH.'
        )
      }
      if (host.isPackaged) {
        tips.push(`Media files live under: ${mediaRoot()}`)
      }
      return {
        chat,
        chatProbe,
        video,
        ffmpeg,
        videoMode: settings.videoMode,
        tips,
        app: {
          version: host.appVersion,
          name: 'InstantDrama Magician',
          isPackaged: host.isPackaged,
          userData: host.userData,
          mediaRoot: mediaRoot()
        }
      }
    })
  )

  reg(
    'media:pickBgm',
    (async (filePath?: string) => {
      let src =
        typeof filePath === 'string' && filePath.trim() ? filePath.trim() : ''
      if (!src) {
        const win = host.getMainWindow()
        const options: OpenDialogOptionsLike = {
          title: 'Select BGM',
          filters: [
            { name: 'Audio', extensions: ['mp3', 'wav', 'm4a', 'aac', 'ogg'] }
          ],
          properties: ['openFile']
        }
        const result = win
          ? await host.dialog.showOpenDialog(win, options)
          : await host.dialog.showOpenDialog(options)
        if (result.canceled || result.filePaths.length === 0) return null
        src = result.filePaths[0]
      }
      if (!existsSync(src)) {
        throw new AppError('NOT_FOUND', `Audio not found: ${src}`)
      }
      const destDir = join(mediaRoot(), 'bgm')
      mkdirSync(destDir, { recursive: true })
      const dest = join(destDir, `${Date.now()}${extname(src) || '.mp3'}`)
      copyFileSync(src, dest)
      const next = settingsStore.save({ bgmPath: dest })
      rebindAi(next)
      return { filePath: dest }
    })
  )

  // ─── Project backup ────────────────────────────────────────
  const backup = (): ProjectBackupService =>
    new ProjectBackupService(host.getPrisma(), new MediaStore(mediaRoot()))

  reg(
    'project:exportBackup',
    (async (storyId: string, destPath?: string) => {
      let outPath =
        typeof destPath === 'string' && destPath.trim()
          ? destPath.trim()
          : ''
      if (!outPath) {
        const win = host.getMainWindow()
        const result = win
          ? await host.dialog.showSaveDialog(win, {
              title: 'Export story backup',
              defaultPath: `story-${storyId}.idm.zip`,
              filters: [{ name: 'IDM Backup', extensions: ['zip'] }]
            })
          : await host.dialog.showSaveDialog({
              title: 'Export story backup',
              defaultPath: `story-${storyId}.idm.zip`,
              filters: [{ name: 'IDM Backup', extensions: ['zip'] }]
            })
        if (result.canceled || !result.filePath) return null
        outPath = result.filePath
      }
      const path = await backup().exportStoryToZip(storyId, outPath)
      return { filePath: path }
    })
  )

  reg(
    'project:importBackup',
    (async (zipPath?: string) => {
      let src =
        typeof zipPath === 'string' && zipPath.trim() ? zipPath.trim() : ''
      if (!src) {
        const win = host.getMainWindow()
        const options: OpenDialogOptionsLike = {
          title: 'Import story backup',
          filters: [{ name: 'IDM Backup', extensions: ['zip'] }],
          properties: ['openFile']
        }
        const result = win
          ? await host.dialog.showOpenDialog(win, options)
          : await host.dialog.showOpenDialog(options)
        if (result.canceled || result.filePaths.length === 0) return null
        src = result.filePaths[0]
      }
      if (!existsSync(src)) {
        throw new AppError('NOT_FOUND', `Backup zip not found: ${src}`)
      }
      return backup().importZipAsNewStory(src)
    })
  )

  // ─── Full app-data backup (menu / Settings / CLI headless) ─
  const fullBackupService = (): AppDataBackupService => {
    const dbUrl = process.env.DATABASE_URL || ''
    let dbPath = join(host.userData, 'instant-drama.db')
    if (dbUrl.startsWith('file:')) {
      let rest = dbUrl.slice('file:'.length)
      if (rest.startsWith('///')) rest = rest.slice(2)
      else if (rest.startsWith('//')) {
        rest = rest.replace(/^\/\/[^/]*/, '') || rest
      }
      dbPath = rest.startsWith('/') ? rest : join(process.cwd(), rest)
    }
    if (host.resolveDatabasePath) {
      try {
        dbPath = host.resolveDatabasePath()
      } catch {
        /* keep */
      }
    }
    return new AppDataBackupService({
      userData: host.userData,
      databasePath: dbPath,
      settingsPath: join(host.userData, 'settings.json'),
      mediaRoot: mediaRoot(),
      activityLogPath: ActivityLog.defaultPath(host.userData),
      appVersion: host.appVersion,
      platform: host.platform
    })
  }

  reg(
    'app:exportFullBackup',
    (async (options?: {
      destPath?: string
      includeSecrets?: boolean
    }) => {
      if (host.exportFullBackup && !options?.destPath) {
        await host.exportFullBackup()
        return { ok: true as const }
      }
      // Headless / CLI: write zip under dataDir/exports or destPath
      const exportsDir = join(host.userData, 'exports')
      mkdirSync(exportsDir, { recursive: true })
      const dest =
        (typeof options?.destPath === 'string' && options.destPath.trim()) ||
        process.env.IDM_SAVE_PATH ||
        join(exportsDir, defaultFullBackupFileName())
      const prisma = host.getPrisma()
      try {
        await prisma.$disconnect()
      } catch {
        /* ignore */
      }
      try {
        await fullBackupService().exportToZip(dest, {
          includeSecrets: Boolean(options?.includeSecrets),
          includeLogs: true
        })
        return {
          ok: true as const,
          filePath: dest,
          fileName: basename(dest)
        }
      } finally {
        try {
          await prisma.$connect()
        } catch {
          /* ignore */
        }
      }
    })
  )
  reg(
    'app:importFullBackup',
    (async (zipPath?: string) => {
      if (host.importFullBackup && !zipPath) {
        await host.importFullBackup()
        return { ok: true as const }
      }
      let src =
        typeof zipPath === 'string' && zipPath.trim()
          ? zipPath.trim()
          : process.env.IDM_PICK_FILE || ''
      if (!src) {
        const win = host.getMainWindow()
        const options: OpenDialogOptionsLike = {
          title: 'Restore full app backup',
          filters: [{ name: 'IDM Backup', extensions: ['zip'] }],
          properties: ['openFile']
        }
        const result = win
          ? await host.dialog.showOpenDialog(win, options)
          : await host.dialog.showOpenDialog(options)
        if (result.canceled || result.filePaths.length === 0) {
          throw new AppError(
            'VALIDATION',
            'Import requires zip path: idm invoke app:importFullBackup \'["/path/to.zip"]\''
          )
        }
        src = result.filePaths[0]
      }
      if (!existsSync(src)) {
        throw new AppError('NOT_FOUND', `Backup zip not found: ${src}`)
      }
      const prisma = host.getPrisma()
      try {
        await prisma.$disconnect()
      } catch {
        /* ignore */
      }
      try {
        const result = await fullBackupService().importFromZip(src)
        return { ok: true as const, requiresReload: true, ...result }
      } finally {
        try {
          await prisma.$connect()
        } catch {
          /* ignore */
        }
      }
    })
  )
  reg(
    'app:rebuildMenu',
    (async () => {
      host.rebuildApplicationMenu?.()
      return { ok: true as const }
    })
  )

  reg(
    'media:importClip',
    (async (storyId: string, entryId: string, filePath?: string) => {
      let src =
        typeof filePath === 'string' && filePath.trim() ? filePath.trim() : ''
      if (!src) {
        const win = host.getMainWindow()
        const options: OpenDialogOptionsLike = {
          title: 'Import video clip',
          filters: [
            { name: 'Video', extensions: ['mp4', 'webm', 'mov', 'mkv'] }
          ],
          properties: ['openFile']
        }
        const result = win
          ? await host.dialog.showOpenDialog(win, options)
          : await host.dialog.showOpenDialog(options)
        if (result.canceled || result.filePaths.length === 0) return null
        src = result.filePaths[0]
      }
      if (!existsSync(src)) {
        throw new AppError('NOT_FOUND', `Video not found: ${src}`)
      }

      const dest = generation()
        .getMediaStore()
        .importClip(storyId, entryId, src)
      await timeline().setMedia(entryId, {
        mediaPath: dest,
        mediaStatus: 'READY',
        mediaError: null
      })
      return { filePath: dest }
    })
  )

  reg(
    'media:openClip',
    (async ( filePath: string) => {
      if (!existsSync(filePath)) {
        throw new AppError('NOT_FOUND', `Clip not found: ${filePath}`)
      }
      const err = await host.shell.openPath(filePath)
      if (err) throw new AppError('IO', err)
      return { ok: true as const }
    })
  )

}
