import { readFileSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const dir = dirname(fileURLToPath(import.meta.url))

const files = {
  en: ['en.ts', 'enPromptCopy'],
  'zh-HK': ['zh-HK.ts', 'zhHkPromptCopy'],
  'zh-CN': ['zh-CN.ts', 'zhCnPromptCopy'],
  ja: ['ja.ts', 'jaPromptCopy'],
  es: ['es.ts', 'esPromptCopy'],
  fr: ['fr.ts', 'frPromptCopy'],
  'pt-BR': ['pt-BR.ts', 'ptBrPromptCopy'],
  ru: ['ru.ts', 'ruPromptCopy'],
  hi: ['hi.ts', 'hiPromptCopy'],
  ar: ['ar.ts', 'arPromptCopy']
}

const extra = {}

extra.en = {
  'common.rules': 'Rules:',
  'common.none': '(none)',
  'intro.soul': 'soul.md (use fully as performance/identity source):\n{{soul}}',
  'intro.matchBible': '(match character bible)',
  'invent.sources':
    'Sources of truth, in order: (1) user idea / request, (2) filled form fields, (3) linked extras (soul, cast lists, story blocks) only when they appear in THIS prompt, (4) attached reference image.',
  'invent.create':
    'Create mode (thin/empty form): invent freely from the idea/image so every critical key is filmable and related — do not leave required keys empty.',
  'invent.improve':
    'Improve mode (form has content): polish and complete missing fields consistent with the draft; do not replace core identity unless the user asks.',
  'invent.noImport':
    'Do NOT import identity, plot, weather, job, location, era, or style from anything not written in this prompt (no active story, no Demo seed, no app default world).',
  'invent.storyBlock':
    'When a story/style block IS present below, use it only for production continuity; never override an explicit user idea.',
  'character.keysLead': 'Return ONLY a single JSON object with keys: {{keys}}',
  'character.ruleSpoken':
    'spokenLanguages: JSON array of BCP-47/ISO codes this character SPEAKS (multi OK), e.g. ["yue","en"] or ["ja"]. Empty array if non-verbal.',
  'character.ruleIdentity':
    'Keep identity consistent for multi-angle reference sheets and video gen.',
  'character.fallbackPersonality': 'warm, clear presence',
  'character.fallbackManner': 'natural micro-gestures',
  'character.fallbackVoice': 'clear speaking voice',
  'scene.keysLead': 'Return ONLY one JSON object (no markdown) with keys: {{keys}}',
  'scene.suggestLead':
    'Propose a production-ready LOCATION plate as scene #{{n}} for story "{{title}}".',
  'scene.suggestPlotFocus': 'Plot focus: {{label}}',
  'scene.suggestStyle': 'Style: {{style}}',
  'scene.suggestExisting': 'Already have locations: {{titles}}',
  'scene.suggestChars': 'Characters (context):',
  'scene.suggestProps': 'Props (context):',
  'scene.suggestSegment': 'Selected plot segment detail:',
  'scene.suggestBeats': 'Story scenes / beats:',
  'scene.suggestClosing':
    'Return full scene JSON. Design a DISTINCT reusable location that fits this plot focus (global library asset — not only for one story).',
  'scene.fallbackName': 'Location',
  'scene.fallbackMood': 'cinematic atmosphere',
  'scene.fallbackLighting': 'match the still',
  'scene.fallbackCamera': 'gentle establishing push-in or slow pan',
  'scene.ideaFromImage':
    'Describe and invent a full location profile from the attached reference photo.',
  'scene.polishIdea': 'Polish',
  'prop.keysLead': 'Return ONLY one JSON object with keys: {{keys}}',
  'action.fieldsLead': 'Fields: {{keys}}.',
  'soul.system':
    'You write production soul.md files for AI agents and short-drama characters.\nOutput ONLY a complete Markdown document (no code fences, no commentary).\nStructure (use these ## headings):\n# {Character name}\n## Identity\n## Appearance\n## Costume & silhouette\n## Personality & voice\n## Spoken languages\n## Mannerisms\n## Backstory\n## Relationships\n## Performance & dialogue style\n## Hard rules for consistency\n## Visual tags\nRules:\n- Adult short-drama / film production context; concrete, filmable detail.\n- Sources of truth: profile form + existing soul + user request. If sparse, invent freely to complete the soul; do not invent from sources not provided in this request.\n- Identity and appearance must stay consistent across multi-angle sheets and video.\n- Spoken languages: honor profile spokenLanguages codes for dialogue/TTS.\n- Hard rules: 5–10 bullet constraints (do/don\'t) for image & dialogue AI.\n- Write the soul in the user interface language unless the profile is clearly another language.\n- Optional YAML frontmatter at top with name, role, tags is allowed but not required.',
  'soul.improveMode':
    'IMPROVE MODE: Merge profile form + existing soul into an updated full soul.md. Keep core identity unless asked to change it.',
  'soul.createMode':
    'Build a full soul.md from this character profile (fill gaps reasonably; do not invent a different person):',
  'soul.profileFields': 'Profile form fields (all filled inputs):',
  'soul.existing':
    'Existing soul.md (merge / improve; do not discard useful detail):',
  'soul.userRequest': 'User request: {{request}}',
  'soul.extraContext':
    'Additional context provided with this request (use if helpful; profile still wins):',
  'soul.returnOnly': 'Return the full soul.md markdown only.',
  'wardrobe.system':
    'You are a short-drama costume & visual-style consultant. Given a character and plot context, propose ONE cohesive wardrobe look. Reply with ONLY a single JSON object (no markdown fences): {"name":"short look name","costume":"detailed outer wardrobe for image/video prompts","artStyle":"one id from list","rationale":"1-2 sentences"} artStyle MUST be exactly one of: {{styleIds}} costume must be specific materials, colors, silhouette, shoes, accessories. Respect age-appropriate presentation. Never eroticize minors. Prefer continuity with existing appearance; invent only wardrobe/style. Use character fields + any plot segment / story context provided; if thin, invent a cohesive look freely.',
  'wardrobe.improveMode':
    'IMPROVE / SUGGEST MODE: Use ALL character fields + plot context below.',
  'wardrobe.characterForm': 'Character (full form):',
  'wardrobe.soulExcerpt': 'soul.md excerpt:\n{{soul}}',
  'wardrobe.userRequest': 'User request: {{request}}',
  'wardrobe.storyContext':
    'Story / production context (use when provided; do not invent a different world):',
  'wardrobe.style': 'style: {{style}}',
  'wardrobe.segment': 'Selected plot segment: {{label}}',
  'wardrobe.sceneContext': 'Scene / beat context:',
  'wardrobe.noScenes': '(no scenes yet)',
  'wardrobe.proposeNew':
    'Propose a NEW wardrobe look that fits the plot (not a duplicate of existing looks).',
  'fill.system':
    'You complete short-drama asset profile fields that were left empty.\nReturn ONLY one JSON object with EXACTLY these keys (and no others): {{keys}}.\nEach value MUST be a non-empty JSON string (never null, never a JSON array).\nvisualTags (if present): comma-separated string in the user interface language (format example only: "gold, necklace") — NEVER an array; invent tags that match THIS asset, do not copy the example.\nStay consistent with the partial profile and any attached reference image only — do not invent a different plot, location, or sample world not already implied by the partial/image.\nNo markdown fences, no commentary.',
  'fill.userPartial': 'Partial profile (already filled — do not contradict):',
  'fill.userOnly': 'Fill ONLY these missing keys: {{keys}}.',
  'fill.userReturn':
    'Return JSON with those keys only; every value a non-empty string.',
  'imageGen.multiRef':
    'Additional identity stills selected ({{n}} more): keep object/subject identity consistent with all selected references; primary edit base is the first still.',
  'residual.sceneLink': 'Scene {{n}}: {{short}}',
  'residual.beatSegment': 'Beat {{n}} · {{who}}{{tail}}',
  'residual.unknown': 'Unknown',
  'residual.story': 'Story',
  'beat.mood': '[MOOD] {{text}}',
  'beat.atmo': '[ATMO] {{text}}',
  'beat.camera': '[CAMERA] {{text}}',
  'beat.sfx': '[SFX] {{text}}',
  'beat.action': '[ACTION] {{text}}',
  'beat.actionWho': '[ACTION|{{who}}] {{text}}',
  'beat.expr': '[EXPR] {{text}}',
  'beat.exprWho': '[EXPR|{{who}}] {{text}}',
  'beat.dialogue': '[DIALOGUE|{{who}}] {{body}}',
  'beat.dialogueTone': '[DIALOGUE|{{who}}|{{tone}}] {{body}}',
  'beat.whoUnknown': '?',
  'beat.template':
    '[MOOD] tense, hesitant\n[ATMO] door-gap warm light; rain on ground\n[CAMERA] medium shot, push to hands\n[SFX] rain, fabric rustle\n[ACTION|Name] removes helmet; stares at the door light; hand into jacket pocket\n[EXPR|Name] furrowed brow, breath catches\n[DIALOGUE|Name|low, hoarse] Raining again…\n[DIALOGUE|Name|aside] (beat) Are you… still there?',
  'vision.preamble':
    'A reference still is attached. Fill ALL profile fields for this {{what}} primarily FROM THE IMAGE. Optionally refine with any idea/draft text.',
  'vision.character':
    'character identity (name, appearance, costume, age, gender, tags)',
  'vision.scene':
    'location profile (title, description, lighting, mood, set dressing, tags)',
  'vision.prop':
    'prop profile (name, description, material, size, condition, tags)',
  'vision.action':
    'action profile (name, description, motion, intention, camera notes, tags)',
  'vision.costume': 'wardrobe (name, full costume description)',
  'still.header':
    'SINGLE KEYFRAME STILL for short-drama video continuity (not a multi-panel sheet). Produce one cinematic hero frame that matches the planned shot below. No text, logos, watermarks, UI chrome. Sharp, production-ready.',
  'still.revision': 'USER IMPROVEMENT FOR THIS STILL (must apply): {{notes}}',
  'still.regenTask':
    'TASK: Revise the image-to-video director prompt AND keep it usable as a still keyframe brief.',
  'still.userImprove': 'USER IMPROVEMENT REQUEST:\n{{notes}}',
  'still.currentPrompt': 'Current professional prompt:',
  'still.hardRules':
    'HARD RULES (must keep at end of output; do not drop or weaken):',
  'mediaGen.writeOne':
    'Write ONE final image-generation prompt for a short-drama production still.',
  'mediaGen.returnOnly':
    'Return ONLY the prompt text — no markdown fences, no title, no explanation.',
  'mediaGen.singleComposite':
    'Output must describe a SINGLE composite image (one export frame).',
  'mediaGen.lockRefs':
    'Attached images are ground-truth references in the same order as Ref# below. Lock identity/wardrobe/location/prop to those stills. Do NOT invent a different person, shop, or prop.',
  'mediaGen.videoSystem':
    'You are a short-drama video director prompt writer (image-to-video).',
  'mediaGen.videoMerge':
    'Merge materials into ONE professional video prompt for a short clip.',
  'mediaGen.videoInclude':
    'Include: subject identity locks from stills, camera move, performance/dialogue, pacing, lighting continuity.',
  'mediaGen.videoFacts':
    'Use only facts present in materials and seed; do not import a fixed sample world or Demo story.',
  'mediaGen.videoNoSwap':
    'Do not invent a different actor, location, or prop when refs are attached.',
  'mediaGen.videoHardRules': 'Hard rules at end if supplied.',
  'mediaGen.imageSystem': 'You are a short-drama image prompt director.',
  'mediaGen.imageMergeStills':
    'Merge the selected materials and attached reference stills into ONE image prompt.',
  'mediaGen.imageMergeText':
    'Merge the selected text materials into ONE image prompt.',
  'mediaGen.imagePriority':
    'Highest priority: match faces/wardrobe/locations/props from attached images.',
  'mediaGen.imageNoSwap':
    'Never substitute a different celebrity, salon clerk, or unrelated set when cast stills are provided.',
  'mediaGen.imageFacts':
    'Use only facts present in materials and seed; do not import a fixed sample world or Demo story.',
  'mediaGen.imageLayout':
    'If multi-panel geometry is required, keep exact panel count and gutters.',
  'mediaGen.imagePackage':
    'If a LAYOUT / package section is present, the final prompt MUST implement that exact layout (panel count, poses, crop).',
  'mediaGen.imageHardRules': 'Hard rules at end if supplied.',
  'mediaGen.directorFallback':
    'IMAGE-TO-VIDEO: animate this keyframe as a short-drama clip. Lock identity, wardrobe, set, and framing to the keyframe.',
  'mediaGen.directorFallbackCam':
    'Camera motion and performance clear; no captions or watermark.',
  'charIntro.task':
    'IMAGE-TO-VIDEO: animate the exact person in the reference image as a short self-introduction clip for short-drama casting.',
  'charIntro.identityLock':
    'IDENTITY LOCK: same face, hair, body, age, wardrobe, and colors as the reference still — do not invent a different person.',
  'charIntro.personality': 'Personality / vibe: {{personality}}.',
  'charIntro.backstory': 'Backstory cue: {{backstory}}.',
  'charIntro.relationships': 'Relationships cue: {{relationships}}.',
  'charIntro.soul': 'Soul bible excerpt (performance source): {{soul}}',
  'charIntro.performance':
    'Performance: gentle camera push-in or subtle handheld; character looks toward camera or slightly off-camera; {{manner}}.',
  'charIntro.speech':
    'Speech: mouth moves as if introducing themselves briefly; voice tone: {{voice}}.',
  'charIntro.beat':
    'Action beat: natural idle → small smile or nod → short spoken intro gesture (hand optional) → hold.',
  'charIntro.lighting':
    'Cinematic lighting consistent with the still; no text overlays, no logos, no extra people.',
  'charIntro.duration':
    'Duration fits a 6–10s vertical-or-horizontal casting self-intro clip.',
  'sceneIntro.task':
    'IMAGE-TO-VIDEO: animate the exact location in the reference still as a short location-intro / establishing clip for short-drama production.',
  'sceneIntro.spaceLock':
    'SPACE LOCK: same architecture, materials, signage, layout, and color language as the reference plate — do not invent a different place.',
  'sceneIntro.name': 'Location name: {{name}}.',
  'sceneIntro.place': 'Place description: {{place}}.',
  'sceneIntro.spaceType': 'Space type: {{type}}.',
  'sceneIntro.time': 'Time of day: {{time}}.',
  'sceneIntro.weather': 'Weather: {{weather}}.',
  'sceneIntro.moodLight': 'Mood: {{mood}}. Lighting: {{lighting}}.',
  'sceneIntro.palette': 'Color palette: {{palette}}.',
  'sceneIntro.setDressing': 'Set dressing: {{set}}.',
  'sceneIntro.tags': 'Visual tags: {{tags}}.',
  'sceneIntro.art': 'Art style: {{art}}.',
  'sceneIntro.ambient': 'Ambient feel (no UI text): {{sound}}.',
  'sceneIntro.scriptCue':
    'Beat cue (atmosphere only, no hero faces unless already in still): {{cue}}.',
  'sceneIntro.camera':
    'Camera: {{camera}}; continuous gentle motion; empty-set preferred — no new cast faces, no logos, no text overlays.',
  'sceneIntro.beat':
    'Action beat: hold establishing → subtle environmental life (light shift, weather particles, fabric/tree if already present) → settle.',
  'sceneIntro.duration': 'Duration fits a 6–10s establishing intro clip.',
  'propIntro.task':
    'IMAGE-TO-VIDEO: animate the exact prop in the reference still as a short product/hero intro clip for short-drama continuity.',
  'propIntro.objectLock':
    'OBJECT LOCK: same silhouette, materials, colors, logos/engravings, wear, and proportions as the reference — do not invent a different object.',
  'propIntro.name': 'Prop name: {{name}}.',
  'propIntro.look': 'Look description: {{look}}.',
  'propIntro.material': 'Material: {{material}}.',
  'propIntro.size': 'Size notes: {{size}}.',
  'propIntro.condition': 'Condition / wear: {{condition}}.',
  'propIntro.tags': 'Visual tags: {{tags}}.',
  'propIntro.art': 'Art style: {{art}}.',
  'propIntro.camera':
    'Camera: gentle orbit or slow push-in on a clean tabletop/hero stage; soft cinematic light consistent with the still.',
  'propIntro.beat':
    'Action beat: hold hero still → subtle light glint / micro-rotation or fabric/metal shimmer if present → settle.',
  'propIntro.noHands':
    'No hands unless already in the still; no new cast faces; no text overlays, logos watermarks, or extra props.',
  'propIntro.duration': 'Duration fits a 6–10s prop intro clip.',
  'costumeIntro.task':
    'IMAGE-TO-VIDEO: animate the exact wardrobe look in the reference still as a short costume intro clip for short-drama wardrobe library.',
  'costumeIntro.wardrobeLock':
    'WARDROBE LOCK: same silhouette, fabrics, colors, layers, accessories, and wear as the reference — do not invent a different outfit.',
  'costumeIntro.identityOrProduct':
    'If a person is in the still: IDENTITY LOCK on face/body while fabric may gently move; if mannequin or flat-lay: keep product framing.',
  'costumeIntro.name': 'Look name: {{name}}.',
  'costumeIntro.desc': 'Costume description: {{look}}.',
  'costumeIntro.art': 'Art style: {{art}}.',
  'costumeIntro.camera':
    'Camera: gentle push-in or subtle orbit; fashion-look lighting consistent with the still.',
  'costumeIntro.beat':
    'Action beat: hold pose/still → fabric drape / sleeve hem micro-motion / light glint on hardware → settle.',
  'costumeIntro.forbid':
    'No new cast faces; no text overlays, logos, or erotic posing.',
  'costumeIntro.duration': 'Duration fits a 6–10s wardrobe intro clip.',
  'costumeIntro.fallbackName': 'Look',
  'actionIntro.lead':
    'Short-drama motion demo video of action "{{name}}".',
  'actionIntro.intention': 'Intention: {{intention}}',
  'actionIntro.body': 'Body/tempo: {{body}}',
  'actionIntro.camera': 'Camera: {{camera}}',
  'actionIntro.closing':
    'Smooth continuous motion, cinematic, no text overlays, follow the keyframe still.',
  'sceneIntroPolish.task':
    'TASK: Location intro / establishing clip (image-to-video).',
  'sceneIntroPolish.hasRef':
    'Reference location still is attached to the video API — lock SPACE identity to that plate.',
  'sceneIntroPolish.noRef':
    'No reference still path in this text; still lock to location bible description.',
  'sceneIntroPolish.dossier': 'Location dossier:',
  'sceneIntroPolish.scriptCue': 'script cue (atmosphere only):\n{{script}}',
  'sceneIntroPolish.emptySet':
    'Prefer empty set; no new cast faces unless already in the still. No text overlays or logos.',
  'propIntroPolish.task': 'TASK: Prop / object hero intro clip (image-to-video).',
  'propIntroPolish.hasRef':
    'Reference prop still is attached — lock OBJECT identity to that image.',
  'propIntroPolish.noRef':
    'No reference still path in this text; still lock to prop dossier.',
  'propIntroPolish.dossier': 'Prop dossier:',
  'propIntroPolish.noHands':
    'No new hands or cast faces unless already in the still. No text overlays or logos.',
  'costumeIntroPolish.task':
    'TASK: Costume / wardrobe look intro clip (image-to-video).',
  'costumeIntroPolish.hasRef':
    'Reference still is attached — if person present lock IDENTITY + wardrobe; if mannequin/flat-lay lock garment silhouette and materials.',
  'costumeIntroPolish.noRef':
    'No reference still path; lock to costume description.',
  'costumeIntroPolish.dossier': 'Costume dossier:',
  'costumeIntroPolish.fabric':
    'Show fabric drape/motion subtly; no new cast faces; no text overlays or logos.',
  'actionIntroPolish.task':
    'TASK: Action / motion-guide intro clip (image-to-video).',
  'actionIntroPolish.hasRef':
    'Reference still attached — lock performance identity to that frame.',
  'actionIntroPolish.templateKeepRules':
    'Template draft (improve; keep HARD RULES at end):',
  'cover.posterLead':
    'PROFESSIONAL SHORT-DRAMA POSTER / KEY ART (16:9 cinematic still). Not a UI mockup. No text, no logo, no watermark, no title caption.',
  'cover.titleMood':
    'Story title (mood only, do not letter it): {{title}}.',
  'cover.styleBible': 'Style bible: {{style}}',
  'cover.extraDir': 'Extra direction: {{idea}}',
  'cover.establishing':
    'Evocative establishing mood frame suitable as a library card cover.',
  'cover.medium':
    'Match the art medium; strong silhouette and readable mood.',
  'cover.editPrefix':
    'IMAGE EDIT: create a new short-drama poster composition. Keep identity/mood of subjects if present. ',
  'cover.label': 'Story cover',
  'costumeFill.system':
    'You are a film wardrobe designer. Reply with ONLY compact JSON: {"name":"short label","description":"full wardrobe description for image gen (layers, fabric, colors, accessories; no brand logos)","artStyle":"optional style id or empty string","hardRules":"3-8 MUST/MUST-NOT lines"} Every key present as a JSON string (not null/array). No markdown. If an image is provided, describe THAT outfit faithfully for short-drama generation.',
  'costumeFill.idea': 'Idea: {{idea}}',
  'costumeFill.polish': 'Polish the draft wardrobe.',
  'costumeFill.required':
    'Required keys: name, description, artStyle, hardRules. Missing keys = invalid.',
  'costumeFill.fallbackName': 'Look',
  'segment.entireStory': 'Entire story (all scenes)',
  'segment.noStory': 'No story selected'
}

extra['zh-HK'] = {
  'common.rules': '規則：',
  'common.none': '（無）',
  'intro.soul': 'soul.md（作為表演／身份完整來源）：\n{{soul}}',
  'intro.matchBible': '（跟從角色人設語言）',
  'invent.sources':
    '依據來源（優先序）：（1）用戶 idea／指示，（2）已填表單，（3）僅當「本次 prompt 已寫出」的額外上下文（soul、選角、故事區塊等），（4）附上的參考圖。',
  'invent.create':
    '創作模式（表單空白／極少）：按 idea／圖自由創作，補齊可拍攝的關鍵欄位，內容須與用戶構想相關——勿留空必填鍵。',
  'invent.improve':
    '改進模式（表單已有內容）：潤飾並補齊空白欄，與已填內容一致；除非用戶要求，否則勿改核心身份。',
  'invent.noImport':
    '不得從「本次 prompt 未出現」的來源引入身份、劇情、天氣、職業、地點、時代或風格（禁止 active 故事、Demo 樣本、App 預設世界觀）。',
  'invent.storyBlock':
    '若下方明確附有故事／風格區塊：僅作 continuity；不可覆蓋用戶明確 idea。',
  'character.keysLead': '只輸出一個 JSON 物件（不要 markdown），鍵名必須是：{{keys}}',
  'character.ruleSpoken':
    'spokenLanguages：角色使用的語言，JSON 字串陣列（可多選），BCP-47／ISO 代碼，例如 ["yue","en"]。非語言角色用 []。',
  'character.ruleIdentity': '同一角色必須視覺一致，方便之後多角度參考圖與影片生成。',
  'character.fallbackPersonality': '溫暖清晰、有個性',
  'character.fallbackManner': '自然微動作',
  'character.fallbackVoice': '清晰聲線',
  'scene.keysLead': '只回傳一個 JSON 物件（不要 markdown），鍵名：{{keys}}',
  'scene.suggestLead': '為故事「{{title}}」建議第 {{n}} 個可用場景（場地／環境設定）。',
  'scene.suggestPlotFocus': '劇情焦點：{{label}}',
  'scene.suggestStyle': '風格：{{style}}',
  'scene.suggestExisting': '庫內／故事已有場地：{{titles}}',
  'scene.suggestChars': '角色（上下文）：',
  'scene.suggestProps': '道具（上下文）：',
  'scene.suggestSegment': '選定劇情段落詳情：',
  'scene.suggestBeats': '故事場次／段落：',
  'scene.suggestClosing':
    '回傳完整場景 JSON。請設計一個可重複使用的獨立場地（全域場景庫資產），須貼合選定劇情焦點，並與已有場地有所區別。',
  'scene.fallbackName': '場景',
  'scene.fallbackMood': '電影氣氛',
  'scene.fallbackLighting': '與靜幀一致',
  'scene.fallbackCamera': '輕微建立鏡頭推近或慢搖',
  'scene.ideaFromImage': '請根據附上的參考圖，完整填寫場景資料。',
  'scene.polishIdea': '全面潤飾',
  'prop.keysLead': '只回傳一個 JSON，鍵名：{{keys}}',
  'action.fieldsLead': '欄位：{{keys}}。',
  'soul.system':
    '你為短劇／影視角色撰寫 production 用 soul.md（單檔 Markdown）。\n只輸出完整 Markdown 文件（不要代碼塊圍欄、不要解說）。\n結構（請用以下 ## 標題）：\n# {角色名}\n## 身份 Identity\n## 外貌 Appearance\n## 服裝與輪廓 Costume\n## 性格與聲線 Personality & voice\n## 使用語言 Spoken languages\n## 小習慣 Mannerisms\n## 背景 Backstory\n## 關係 Relationships\n## 表演與對白風格\n## 一致性硬規則 Hard rules\n## 視覺標籤 Visual tags\n規則：\n- 短劇可拍、可辨認、可一致；細節須具體。\n- 依據：Profile 表單 + 現有 soul + 用戶指示。不足則自由補齊；勿用本次未提供的來源臆造。\n- 對白／配音必須尊重 profile 的 spokenLanguages。\n- 硬規則用 5–10 條 bullet，方便之後圖像／對白 AI 遵守。\n- 用用戶介面語言書寫（香港書面語優先，若介面係其他語言就跟介面）。\n- 可選開頭 YAML frontmatter（name / tags），非必須。',
  'soul.improveMode':
    '改進模式：合併 Profile 表單 + 現有 soul，輸出更新後完整 soul.md。除非要求改身份，否則保持核心一致。',
  'soul.createMode':
    '根據以下角色設定撰寫完整 soul.md（合理補齊空白；不要換成另一個人）：',
  'soul.profileFields': 'Profile 表單欄位（已填內容）：',
  'soul.existing': '現有 soul.md（合併／改進；勿丟有用細節）：',
  'soul.userRequest': '用戶指示：{{request}}',
  'soul.extraContext': '本次一併提供的上下文（有用就用；仍以 profile 為準）：',
  'soul.returnOnly': '只輸出完整 soul.md Markdown 正文。',
  'wardrobe.system':
    '你是短劇服裝與視覺風格顧問。根據角色與劇情，提出一套完整外裝方案。只回傳一個 JSON 物件（不要 markdown 圍欄）：{"name":"短名稱","costume":"詳細外裝描述（供出圖／影片）","artStyle":"下列其一","rationale":"一兩句理由"} artStyle 必須是：{{styleIds}} costume 要具體：材質、顏色、輪廓、鞋履、配件。年齡表述須得體；禁止對未成年做性化描述。保留既有外貌身份，只設計服裝與風格。用角色欄位與已提供的劇情／故事上下文；不足就自由補一套連貫造型。',
  'wardrobe.improveMode': '改進／建議模式：使用下方全部角色欄位與劇情上下文。',
  'wardrobe.characterForm': '角色（完整表單）：',
  'wardrobe.soulExcerpt': 'soul.md 摘要：\n{{soul}}',
  'wardrobe.userRequest': '用戶指示：{{request}}',
  'wardrobe.storyContext': '故事／製作上下文（有就用；勿另起一個世界）：',
  'wardrobe.style': '風格：{{style}}',
  'wardrobe.segment': '選定劇情段落：{{label}}',
  'wardrobe.sceneContext': '場景／段落／對白摘錄：',
  'wardrobe.noScenes': '（尚無場景）',
  'wardrobe.proposeNew': '請提出一套符合劇情的新戲服（避免與已有造型重複）。',
  'fill.system':
    '你負責補齊短劇資產設定中「仍然空白」的欄位。\n只回傳一個 JSON 物件，且只能包含這些鍵：{{keys}}。\n每個值必須是非空 JSON 字串（不可 null、不可 JSON 陣列）。\n若含 visualTags：用用戶介面語言的逗號分隔字串（格式例："gold, necklace"，勿照抄例子，須貼合本資產）——禁止陣列。\n只根據已有部分設定及參考圖補齊；勿另起未見於 partial／圖的劇情、地點或樣本世界。\n不要 markdown、不要解說。',
  'fill.userPartial': '已有部分設定（勿矛盾）：',
  'fill.userOnly': '只補齊這些空白鍵：{{keys}}。',
  'fill.userReturn': '只回傳含上述鍵的 JSON；每值為非空字串。',
  'imageGen.multiRef':
    '另有 {{n}} 張已選參考圖：主編輯底圖為第一張，其餘作身份一致輔助，勿換成另一物件／主體。',
  'residual.sceneLink': '第 {{n}} 場：{{short}}',
  'residual.beatSegment': '段落 {{n}} · {{who}}{{tail}}',
  'residual.unknown': '未指定',
  'residual.story': '故事',
  'beat.mood': '【心情】{{text}}',
  'beat.atmo': '【氣氛】{{text}}',
  'beat.camera': '【鏡頭】{{text}}',
  'beat.sfx': '【聲效】{{text}}',
  'beat.action': '【動作】{{text}}',
  'beat.actionWho': '【動作｜{{who}}】{{text}}',
  'beat.expr': '【表情】{{text}}',
  'beat.exprWho': '【表情｜{{who}}】{{text}}',
  'beat.dialogue': '【對白｜{{who}}】{{body}}',
  'beat.dialogueTone': '【對白｜{{who}}｜{{tone}}】{{body}}',
  'beat.whoUnknown': '？',
  'beat.template':
    '【心情】緊繃、猶豫\n【氣氛】門縫暖光；雨砸地\n【鏡頭】中景，跟手推近\n【聲效】雨、布料摩擦\n【動作｜角色名】摘下安全帽；盯門縫暖光；手伸進外套內袋\n【表情｜角色名】眉心緊鎖，呼吸一滯\n【對白｜角色名｜低聲沙啞】又係落雨……\n【對白｜角色名｜自語】（停半拍）你……仲喺度？',
  'vision.preamble':
    '已附上參考靜圖。請主要根據圖片填寫此{{what}}全部欄位；可結合構思／草稿潤飾。',
  'vision.character': '角色（名稱、外貌、戲服、年齡、性別、標籤等）',
  'vision.scene': '場景（標題、描述、光影、氣氛、佈景、標籤等）',
  'vision.prop': '道具（名稱、描述、材質、尺寸、狀態、標籤等）',
  'vision.action': '動作（名稱、說明、節奏、意圖、鏡頭備註、標籤等）',
  'vision.costume': '戲服（名稱、完整造型描述）',
  'still.header':
    'SINGLE KEYFRAME STILL for short-drama video continuity（單格關鍵幀，不是多格板）。產出一張對應下方鏡頭的電影感主畫面。無文字、logo、浮水印、UI。清晰可製作。',
  'still.revision': '用戶改進要求（必須套用）：{{notes}}',
  'still.regenTask': '任務：修訂 image-to-video 導演提示詞，並保持可作靜幀 keyframe 簡報。',
  'still.userImprove': '用戶改進要求：\n{{notes}}',
  'still.currentPrompt': '目前專業提示詞：',
  'still.hardRules': 'HARD RULES／生成鐵則（必須保留於輸出最尾；不得刪除或削弱）：',
  'mediaGen.writeOne': '請撰寫「一條」最終短劇靜圖／多格指示圖生成 prompt。',
  'mediaGen.returnOnly': '只回傳 prompt 正文——不要 markdown 代碼塊、標題或解釋。',
  'mediaGen.singleComposite': '輸出描述「單一合成圖」（只 export 一張）。',
  'mediaGen.lockRefs':
    '附圖圖序與下方 Ref# 一致，須作視覺 ground truth。身份／戲服／場景／道具必須鎖定附圖，禁止換成另一人、另一店或另一物。',
  'mediaGen.videoSystem': '你是短劇 image-to-video 導演 prompt 撰寫者。',
  'mediaGen.videoMerge': '將材料合併為「一條」專業短片 video prompt。',
  'mediaGen.videoInclude': '須含：身份鎖定、鏡頭運動、表演／對白、節奏、光影連續。',
  'mediaGen.videoFacts': '只用材料與 seed 中的事實；勿引入固定樣本世界或 Demo 故事。',
  'mediaGen.videoNoSwap': '有附圖時禁止換成另一演員、場景或道具。',
  'mediaGen.videoHardRules': '有 HARD RULES 則置於文末。',
  'mediaGen.imageSystem': '你是短劇靜圖／指示圖 prompt 導演。',
  'mediaGen.imageMergeStills': '將用戶勾選材料與附圖合併為「一條」出圖 prompt。',
  'mediaGen.imageMergeText': '將用戶勾選文字材料合併為「一條」出圖 prompt。',
  'mediaGen.imagePriority': '最高優先：附圖中的臉／服裝／場景／道具必須一致。',
  'mediaGen.imageNoSwap': '有角色／場景靜圖時，禁止換成無關沙龍店員或另一間店。',
  'mediaGen.imageFacts': '只用材料與 seed 中的事實；勿引入固定樣本世界或 Demo 故事。',
  'mediaGen.imageLayout': '若要求多格板，保留精確格數與分隔。',
  'mediaGen.imagePackage':
    '若有 LAYOUT／出圖方案區塊，最終 prompt 必須嚴格執行該 layout（格數、姿勢、構圖）。',
  'mediaGen.imageHardRules': '有 HARD RULES 則置於文末。',
  'mediaGen.directorFallback':
    '圖生影片：以呢張關鍵幀做短劇片段。身份、戲服、場景、構圖須鎖定關鍵幀，由此畫面開始動。',
  'mediaGen.directorFallbackCam':
    '鏡頭運動與表演清楚；對白口型跟住腳本；無字幕、無浮水印。',
  'charIntro.task':
    '圖生影片：以參考圖中的同一人物，拍一段短劇選角用「自我介紹」短片。',
  'charIntro.identityLock':
    '身份鎖定：臉、髮型、體型、年齡感、服裝與顏色必須與參考靜幀一致，不可換成另一個人。',
  'charIntro.personality': '性格／氣場：{{personality}}。',
  'charIntro.backstory': '背景要點：{{backstory}}。',
  'charIntro.relationships': '關係要點：{{relationships}}。',
  'charIntro.soul': 'Soul 摘要（表演來源）：{{soul}}',
  'charIntro.performance':
    '表演：輕微推近或手持晃動；角色望向鏡頭或略偏鏡頭；{{manner}}。',
  'charIntro.speech': '口白：嘴唇自然開合像在簡短自我介紹；聲線：{{voice}}。',
  'charIntro.beat': '動作節奏：自然站定 → 微笑或輕點頭 → 簡短介紹手勢（可空手）→ 定格。',
  'charIntro.lighting': '光線與靜幀一致；無字幕、無 logo、無其他人入鏡。',
  'charIntro.duration': '適合 6–10 秒自我介紹短片。',
  'sceneIntro.task':
    '圖生影片：以參考靜幀中的同一場地，拍一段短劇用「場景介紹／建立鏡頭」短片。',
  'sceneIntro.spaceLock':
    '空間鎖定：建築、材質、招牌、格局與色彩語言必須與參考靜幀一致，不可換成另一個地方。',
  'sceneIntro.name': '地點名稱：{{name}}。',
  'sceneIntro.place': '場地描述：{{place}}。',
  'sceneIntro.spaceType': '空間類型：{{type}}。',
  'sceneIntro.time': '時段：{{time}}。',
  'sceneIntro.weather': '天氣：{{weather}}。',
  'sceneIntro.moodLight': '氣氛：{{mood}}。燈光：{{lighting}}。',
  'sceneIntro.palette': '色盤：{{palette}}。',
  'sceneIntro.setDressing': '陳設：{{set}}。',
  'sceneIntro.tags': '視覺標籤：{{tags}}。',
  'sceneIntro.art': '藝術風格：{{art}}。',
  'sceneIntro.ambient': '環境氛圍（無 UI 字幕）：{{sound}}。',
  'sceneIntro.scriptCue':
    '本場提示（只作氣氛，勿新增角色臉，除非靜幀已有）：{{cue}}。',
  'sceneIntro.camera':
    '運鏡：{{camera}}；連續輕微動態；空鏡為主——勿新增路人臉、logo、字幕。',
  'sceneIntro.beat':
    '動作節奏：建立鏡頭定場 → 環境微動（光影、天氣粒子、已有的布料／樹影）→ 定格。',
  'sceneIntro.duration': '適合 6–10 秒場景介紹短片。',
  'propIntro.task':
    '圖生影片：以參考靜幀中的同一道具，拍一段短劇 continuity 用「道具介紹／主視覺」短片。',
  'propIntro.objectLock':
    '物件鎖定：輪廓、材質、顏色、刻字／紋樣、舊損與比例必須與參考圖一致，不可換成另一件。',
  'propIntro.name': '道具名稱：{{name}}。',
  'propIntro.look': '外觀描述：{{look}}。',
  'propIntro.material': '材質：{{material}}。',
  'propIntro.size': '尺寸筆記：{{size}}。',
  'propIntro.condition': '狀態／舊損：{{condition}}。',
  'propIntro.tags': '視覺標籤：{{tags}}。',
  'propIntro.art': '藝術風格：{{art}}。',
  'propIntro.camera':
    '運鏡：乾淨桌面／主視覺台，輕微環繞或慢推近；光線與靜幀一致。',
  'propIntro.beat':
    '動作節奏：主視覺定格 → 微光澤／微旋轉或材質閃爍（若圖中已有）→ 定格。',
  'propIntro.noHands':
    '除非靜幀已有，否則勿加手、角色臉、字幕、浮水印或額外道具。',
  'propIntro.duration': '適合 6–10 秒道具介紹短片。',
  'costumeIntro.task':
    '圖生影片：以參考靜幀中的同一戲服造型，拍一段短劇戲服庫用「造型介紹」短片。',
  'costumeIntro.wardrobeLock':
    '服裝鎖定：輪廓、布料、顏色、層次、配件與舊損必須與參考圖一致，不可換成另一套。',
  'costumeIntro.identityOrProduct':
    '若靜幀有人：鎖定臉與體型，布料可輕微擺動；若為人台／平鋪：保持產品構圖。',
  'costumeIntro.name': '造型名稱：{{name}}。',
  'costumeIntro.desc': '戲服描述：{{look}}。',
  'costumeIntro.art': '藝術風格：{{art}}。',
  'costumeIntro.camera': '運鏡：輕微推近或慢環繞；光線與靜幀一致。',
  'costumeIntro.beat': '動作節奏：定格 → 布料垂墜／袖口微動／五金反光 → 定格。',
  'costumeIntro.forbid': '勿新增角色臉、字幕、logo 或色情姿勢。',
  'costumeIntro.duration': '適合 6–10 秒造型介紹短片。',
  'costumeIntro.fallbackName': '造型',
  'actionIntro.lead': '短劇動作示範片：「{{name}}」。',
  'actionIntro.intention': '意圖：{{intention}}',
  'actionIntro.body': '肢體節奏：{{body}}',
  'actionIntro.camera': '鏡頭：{{camera}}',
  'actionIntro.closing': '動作連貫流暢，電影感，無字幕水印，緊跟關鍵幀靜圖。',
  'sceneIntroPolish.task': '任務：場景介紹／建立鏡頭短片（圖生影片）。',
  'sceneIntroPolish.hasRef':
    '參考場景靜圖會交予影片 API——必須鎖定該圖空間身份。',
  'sceneIntroPolish.noRef': '本文無靜圖路徑；仍須鎖定地點聖經描述。',
  'sceneIntroPolish.dossier': '場景檔案：',
  'sceneIntroPolish.scriptCue': '劇本提示（只作氣氛）：\n{{script}}',
  'sceneIntroPolish.emptySet':
    '空鏡為主；除非靜幀已有，否則勿新增角色臉。無字幕、logo。',
  'propIntroPolish.task': '任務：道具主視覺介紹短片（圖生影片）。',
  'propIntroPolish.hasRef': '參考道具靜圖會交予影片 API——必須鎖定該圖物件身份。',
  'propIntroPolish.noRef': '本文無靜圖路徑；仍須鎖定道具檔案描述。',
  'propIntroPolish.dossier': '道具檔案：',
  'propIntroPolish.noHands':
    '除非靜幀已有，否則勿新增手或角色臉。無字幕、logo。',
  'costumeIntroPolish.task': '任務：戲服／造型介紹短片（圖生影片）。',
  'costumeIntroPolish.hasRef':
    '參考靜圖會交予影片 API——有人則鎖定身份＋服裝；人台／平鋪則鎖定服裝輪廓與材質。',
  'costumeIntroPolish.noRef': '本文無靜圖路徑；仍須鎖定戲服描述。',
  'costumeIntroPolish.dossier': '戲服檔案：',
  'costumeIntroPolish.fabric': '布料垂墜／微動即可；勿新增角色臉；無字幕、logo。',
  'actionIntroPolish.task': '任務：動作指導介紹短片（圖生影片）。',
  'actionIntroPolish.hasRef': '參考靜圖已附——表演身份鎖定該幀。',
  'actionIntroPolish.templateKeepRules':
    '模板草稿（請改進；HARD RULES 置於最尾）：',
  'cover.posterLead':
    'PROFESSIONAL SHORT-DRAMA POSTER / KEY ART（16:9 電影感靜幀）。不是 UI 模型。無文字、logo、浮水印、標題字幕。',
  'cover.titleMood': '故事標題（只取氣氛，畫面勿寫出文字）：{{title}}。',
  'cover.styleBible': '風格備註：{{style}}',
  'cover.extraDir': '額外方向：{{idea}}',
  'cover.establishing': '適合用作片庫封面的情緒建立鏡頭；強烈剪影、可讀氣氛。',
  'cover.medium': '依藝術風格 medium 出圖；構圖清晰。',
  'cover.editPrefix':
    'IMAGE EDIT：以新構圖創作短劇海報。保留主體身份／氣氛（如有）。',
  'cover.label': '故事封面',
  'costumeFill.system':
    '你是影視造型指導。只回覆緊湊 JSON：{"name":"短名稱","description":"完整戲服描述（分層、布料、顏色、配飾；無品牌 Logo）","artStyle":"可選風格 id 或空字串","hardRules":"3–8 句必須／禁止"} 每個鍵必須是 JSON 字串（不可 null／陣列）。不要 markdown。若有參考圖，請按圖如實描述該造型，供短劇出圖使用。',
  'costumeFill.idea': '構思：{{idea}}',
  'costumeFill.polish': '潤飾以下戲服草稿。',
  'costumeFill.required':
    '必填鍵：name, description, artStyle, hardRules。缺鍵無效。',
  'costumeFill.fallbackName': '造型',
  'segment.entireStory': '全劇（所有場次）',
  'segment.noStory': '未選故事（僅角色資料）'
}

const tradToHans = (v) =>
  v
    .replaceAll('構', '构')
    .replaceAll('備', '备')
    .replaceAll('與', '与')
    .replaceAll('場', '场')
    .replaceAll('現', '现')
    .replaceAll('潤', '润')
    .replaceAll('飾', '饰')
    .replaceAll('於', '于')
    .replaceAll('錄', '录')
    .replaceAll('經', '经')
    .replaceAll('據', '据')
    .replaceAll('連', '连')
    .replaceAll('結', '结')
    .replaceAll('聖', '圣')
    .replaceAll('則', '则')
    .replaceAll('畫', '画')
    .replaceAll('陣', '阵')
    .replaceAll('須', '须')
    .replaceAll('為', '为')
    .replaceAll('這', '这')
    .replaceAll('個', '个')
    .replaceAll('請', '请')
    .replaceAll('輸出', '输出')
    .replaceAll('鍵', '键')
    .replaceAll('語', '语')
    .replaceAll('說', '说')
    .replaceAll('對', '对')
    .replaceAll('應', '应')
    .replaceAll('選', '选')
    .replaceAll('項', '项')
    .replaceAll('標', '标')
    .replaceAll('題', '题')
    .replaceAll('氣', '气')
    .replaceAll('燈', '灯')
    .replaceAll('頭', '头')
    .replaceAll('聲', '声')
    .replaceAll('動', '动')
    .replaceAll('術', '术')
    .replaceAll('術', '术')
    .replaceAll('際', '际')
    .replaceAll('態', '态')
    .replaceAll('無', '无')
    .replaceAll('碼', '码')
    .replaceAll('時', '时')
    .replaceAll('間', '间')
    .replaceAll('長', '长')
    .replaceAll('從', '从')
    .replaceAll('跟隨', '跟随')
    .replaceAll('係', '是')
    .replaceAll('喺', '在')
    .replaceAll('嚟', '来')
    .replaceAll('咗', '了')
    .replaceAll('佢', '他')
    .replaceAll('唔', '不')
    .replaceAll('嘅', '的')
    .replaceAll('呢張', '这张')
    .replaceAll('跟住', '跟着')
    .replaceAll('開合', '开合')

extra['zh-CN'] = Object.fromEntries(
  Object.entries(extra['zh-HK']).map(([k, v]) => [k, tradToHans(v)])
)

function fromEn(over) {
  return { ...extra.en, ...over }
}

extra.ja = fromEn({
  'common.rules': '規則：',
  'common.none': '（なし）',
  'intro.soul': 'soul.md（演技／身元の完全な出典）：\n{{soul}}',
  'intro.matchBible': '（キャラ聖書の言語に合わせる）',
  'invent.sources':
    '根拠の優先順：（1）ユーザー構想／指示、（2）記入済みフォーム、（3）このプロンプトに書かれた追加文脈のみ、（4）添付参照画像。',
  'invent.create':
    '作成モード（空／薄いフォーム）：構想／画像から自由に創作し、必須キーを空にするな。',
  'invent.improve':
    '改善モード：下書きと一貫するよう磨き、欠欄を埋めよ。身元変更は明示されたときだけ。',
  'invent.noImport':
    'このプロンプトに無い身元・筋・天候・職業・場所・時代・作風を持ち込むな（active 物語、Demo、既定世界禁止）。',
  'invent.storyBlock':
    '物語／作風ブロックがある場合は continuity のみに使え。明示された構想を上書きするな。',
  'character.keysLead': 'JSONオブジェクトのみ。キー：{{keys}}',
  'character.ruleSpoken':
    'spokenLanguages：話す言語の BCP-47 配列。無言なら []。',
  'character.ruleIdentity': '多角度シートと動画で身元を一貫させよ。',
  'character.fallbackPersonality': '温かくはっきりした存在感',
  'character.fallbackManner': '自然な微動作',
  'character.fallbackVoice': '明瞭な声',
  'scene.keysLead': 'JSONオブジェクトのみ。キー：{{keys}}',
  'scene.suggestLead': '物語「{{title}}」の第{{n}}場として使える場所を提案せよ。',
  'scene.suggestPlotFocus': '筋の焦点：{{label}}',
  'scene.suggestStyle': '作風：{{style}}',
  'scene.suggestExisting': '既存の場所：{{titles}}',
  'scene.suggestChars': 'キャラ（文脈）：',
  'scene.suggestProps': '小道具（文脈）：',
  'scene.suggestSegment': '選んだ筋の詳細：',
  'scene.suggestBeats': '物語の場／ビート：',
  'scene.suggestClosing':
    '完全な場面JSONを返せ。再利用できる独立した場所を設計せよ。',
  'scene.fallbackName': '場所',
  'scene.fallbackMood': '映画的な雰囲気',
  'scene.fallbackLighting': '静止画に合わせる',
  'scene.fallbackCamera': 'ゆるい確立ショットのプッシュインまたはパン',
  'scene.ideaFromImage': '添付写真から場所プロフィールを完全に埋めよ。',
  'scene.polishIdea': '磨く',
  'prop.keysLead': 'JSONのみ。キー：{{keys}}',
  'action.fieldsLead': '欄：{{keys}}。',
  'soul.system':
    '短編ドラマ用 production soul.md を書け。完全なMarkdownのみ。見出しを守れ。spokenLanguages を尊重せよ。界面言語で書け。',
  'soul.improveMode':
    '改善モード：プロフィール＋既存soulを統合した完全な soul.md を出せ。',
  'soul.createMode':
    'このプロフィールから完全な soul.md を書け（別人にすり替えるな）：',
  'soul.profileFields': 'プロフィール欄：',
  'soul.existing': '既存 soul.md（有用な細部を捨てるな）：',
  'soul.userRequest': 'ユーザー指示：{{request}}',
  'soul.extraContext': '追加文脈（有用なら使え；プロフィール優先）：',
  'soul.returnOnly': 'soul.md の本文だけ返せ。',
  'wardrobe.system':
    '短編ドラマの衣装顧問。JSON一つだけ。artStyle は {{styleIds}} のいずれか。具体的な素材・色・輪郭。未成年の性化禁止。',
  'wardrobe.improveMode': '改善／提案：下の全欄と筋を使え。',
  'wardrobe.characterForm': 'キャラ（全フォーム）：',
  'wardrobe.soulExcerpt': 'soul.md 抜粋：\n{{soul}}',
  'wardrobe.userRequest': 'ユーザー指示：{{request}}',
  'wardrobe.storyContext': '物語／制作文脈（あれば使え；別世界を作るな）：',
  'wardrobe.style': '作風：{{style}}',
  'wardrobe.segment': '選んだ筋：{{label}}',
  'wardrobe.sceneContext': '場面／ビート抜粋：',
  'wardrobe.noScenes': '（場面はまだ無い）',
  'wardrobe.proposeNew': '筋に合う新しい衣装を提案（既存と重複させるな）。',
  'fill.system':
    '空欄だけ埋めよ。これらのキーだけのJSON：{{keys}}。各値は非空文字列。配列禁止。',
  'fill.userPartial': '既存の部分設定（矛盾させるな）：',
  'fill.userOnly': 'これらの空キーだけ埋めよ：{{keys}}。',
  'fill.userReturn': 'そのキーだけのJSON。各値は非空文字列。',
  'imageGen.multiRef':
    '追加参照が{{n}}枚。第一枚が編集ベース。身元を全参照と一致させよ。',
  'residual.sceneLink': '第{{n}}場：{{short}}',
  'residual.beatSegment': 'ビート {{n}} · {{who}}{{tail}}',
  'residual.unknown': '未指定',
  'residual.story': '物語',
  'beat.mood': '[MOOD] {{text}}',
  'beat.atmo': '[ATMO] {{text}}',
  'beat.camera': '[CAMERA] {{text}}',
  'beat.sfx': '[SFX] {{text}}',
  'beat.action': '[ACTION] {{text}}',
  'beat.actionWho': '[ACTION|{{who}}] {{text}}',
  'beat.expr': '[EXPR] {{text}}',
  'beat.exprWho': '[EXPR|{{who}}] {{text}}',
  'beat.dialogue': '[DIALOGUE|{{who}}] {{body}}',
  'beat.dialogueTone': '[DIALOGUE|{{who}}|{{tone}}] {{body}}',
  'beat.whoUnknown': '?',
  'beat.template':
    '[MOOD] tense, hesitant\n[ATMO] door-gap warm light; rain on ground\n[CAMERA] medium shot, push to hands\n[SFX] rain, fabric rustle\n[ACTION|Name] removes helmet; stares at the door light; hand into jacket pocket\n[EXPR|Name] furrowed brow, breath catches\n[DIALOGUE|Name|low, hoarse] また雨か……\n[DIALOGUE|Name|aside] （間）まだ、そこにいるのか？',
  'vision.preamble':
    '参照静止画が添付されている。この{{what}}の全欄を主に画像から埋めよ。構想／下書きで補ってよい。',
  'vision.character': 'キャラ（名、外見、衣装、年齢、性別、タグ）',
  'vision.scene': '場所（題、説明、光、雰囲気、装置、タグ）',
  'vision.prop': '小道具（名、説明、材質、寸法、状態、タグ）',
  'vision.action': '動作（名、説明、テンポ、意図、カメラ、タグ）',
  'vision.costume': '衣装（名、完全な造形）',
  'still.header':
    '短編ドラマ用の単一キーフレーム静止画。計画ショットに合う映画的ヒーローフレーム。文字・ロゴ・透かし禁止。',
  'still.revision': 'この静止画への改善要求（必須）：{{notes}}',
  'still.regenTask':
    '任務：image-to-video 監督プロンプトを改訂し、キーフレーム概要としても使えるようにせよ。',
  'still.userImprove': 'ユーザー改善要求：\n{{notes}}',
  'still.currentPrompt': '現在の専門プロンプト：',
  'still.hardRules': 'HARD RULES（出力末尾に残せ。弱めるな）：',
  'mediaGen.writeOne': '短編ドラマ用の最終静止画プロンプトを「1本」書け。',
  'mediaGen.returnOnly': 'プロンプト本文だけ。markdown禁止。',
  'mediaGen.singleComposite': '単一合成画像を記述せよ。',
  'mediaGen.lockRefs':
    '添付画像は Ref# 順の根拠。身元／衣装／場所／小道具をロック。別物に替えるな。',
  'mediaGen.videoSystem': '短編ドラマの image-to-video 監督プロンプト作者。',
  'mediaGen.videoMerge': '材料を1本の専門ビデオプロンプトに統合せよ。',
  'mediaGen.videoInclude': '身元ロック、カメラ、演技／台詞、リズム、光の連続。',
  'mediaGen.videoFacts': '材料と seed の事実だけ。Demo 世界を持ち込むな。',
  'mediaGen.videoNoSwap': '参照があるとき別俳優／場所／小道具に替えるな。',
  'mediaGen.videoHardRules': 'HARD RULES があれば末尾へ。',
  'mediaGen.imageSystem': '短編ドラマ静止画プロンプト監督。',
  'mediaGen.imageMergeStills': '選んだ材料と添付静止画を1本の出図プロンプトにせよ。',
  'mediaGen.imageMergeText': '選んだテキスト材料を1本の出図プロンプトにせよ。',
  'mediaGen.imagePriority': '最優先：添付の顔／衣装／場所／小道具を一致させよ。',
  'mediaGen.imageNoSwap': 'キャスト静止画があるとき無関係な人物や店に替えるな。',
  'mediaGen.imageFacts': '材料と seed の事実だけ。',
  'mediaGen.imageLayout': '多コマなら正確なコマ数と溝を保て。',
  'mediaGen.imagePackage':
    'LAYOUT があるならそのレイアウトを厳密に実行せよ。',
  'mediaGen.imageHardRules': 'HARD RULES があれば末尾へ。',
  'mediaGen.directorFallback':
    '図生動画：このキーフレームから短編クリップを動かせ。身元・衣装・場所・構図をロック。',
  'mediaGen.directorFallbackCam':
    'カメラと演技を明確に。字幕・透かし禁止。',
  'charIntro.task':
    '図生動画：参照の同一人物で短い自己紹介クリップ。',
  'charIntro.identityLock':
    '身元ロック：顔・髪・体・年齢・衣装・色を参照と一致させよ。',
  'charIntro.personality': '性格／気配：{{personality}}。',
  'charIntro.backstory': '背景：{{backstory}}。',
  'charIntro.relationships': '関係：{{relationships}}。',
  'charIntro.soul': 'Soul 抜粋（演技出典）：{{soul}}',
  'charIntro.performance':
    '演技：ゆるいプッシュインまたは手持ち；カメラ目線；{{manner}}。',
  'charIntro.speech': '口：短い自己紹介のように動く。声：{{voice}}。',
  'charIntro.beat': '自然な静止 → 微笑／会釈 → 短い紹介ジェスチャ → ホールド。',
  'charIntro.lighting': '静止画と一致する光。字幕・ロゴ・他人禁止。',
  'charIntro.duration': '6–10秒の自己紹介に適する。',
  'sceneIntro.task': '図生動画：同一場所の紹介／確立ショット。',
  'sceneIntro.spaceLock':
    '空間ロック：建築・材質・看板・間取り・色を参照と一致させよ。',
  'sceneIntro.name': '地名：{{name}}。',
  'sceneIntro.place': '場所の説明：{{place}}。',
  'sceneIntro.spaceType': '空間タイプ：{{type}}。',
  'sceneIntro.time': '時間帯：{{time}}。',
  'sceneIntro.weather': '天候：{{weather}}。',
  'sceneIntro.moodLight': '雰囲気：{{mood}}。照明：{{lighting}}。',
  'sceneIntro.palette': '色：{{palette}}。',
  'sceneIntro.setDressing': '装置：{{set}}。',
  'sceneIntro.tags': '視覚タグ：{{tags}}。',
  'sceneIntro.art': '作風：{{art}}。',
  'sceneIntro.ambient': '環境（UI字幕なし）：{{sound}}。',
  'sceneIntro.scriptCue': '場のヒント（雰囲気のみ）：{{cue}}。',
  'sceneIntro.camera':
    'カメラ：{{camera}}；空セット優先。新しい顔・ロゴ・字幕禁止。',
  'sceneIntro.beat': '確立 → 環境の微動 → 静止。',
  'sceneIntro.duration': '6–10秒の場所紹介。',
  'propIntro.task': '図生動画：同一小道具のヒーロー紹介。',
  'propIntro.objectLock':
    '物体ロック：輪郭・材質・色・刻印・摩耗・比率を参照と一致させよ。',
  'propIntro.name': '小道具名：{{name}}。',
  'propIntro.look': '外見：{{look}}。',
  'propIntro.material': '材質：{{material}}。',
  'propIntro.size': '寸法：{{size}}。',
  'propIntro.condition': '状態：{{condition}}。',
  'propIntro.tags': '視覚タグ：{{tags}}。',
  'propIntro.art': '作風：{{art}}。',
  'propIntro.camera': 'きれいな卓上でゆるい周回またはプッシュイン。',
  'propIntro.beat': 'ヒーロー静止 → 微光／微回転 → 静止。',
  'propIntro.noHands': '静止画に無い手・顔・字幕・透かし・余分な小道具禁止。',
  'propIntro.duration': '6–10秒の小道具紹介。',
  'costumeIntro.task': '図生動画：同一衣装の紹介クリップ。',
  'costumeIntro.wardrobeLock':
    '衣装ロック：輪郭・布・色・層・小物を参照と一致させよ。',
  'costumeIntro.identityOrProduct':
    '人がいれば顔／体をロックし布は微動可。トルソー／平置きなら商品構図。',
  'costumeIntro.name': 'ルック名：{{name}}。',
  'costumeIntro.desc': '衣装：{{look}}。',
  'costumeIntro.art': '作風：{{art}}。',
  'costumeIntro.camera': 'ゆるいプッシュインまたは周回。',
  'costumeIntro.beat': '静止 → 布の垂れ／袖口の微動／金具の反射 → 静止。',
  'costumeIntro.forbid': '新しい顔・字幕・ロゴ・エロポーズ禁止。',
  'costumeIntro.duration': '6–10秒の衣装紹介。',
  'costumeIntro.fallbackName': 'ルック',
  'actionIntro.lead': '短編ドラマ動作デモ：「{{name}}」。',
  'actionIntro.intention': '意図：{{intention}}',
  'actionIntro.body': '身体／テンポ：{{body}}',
  'actionIntro.camera': 'カメラ：{{camera}}',
  'actionIntro.closing': '滑らかで映画的。字幕なし。キーフレームに従え。',
  'sceneIntroPolish.task': '任務：場所紹介／確立クリップ（図生動画）。',
  'sceneIntroPolish.hasRef': '参照場所静止画あり — 空間身元をロック。',
  'sceneIntroPolish.noRef': '静止画パスなし。場所聖書にロック。',
  'sceneIntroPolish.dossier': '場所ファイル：',
  'sceneIntroPolish.scriptCue': '脚本ヒント（雰囲気のみ）：\n{{script}}',
  'sceneIntroPolish.emptySet':
    '空セット優先。新しい顔禁止。字幕・ロゴ禁止。',
  'propIntroPolish.task': '任務：小道具ヒーロー紹介（図生動画）。',
  'propIntroPolish.hasRef': '参照小道具静止画あり — 物体身元をロック。',
  'propIntroPolish.noRef': '静止画パスなし。小道具ファイルにロック。',
  'propIntroPolish.dossier': '小道具ファイル：',
  'propIntroPolish.noHands': '新しい手や顔禁止。字幕・ロゴ禁止。',
  'costumeIntroPolish.task': '任務：衣装／ルック紹介（図生動画）。',
  'costumeIntroPolish.hasRef':
    '参照あり — 人なら身元＋衣装、トルソーなら輪郭と材質。',
  'costumeIntroPolish.noRef': '静止画なし。衣装説明にロック。',
  'costumeIntroPolish.dossier': '衣装ファイル：',
  'costumeIntroPolish.fabric': '布の微動のみ。新しい顔・字幕・ロゴ禁止。',
  'actionIntroPolish.task': '任務：動作指導紹介クリップ（図生動画）。',
  'actionIntroPolish.hasRef': '参照あり — 演技身元をそのフレームにロック。',
  'actionIntroPolish.templateKeepRules':
    'テンプレート下書き（磨け；HARD RULES は末尾）：',
  'cover.posterLead':
    '短編ドラマのポスター／キーアート（16:9）。UIモック禁止。文字・ロゴ・透かし禁止。',
  'cover.titleMood': '物語タイトル（雰囲気のみ、画面に文字を出すな）：{{title}}。',
  'cover.styleBible': '作風：{{style}}',
  'cover.extraDir': '追加指示：{{idea}}',
  'cover.establishing': 'ライブラリ表紙向きの確立ムード。強いシルエット。',
  'cover.medium': '指定 medium に合わせ、構図をはっきり。',
  'cover.editPrefix':
    'IMAGE EDIT：新しいポスター構図。主体の身元／雰囲気は残せ。',
  'cover.label': '物語カバー',
  'costumeFill.system':
    '映画衣装デザイナー。コンパクトJSONのみ。各値は文字列。画像があればその衣装を忠実に。',
  'costumeFill.idea': '構想：{{idea}}',
  'costumeFill.polish': '衣装下書きを磨け。',
  'costumeFill.required':
    '必須キー：name, description, artStyle, hardRules。欠けると無効。',
  'costumeFill.fallbackName': 'ルック',
  'segment.entireStory': '全編（すべての場）',
  'segment.noStory': '物語未選択（キャラ資料のみ）'
})

extra.es = fromEn({
  'common.rules': 'Reglas:',
  'common.none': '(ninguno)',
  'intro.soul': 'soul.md (fuente de interpretación/identidad):\n{{soul}}',
  'intro.matchBible': '(seguir la biblia del personaje)',
  'invent.sources':
    'Fuentes de verdad, en orden: (1) idea/petición, (2) formulario, (3) extras solo si están en ESTE prompt, (4) imagen adjunta.',
  'invent.create':
    'Modo crear: inventa con libertad desde la idea/imagen; no dejes claves obligatorias vacías.',
  'invent.improve':
    'Modo mejorar: pule y completa el borrador; no cambies la identidad salvo petición.',
  'invent.noImport':
    'NO importes identidad, trama, clima, oficio, lugar, época o estilo de lo que no esté en este prompt.',
  'invent.storyBlock':
    'Si hay bloque de historia/estilo, úsalo solo para continuidad; no anules la idea explícita.',
  'character.keysLead': 'SOLO un JSON con claves: {{keys}}',
  'character.ruleSpoken':
    'spokenLanguages: array BCP-47 de idiomas que HABLA. [] si no verbal.',
  'character.ruleIdentity': 'Identidad coherente en láminas y vídeo.',
  'character.fallbackPersonality': 'presencia cálida y clara',
  'character.fallbackManner': 'microgestos naturales',
  'character.fallbackVoice': 'voz clara',
  'scene.keysLead': 'SOLO un JSON con claves: {{keys}}',
  'scene.suggestLead':
    'Propón una LOCALIZACIÓN lista como escena nº {{n}} de "{{title}}".',
  'scene.suggestPlotFocus': 'Foco argumental: {{label}}',
  'scene.suggestStyle': 'Estilo: {{style}}',
  'scene.suggestExisting': 'Localizaciones ya existentes: {{titles}}',
  'scene.suggestChars': 'Personajes (contexto):',
  'scene.suggestProps': 'Atrezzo (contexto):',
  'scene.suggestSegment': 'Detalle del segmento:',
  'scene.suggestBeats': 'Escenas / beats:',
  'scene.suggestClosing':
    'Devuelve el JSON completo. Diseña un lugar reutilizable y distinto.',
  'scene.fallbackName': 'Localización',
  'scene.fallbackMood': 'atmósfera cinematográfica',
  'scene.fallbackLighting': 'igual que el still',
  'scene.fallbackCamera': 'leve travelling de establecimiento o paneo lento',
  'scene.ideaFromImage':
    'Inventa el perfil completo de localización a partir de la foto adjunta.',
  'scene.polishIdea': 'Pulir',
  'prop.keysLead': 'SOLO un JSON con claves: {{keys}}',
  'action.fieldsLead': 'Campos: {{keys}}.',
  'soul.system':
    'Escribes soul.md de producción. SOLO markdown completo. Respeta spokenLanguages. Escribe en el idioma de la interfaz.',
  'soul.improveMode':
    'MODO MEJORAR: fusiona perfil + soul existente en un soul.md completo.',
  'soul.createMode':
    'Crea un soul.md completo a partir de este perfil (no inventes a otra persona):',
  'soul.profileFields': 'Campos del perfil:',
  'soul.existing': 'soul.md existente (fusiona; no descartes detalle útil):',
  'soul.userRequest': 'Petición del usuario: {{request}}',
  'soul.extraContext': 'Contexto adicional (útil sí; gana el perfil):',
  'soul.returnOnly': 'Devuelve solo el markdown del soul.md.',
  'wardrobe.system':
    'Eres consultor de vestuario. SOLO un JSON. artStyle debe ser uno de: {{styleIds}}. Materiales y silueta concretos. Nunca erotices menores.',
  'wardrobe.improveMode':
    'MODO MEJORAR / SUGERIR: usa TODOS los campos y el contexto argumental.',
  'wardrobe.characterForm': 'Personaje (formulario completo):',
  'wardrobe.soulExcerpt': 'Extracto soul.md:\n{{soul}}',
  'wardrobe.userRequest': 'Petición: {{request}}',
  'wardrobe.storyContext':
    'Contexto de producción (úsalo si está; no inventes otro mundo):',
  'wardrobe.style': 'estilo: {{style}}',
  'wardrobe.segment': 'Segmento elegido: {{label}}',
  'wardrobe.sceneContext': 'Escena / beat:',
  'wardrobe.noScenes': '(aún no hay escenas)',
  'wardrobe.proposeNew': 'Propón un look NUEVO que encaje (no dupliques).',
  'fill.system':
    'Completas campos vacíos. SOLO JSON con estas claves: {{keys}}. Cada valor es una cadena no vacía. Nunca un array.',
  'fill.userPartial': 'Perfil parcial (no contradigas):',
  'fill.userOnly': 'Rellena SOLO estas claves: {{keys}}.',
  'fill.userReturn': 'JSON solo con esas claves; valores no vacíos.',
  'imageGen.multiRef':
    '{{n}} stills extra: la primera es la base; mantén la identidad en todas.',
  'residual.sceneLink': 'Escena {{n}}: {{short}}',
  'residual.beatSegment': 'Beat {{n}} · {{who}}{{tail}}',
  'residual.unknown': 'Desconocido',
  'residual.story': 'Historia',
  'vision.preamble':
    'Hay un still adjunto. Rellena TODOS los campos de este {{what}} sobre todo DESDE LA IMAGEN.',
  'vision.character': 'identidad (nombre, aspecto, vestuario, edad, género, tags)',
  'vision.scene': 'localización (título, descripción, luz, ánimo, atrezzo, tags)',
  'vision.prop': 'atrezzo (nombre, descripción, material, tamaño, estado, tags)',
  'vision.action': 'acción (nombre, descripción, tempo, intención, cámara, tags)',
  'vision.costume': 'vestuario (nombre, descripción completa)',
  'still.revision': 'MEJORA DEL USUARIO PARA ESTE STILL (obligatoria): {{notes}}',
  'still.regenTask':
    'TAREA: revisa el prompt de director image-to-video y mantenlo usable como brief de keyframe.',
  'still.userImprove': 'PETICIÓN DE MEJORA:\n{{notes}}',
  'still.currentPrompt': 'Prompt profesional actual:',
  'still.hardRules': 'HARD RULES (al final; no las debilites):',
  'mediaGen.writeOne':
    'Escribe UN prompt final de imagen para un still de drama corto.',
  'mediaGen.returnOnly': 'SOLO el texto del prompt — sin markdown.',
  'mediaGen.singleComposite': 'Describe UNA sola imagen compuesta.',
  'mediaGen.lockRefs':
    'Las imágenes adjuntas son la verdad visual (orden Ref#). No inventes otra persona, tienda u objeto.',
  'mediaGen.videoSystem':
    'Eres redactor de prompts de director image-to-video.',
  'mediaGen.videoMerge': 'Fusiona los materiales en UN prompt de vídeo.',
  'mediaGen.videoInclude':
    'Incluye: bloqueo de identidad, cámara, interpretación/diálogo, ritmo, luz.',
  'mediaGen.videoFacts': 'Solo hechos de materiales y seed. Nada de Demo.',
  'mediaGen.videoNoSwap':
    'Con refs, no cambies actor, localización ni atrezzo.',
  'mediaGen.videoHardRules': 'HARD RULES al final si hay.',
  'mediaGen.imageSystem': 'Eres director de prompts de imagen.',
  'mediaGen.imageMergeStills':
    'Fusiona materiales y stills en UN prompt de imagen.',
  'mediaGen.imageMergeText': 'Fusiona los textos en UN prompt de imagen.',
  'mediaGen.imagePriority':
    'Prioridad: caras/vestuario/lugares/atrezzo de las imágenes.',
  'mediaGen.imageNoSwap':
    'No sustituyas por otro famoso o set ajeno si hay stills de elenco.',
  'mediaGen.imageFacts': 'Solo hechos de materiales y seed.',
  'mediaGen.imageLayout': 'Si hay multipanel, conserva el recuento exacto.',
  'mediaGen.imagePackage':
    'Si hay LAYOUT, el prompt DEBE aplicar ese layout exacto.',
  'mediaGen.imageHardRules': 'HARD RULES al final si hay.',
  'mediaGen.directorFallback':
    'IMAGEN-A-VÍDEO: anima este keyframe. Bloquea identidad, vestuario, set y encuadre.',
  'mediaGen.directorFallbackCam':
    'Cámara e interpretación claras; sin subtítulos ni marca de agua.',
  'charIntro.task':
    'IMAGEN-A-VÍDEO: anima a la misma persona del still en un autocasting breve.',
  'charIntro.identityLock':
    'BLOQUEO DE IDENTIDAD: misma cara, pelo, cuerpo, edad, vestuario y colores.',
  'charIntro.personality': 'Personalidad / vibe: {{personality}}.',
  'charIntro.backstory': 'Trasfondo: {{backstory}}.',
  'charIntro.relationships': 'Relaciones: {{relationships}}.',
  'charIntro.soul': 'Extracto soul (fuente de interpretación): {{soul}}',
  'charIntro.performance':
    'Interpretación: leve travelling o cámara en mano; mira a cámara; {{manner}}.',
  'charIntro.speech':
    'Habla: la boca se mueve como presentándose; voz: {{voice}}.',
  'charIntro.beat':
    'Idle natural → sonrisa o asentimiento → gesto breve → hold.',
  'charIntro.lighting':
    'Luz coherente con el still; sin texto, logos ni extra gente.',
  'charIntro.duration': 'Cabe en 6–10s de autocasting.',
  'sceneIntro.task':
    'IMAGEN-A-VÍDEO: anima el mismo lugar como plano de establecimiento.',
  'sceneIntro.spaceLock':
    'BLOQUEO DE ESPACIO: misma arquitectura, materiales, letreros, planta y color.',
  'sceneIntro.name': 'Nombre del lugar: {{name}}.',
  'sceneIntro.place': 'Descripción: {{place}}.',
  'sceneIntro.spaceType': 'Tipo de espacio: {{type}}.',
  'sceneIntro.time': 'Hora del día: {{time}}.',
  'sceneIntro.weather': 'Clima: {{weather}}.',
  'sceneIntro.moodLight': 'Ánimo: {{mood}}. Luz: {{lighting}}.',
  'sceneIntro.palette': 'Paleta: {{palette}}.',
  'sceneIntro.setDressing': 'Atrezzo de set: {{set}}.',
  'sceneIntro.tags': 'Tags visuales: {{tags}}.',
  'sceneIntro.art': 'Estilo: {{art}}.',
  'sceneIntro.ambient': 'Ambiente (sin texto UI): {{sound}}.',
  'sceneIntro.scriptCue': 'Pista de beat (solo atmósfera): {{cue}}.',
  'sceneIntro.camera':
    'Cámara: {{camera}}; set vacío preferible; sin caras nuevas ni logos.',
  'sceneIntro.beat':
    'Establecer → vida ambiental sutil → hold.',
  'sceneIntro.duration': 'Cabe en 6–10s de intro de lugar.',
  'propIntro.task':
    'IMAGEN-A-VÍDEO: anima el mismo atrezzo como intro de producto.',
  'propIntro.objectLock':
    'BLOQUEO DE OBJETO: misma silueta, materiales, colores, grabados y desgaste.',
  'propIntro.name': 'Nombre: {{name}}.',
  'propIntro.look': 'Aspecto: {{look}}.',
  'propIntro.material': 'Material: {{material}}.',
  'propIntro.size': 'Tamaño: {{size}}.',
  'propIntro.condition': 'Estado: {{condition}}.',
  'propIntro.tags': 'Tags: {{tags}}.',
  'propIntro.art': 'Estilo: {{art}}.',
  'propIntro.camera':
    'Órbita suave o travelling lento en mesa limpia; luz coherente.',
  'propIntro.beat': 'Hold → brillo / microgiro → hold.',
  'propIntro.noHands':
    'Sin manos ni caras nuevas si no están en el still; sin texto ni extras.',
  'propIntro.duration': 'Cabe en 6–10s de intro de atrezzo.',
  'costumeIntro.task':
    'IMAGEN-A-VÍDEO: anima el mismo look como intro de vestuario.',
  'costumeIntro.wardrobeLock':
    'BLOQUEO DE VESTUARIO: misma silueta, telas, colores, capas y accesorios.',
  'costumeIntro.identityOrProduct':
    'Si hay persona: bloquea cara/cuerpo; si maniquí/plano: encuadre de producto.',
  'costumeIntro.name': 'Nombre del look: {{name}}.',
  'costumeIntro.desc': 'Vestuario: {{look}}.',
  'costumeIntro.art': 'Estilo: {{art}}.',
  'costumeIntro.camera': 'Leve travelling u órbita; luz de moda coherente.',
  'costumeIntro.beat': 'Hold → caída de tela / brillo de herrajes → hold.',
  'costumeIntro.forbid': 'Sin caras nuevas, texto, logos ni pose erótica.',
  'costumeIntro.duration': 'Cabe en 6–10s de intro de vestuario.',
  'costumeIntro.fallbackName': 'Look',
  'actionIntro.lead': 'Vídeo demo de acción "{{name}}".',
  'actionIntro.intention': 'Intención: {{intention}}',
  'actionIntro.body': 'Cuerpo/tempo: {{body}}',
  'actionIntro.camera': 'Cámara: {{camera}}',
  'actionIntro.closing':
    'Movimiento continuo, cinematográfico, sin texto; sigue el still.',
  'sceneIntroPolish.task': 'TAREA: intro de localización (imagen-a-vídeo).',
  'sceneIntroPolish.hasRef':
    'Still de lugar adjunto — bloquea la identidad ESPACIAL.',
  'sceneIntroPolish.noRef': 'Sin still; bloquea a la biblia del lugar.',
  'sceneIntroPolish.dossier': 'Dossier de localización:',
  'sceneIntroPolish.scriptCue': 'pista de guion (solo atmósfera):\n{{script}}',
  'sceneIntroPolish.emptySet':
    'Set vacío; sin caras nuevas. Sin texto ni logos.',
  'propIntroPolish.task': 'TAREA: intro héroe de atrezzo (imagen-a-vídeo).',
  'propIntroPolish.hasRef': 'Still de atrezzo adjunto — bloquea el OBJETO.',
  'propIntroPolish.noRef': 'Sin still; bloquea al dossier.',
  'propIntroPolish.dossier': 'Dossier de atrezzo:',
  'propIntroPolish.noHands': 'Sin manos ni caras nuevas. Sin texto ni logos.',
  'costumeIntroPolish.task': 'TAREA: intro de vestuario (imagen-a-vídeo).',
  'costumeIntroPolish.hasRef':
    'Still adjunto — persona: identidad+ropa; maniquí: silueta y materiales.',
  'costumeIntroPolish.noRef': 'Sin still; bloquea a la descripción.',
  'costumeIntroPolish.dossier': 'Dossier de vestuario:',
  'costumeIntroPolish.fabric':
    'Caída sutil de tela; sin caras nuevas ni texto.',
  'actionIntroPolish.task': 'TAREA: intro de guía de movimiento (imagen-a-vídeo).',
  'actionIntroPolish.hasRef':
    'Still adjunto — bloquea la identidad interpretativa.',
  'actionIntroPolish.templateKeepRules':
    'Borrador plantilla (mejora; HARD RULES al final):',
  'cover.posterLead':
    'PÓSTER / KEY ART profesional 16:9. No es mockup UI. Sin texto, logo ni marca.',
  'cover.titleMood':
    'Título (solo ánimo, no lo escribas en imagen): {{title}}.',
  'cover.styleBible': 'Biblia de estilo: {{style}}',
  'cover.extraDir': 'Dirección extra: {{idea}}',
  'cover.establishing':
    'Plano de establecimiento evocador para portada de biblioteca.',
  'cover.medium': 'Respeta el medium; silueta fuerte.',
  'cover.editPrefix':
    'IMAGE EDIT: nueva composición de póster. Conserva identidad/ánimo. ',
  'cover.label': 'Portada de historia',
  'costumeFill.system':
    'Eres diseñador de vestuario. SOLO JSON compacto. Si hay imagen, describe ESE outfit con fidelidad.',
  'costumeFill.idea': 'Idea: {{idea}}',
  'costumeFill.polish': 'Pule el borrador de vestuario.',
  'costumeFill.required':
    'Claves: name, description, artStyle, hardRules. Faltar = inválido.',
  'costumeFill.fallbackName': 'Look',
  'segment.entireStory': 'Toda la historia (todas las escenas)',
  'segment.noStory': 'Sin historia (solo ficha de personaje)'
})

extra.fr = fromEn({
  'common.rules': 'Règles :',
  'common.none': '(aucun)',
  'intro.soul': 'soul.md (source d’interprétation / identité) :\n{{soul}}',
  'intro.matchBible': '(suivre la bible du personnage)',
  'invent.sources':
    'Sources de vérité, dans l’ordre : (1) idée / demande, (2) formulaire, (3) extras seulement s’ils sont dans CE prompt, (4) image jointe.',
  'invent.create':
    'Mode créer : inventez librement depuis l’idée/image ; ne laissez aucune clé obligatoire vide.',
  'invent.improve':
    'Mode améliorer : peaufinez le brouillon ; ne changez l’identité que sur demande.',
  'invent.noImport':
    'N’importez ni identité, intrigue, météo, métier, lieu, époque ou style hors de ce prompt.',
  'invent.storyBlock':
    'Un bloc histoire/style ne sert qu’à la continuité ; n’écrasez pas l’idée explicite.',
  'character.keysLead': 'UN SEUL JSON avec les clés : {{keys}}',
  'character.ruleSpoken':
    'spokenLanguages : tableau BCP-47 des langues PARLÉES. [] si non verbal.',
  'character.ruleIdentity': 'Identité cohérente pour planches et vidéo.',
  'character.fallbackPersonality': 'présence chaleureuse et nette',
  'character.fallbackManner': 'micro-gestes naturels',
  'character.fallbackVoice': 'voix claire',
  'scene.keysLead': 'UN SEUL JSON avec les clés : {{keys}}',
  'scene.suggestLead':
    'Proposez un LIEU prêt comme scène n° {{n}} pour « {{title}} ».',
  'scene.suggestPlotFocus': 'Foyer narratif : {{label}}',
  'scene.suggestStyle': 'Style : {{style}}',
  'scene.suggestExisting': 'Lieux déjà là : {{titles}}',
  'scene.suggestChars': 'Personnages (contexte) :',
  'scene.suggestProps': 'Accessoires (contexte) :',
  'scene.suggestSegment': 'Détail du segment :',
  'scene.suggestBeats': 'Scènes / beats :',
  'scene.suggestClosing':
    'Renvoyez le JSON complet. Concevez un lieu distinct et réutilisable.',
  'scene.fallbackName': 'Lieu',
  'scene.fallbackMood': 'atmosphère cinématographique',
  'scene.fallbackLighting': 'comme le still',
  'scene.fallbackCamera': 'léger travelling d’établissement ou panoramique lent',
  'scene.ideaFromImage':
    'Inventez le profil de lieu complet à partir de la photo jointe.',
  'scene.polishIdea': 'Peaufiner',
  'prop.keysLead': 'UN SEUL JSON avec les clés : {{keys}}',
  'action.fieldsLead': 'Champs : {{keys}}.',
  'soul.system':
    'Vous rédigez des soul.md de production. Markdown complet seulement. Respectez spokenLanguages. Langue de l’interface.',
  'soul.improveMode':
    'MODE AMÉLIORER : fusionnez profil + soul existant en un soul.md complet.',
  'soul.createMode':
    'Rédigez un soul.md complet à partir de ce profil (pas une autre personne) :',
  'soul.profileFields': 'Champs du profil :',
  'soul.existing': 'soul.md existant (fusionnez ; ne jetez pas le détail utile) :',
  'soul.userRequest': 'Demande : {{request}}',
  'soul.extraContext': 'Contexte supplémentaire (utile oui ; le profil gagne) :',
  'soul.returnOnly': 'Renvoyez uniquement le markdown du soul.md.',
  'wardrobe.system':
    'Vous êtes consultant costumes. UN seul JSON. artStyle parmi : {{styleIds}}. Matières et silhouette concrètes. Jamais d’érotisation mineure.',
  'wardrobe.improveMode':
    'MODE AMÉLIORER / SUGGÉRER : utilisez TOUS les champs et le contexte.',
  'wardrobe.characterForm': 'Personnage (formulaire complet) :',
  'wardrobe.soulExcerpt': 'Extrait soul.md :\n{{soul}}',
  'wardrobe.userRequest': 'Demande : {{request}}',
  'wardrobe.storyContext':
    'Contexte de production (s’il est là ; n’inventez pas un autre monde) :',
  'wardrobe.style': 'style : {{style}}',
  'wardrobe.segment': 'Segment choisi : {{label}}',
  'wardrobe.sceneContext': 'Scène / beat :',
  'wardrobe.noScenes': '(pas encore de scènes)',
  'wardrobe.proposeNew': 'Proposez un look NOUVEAU qui colle (pas un doublon).',
  'fill.system':
    'Vous complétez les champs vides. JSON avec EXACTEMENT ces clés : {{keys}}. Chaque valeur est une chaîne non vide. Jamais un tableau.',
  'fill.userPartial': 'Profil partiel (ne contredisez pas) :',
  'fill.userOnly': 'Remplissez SEULEMENT ces clés : {{keys}}.',
  'fill.userReturn': 'JSON avec ces clés seulement ; valeurs non vides.',
  'imageGen.multiRef':
    '{{n}} stills de plus : le premier est la base ; gardez l’identité partout.',
  'residual.sceneLink': 'Scène {{n}} : {{short}}',
  'residual.beatSegment': 'Beat {{n}} · {{who}}{{tail}}',
  'residual.unknown': 'Inconnu',
  'residual.story': 'Histoire',
  'vision.preamble':
    'Un still est joint. Remplissez TOUS les champs de ce {{what}} surtout DEPUIS L’IMAGE.',
  'vision.character':
    'identité (nom, apparence, costume, âge, genre, tags)',
  'vision.scene': 'lieu (titre, description, lumière, humeur, décor, tags)',
  'vision.prop':
    'accessoire (nom, description, matière, taille, état, tags)',
  'vision.action':
    'action (nom, description, tempo, intention, caméra, tags)',
  'vision.costume': 'costume (nom, description complète)',
  'still.revision': 'AMÉLIORATION UTILISATEUR POUR CE STILL (obligatoire) : {{notes}}',
  'still.regenTask':
    'TÂCHE : révisez le prompt directeur image-to-video et gardez-le utilisable comme brief de keyframe.',
  'still.userImprove': 'DEMANDE D’AMÉLIORATION :\n{{notes}}',
  'still.currentPrompt': 'Prompt professionnel actuel :',
  'still.hardRules': 'HARD RULES (à la fin ; ne les affaiblissez pas) :',
  'mediaGen.writeOne':
    'Rédigez UN prompt d’image final pour un still de drama court.',
  'mediaGen.returnOnly': 'SEULEMENT le texte du prompt — pas de markdown.',
  'mediaGen.singleComposite': 'Décrivez UNE seule image composite.',
  'mediaGen.lockRefs':
    'Les images jointes sont la vérité visuelle (ordre Ref#). N’inventez pas une autre personne, boutique ou objet.',
  'mediaGen.videoSystem':
    'Vous rédigez des prompts de réalisateur image-to-video.',
  'mediaGen.videoMerge': 'Fusionnez les matériaux en UN prompt vidéo.',
  'mediaGen.videoInclude':
    'Inclure : verrou d’identité, caméra, jeu/dialogue, rythme, lumière.',
  'mediaGen.videoFacts': 'Faits des matériaux et du seed seulement. Pas de Demo.',
  'mediaGen.videoNoSwap':
    'Avec refs, ne changez ni acteur, lieu ni accessoire.',
  'mediaGen.videoHardRules': 'HARD RULES à la fin s’il y en a.',
  'mediaGen.imageSystem': 'Vous êtes directeur de prompts image.',
  'mediaGen.imageMergeStills':
    'Fusionnez matériaux et stills en UN prompt image.',
  'mediaGen.imageMergeText': 'Fusionnez les textes en UN prompt image.',
  'mediaGen.imagePriority':
    'Priorité : visages/costumes/lieux/accessoires des images.',
  'mediaGen.imageNoSwap':
    'Ne substituez pas une autre célébrité ou un autre set s’il y a des stills de cast.',
  'mediaGen.imageFacts': 'Faits des matériaux et du seed seulement.',
  'mediaGen.imageLayout': 'Multipan visé : conservez le nombre exact de cases.',
  'mediaGen.imagePackage':
    'S’il y a un LAYOUT, le prompt DOIT l’appliquer exactement.',
  'mediaGen.imageHardRules': 'HARD RULES à la fin s’il y en a.',
  'mediaGen.directorFallback':
    'IMAGE-VERS-VIDÉO : animez ce keyframe. Verrouillez identité, costume, décor et cadrage.',
  'mediaGen.directorFallbackCam':
    'Caméra et jeu clairs ; pas de sous-titres ni filigrane.',
  'charIntro.task':
    'IMAGE-VERS-VIDÉO : animez la même personne pour un court auto-casting.',
  'charIntro.identityLock':
    'VERROU D’IDENTITÉ : même visage, cheveux, corps, âge, costume et couleurs.',
  'charIntro.personality': 'Personnalité / vibe : {{personality}}.',
  'charIntro.backstory': 'Histoire : {{backstory}}.',
  'charIntro.relationships': 'Relations : {{relationships}}.',
  'charIntro.soul': 'Extrait soul (source de jeu) : {{soul}}',
  'charIntro.performance':
    'Jeu : léger travelling ou caméra à l’épaule ; regard caméra ; {{manner}}.',
  'charIntro.speech':
    'Parole : la bouche bouge comme une courte présentation ; voix : {{voice}}.',
  'charIntro.beat':
    'Idle naturel → sourire ou hochement → geste bref → hold.',
  'charIntro.lighting':
    'Lumière cohérente avec le still ; pas de texte, logo ni figurants.',
  'charIntro.duration': 'Convient à 6–10 s d’auto-casting.',
  'sceneIntro.task':
    'IMAGE-VERS-VIDÉO : animez le même lieu en plan d’établissement.',
  'sceneIntro.spaceLock':
    'VERROU D’ESPACE : même architecture, matières, enseignes, plan et couleurs.',
  'sceneIntro.name': 'Nom du lieu : {{name}}.',
  'sceneIntro.place': 'Description : {{place}}.',
  'sceneIntro.spaceType': 'Type d’espace : {{type}}.',
  'sceneIntro.time': 'Moment : {{time}}.',
  'sceneIntro.weather': 'Météo : {{weather}}.',
  'sceneIntro.moodLight': 'Humeur : {{mood}}. Lumière : {{lighting}}.',
  'sceneIntro.palette': 'Palette : {{palette}}.',
  'sceneIntro.setDressing': 'Décor : {{set}}.',
  'sceneIntro.tags': 'Tags visuels : {{tags}}.',
  'sceneIntro.art': 'Style : {{art}}.',
  'sceneIntro.ambient': 'Ambiance (sans texte UI) : {{sound}}.',
  'sceneIntro.scriptCue': 'Indice de beat (atmosphère seulement) : {{cue}}.',
  'sceneIntro.camera':
    'Caméra : {{camera}} ; plateau vide de préférence ; pas de nouveaux visages ni logos.',
  'sceneIntro.beat': 'Établir → vie environnementale subtile → hold.',
  'sceneIntro.duration': 'Convient à 6–10 s d’intro de lieu.',
  'propIntro.task':
    'IMAGE-VERS-VIDÉO : animez le même accessoire en intro produit.',
  'propIntro.objectLock':
    'VERROU D’OBJET : même silhouette, matières, couleurs, gravures et usure.',
  'propIntro.name': 'Nom : {{name}}.',
  'propIntro.look': 'Apparence : {{look}}.',
  'propIntro.material': 'Matière : {{material}}.',
  'propIntro.size': 'Taille : {{size}}.',
  'propIntro.condition': 'État : {{condition}}.',
  'propIntro.tags': 'Tags : {{tags}}.',
  'propIntro.art': 'Style : {{art}}.',
  'propIntro.camera':
    'Orbite douce ou travelling lent sur table propre ; lumière cohérente.',
  'propIntro.beat': 'Hold → éclat / micro-rotation → hold.',
  'propIntro.noHands':
    'Pas de mains ni visages nouveaux s’ils n’y sont pas ; pas de texte ni extras.',
  'propIntro.duration': 'Convient à 6–10 s d’intro d’accessoire.',
  'costumeIntro.task':
    'IMAGE-VERS-VIDÉO : animez le même look en intro costume.',
  'costumeIntro.wardrobeLock':
    'VERROU DE COSTUME : même silhouette, tissus, couleurs, couches et accessoires.',
  'costumeIntro.identityOrProduct':
    'Personne : verrouillez visage/corps ; mannequin / à plat : cadrage produit.',
  'costumeIntro.name': 'Nom du look : {{name}}.',
  'costumeIntro.desc': 'Costume : {{look}}.',
  'costumeIntro.art': 'Style : {{art}}.',
  'costumeIntro.camera': 'Léger travelling ou orbite ; lumière mode cohérente.',
  'costumeIntro.beat': 'Hold → tombé de tissu / éclat de quincaillerie → hold.',
  'costumeIntro.forbid':
    'Pas de nouveaux visages, texte, logos ni pose érotique.',
  'costumeIntro.duration': 'Convient à 6–10 s d’intro costume.',
  'costumeIntro.fallbackName': 'Look',
  'actionIntro.lead': 'Démo de mouvement « {{name}} ».',
  'actionIntro.intention': 'Intention : {{intention}}',
  'actionIntro.body': 'Corps/tempo : {{body}}',
  'actionIntro.camera': 'Caméra : {{camera}}',
  'actionIntro.closing':
    'Mouvement continu, cinématographique, sans texte ; suivez le still.',
  'sceneIntroPolish.task': 'TÂCHE : intro de lieu (image-vers-vidéo).',
  'sceneIntroPolish.hasRef':
    'Still de lieu joint — verrouillez l’identité SPATIALE.',
  'sceneIntroPolish.noRef': 'Pas de still ; verrouillez à la bible du lieu.',
  'sceneIntroPolish.dossier': 'Dossier du lieu :',
  'sceneIntroPolish.scriptCue': 'indice de script (atmosphère seulement) :\n{{script}}',
  'sceneIntroPolish.emptySet':
    'Plateau vide ; pas de nouveaux visages. Pas de texte ni logos.',
  'propIntroPolish.task': 'TÂCHE : intro héros d’accessoire (image-vers-vidéo).',
  'propIntroPolish.hasRef': 'Still d’accessoire joint — verrouillez l’OBJET.',
  'propIntroPolish.noRef': 'Pas de still ; verrouillez au dossier.',
  'propIntroPolish.dossier': 'Dossier accessoire :',
  'propIntroPolish.noHands':
    'Pas de nouvelles mains ni visages. Pas de texte ni logos.',
  'costumeIntroPolish.task': 'TÂCHE : intro costume / look (image-vers-vidéo).',
  'costumeIntroPolish.hasRef':
    'Still joint — personne : identité+costume ; mannequin : silhouette et matières.',
  'costumeIntroPolish.noRef': 'Pas de still ; verrouillez à la description.',
  'costumeIntroPolish.dossier': 'Dossier costume :',
  'costumeIntroPolish.fabric':
    'Tombé subtil ; pas de nouveaux visages ni texte.',
  'actionIntroPolish.task':
    'TÂCHE : intro de guide de mouvement (image-vers-vidéo).',
  'actionIntroPolish.hasRef':
    'Still joint — verrouillez l’identité de jeu à ce cadre.',
  'actionIntroPolish.templateKeepRules':
    'Brouillon modèle (améliorez ; HARD RULES à la fin) :',
  'cover.posterLead':
    'AFFICHE / KEY ART professionnel 16:9. Pas de mockup UI. Pas de texte, logo ni filigrane.',
  'cover.titleMood':
    'Titre (humeur seulement, ne l’écrivez pas) : {{title}}.',
  'cover.styleBible': 'Bible de style : {{style}}',
  'cover.extraDir': 'Direction extra : {{idea}}',
  'cover.establishing':
    'Plan d’établissement évocateur pour une couverture de bibliothèque.',
  'cover.medium': 'Respectez le medium ; silhouette forte.',
  'cover.editPrefix':
    'IMAGE EDIT : nouvelle composition d’affiche. Gardez identité/humeur. ',
  'cover.label': 'Couverture d’histoire',
  'costumeFill.system':
    'Vous êtes costumier. JSON compact seulement. Si image, décrivez CET habit fidèlement.',
  'costumeFill.idea': 'Idée : {{idea}}',
  'costumeFill.polish': 'Peaufinez le brouillon de costume.',
  'costumeFill.required':
    'Clés : name, description, artStyle, hardRules. Manquer = invalide.',
  'costumeFill.fallbackName': 'Look',
  'segment.entireStory': 'Toute l’histoire (toutes les scènes)',
  'segment.noStory': 'Aucune histoire (fiche personnage seulement)'
})

extra['pt-BR'] = fromEn({
  'common.rules': 'Regras:',
  'common.none': '(nenhum)',
  'intro.soul': 'soul.md (fonte de interpretação/identidade):\n{{soul}}',
  'intro.matchBible': '(seguir a bíblia do personagem)',
  'invent.sources':
    'Fontes da verdade, nesta ordem: (1) ideia/pedido, (2) formulário, (3) extras só se estiverem NESTE prompt, (4) imagem anexada.',
  'invent.create':
    'Modo criar: invente livremente a partir da ideia/imagem; não deixe chaves obrigatórias vazias.',
  'invent.improve':
    'Modo melhorar: polir o rascunho; não troque a identidade salvo pedido.',
  'invent.noImport':
    'NÃO importe identidade, trama, clima, ofício, lugar, época ou estilo de fora deste prompt.',
  'invent.storyBlock':
    'Bloco de história/estilo só para continuidade; não anule a ideia explícita.',
  'character.keysLead': 'APENAS um JSON com chaves: {{keys}}',
  'character.ruleSpoken':
    'spokenLanguages: array BCP-47 dos idiomas FALADOS. [] se não verbal.',
  'character.ruleIdentity': 'Identidade coerente em pranchas e vídeo.',
  'character.fallbackPersonality': 'presença calorosa e clara',
  'character.fallbackManner': 'microgestos naturais',
  'character.fallbackVoice': 'voz clara',
  'scene.keysLead': 'APENAS um JSON com chaves: {{keys}}',
  'scene.suggestLead':
    'Proponha um LOCAL pronto como cena nº {{n}} de "{{title}}".',
  'scene.suggestPlotFocus': 'Foco da trama: {{label}}',
  'scene.suggestStyle': 'Estilo: {{style}}',
  'scene.suggestExisting': 'Locais já existentes: {{titles}}',
  'scene.suggestChars': 'Personagens (contexto):',
  'scene.suggestProps': 'Objetos (contexto):',
  'scene.suggestSegment': 'Detalhe do segmento:',
  'scene.suggestBeats': 'Cenas / beats:',
  'scene.suggestClosing':
    'Devolva o JSON completo. Desenhe um local reutilizável e distinto.',
  'scene.fallbackName': 'Local',
  'scene.fallbackMood': 'atmosfera cinematográfica',
  'scene.fallbackLighting': 'igual ao still',
  'scene.fallbackCamera': 'leve travelling de estabelecimento ou pan lento',
  'scene.ideaFromImage':
    'Invente o perfil completo do local a partir da foto anexada.',
  'scene.polishIdea': 'Polir',
  'prop.keysLead': 'APENAS um JSON com chaves: {{keys}}',
  'action.fieldsLead': 'Campos: {{keys}}.',
  'soul.system':
    'Você escreve soul.md de produção. Só markdown completo. Respeite spokenLanguages. Idioma da interface.',
  'soul.improveMode':
    'MODO MELHORAR: una perfil + soul existente num soul.md completo.',
  'soul.createMode':
    'Escreva um soul.md completo a partir deste perfil (não invente outra pessoa):',
  'soul.profileFields': 'Campos do perfil:',
  'soul.existing': 'soul.md existente (una; não descarte detalhe útil):',
  'soul.userRequest': 'Pedido: {{request}}',
  'soul.extraContext': 'Contexto extra (útil sim; o perfil vence):',
  'soul.returnOnly': 'Devolva só o markdown do soul.md.',
  'wardrobe.system':
    'Você é consultor de figurino. UM JSON só. artStyle deve ser um de: {{styleIds}}. Materiais e silhueta concretos. Nunca erotize menores.',
  'wardrobe.improveMode':
    'MODO MELHORAR / SUGERIR: use TODOS os campos e o contexto.',
  'wardrobe.characterForm': 'Personagem (formulário completo):',
  'wardrobe.soulExcerpt': 'Trecho soul.md:\n{{soul}}',
  'wardrobe.userRequest': 'Pedido: {{request}}',
  'wardrobe.storyContext':
    'Contexto de produção (use se houver; não invente outro mundo):',
  'wardrobe.style': 'estilo: {{style}}',
  'wardrobe.segment': 'Segmento escolhido: {{label}}',
  'wardrobe.sceneContext': 'Cena / beat:',
  'wardrobe.noScenes': '(ainda sem cenas)',
  'wardrobe.proposeNew': 'Proponha um look NOVO que sirva (sem duplicar).',
  'fill.system':
    'Você completa campos vazios. JSON com EXATAMENTE estas chaves: {{keys}}. Cada valor é string não vazia. Nunca array.',
  'fill.userPartial': 'Perfil parcial (não contradiga):',
  'fill.userOnly': 'Preencha SÓ estas chaves: {{keys}}.',
  'fill.userReturn': 'JSON só com essas chaves; valores não vazios.',
  'imageGen.multiRef':
    '{{n}} stills a mais: o primeiro é a base; mantenha a identidade em todos.',
  'residual.sceneLink': 'Cena {{n}}: {{short}}',
  'residual.beatSegment': 'Beat {{n}} · {{who}}{{tail}}',
  'residual.unknown': 'Desconhecido',
  'residual.story': 'História',
  'vision.preamble':
    'Há um still anexado. Preencha TODOS os campos deste {{what}} principalmente A PARTIR DA IMAGEM.',
  'vision.character':
    'identidade (nome, aparência, figurino, idade, gênero, tags)',
  'vision.scene': 'local (título, descrição, luz, clima, cenário, tags)',
  'vision.prop': 'objeto (nome, descrição, material, tamanho, estado, tags)',
  'vision.action': 'ação (nome, descrição, ritmo, intenção, câmera, tags)',
  'vision.costume': 'figurino (nome, descrição completa)',
  'still.revision': 'MELHORIA DO USUÁRIO PARA ESTE STILL (obrigatória): {{notes}}',
  'still.regenTask':
    'TAREFA: revise o prompt de diretor image-to-video e mantenha-o usável como brief de keyframe.',
  'still.userImprove': 'PEDIDO DE MELHORIA:\n{{notes}}',
  'still.currentPrompt': 'Prompt profissional atual:',
  'still.hardRules': 'HARD RULES (no fim; não enfraqueça):',
  'mediaGen.writeOne':
    'Escreva UM prompt final de imagem para um still de drama curto.',
  'mediaGen.returnOnly': 'SÓ o texto do prompt — sem markdown.',
  'mediaGen.singleComposite': 'Descreva UMA única imagem composta.',
  'mediaGen.lockRefs':
    'As imagens anexadas são a verdade visual (ordem Ref#). Não invente outra pessoa, loja ou objeto.',
  'mediaGen.videoSystem':
    'Você escreve prompts de diretor image-to-video.',
  'mediaGen.videoMerge': 'Una os materiais num ÚNICO prompt de vídeo.',
  'mediaGen.videoInclude':
    'Inclua: trava de identidade, câmera, atuação/diálogo, ritmo, luz.',
  'mediaGen.videoFacts': 'Só fatos dos materiais e do seed. Sem Demo.',
  'mediaGen.videoNoSwap':
    'Com refs, não troque ator, local nem objeto.',
  'mediaGen.videoHardRules': 'HARD RULES no fim se houver.',
  'mediaGen.imageSystem': 'Você é diretor de prompts de imagem.',
  'mediaGen.imageMergeStills':
    'Una materiais e stills num ÚNICO prompt de imagem.',
  'mediaGen.imageMergeText': 'Una os textos num ÚNICO prompt de imagem.',
  'mediaGen.imagePriority':
    'Prioridade: rostos/figurinos/locais/objetos das imagens.',
  'mediaGen.imageNoSwap':
    'Não substitua por outra celebridade ou set alheio se houver stills de elenco.',
  'mediaGen.imageFacts': 'Só fatos dos materiais e do seed.',
  'mediaGen.imageLayout': 'Se for multipainel, preserve a contagem exata.',
  'mediaGen.imagePackage':
    'Se houver LAYOUT, o prompt DEVE aplicar esse layout exato.',
  'mediaGen.imageHardRules': 'HARD RULES no fim se houver.',
  'mediaGen.directorFallback':
    'IMAGEM-PARA-VÍDEO: anime este keyframe. Trave identidade, figurino, set e enquadramento.',
  'mediaGen.directorFallbackCam':
    'Câmera e atuação claras; sem legendas nem marca d’água.',
  'charIntro.task':
    'IMAGEM-PARA-VÍDEO: anime a mesma pessoa num auto-casting curto.',
  'charIntro.identityLock':
    'TRAVA DE IDENTIDADE: mesmo rosto, cabelo, corpo, idade, figurino e cores.',
  'charIntro.personality': 'Personalidade / vibe: {{personality}}.',
  'charIntro.backstory': 'História: {{backstory}}.',
  'charIntro.relationships': 'Relações: {{relationships}}.',
  'charIntro.soul': 'Trecho soul (fonte de atuação): {{soul}}',
  'charIntro.performance':
    'Atuação: leve travelling ou câmera na mão; olha para a câmera; {{manner}}.',
  'charIntro.speech':
    'Fala: a boca se move como uma apresentação breve; voz: {{voice}}.',
  'charIntro.beat':
    'Idle natural → sorriso ou aceno → gesto breve → hold.',
  'charIntro.lighting':
    'Luz coerente com o still; sem texto, logos nem extra gente.',
  'charIntro.duration': 'Cabe em 6–10s de auto-casting.',
  'sceneIntro.task':
    'IMAGEM-PARA-VÍDEO: anime o mesmo local como plano de estabelecimento.',
  'sceneIntro.spaceLock':
    'TRAVA DE ESPAÇO: mesma arquitetura, materiais, placas, planta e cor.',
  'sceneIntro.name': 'Nome do local: {{name}}.',
  'sceneIntro.place': 'Descrição: {{place}}.',
  'sceneIntro.spaceType': 'Tipo de espaço: {{type}}.',
  'sceneIntro.time': 'Hora do dia: {{time}}.',
  'sceneIntro.weather': 'Clima: {{weather}}.',
  'sceneIntro.moodLight': 'Clima: {{mood}}. Luz: {{lighting}}.',
  'sceneIntro.palette': 'Paleta: {{palette}}.',
  'sceneIntro.setDressing': 'Cenário: {{set}}.',
  'sceneIntro.tags': 'Tags visuais: {{tags}}.',
  'sceneIntro.art': 'Estilo: {{art}}.',
  'sceneIntro.ambient': 'Ambiente (sem texto de UI): {{sound}}.',
  'sceneIntro.scriptCue': 'Dica de beat (só atmosfera): {{cue}}.',
  'sceneIntro.camera':
    'Câmera: {{camera}}; set vazio preferível; sem rostos novos nem logos.',
  'sceneIntro.beat': 'Estabelecer → vida ambiental sutil → hold.',
  'sceneIntro.duration': 'Cabe em 6–10s de intro de local.',
  'propIntro.task':
    'IMAGEM-PARA-VÍDEO: anime o mesmo objeto como intro de produto.',
  'propIntro.objectLock':
    'TRAVA DE OBJETO: mesma silhueta, materiais, cores, gravuras e desgaste.',
  'propIntro.name': 'Nome: {{name}}.',
  'propIntro.look': 'Aparência: {{look}}.',
  'propIntro.material': 'Material: {{material}}.',
  'propIntro.size': 'Tamanho: {{size}}.',
  'propIntro.condition': 'Estado: {{condition}}.',
  'propIntro.tags': 'Tags: {{tags}}.',
  'propIntro.art': 'Estilo: {{art}}.',
  'propIntro.camera':
    'Órbita suave ou travelling lento em mesa limpa; luz coerente.',
  'propIntro.beat': 'Hold → brilho / microgiro → hold.',
  'propIntro.noHands':
    'Sem mãos nem rostos novos se não estiverem no still; sem texto nem extras.',
  'propIntro.duration': 'Cabe em 6–10s de intro de objeto.',
  'costumeIntro.task':
    'IMAGEM-PARA-VÍDEO: anime o mesmo look como intro de figurino.',
  'costumeIntro.wardrobeLock':
    'TRAVA DE FIGURINO: mesma silhueta, tecidos, cores, camadas e acessórios.',
  'costumeIntro.identityOrProduct':
    'Se houver pessoa: trave rosto/corpo; se manequim/plano: enquadramento de produto.',
  'costumeIntro.name': 'Nome do look: {{name}}.',
  'costumeIntro.desc': 'Figurino: {{look}}.',
  'costumeIntro.art': 'Estilo: {{art}}.',
  'costumeIntro.camera': 'Leve travelling ou órbita; luz de moda coerente.',
  'costumeIntro.beat': 'Hold → queda de tecido / brilho de ferragens → hold.',
  'costumeIntro.forbid': 'Sem rostos novos, texto, logos nem pose erótica.',
  'costumeIntro.duration': 'Cabe em 6–10s de intro de figurino.',
  'costumeIntro.fallbackName': 'Look',
  'actionIntro.lead': 'Vídeo demo da ação "{{name}}".',
  'actionIntro.intention': 'Intenção: {{intention}}',
  'actionIntro.body': 'Corpo/tempo: {{body}}',
  'actionIntro.camera': 'Câmera: {{camera}}',
  'actionIntro.closing':
    'Movimento contínuo, cinematográfico, sem texto; siga o still.',
  'sceneIntroPolish.task': 'TAREFA: intro de local (imagem-para-vídeo).',
  'sceneIntroPolish.hasRef':
    'Still de local anexado — trave a identidade ESPACIAL.',
  'sceneIntroPolish.noRef': 'Sem still; trave à bíblia do local.',
  'sceneIntroPolish.dossier': 'Dossiê do local:',
  'sceneIntroPolish.scriptCue': 'dica de roteiro (só atmosfera):\n{{script}}',
  'sceneIntroPolish.emptySet':
    'Set vazio; sem rostos novos. Sem texto nem logos.',
  'propIntroPolish.task': 'TAREFA: intro herói de objeto (imagem-para-vídeo).',
  'propIntroPolish.hasRef': 'Still de objeto anexado — trave o OBJETO.',
  'propIntroPolish.noRef': 'Sem still; trave ao dossiê.',
  'propIntroPolish.dossier': 'Dossiê do objeto:',
  'propIntroPolish.noHands': 'Sem mãos nem rostos novos. Sem texto nem logos.',
  'costumeIntroPolish.task': 'TAREFA: intro de figurino (imagem-para-vídeo).',
  'costumeIntroPolish.hasRef':
    'Still anexado — pessoa: identidade+roupa; manequim: silhueta e materiais.',
  'costumeIntroPolish.noRef': 'Sem still; trave à descrição.',
  'costumeIntroPolish.dossier': 'Dossiê de figurino:',
  'costumeIntroPolish.fabric':
    'Queda sutil de tecido; sem rostos novos nem texto.',
  'actionIntroPolish.task':
    'TAREFA: intro de guia de movimento (imagem-para-vídeo).',
  'actionIntroPolish.hasRef':
    'Still anexado — trave a identidade de atuação àquele quadro.',
  'actionIntroPolish.templateKeepRules':
    'Rascunho modelo (melhore; HARD RULES no fim):',
  'cover.posterLead':
    'PÔSTER / KEY ART profissional 16:9. Não é mockup de UI. Sem texto, logo nem marca.',
  'cover.titleMood':
    'Título (só clima, não escreva na imagem): {{title}}.',
  'cover.styleBible': 'Bíblia de estilo: {{style}}',
  'cover.extraDir': 'Direção extra: {{idea}}',
  'cover.establishing':
    'Plano de estabelecimento evocativo para capa da biblioteca.',
  'cover.medium': 'Respeite o medium; silhueta forte.',
  'cover.editPrefix':
    'IMAGE EDIT: nova composição de pôster. Mantenha identidade/clima. ',
  'cover.label': 'Capa da história',
  'costumeFill.system':
    'Você é figurinista. Só JSON compacto. Se houver imagem, descreva ESSE look com fidelidade.',
  'costumeFill.idea': 'Ideia: {{idea}}',
  'costumeFill.polish': 'Polir o rascunho de figurino.',
  'costumeFill.required':
    'Chaves: name, description, artStyle, hardRules. Faltar = inválido.',
  'costumeFill.fallbackName': 'Look',
  'segment.entireStory': 'Toda a história (todas as cenas)',
  'segment.noStory': 'Nenhuma história (só ficha do personagem)'
})

extra.ru = fromEn({
  'common.rules': 'Правила:',
  'common.none': '(нет)',
  'intro.soul': 'soul.md (источник игры / личности):\n{{soul}}',
  'intro.matchBible': '(следовать библии персонажа)',
  'invent.sources':
    'Источники истины по порядку: (1) идея/запрос, (2) форма, (3) дополнения только если они ЕСТЬ в этом промпте, (4) приложенное фото.',
  'invent.create':
    'Режим создания: свободно додумай из идеи/фото; не оставляй обязательные ключи пустыми.',
  'invent.improve':
    'Режим улучшения: шлифуй черновик; не меняй личность без просьбы.',
  'invent.noImport':
    'НЕ импортируй личность, сюжет, погоду, профессию, место, эпоху или стиль из того, чего нет в промпте.',
  'invent.storyBlock':
    'Блок истории/стиля — только для непрерывности; не перекрывай явную идею.',
  'character.keysLead': 'ТОЛЬКО один JSON с ключами: {{keys}}',
  'character.ruleSpoken':
    'spokenLanguages: массив BCP-47 языков, на которых ГОВОРИТ. [] если нем.',
  'character.ruleIdentity': 'Одна и та же личность на листах и в видео.',
  'character.fallbackPersonality': 'тёплое ясное присутствие',
  'character.fallbackManner': 'естественные микродвижения',
  'character.fallbackVoice': 'ясный голос',
  'scene.keysLead': 'ТОЛЬКО один JSON с ключами: {{keys}}',
  'scene.suggestLead':
    'Предложи готовую ЛОКАЦИЮ как сцену № {{n}} для «{{title}}».',
  'scene.suggestPlotFocus': 'Фокус сюжета: {{label}}',
  'scene.suggestStyle': 'Стиль: {{style}}',
  'scene.suggestExisting': 'Уже есть локации: {{titles}}',
  'scene.suggestChars': 'Персонажи (контекст):',
  'scene.suggestProps': 'Реквизит (контекст):',
  'scene.suggestSegment': 'Детали выбранного куска:',
  'scene.suggestBeats': 'Сцены / биты:',
  'scene.suggestClosing':
    'Верни полный JSON сцены. Сделай отдельное переиспользуемое место.',
  'scene.fallbackName': 'Локация',
  'scene.fallbackMood': 'кинематографичная атмосфера',
  'scene.fallbackLighting': 'как на кадре',
  'scene.fallbackCamera': 'мягкий установочный наезд или медленный панорама',
  'scene.ideaFromImage':
    'Заполни полный профиль локации по приложенному фото.',
  'scene.polishIdea': 'Отшлифовать',
  'prop.keysLead': 'ТОЛЬКО один JSON с ключами: {{keys}}',
  'action.fieldsLead': 'Поля: {{keys}}.',
  'soul.system':
    'Ты пишешь production soul.md. Только полный markdown. Уважай spokenLanguages. Язык интерфейса.',
  'soul.improveMode':
    'РЕЖИМ УЛУЧШЕНИЯ: объедини профиль + существующий soul в полный soul.md.',
  'soul.createMode':
    'Напиши полный soul.md по этому профилю (не подменяй человека):',
  'soul.profileFields': 'Поля профиля:',
  'soul.existing': 'Существующий soul.md (слить; не выбрасывай полезное):',
  'soul.userRequest': 'Запрос: {{request}}',
  'soul.extraContext': 'Доп. контекст (если полезно; профиль важнее):',
  'soul.returnOnly': 'Верни только markdown soul.md.',
  'wardrobe.system':
    'Ты консультант по костюмам. Один JSON. artStyle из: {{styleIds}}. Конкретные ткани и силуэт. Не эротизируй несовершеннолетних.',
  'wardrobe.improveMode':
    'РЕЖИМ УЛУЧШЕНИЯ / ПРЕДЛОЖЕНИЯ: используй ВСЕ поля и сюжет.',
  'wardrobe.characterForm': 'Персонаж (полная форма):',
  'wardrobe.soulExcerpt': 'Отрывок soul.md:\n{{soul}}',
  'wardrobe.userRequest': 'Запрос: {{request}}',
  'wardrobe.storyContext':
    'Производственный контекст (если дан; не выдумывай другой мир):',
  'wardrobe.style': 'стиль: {{style}}',
  'wardrobe.segment': 'Выбранный кусок: {{label}}',
  'wardrobe.sceneContext': 'Сцена / бит:',
  'wardrobe.noScenes': '(сцен ещё нет)',
  'wardrobe.proposeNew': 'Предложи НОВЫЙ образ под сюжет (не дублируй).',
  'fill.system':
    'Ты заполняешь пустые поля. JSON РОВНО с ключами: {{keys}}. Каждое значение — непустая строка. Не массив.',
  'fill.userPartial': 'Частичный профиль (не противоречь):',
  'fill.userOnly': 'Заполни ТОЛЬКО эти ключи: {{keys}}.',
  'fill.userReturn': 'JSON только с этими ключами; значения непустые.',
  'imageGen.multiRef':
    'Ещё {{n}} референсов: первый — база; держи личность во всех.',
  'residual.sceneLink': 'Сцена {{n}}: {{short}}',
  'residual.beatSegment': 'Бит {{n}} · {{who}}{{tail}}',
  'residual.unknown': 'Не указано',
  'residual.story': 'История',
  'vision.preamble':
    'Приложен кадр. Заполни ВСЕ поля этого {{what}} главным образом ПО КАРТИНКЕ.',
  'vision.character':
    'личность (имя, внешность, костюм, возраст, пол, теги)',
  'vision.scene': 'локация (название, описание, свет, настроение, декорации, теги)',
  'vision.prop': 'реквизит (имя, описание, материал, размер, состояние, теги)',
  'vision.action': 'действие (имя, описание, темп, намерение, камера, теги)',
  'vision.costume': 'костюм (имя, полное описание)',
  'still.revision': 'ПРАВКА ПОЛЬЗОВАТЕЛЯ ДЛЯ ЭТОГО КАДРА (обязательно): {{notes}}',
  'still.regenTask':
    'ЗАДАЧА: перепиши режиссёрский image-to-video промпт и оставь его пригодным как бриф кейфрейма.',
  'still.userImprove': 'ЗАПРОС НА УЛУЧШЕНИЕ:\n{{notes}}',
  'still.currentPrompt': 'Текущий профессиональный промпт:',
  'still.hardRules': 'HARD RULES (в конце; не ослабляй):',
  'mediaGen.writeOne':
    'Напиши ОДИН финальный промпт изображения для кадра короткой драмы.',
  'mediaGen.returnOnly': 'ТОЛЬКО текст промпта — без markdown.',
  'mediaGen.singleComposite': 'Опиши ОДИН составной кадр.',
  'mediaGen.lockRefs':
    'Приложенные кадры — визуальная правда (порядок Ref#). Не выдумывай другого человека, магазин или предмет.',
  'mediaGen.videoSystem':
    'Ты пишешь режиссёрские image-to-video промпты.',
  'mediaGen.videoMerge': 'Слей материалы в ОДИН видеопромпт.',
  'mediaGen.videoInclude':
    'Включи: замок личности, камеру, игру/реплики, ритм, свет.',
  'mediaGen.videoFacts': 'Только факты из материалов и seed. Без Demo.',
  'mediaGen.videoNoSwap':
    'При референсах не меняй актёра, локацию и реквизит.',
  'mediaGen.videoHardRules': 'HARD RULES в конце, если есть.',
  'mediaGen.imageSystem': 'Ты режиссёр промптов изображений.',
  'mediaGen.imageMergeStills':
    'Слей материалы и кадры в ОДИН промпт изображения.',
  'mediaGen.imageMergeText': 'Слей тексты в ОДИН промпт изображения.',
  'mediaGen.imagePriority':
    'Приоритет: лица/костюмы/места/реквизит с картинок.',
  'mediaGen.imageNoSwap':
    'Не подменяй другой знаменитостью или чужим сетом, если есть кадры каста.',
  'mediaGen.imageFacts': 'Только факты из материалов и seed.',
  'mediaGen.imageLayout': 'Если мультипанель — точное число клеток.',
  'mediaGen.imagePackage':
    'Если есть LAYOUT, промпт ДОЛЖЕН точно его исполнить.',
  'mediaGen.imageHardRules': 'HARD RULES в конце, если есть.',
  'mediaGen.directorFallback':
    'КАРТИНКА-В-ВИДЕО: оживи этот кейфрейм. Замок личности, костюма, декора и кадра.',
  'mediaGen.directorFallbackCam':
    'Камера и игра ясные; без титров и водяных знаков.',
  'charIntro.task':
    'КАРТИНКА-В-ВИДЕО: та же личность — короткое самопредставление.',
  'charIntro.identityLock':
    'ЗАМОК ЛИЧНОСТИ: то же лицо, волосы, тело, возраст, костюм и цвета.',
  'charIntro.personality': 'Характер / вайб: {{personality}}.',
  'charIntro.backstory': 'Предыстория: {{backstory}}.',
  'charIntro.relationships': 'Связи: {{relationships}}.',
  'charIntro.soul': 'Отрывок soul (источник игры): {{soul}}',
  'charIntro.performance':
    'Игра: мягкий наезд или handheld; взгляд в камеру; {{manner}}.',
  'charIntro.speech':
    'Речь: рот двигается как при коротком представлении; голос: {{voice}}.',
  'charIntro.beat':
    'Спокойный idle → улыбка или кивок → короткий жест → hold.',
  'charIntro.lighting':
    'Свет как на кадре; без текста, логотипов и лишних людей.',
  'charIntro.duration': 'Подходит для 6–10 с самопредставления.',
  'sceneIntro.task':
    'КАРТИНКА-В-ВИДЕО: то же место как установочный кадр.',
  'sceneIntro.spaceLock':
    'ЗАМОК ПРОСТРАНСТВА: та же архитектура, материалы, вывески, план и цвет.',
  'sceneIntro.name': 'Название места: {{name}}.',
  'sceneIntro.place': 'Описание: {{place}}.',
  'sceneIntro.spaceType': 'Тип пространства: {{type}}.',
  'sceneIntro.time': 'Время суток: {{time}}.',
  'sceneIntro.weather': 'Погода: {{weather}}.',
  'sceneIntro.moodLight': 'Настроение: {{mood}}. Свет: {{lighting}}.',
  'sceneIntro.palette': 'Палитра: {{palette}}.',
  'sceneIntro.setDressing': 'Декорации: {{set}}.',
  'sceneIntro.tags': 'Визуальные теги: {{tags}}.',
  'sceneIntro.art': 'Стиль: {{art}}.',
  'sceneIntro.ambient': 'Атмосфера (без UI-текста): {{sound}}.',
  'sceneIntro.scriptCue': 'Подсказка бита (только атмосфера): {{cue}}.',
  'sceneIntro.camera':
    'Камера: {{camera}}; пустой сет предпочтителен; без новых лиц и логотипов.',
  'sceneIntro.beat': 'Установка → тонкая жизнь среды → hold.',
  'sceneIntro.duration': 'Подходит для 6–10 с интро локации.',
  'propIntro.task':
    'КАРТИНКА-В-ВИДЕО: тот же реквизит как геройский интро.',
  'propIntro.objectLock':
    'ЗАМОК ОБЪЕКТА: тот же силуэт, материалы, цвета, гравировка и износ.',
  'propIntro.name': 'Название: {{name}}.',
  'propIntro.look': 'Вид: {{look}}.',
  'propIntro.material': 'Материал: {{material}}.',
  'propIntro.size': 'Размер: {{size}}.',
  'propIntro.condition': 'Состояние: {{condition}}.',
  'propIntro.tags': 'Теги: {{tags}}.',
  'propIntro.art': 'Стиль: {{art}}.',
  'propIntro.camera':
    'Мягкая орбита или медленный наезд на чистом столе; свет как на кадре.',
  'propIntro.beat': 'Hold → блик / микроповорот → hold.',
  'propIntro.noHands':
    'Без новых рук и лиц, если их нет на кадре; без текста и лишнего реквизита.',
  'propIntro.duration': 'Подходит для 6–10 с интро реквизита.',
  'costumeIntro.task':
    'КАРТИНКА-В-ВИДЕО: тот же образ как интро костюма.',
  'costumeIntro.wardrobeLock':
    'ЗАМОК КОСТЮМА: тот же силуэт, ткани, цвета, слои и аксессуары.',
  'costumeIntro.identityOrProduct':
    'Если человек: замок лица/тела; если манекен/раскладка — продуктовый кадр.',
  'costumeIntro.name': 'Имя образа: {{name}}.',
  'costumeIntro.desc': 'Костюм: {{look}}.',
  'costumeIntro.art': 'Стиль: {{art}}.',
  'costumeIntro.camera': 'Мягкий наезд или орбита; модный свет как на кадре.',
  'costumeIntro.beat': 'Hold → драпировка / блик фурнитуры → hold.',
  'costumeIntro.forbid': 'Без новых лиц, текста, логотипов и эропозы.',
  'costumeIntro.duration': 'Подходит для 6–10 с интро костюма.',
  'costumeIntro.fallbackName': 'Образ',
  'actionIntro.lead': 'Демо движения «{{name}}».',
  'actionIntro.intention': 'Намерение: {{intention}}',
  'actionIntro.body': 'Тело/темп: {{body}}',
  'actionIntro.camera': 'Камера: {{camera}}',
  'actionIntro.closing':
    'Плавное кинодвижение, без текста; следуй кейфрейму.',
  'sceneIntroPolish.task': 'ЗАДАЧА: интро локации (картинка-в-видео).',
  'sceneIntroPolish.hasRef':
    'Кадр локации приложен — замок ПРОСТРАНСТВЕННОЙ личности.',
  'sceneIntroPolish.noRef': 'Нет кадра; замок к библии места.',
  'sceneIntroPolish.dossier': 'Досье локации:',
  'sceneIntroPolish.scriptCue': 'подсказка сценария (только атмосфера):\n{{script}}',
  'sceneIntroPolish.emptySet':
    'Пустой сет; без новых лиц. Без текста и логотипов.',
  'propIntroPolish.task': 'ЗАДАЧА: геройское интро реквизита (картинка-в-видео).',
  'propIntroPolish.hasRef': 'Кадр реквизита приложен — замок ОБЪЕКТА.',
  'propIntroPolish.noRef': 'Нет кадра; замок к досье.',
  'propIntroPolish.dossier': 'Досье реквизита:',
  'propIntroPolish.noHands': 'Без новых рук и лиц. Без текста и логотипов.',
  'costumeIntroPolish.task': 'ЗАДАЧА: интро костюма (картинка-в-видео).',
  'costumeIntroPolish.hasRef':
    'Кадр есть — человек: личность+костюм; манекен: силуэт и материалы.',
  'costumeIntroPolish.noRef': 'Нет кадра; замок к описанию.',
  'costumeIntroPolish.dossier': 'Досье костюма:',
  'costumeIntroPolish.fabric':
    'Тонкая драпировка; без новых лиц и текста.',
  'actionIntroPolish.task':
    'ЗАДАЧА: интро гайда движения (картинка-в-видео).',
  'actionIntroPolish.hasRef':
    'Кадр есть — замок актёрской личности к этому кадру.',
  'actionIntroPolish.templateKeepRules':
    'Черновик шаблона (шлифуй; HARD RULES в конце):',
  'cover.posterLead':
    'Профессиональный ПОСТЕР / KEY ART 16:9. Не UI-макет. Без текста, логотипа и водяного знака.',
  'cover.titleMood':
    'Название (только настроение, не пиши на кадре): {{title}}.',
  'cover.styleBible': 'Стиль-библия: {{style}}',
  'cover.extraDir': 'Доп. направление: {{idea}}',
  'cover.establishing':
    'Установочный кадр настроения для обложки библиотеки.',
  'cover.medium': 'Соблюди medium; сильный силуэт.',
  'cover.editPrefix':
    'IMAGE EDIT: новая композиция постера. Сохрани личность/настроение. ',
  'cover.label': 'Обложка истории',
  'costumeFill.system':
    'Ты художник по костюмам. Только компактный JSON. Если есть фото — опиши ИМЕННО этот наряд.',
  'costumeFill.idea': 'Идея: {{idea}}',
  'costumeFill.polish': 'Отшлифуй черновик костюма.',
  'costumeFill.required':
    'Ключи: name, description, artStyle, hardRules. Пропуск = недействительно.',
  'costumeFill.fallbackName': 'Образ',
  'segment.entireStory': 'Вся история (все сцены)',
  'segment.noStory': 'История не выбрана (только карточка персонажа)'
})

extra.hi = fromEn({
  'common.rules': 'नियम:',
  'common.none': '(कोई नहीं)',
  'intro.soul': 'soul.md (अभिनय/पहचान स्रोत):\n{{soul}}',
  'intro.matchBible': '(पात्र बाइबल की भाषा अपनाओ)',
  'invent.sources':
    'सत्य स्रोत क्रम से: (1) विचार/अनुरोध, (2) फ़ॉर्म, (3) अतिरिक्त केवल यदि इसी प्रॉम्प्ट में हों, (4) संलग्न चित्र।',
  'invent.create':
    'रचना मोड: विचार/चित्र से स्वतंत्र भरें; अनिवार्य कुंजी खाली न छोड़ें।',
  'invent.improve':
    'सुधार मोड: ड्राफ्ट संगत रखें; बिना अनुरोध पहचान न बदलें।',
  'invent.noImport':
    'जो इस प्रॉम्प्ट में नहीं है उसे न लाएँ — पहचान, कथानक, मौसम, पेशा, स्थान, युग, शैली।',
  'invent.storyBlock':
    'कहानी/शैली ब्लॉक केवल निरंतरता के लिए; स्पष्ट विचार न ढकें।',
  'character.keysLead': 'केवल एक JSON, कुंजियाँ: {{keys}}',
  'character.ruleSpoken':
    'spokenLanguages: बोली जाने वाली भाषाओं की BCP-47 ऐरे। मौन हो तो []।',
  'character.ruleIdentity': 'शीट और वीडियो में पहचान एक जैसी रखें।',
  'character.fallbackPersonality': 'गर्म, स्पष्ट उपस्थिति',
  'character.fallbackManner': 'स्वाभाविक सूक्ष्म हावभाव',
  'character.fallbackVoice': 'स्पष्ट आवाज़',
  'scene.keysLead': 'केवल एक JSON, कुंजियाँ: {{keys}}',
  'scene.suggestLead':
    'कहानी «{{title}}» के दृश्य #{{n}} के लिए तैयार स्थान सुझाएँ।',
  'scene.suggestPlotFocus': 'कथानक केंद्र: {{label}}',
  'scene.suggestStyle': 'शैली: {{style}}',
  'scene.suggestExisting': 'पहले से स्थान: {{titles}}',
  'scene.suggestChars': 'पात्र (संदर्भ):',
  'scene.suggestProps': 'प्रॉप्स (संदर्भ):',
  'scene.suggestSegment': 'चयनित खंड विस्तार:',
  'scene.suggestBeats': 'दृश्य / बीट:',
  'scene.suggestClosing':
    'पूरा दृश्य JSON दें। अलग, पुनः उपयोग योग्य स्थान बनाएँ।',
  'scene.fallbackName': 'स्थान',
  'scene.fallbackMood': 'सिनेमाई माहौल',
  'scene.fallbackLighting': 'स्टिल से मेल',
  'scene.fallbackCamera': 'हल्की स्थापना पुश-इन या धीमी पैन',
  'scene.ideaFromImage': 'संलग्न फ़ोटो से पूरा स्थान प्रोफ़ाइल भरें।',
  'scene.polishIdea': 'निखारें',
  'prop.keysLead': 'केवल एक JSON, कुंजियाँ: {{keys}}',
  'action.fieldsLead': 'फ़ील्ड: {{keys}}।',
  'soul.system':
    'आप production soul.md लिखते हैं। केवल पूरा मार्कडाउन। spokenLanguages का सम्मान। इंटरफ़ेस भाषा।',
  'soul.improveMode':
    'सुधार मोड: प्रोफ़ाइल + मौजूदा soul मिलाकर पूरा soul.md दें।',
  'soul.createMode':
    'इस प्रोफ़ाइल से पूरा soul.md लिखें (दूसरा व्यक्ति न बनाएँ):',
  'soul.profileFields': 'प्रोफ़ाइल फ़ील्ड:',
  'soul.existing': 'मौजूदा soul.md (मिलाएँ; उपयोगी विस्तार न फेंकें):',
  'soul.userRequest': 'अनुरोध: {{request}}',
  'soul.extraContext': 'अतिरिक्त संदर्भ (लाभ हो तो; प्रोफ़ाइल जीते):',
  'soul.returnOnly': 'केवल soul.md मार्कडाउन लौटाएँ।',
  'wardrobe.system':
    'आप कॉस्ट्यूम सलाहकार हैं। एक JSON। artStyle इनमें से: {{styleIds}}। ठोस कपड़ा/सिल्हूट। नाबालिग का यौनीकरण वर्जित।',
  'wardrobe.improveMode':
    'सुधार / सुझाव: नीचे के सभी फ़ील्ड और कथानक इस्तेमाल करें।',
  'wardrobe.characterForm': 'पात्र (पूरा फ़ॉर्म):',
  'wardrobe.soulExcerpt': 'soul.md अंश:\n{{soul}}',
  'wardrobe.userRequest': 'अनुरोध: {{request}}',
  'wardrobe.storyContext':
    'निर्माण संदर्भ (हो तो उपयोग; दूसरा संसार न बनाएँ):',
  'wardrobe.style': 'शैली: {{style}}',
  'wardrobe.segment': 'चयनित खंड: {{label}}',
  'wardrobe.sceneContext': 'दृश्य / बीट:',
  'wardrobe.noScenes': '(अभी दृश्य नहीं)',
  'wardrobe.proposeNew': 'कथानक से मेल खाता नया लुक दें (डुप्लिकेट नहीं)।',
  'fill.system':
    'खाली फ़ील्ड भरें। ठीक इन कुंजियों का JSON: {{keys}}। प्रत्येक मान गैर-खाली स्ट्रिंग। ऐरे नहीं।',
  'fill.userPartial': 'आंशिक प्रोफ़ाइल (विरोध न करें):',
  'fill.userOnly': 'केवल ये कुंजियाँ भरें: {{keys}}।',
  'fill.userReturn': 'केवल उन्हीं कुंजियों का JSON; मान खाली न हों।',
  'imageGen.multiRef':
    '{{n}} और स्टिल: पहला आधार है; सभी में पहचान एक जैसी रखें।',
  'residual.sceneLink': 'दृश्य {{n}}: {{short}}',
  'residual.beatSegment': 'बीट {{n}} · {{who}}{{tail}}',
  'residual.unknown': 'अज्ञात',
  'residual.story': 'कहानी',
  'vision.preamble':
    'संदर्भ स्टिल लगा है। इस {{what}} के सभी फ़ील्ड मुख्यतः चित्र से भरें।',
  'vision.character': 'पहचान (नाम, रूप, पोशाक, उम्र, लिंग, टैग)',
  'vision.scene': 'स्थान (शीर्षक, वर्णन, रोशनी, मूड, सेट, टैग)',
  'vision.prop': 'प्रॉप (नाम, वर्णन, सामग्री, आकार, स्थिति, टैग)',
  'vision.action': 'क्रिया (नाम, वर्णन, लय, इरादा, कैमरा, टैग)',
  'vision.costume': 'पोशाक (नाम, पूरा वर्णन)',
  'still.revision': 'इस स्टिल के लिए उपयोगकर्ता सुधार (अनिवार्य): {{notes}}',
  'still.regenTask':
    'कार्य: image-to-video निर्देशक प्रॉम्प्ट संशोधित करें और कीफ़्रेम ब्रीफ़ के रूप में रखें।',
  'still.userImprove': 'सुधार अनुरोध:\n{{notes}}',
  'still.currentPrompt': 'वर्तमान पेशेवर प्रॉम्प्ट:',
  'still.hardRules': 'HARD RULES (अंत में रखें; कमज़ोर न करें):',
  'mediaGen.writeOne': 'शॉर्ट-ड्रामा स्टिल के लिए एक अंतिम इमेज प्रॉम्प्ट लिखें।',
  'mediaGen.returnOnly': 'केवल प्रॉम्प्ट पाठ — मार्कडाउन नहीं।',
  'mediaGen.singleComposite': 'एक ही संयुक्त छवि का वर्णन।',
  'mediaGen.lockRefs':
    'संलग्न चित्र Ref# क्रम में सत्य हैं। दूसरा व्यक्ति/दुकान/वस्तु न बनाएँ।',
  'mediaGen.videoSystem': 'आप image-to-video निर्देशक प्रॉम्प्ट लिखते हैं।',
  'mediaGen.videoMerge': 'सामग्री को एक वीडियो प्रॉम्प्ट में मिलाएँ।',
  'mediaGen.videoInclude':
    'शामिल करें: पहचान लॉक, कैमरा, अभिनय/संवाद, लय, रोशनी।',
  'mediaGen.videoFacts': 'केवल सामग्री और seed के तथ्य। Demo नहीं।',
  'mediaGen.videoNoSwap':
    'रेफ़ हों तो अभिनेता, स्थान या प्रॉप न बदलें।',
  'mediaGen.videoHardRules': 'HARD RULES हों तो अंत में।',
  'mediaGen.imageSystem': 'आप इमेज प्रॉम्प्ट निर्देशक हैं।',
  'mediaGen.imageMergeStills':
    'चयनित सामग्री और स्टिल को एक इमेज प्रॉम्प्ट बनाएँ।',
  'mediaGen.imageMergeText': 'चयनित पाठ को एक इमेज प्रॉम्प्ट बनाएँ।',
  'mediaGen.imagePriority':
    'सर्वोच्च: चित्रों के चेहरे/पोशाक/स्थान/प्रॉप।',
  'mediaGen.imageNoSwap':
    'कास्ट स्टिल हों तो कोई और सेलिब्रिटी या सेट न लगाएँ।',
  'mediaGen.imageFacts': 'केवल सामग्री और seed के तथ्य।',
  'mediaGen.imageLayout': 'मल्टी-पैनल हो तो सही पैनल संख्या रखें।',
  'mediaGen.imagePackage':
    'LAYOUT हो तो वही लेआउट सख्ती से लागू करें।',
  'mediaGen.imageHardRules': 'HARD RULES हों तो अंत में।',
  'mediaGen.directorFallback':
    'चित्र-से-वीडियो: इस कीफ़्रेम को चलाएँ। पहचान, पोशाक, सेट, फ़्रेमिंग लॉक।',
  'mediaGen.directorFallbackCam':
    'कैमरा और अभिनय स्पष्ट; कैप्शन/वॉटरमार्क नहीं।',
  'charIntro.task':
    'चित्र-से-वीडियो: उसी व्यक्ति का छोटा आत्म-परिचय।',
  'charIntro.identityLock':
    'पहचान लॉक: वही चेहरा, बाल, शरीर, उम्र, पोशाक, रंग।',
  'charIntro.personality': 'स्वभाव: {{personality}}।',
  'charIntro.backstory': 'पृष्ठभूमि: {{backstory}}।',
  'charIntro.relationships': 'संबंध: {{relationships}}।',
  'charIntro.soul': 'Soul अंश (अभिनय स्रोत): {{soul}}',
  'charIntro.performance':
    'अभिनय: हल्की पुश-इन या हैंडहेल्ड; कैमरा देखें; {{manner}}।',
  'charIntro.speech':
    'बोल: मुँह छोटे परिचय जैसा हिले; आवाज़: {{voice}}।',
  'charIntro.beat': 'स्वाभाविक स्थिर → मुस्कान/सिर हिलाना → छोटा इशारा → hold।',
  'charIntro.lighting':
    'स्टिल जैसी रोशनी; पाठ, लोगो, अतिरिक्त लोग नहीं।',
  'charIntro.duration': '6–10 सेकंड के परिचय के लिए।',
  'sceneIntro.task':
    'चित्र-से-वीडियो: उसी स्थान का स्थापना क्लिप।',
  'sceneIntro.spaceLock':
    'स्थान लॉक: वही वास्तुकला, सामग्री, साइन, लेआउट, रंग।',
  'sceneIntro.name': 'स्थान नाम: {{name}}।',
  'sceneIntro.place': 'वर्णन: {{place}}।',
  'sceneIntro.spaceType': 'स्थान प्रकार: {{type}}।',
  'sceneIntro.time': 'समय: {{time}}।',
  'sceneIntro.weather': 'मौसम: {{weather}}।',
  'sceneIntro.moodLight': 'मूड: {{mood}}। रोशनी: {{lighting}}।',
  'sceneIntro.palette': 'पैलेट: {{palette}}।',
  'sceneIntro.setDressing': 'सेट: {{set}}।',
  'sceneIntro.tags': 'विज़ुअल टैग: {{tags}}।',
  'sceneIntro.art': 'शैली: {{art}}।',
  'sceneIntro.ambient': 'माहौल (UI पाठ नहीं): {{sound}}।',
  'sceneIntro.scriptCue': 'बीट संकेत (केवल माहौल): {{cue}}।',
  'sceneIntro.camera':
    'कैमरा: {{camera}}; खाली सेट बेहतर; नए चेहरे/लोगो नहीं।',
  'sceneIntro.beat': 'स्थापना → सूक्ष्म पर्यावरण जीवन → hold।',
  'sceneIntro.duration': '6–10 सेकंड स्थान परिचय।',
  'propIntro.task':
    'चित्र-से-वीडियो: उसी प्रॉप का हीरो परिचय।',
  'propIntro.objectLock':
    'वस्तु लॉक: वही सिल्हूट, सामग्री, रंग, नक्काशी, घिसाव।',
  'propIntro.name': 'नाम: {{name}}।',
  'propIntro.look': 'रूप: {{look}}।',
  'propIntro.material': 'सामग्री: {{material}}।',
  'propIntro.size': 'आकार: {{size}}।',
  'propIntro.condition': 'स्थिति: {{condition}}।',
  'propIntro.tags': 'टैग: {{tags}}।',
  'propIntro.art': 'शैली: {{art}}।',
  'propIntro.camera':
    'साफ़ मेज़ पर हल्की परिक्रमा या धीमी पुश-इन।',
  'propIntro.beat': 'Hold → चमक / सूक्ष्म घुमाव → hold।',
  'propIntro.noHands':
    'स्टिल में न हों तो हाथ/चेहरे नहीं; पाठ/अतिरिक्त प्रॉप नहीं।',
  'propIntro.duration': '6–10 सेकंड प्रॉप परिचय।',
  'costumeIntro.task':
    'चित्र-से-वीडियो: उसी लुक का कॉस्ट्यूम परिचय।',
  'costumeIntro.wardrobeLock':
    'पोशाक लॉक: वही सिल्हूट, कपड़ा, रंग, परतें, सहायक।',
  'costumeIntro.identityOrProduct':
    'व्यक्ति हो तो चेहरा/शरीर लॉक; मैनक्विन/फ़्लैट-ले तो उत्पाद फ़्रेम।',
  'costumeIntro.name': 'लुक नाम: {{name}}।',
  'costumeIntro.desc': 'पोशाक: {{look}}।',
  'costumeIntro.art': 'शैली: {{art}}।',
  'costumeIntro.camera': 'हल्की पुश-इन या परिक्रमा; स्टिल जैसी फ़ैशन रोशनी।',
  'costumeIntro.beat': 'Hold → कपड़े की लटकन / हार्डवेयर चमक → hold।',
  'costumeIntro.forbid': 'नए चेहरे, पाठ, लोगो, कामुक पोज़ नहीं।',
  'costumeIntro.duration': '6–10 सेकंड पोशाक परिचय।',
  'costumeIntro.fallbackName': 'लुक',
  'actionIntro.lead': 'क्रिया डेमो «{{name}}».',
  'actionIntro.intention': 'इरादा: {{intention}}',
  'actionIntro.body': 'शरीर/लय: {{body}}',
  'actionIntro.camera': 'कैमरा: {{camera}}',
  'actionIntro.closing':
    'धाराप्रवाह सिनेमाई गति, बिना पाठ; कीफ़्रेम का पालन।',
  'sceneIntroPolish.task': 'कार्य: स्थान परिचय (चित्र-से-वीडियो)।',
  'sceneIntroPolish.hasRef': 'स्थान स्टिल लगा — स्थान पहचान लॉक।',
  'sceneIntroPolish.noRef': 'स्टिल नहीं; स्थान बाइबल पर लॉक।',
  'sceneIntroPolish.dossier': 'स्थान फ़ाइल:',
  'sceneIntroPolish.scriptCue': 'स्क्रिप्ट संकेत (केवल माहौल):\n{{script}}',
  'sceneIntroPolish.emptySet':
    'खाली सेट; नए चेहरे नहीं। पाठ/लोगो नहीं।',
  'propIntroPolish.task': 'कार्य: प्रॉप हीरो परिचय (चित्र-से-वीडियो)।',
  'propIntroPolish.hasRef': 'प्रॉप स्टिल लगा — वस्तु पहचान लॉक।',
  'propIntroPolish.noRef': 'स्टिल नहीं; प्रॉप फ़ाइल पर लॉक।',
  'propIntroPolish.dossier': 'प्रॉप फ़ाइल:',
  'propIntroPolish.noHands': 'नए हाथ/चेहरे नहीं। पाठ/लोगो नहीं।',
  'costumeIntroPolish.task': 'कार्य: पोशाक परिचय (चित्र-से-वीडियो)।',
  'costumeIntroPolish.hasRef':
    'स्टिल लगा — व्यक्ति: पहचान+पोशाक; मैनक्विन: सिल्हूट और सामग्री।',
  'costumeIntroPolish.noRef': 'स्टिल नहीं; वर्णन पर लॉक।',
  'costumeIntroPolish.dossier': 'पोशाक फ़ाइल:',
  'costumeIntroPolish.fabric':
    'हल्की लटकन; नए चेहरे/पाठ नहीं।',
  'actionIntroPolish.task': 'कार्य: गति-गाइड परिचय (चित्र-से-वीडियो)।',
  'actionIntroPolish.hasRef':
    'स्टिल लगा — अभिनय पहचान उस फ़्रेम पर लॉक।',
  'actionIntroPolish.templateKeepRules':
    'टेम्पलेट ड्राफ्ट (निखारें; HARD RULES अंत में):',
  'cover.posterLead':
    'पेशेवर शॉर्ट-ड्रामा पोस्टर / KEY ART 16:9। UI मॉकअप नहीं। पाठ/लोगो/वॉटरमार्क नहीं।',
  'cover.titleMood':
    'शीर्षक (केवल मूड, चित्र पर अक्षर न लिखें): {{title}}।',
  'cover.styleBible': 'शैली बाइबल: {{style}}',
  'cover.extraDir': 'अतिरिक्त दिशा: {{idea}}',
  'cover.establishing': 'पुस्तकालय कवर जैसा स्थापना मूड फ़्रेम।',
  'cover.medium': 'माध्यम का पालन; मज़बूत सिल्हूट।',
  'cover.editPrefix':
    'IMAGE EDIT: नया पोस्टर कंपोज़िशन। पहचान/मूड रखें। ',
  'cover.label': 'कहानी कवर',
  'costumeFill.system':
    'आप फ़िल्म वॉर्डरोब डिज़ाइनर हैं। केवल संक्षिप्त JSON। चित्र हो तो उसी पोशाक का ईमानदार वर्णन।',
  'costumeFill.idea': 'विचार: {{idea}}',
  'costumeFill.polish': 'पोशाक ड्राफ्ट निखारें।',
  'costumeFill.required':
    'कुंजियाँ: name, description, artStyle, hardRules। कमी = अमान्य।',
  'costumeFill.fallbackName': 'लुक',
  'segment.entireStory': 'पूरी कहानी (सभी दृश्य)',
  'segment.noStory': 'कहानी नहीं चुनी (केवल पात्र विवरण)'
})

extra.ar = fromEn({
  'common.rules': 'القواعد:',
  'common.none': '(لا شيء)',
  'intro.soul': 'soul.md (مصدر الأداء/الهوية):\n{{soul}}',
  'intro.matchBible': '(اتبع لغة إنجيل الشخصية)',
  'invent.sources':
    'مصادر الحقيقة بالترتيب: (1) الفكرة/الطلب، (2) النموذج، (3) الإضافات فقط إن وردت في هذا الأمر، (4) الصورة المرفقة.',
  'invent.create':
    'وضع الإنشاء: ابتكر بحرية من الفكرة/الصورة؛ لا تترك مفاتيح إلزامية فارغة.',
  'invent.improve':
    'وضع التحسين: لمّع المسودة؛ لا تغيّر الهوية إلا بطلب صريح.',
  'invent.noImport':
    'لا تستورد هوية أو حبكة أو طقسًا أو مهنة أو مكانًا أو عصرًا أو أسلوبًا مما ليس في هذا الأمر.',
  'invent.storyBlock':
    'كتلة القصة/الأسلوب للاستمرارية فقط؛ لا تطغَ على الفكرة الصريحة.',
  'character.keysLead': 'كائن JSON واحد فقط بالمفاتيح: {{keys}}',
  'character.ruleSpoken':
    'spokenLanguages: مصفوفة BCP-47 للغات التي يتكلمها. [] إن كان صامتًا.',
  'character.ruleIdentity': 'حافظ على الهوية عبر الألواح والفيديو.',
  'character.fallbackPersonality': 'حضور دافئ وواضح',
  'character.fallbackManner': 'إيماءات دقيقة طبيعية',
  'character.fallbackVoice': 'صوت واضح',
  'scene.keysLead': 'كائن JSON واحد فقط بالمفاتيح: {{keys}}',
  'scene.suggestLead':
    'اقترح موقعًا جاهزًا كمشهد رقم {{n}} لقصة «{{title}}».',
  'scene.suggestPlotFocus': 'بؤرة الحبكة: {{label}}',
  'scene.suggestStyle': 'الأسلوب: {{style}}',
  'scene.suggestExisting': 'مواقع موجودة: {{titles}}',
  'scene.suggestChars': 'شخصيات (سياق):',
  'scene.suggestProps': 'إكسسوارات (سياق):',
  'scene.suggestSegment': 'تفاصيل المقطع المختار:',
  'scene.suggestBeats': 'مشاهد / نبضات:',
  'scene.suggestClosing':
    'أرجع JSON المشهد كاملًا. صمّم مكانًا مستقلًا قابلًا لإعادة الاستخدام.',
  'scene.fallbackName': 'موقع',
  'scene.fallbackMood': 'جو سينمائي',
  'scene.fallbackLighting': 'يطابق اللقطة',
  'scene.fallbackCamera': 'اقتراب تأسيس لطيف أو تحريك بطيء',
  'scene.ideaFromImage': 'املأ ملف الموقع كاملًا من الصورة المرفقة.',
  'scene.polishIdea': 'لمّع',
  'prop.keysLead': 'كائن JSON واحد فقط بالمفاتيح: {{keys}}',
  'action.fieldsLead': 'الحقول: {{keys}}.',
  'soul.system':
    'تكتب soul.md للإنتاج. ماركداون كامل فقط. احترم spokenLanguages. لغة الواجهة.',
  'soul.improveMode':
    'وضع التحسين: ادمج الملف + soul القائم في soul.md كامل.',
  'soul.createMode':
    'اكتب soul.md كاملًا من هذا الملف (لا تستبدل الشخص):',
  'soul.profileFields': 'حقول الملف:',
  'soul.existing': 'soul.md القائم (ادمج؛ لا ترمِ التفصيل المفيد):',
  'soul.userRequest': 'طلب المستخدم: {{request}}',
  'soul.extraContext': 'سياق إضافي (إن نفع؛ الملف يغلب):',
  'soul.returnOnly': 'أرجع ماركداون soul.md فقط.',
  'wardrobe.system':
    'أنت مستشار أزياء. JSON واحد. artStyle من: {{styleIds}}. خامات وظل واضحة. لا تُجنّس القُصّر.',
  'wardrobe.improveMode':
    'وضع التحسين / الاقتراح: استخدم كل الحقول والسياق.',
  'wardrobe.characterForm': 'الشخصية (النموذج الكامل):',
  'wardrobe.soulExcerpt': 'مقتطف soul.md:\n{{soul}}',
  'wardrobe.userRequest': 'الطلب: {{request}}',
  'wardrobe.storyContext':
    'سياق الإنتاج (إن وُجد؛ لا تخترع عالمًا آخر):',
  'wardrobe.style': 'الأسلوب: {{style}}',
  'wardrobe.segment': 'المقطع المختار: {{label}}',
  'wardrobe.sceneContext': 'المشهد / النبضة:',
  'wardrobe.noScenes': '(لا مشاهد بعد)',
  'wardrobe.proposeNew': 'اقترح مظهرًا جديدًا يناسب الحبكة (لا تكرر).',
  'fill.system':
    'تُكمل الحقول الفارغة. JSON بهذه المفاتيح فقط: {{keys}}. كل قيمة سلسلة غير فارغة. ليست مصفوفة.',
  'fill.userPartial': 'ملف جزئي (لا تناقض):',
  'fill.userOnly': 'املأ هذه المفاتيح فقط: {{keys}}.',
  'fill.userReturn': 'JSON بتلك المفاتيح فقط؛ قيم غير فارغة.',
  'imageGen.multiRef':
    '{{n}} لقطات إضافية: الأولى هي القاعدة؛ حافظ على الهوية في الكل.',
  'residual.sceneLink': 'المشهد {{n}}: {{short}}',
  'residual.beatSegment': 'نبضة {{n}} · {{who}}{{tail}}',
  'residual.unknown': 'غير محدد',
  'residual.story': 'قصة',
  'vision.preamble':
    'لقطة مرجعية مرفقة. املأ كل حقول هذا {{what}} أساسًا من الصورة.',
  'vision.character': 'الهوية (الاسم، المظهر، الزي، العمر، الجنس، الوسوم)',
  'vision.scene': 'الموقع (العنوان، الوصف، الضوء، المزاج، الديكور، الوسوم)',
  'vision.prop': 'الإكسسوار (الاسم، الوصف، الخامة، الحجم، الحالة، الوسوم)',
  'vision.action': 'الحركة (الاسم، الوصف، الإيقاع، القصد، الكاميرا، الوسوم)',
  'vision.costume': 'الزي (الاسم، وصف كامل)',
  'still.revision': 'تحسين المستخدم لهذه اللقطة (إلزامي): {{notes}}',
  'still.regenTask':
    'المهمة: نقّح أمر المخرج image-to-video وأبقِه صالحًا كموجز إطار مفتاحي.',
  'still.userImprove': 'طلب التحسين:\n{{notes}}',
  'still.currentPrompt': 'الأمر المهني الحالي:',
  'still.hardRules': 'HARD RULES (في النهاية؛ لا تُضعفها):',
  'mediaGen.writeOne': 'اكتب أمر صورة نهائي واحد للقطة دراما قصيرة.',
  'mediaGen.returnOnly': 'نص الأمر فقط — بلا ماركداون.',
  'mediaGen.singleComposite': 'صف صورة مركّبة واحدة.',
  'mediaGen.lockRefs':
    'الصور المرفقة حقيقة بصرية بترتيب Ref#. لا تخترع شخصًا أو متجرًا أو غرضًا آخر.',
  'mediaGen.videoSystem': 'تكتب أوامر مخرج image-to-video.',
  'mediaGen.videoMerge': 'ادمج المواد في أمر فيديو واحد.',
  'mediaGen.videoInclude':
    'ضمّن: قفل الهوية، الكاميرا، الأداء/الحوار، الإيقاع، الضوء.',
  'mediaGen.videoFacts': 'حقائق المواد وseed فقط. لا Demo.',
  'mediaGen.videoNoSwap':
    'مع المراجع لا تبدّل الممثل أو الموقع أو الإكسسوار.',
  'mediaGen.videoHardRules': 'HARD RULES في النهاية إن وُجدت.',
  'mediaGen.imageSystem': 'أنت مخرج أوامر الصورة.',
  'mediaGen.imageMergeStills':
    'ادمج المواد واللقطات في أمر صورة واحد.',
  'mediaGen.imageMergeText': 'ادمج النصوص في أمر صورة واحد.',
  'mediaGen.imagePriority':
    'الأولوية: الوجوه/الأزياء/الأماكن/الإكسسوار من الصور.',
  'mediaGen.imageNoSwap':
    'لا تستبدل بمشهور أو موقع غريب إن وُجدت لقطات الطاقم.',
  'mediaGen.imageFacts': 'حقائق المواد وseed فقط.',
  'mediaGen.imageLayout': 'إن تعددت الألواح فاحفظ العدد الدقيق.',
  'mediaGen.imagePackage':
    'إن وُجد LAYOUT يجب تنفيذ ذلك التخطيط حرفيًا.',
  'mediaGen.imageHardRules': 'HARD RULES في النهاية إن وُجدت.',
  'mediaGen.directorFallback':
    'صورة-إلى-فيديو: حرّك هذا الإطار. اقفل الهوية والزي والموقع والإطار.',
  'mediaGen.directorFallbackCam':
    'كاميرا وأداء واضحان؛ بلا ترجمة أو علامة مائية.',
  'charIntro.task':
    'صورة-إلى-فيديو: حرّك الشخص نفسه في تقديم قصير.',
  'charIntro.identityLock':
    'قفل الهوية: الوجه والشعر والجسد والعمر والزي والألوان نفسها.',
  'charIntro.personality': 'الشخصية / الحضور: {{personality}}.',
  'charIntro.backstory': 'الخلفية: {{backstory}}.',
  'charIntro.relationships': 'العلاقات: {{relationships}}.',
  'charIntro.soul': 'مقتطف soul (مصدر الأداء): {{soul}}',
  'charIntro.performance':
    'الأداء: اقتراب لطيف أو كاميرا محمولة؛ ينظر إلى العدسة؛ {{manner}}.',
  'charIntro.speech':
    'الكلام: الفم يتحرك كتقديم قصير؛ الصوت: {{voice}}.',
  'charIntro.beat': 'ثبات طبيعي → ابتسامة أو إيماءة → إشارة قصيرة → ثبات.',
  'charIntro.lighting':
    'ضوء يطابق اللقطة؛ بلا نص أو شعار أو أشخاص إضافيين.',
  'charIntro.duration': 'يناسب تقديمًا من 6–10 ثوانٍ.',
  'sceneIntro.task':
    'صورة-إلى-فيديو: حرّك المكان نفسه كلقطة تأسيس.',
  'sceneIntro.spaceLock':
    'قفل المكان: العمارة والخامات واللافتات والمخطط واللون نفسها.',
  'sceneIntro.name': 'اسم المكان: {{name}}.',
  'sceneIntro.place': 'الوصف: {{place}}.',
  'sceneIntro.spaceType': 'نوع الفضاء: {{type}}.',
  'sceneIntro.time': 'وقت اليوم: {{time}}.',
  'sceneIntro.weather': 'الطقس: {{weather}}.',
  'sceneIntro.moodLight': 'المزاج: {{mood}}. الإضاءة: {{lighting}}.',
  'sceneIntro.palette': 'لوحة الألوان: {{palette}}.',
  'sceneIntro.setDressing': 'الديكور: {{set}}.',
  'sceneIntro.tags': 'وسوم بصرية: {{tags}}.',
  'sceneIntro.art': 'الأسلوب: {{art}}.',
  'sceneIntro.ambient': 'الجو (بلا نص واجهة): {{sound}}.',
  'sceneIntro.scriptCue': 'إشارة النبضة (جو فقط): {{cue}}.',
  'sceneIntro.camera':
    'الكاميرا: {{camera}}؛ مجموعة فارغة مفضلة؛ بلا وجوه أو شعارات جديدة.',
  'sceneIntro.beat': 'تأسيس → حياة بيئية خفيفة → ثبات.',
  'sceneIntro.duration': 'يناسب مقدمة موقع 6–10 ثوانٍ.',
  'propIntro.task':
    'صورة-إلى-فيديو: حرّك الإكسسوار نفسه كمقدمة بطل.',
  'propIntro.objectLock':
    'قفل الغرض: الظل والخامات والألوان والنقوش والتآكل نفسها.',
  'propIntro.name': 'الاسم: {{name}}.',
  'propIntro.look': 'المظهر: {{look}}.',
  'propIntro.material': 'الخامة: {{material}}.',
  'propIntro.size': 'الحجم: {{size}}.',
  'propIntro.condition': 'الحالة: {{condition}}.',
  'propIntro.tags': 'الوسوم: {{tags}}.',
  'propIntro.art': 'الأسلوب: {{art}}.',
  'propIntro.camera':
    'مدار لطيف أو اقتراب بطيء على طاولة نظيفة؛ ضوء يطابق اللقطة.',
  'propIntro.beat': 'ثبات → لمعان / دوران دقيق → ثبات.',
  'propIntro.noHands':
    'بلا أيدٍ أو وجوه جديدة إن لم تكن في اللقطة؛ بلا نص أو إكسسوار إضافي.',
  'propIntro.duration': 'يناسب مقدمة إكسسوار 6–10 ثوانٍ.',
  'costumeIntro.task':
    'صورة-إلى-فيديو: حرّك المظهر نفسه كمقدمة زي.',
  'costumeIntro.wardrobeLock':
    'قفل الزي: الظل والأقمشة والألوان والطبقات والإكسسوار نفسها.',
  'costumeIntro.identityOrProduct':
    'إن وُجد شخص: اقفل الوجه/الجسد؛ إن كان مانيكان/بسط: إطار منتج.',
  'costumeIntro.name': 'اسم المظهر: {{name}}.',
  'costumeIntro.desc': 'الزي: {{look}}.',
  'costumeIntro.art': 'الأسلوب: {{art}}.',
  'costumeIntro.camera': 'اقتراب لطيف أو مدار؛ ضوء أزياء يطابق اللقطة.',
  'costumeIntro.beat': 'ثبات → تدلي القماش / لمعان المعدن → ثبات.',
  'costumeIntro.forbid': 'بلا وجوه جديدة أو نص أو شعار أو وضع إيروتيكي.',
  'costumeIntro.duration': 'يناسب مقدمة زي 6–10 ثوانٍ.',
  'costumeIntro.fallbackName': 'مظهر',
  'actionIntro.lead': 'فيديو عرض الحركة «{{name}}».',
  'actionIntro.intention': 'القصد: {{intention}}',
  'actionIntro.body': 'الجسد/الإيقاع: {{body}}',
  'actionIntro.camera': 'الكاميرا: {{camera}}',
  'actionIntro.closing':
    'حركة متصلة سينمائية بلا نص؛ اتبع الإطار المفتاحي.',
  'sceneIntroPolish.task': 'المهمة: مقدمة موقع (صورة-إلى-فيديو).',
  'sceneIntroPolish.hasRef': 'لقطة موقع مرفقة — اقفل هوية المكان.',
  'sceneIntroPolish.noRef': 'لا لقطة؛ اقفل بإنجيل المكان.',
  'sceneIntroPolish.dossier': 'ملف الموقع:',
  'sceneIntroPolish.scriptCue': 'إشارة السكربت (جو فقط):\n{{script}}',
  'sceneIntroPolish.emptySet':
    'مجموعة فارغة؛ بلا وجوه جديدة. بلا نص أو شعار.',
  'propIntroPolish.task': 'المهمة: مقدمة بطل الإكسسوار (صورة-إلى-فيديو).',
  'propIntroPolish.hasRef': 'لقطة إكسسوار مرفقة — اقفل الغرض.',
  'propIntroPolish.noRef': 'لا لقطة؛ اقفل بالملف.',
  'propIntroPolish.dossier': 'ملف الإكسسوار:',
  'propIntroPolish.noHands': 'بلا أيدٍ أو وجوه جديدة. بلا نص أو شعار.',
  'costumeIntroPolish.task': 'المهمة: مقدمة زي (صورة-إلى-فيديو).',
  'costumeIntroPolish.hasRef':
    'لقطة مرفقة — شخص: هوية+زي؛ مانيكان: ظل وخامات.',
  'costumeIntroPolish.noRef': 'لا لقطة؛ اقفل بالوصف.',
  'costumeIntroPolish.dossier': 'ملف الزي:',
  'costumeIntroPolish.fabric':
    'تدلي خفيف؛ بلا وجوه جديدة أو نص.',
  'actionIntroPolish.task': 'المهمة: مقدمة دليل حركة (صورة-إلى-فيديو).',
  'actionIntroPolish.hasRef':
    'لقطة مرفقة — اقفل هوية الأداء بذلك الإطار.',
  'actionIntroPolish.templateKeepRules':
    'مسودة القالب (حسّن؛ HARD RULES في النهاية):',
  'cover.posterLead':
    'ملصق / KEY ART احترافي 16:9. ليس نموذج واجهة. بلا نص أو شعار أو علامة مائية.',
  'cover.titleMood':
    'العنوان (مزاج فقط، لا تكتبه على الصورة): {{title}}.',
  'cover.styleBible': 'إنجيل الأسلوب: {{style}}',
  'cover.extraDir': 'اتجاه إضافي: {{idea}}',
  'cover.establishing': 'إطار تأسيس مزاجي لغلاف المكتبة.',
  'cover.medium': 'طابق الوسيط؛ ظل قوي.',
  'cover.editPrefix':
    'IMAGE EDIT: تكوين ملصق جديد. احتفظ بالهوية/المزاج. ',
  'cover.label': 'غلاف القصة',
  'costumeFill.system':
    'أنت مصمم أزياء. JSON مضغوط فقط. إن وُجدت صورة فصف ذلك الزي بأمانة.',
  'costumeFill.idea': 'الفكرة: {{idea}}',
  'costumeFill.polish': 'لمّع مسودة الزي.',
  'costumeFill.required':
    'المفاتيح: name, description, artStyle, hardRules. النقص يُبطل.',
  'costumeFill.fallbackName': 'مظهر',
  'segment.entireStory': 'القصة كاملة (كل المشاهد)',
  'segment.noStory': 'لم تُختر قصة (بيانات الشخصية فقط)'
})

for (const [id, [fname, exp]] of Object.entries(files)) {
  const fp = join(dir, fname)
  const raw = readFileSync(fp, 'utf8')
  const start = raw.indexOf('= {')
  const end = raw.lastIndexOf('}')
  const table = JSON.parse(raw.slice(start + 2, end + 1))
  Object.assign(table, extra[id] || extra.en)
  writeFileSync(
    fp,
    `import type { PromptCopyTable } from './keys'\n\nexport const ${exp}: PromptCopyTable = ${JSON.stringify(table, null, 2)}\n`
  )
  console.log(id, Object.keys(table).length)
}
