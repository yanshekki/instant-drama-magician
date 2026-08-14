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

const extra = {
  en: {
    'improve.mode':
      'IMPROVE MODE: Merge ALL sources below into a complete result. Keep core identity unless the user explicitly asks to change it. Prefer rich extra context when form fields are sparse; prefer explicit user request when it asks for a change.',
    'improve.draftDefault': 'Current form fields (all filled inputs):',
    'improve.userRequest':
      'User improvement request (may be empty = polish & merge everything):',
    'improve.emptyDefault': '(polish all fields for short-drama continuity)',
    'improve.createDefault': 'Idea / direction:',
    'improve.explicitContext':
      'Explicit context in THIS request only (use for continuity; do not import any other sample world; user idea/draft wins on conflict):',
    'improve.storyTitle': 'Story title: {{title}}',
    'improve.styleNote': 'Style note: {{style}}',
    'improve.closingDefault': 'Output the complete result now.',
    'storyMeta.system':
      'You are a short-drama showrunner. Given a story title and optional idea, write a concise visual style bible AND hard rules for cover + clip generation. Return ONLY JSON (no fences): {"styleNote":"2-5 sentences: tone, lighting, camera, color, pacing","hardRules":"3-8 MUST/MUST-NOT lines for image & video"}. Concrete, filmable language for AI video continuity. Use title, idea, existing style note / hard rules, and any context snippets; if thin, invent freely a coherent style bible + rules.',
    'storyMeta.draftLabel': 'Current story fields:',
    'storyMeta.createLabel': 'Story idea / title:',
    'storyMeta.emptyPolish':
      '(polish visual style bible + hardRules for AI video continuity)',
    'storyMeta.closing':
      'Return ONLY JSON: {"styleNote":"…","hardRules":"…"}. Both keys required and non-empty.',
    'storyMeta.contextLabel': 'Story context (cast / scenes / props):',
    'character.system':
      'You are a professional short-drama character designer for AI video production. Given a short idea from the user, invent a complete, filmable character bible. A character may be human, animal, spirit, monster, robot, virtual avatar, or other designed entity — follow the idea; do not force a human if the idea is non-human. Return ONLY a single JSON object (no markdown fences, no commentary). Prefer vivid, concrete sensory detail. Keep identity consistent for multi-angle sheets and video. spokenLanguages: JSON array of BCP-47 codes this character SPEAKS, e.g. ["yue","en"] or ["ja"]. Empty array if non-verbal.',
    'character.draftLabel': 'Current Profile form fields (all filled inputs):',
    'character.soulLabel':
      'Linked soul.md / character bible (primary identity & personality source):',
    'character.createLabel': 'Character idea:',
    'character.emptyPolish': '(polish all fields; integrate soul into profile)',
    'character.closing':
      'Output complete JSON now. Required keys: {{keys}}. visualTags = comma-separated string (not array). spokenLanguages may be a code array.',
    'scene.system':
      'You are a short-drama location & scene designer for AI video. Produce a filmable location bible + playable scene script fragment. Return ONLY one JSON object (no markdown). title = short location name; description = architecture/materials/landmarks; script = dialogue + action + camera for THIS scene.',
    'scene.draftLabel': 'Current scene form fields (all filled inputs):',
    'scene.charsLabel': 'Characters in story:',
    'scene.propsLabel': 'Props in story:',
    'scene.priorLabel': 'Prior scenes (continuity):',
    'scene.createLabel': 'Scene idea:',
    'scene.emptyPolish': '(polish place + script for video continuity)',
    'scene.closing':
      'Output complete JSON now. Required keys: {{keys}}. Missing keys = invalid. visualTags must be a comma-separated string, not an array.',
    'prop.system':
      'You are a short-drama prop designer for AI video continuity. Return ONLY one JSON object. description: detailed look; material/sizeNotes/condition concrete.',
    'prop.draftLabel': 'Current prop form fields (all filled inputs):',
    'prop.createLabel': 'Prop idea:',
    'prop.emptyPolish': '(polish prop look for video continuity)',
    'prop.closing':
      'Output complete JSON now. Required keys: {{keys}}. Missing keys = invalid. visualTags must be a comma-separated string, not an array.',
    'prop.fallbackName': 'Prop',
    'action.system':
      'You are a short-drama motion director. Output ONLY valid JSON for an action/motion guide asset. Be concrete: body parts, tempo, weight, prop paths, staging. No markdown.',
    'action.storyContext': 'Story context (optional): {{title}}',
    'action.styleNote': 'Style note: {{style}}',
    'action.existingDraft': 'Existing draft JSON to polish:',
    'action.userIdea': 'User idea: {{idea}}',
    'action.closing':
      'Return JSON only. Required keys: {{keys}}. visualTags = comma-separated string, not array.',
    'profile.mustEveryKey': 'You MUST output EVERY key in this list: {{keys}}.',
    'profile.valuesAreStrings':
      'Every value MUST be a JSON string (not null, not a JSON array). Empty string only if truly unknown.',
    'profile.visualTagsRule':
      'visualTags: single comma-separated string in the user interface language — NEVER a JSON array.',
    'profile.fillConcrete':
      'Prefer filling all keys with concrete detail for short-drama continuity.'
  },
  'zh-HK': {
    'improve.mode':
      '改進模式：合併下方所有來源輸出完整結果。除非用戶明確要求改身份，否則保持核心一致。表單稀疏時以額外上下文為準；用戶明確要求更改時以指示為準。',
    'improve.draftDefault': '目前表單欄位（已填內容）：',
    'improve.userRequest': '用戶改進要求（可留空 = 全面潤飾並合併以上內容）：',
    'improve.emptyDefault': '（全面潤飾：適合短劇／出圖／出片 continuity）',
    'improve.createDefault': '構想／方向：',
    'improve.explicitContext':
      '僅限本次請求明確附上的上下文（作 continuity；勿引入其他樣本世界；與 idea／表單衝突時以用戶為準）：',
    'improve.storyTitle': '故事標題：{{title}}',
    'improve.styleNote': '風格備註：{{style}}',
    'improve.closingDefault': '請立即輸出完整結果。',
    'storyMeta.system':
      '你是短劇主創／視覺總監。根據故事標題與構想，寫簡潔可拍的風格備註（Style bible）以及出圖／出片「生成鐵則」。只回傳 JSON（不要代碼塊）：{"styleNote":"2–5 句：氣氛、光線、鏡頭、色調、節奏","hardRules":"3–8 句必須／禁止"}。要具體、適合 AI 影片／出圖延續。用提供的標題、構想、現有風格／鐵則與上下文；不足就自由補齊一套連貫風格與鐵則。',
    'storyMeta.draftLabel': '目前故事欄位：',
    'storyMeta.createLabel': '故事構想／標題：',
    'storyMeta.emptyPolish': '（潤飾視覺風格備註與生成鐵則，利於 AI 出片 continuity）',
    'storyMeta.closing':
      '只回傳 JSON：{"styleNote":"…","hardRules":"…"}。兩個鍵都必填且非空。',
    'storyMeta.contextLabel': '故事上下文（角色／場景／道具）：',
    'character.system':
      '你是專業短劇角色設定師，專門為 AI 影片／短劇生成「可拍、可認、可一致」的角色聖經。用戶會給一段角色 idea。角色可以是人類、動物、鬼靈、魔物、機械、虛擬形象或其他設計體——依 idea 而定，勿強行寫成人類。只輸出一個 JSON 物件。spokenLanguages：BCP-47 代碼陣列，例如 ["yue","en"]。非語言角色用 []。避免空泛形容；用可拍攝的細節。同一角色必須視覺一致。',
    'character.draftLabel': '目前 Profile 表單欄位（已填內容）：',
    'character.soulLabel': '已連結 soul.md／角色聖經（主要身份與性格依據）：',
    'character.createLabel': '角色 idea：',
    'character.emptyPolish': '（全面潤飾：將 soul 與表單合併進完整 Profile）',
    'character.closing':
      '請立即輸出完整 JSON。必填鍵：{{keys}}。visualTags 為逗號分隔字串（禁止標籤陣列）；spokenLanguages 可以是代碼陣列。',
    'scene.system':
      '你是短劇場景／場景空間設計師，服務 AI 影片 continuity。請輸出可拍的地點聖經 + 本場可演劇本片段。只回傳一個 JSON 物件。title＝短地名；description＝建築、物料、地標；script＝本場對白／動作／鏡頭。',
    'scene.draftLabel': '目前場景表單欄位（已填內容）：',
    'scene.charsLabel': '故事角色：',
    'scene.propsLabel': '故事道具：',
    'scene.priorLabel': '既有場景（continuity）：',
    'scene.createLabel': '場景 idea：',
    'scene.emptyPolish': '（全面潤飾地點與本場劇本，利於出片 continuity）',
    'scene.closing':
      '請立即輸出完整 JSON。必填鍵：{{keys}}。缺鍵無效。visualTags 必須是逗號分隔字串，禁止陣列。',
    'prop.system':
      '你是短劇道具設計師，服務 AI 影片 continuity。只回傳一個 JSON。description：可畫細節；material／sizeNotes／condition 具體。',
    'prop.draftLabel': '目前道具表單欄位（已填內容）：',
    'prop.createLabel': '道具 idea：',
    'prop.emptyPolish': '（全面潤飾道具外觀，利於出片 continuity）',
    'prop.closing':
      '請立即輸出完整 JSON。必填鍵：{{keys}}。缺鍵無效。visualTags 必須是逗號分隔字串，禁止陣列。',
    'prop.fallbackName': '道具',
    'action.system':
      '你是短劇動作指導。只輸出有效 JSON，描述一項可拍攝的動作指導。要具體：身體部位、節奏、力度、道具路徑、走位。不要 markdown。',
    'action.storyContext': '故事脈絡（可選）：{{title}}',
    'action.styleNote': '風格備註：{{style}}',
    'action.existingDraft': '現有草稿（請潤飾補全）：',
    'action.userIdea': '用戶構想：{{idea}}',
    'action.closing':
      '只回傳 JSON。必填鍵：{{keys}}。visualTags 為逗號分隔字串，禁止陣列。',
    'profile.mustEveryKey': '必須輸出列表中的每一個鍵：{{keys}}。',
    'profile.valuesAreStrings':
      '每個值必須是 JSON 字串（不可 null、不可用 JSON 陣列）。真的不知道才可空字串。',
    'profile.visualTagsRule':
      'visualTags：用用戶介面語言的單一逗號分隔字串——禁止 JSON 陣列。',
    'profile.fillConcrete': '各鍵請盡量填具體細節，利於短劇 continuity。'
  }
}

extra['zh-CN'] = Object.fromEntries(
  Object.entries(extra['zh-HK']).map(([k, v]) => [
    k,
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
  ])
)

function fromEn(over) {
  return { ...extra.en, ...over }
}

extra.ja = fromEn({
  'improve.mode':
    '改善モード：以下の全ソースを統合して完全な結果を出せ。ユーザーが身元変更を明示しない限り核は保て。',
  'improve.draftDefault': '現在のフォーム欄（入力済み）：',
  'improve.userRequest': 'ユーザー改善要求（空＝すべて磨いて統合）：',
  'improve.emptyDefault': '（短編ドラマ continuity のため全欄を磨く）',
  'improve.createDefault': '構想／方向：',
  'improve.explicitContext':
    '本リクエストに明示された文脈のみ（continuity 用。他のサンプル世界を持ち込むな）：',
  'improve.storyTitle': '物語タイトル：{{title}}',
  'improve.styleNote': '作風メモ：{{style}}',
  'improve.closingDefault': '完全な結果を今すぐ出力せよ。',
  'storyMeta.system':
    'あなたは短編ドラマのショーランナー。タイトルと構想から視覚スタイル聖書と生成鉄則を書け。JSONのみ返せ。',
  'storyMeta.draftLabel': '現在の物語フィールド：',
  'storyMeta.createLabel': '物語の構想／タイトル：',
  'storyMeta.emptyPolish': '（視覚スタイルと鉄則を磨く）',
  'storyMeta.closing':
    'JSONのみ：{"styleNote":"…","hardRules":"…"}。両キー必須。',
  'storyMeta.contextLabel': '物語コンテキスト（キャスト／場面／小道具）：',
  'character.system':
    'あなたはAI動画向けの短編ドラマ・キャラクター設定者。ideaに従い完全なキャラ聖書をJSONだけで出せ。spokenLanguagesはBCP-47配列。',
  'character.draftLabel': '現在のプロフィール欄：',
  'character.soulLabel': 'リンク済み soul.md／キャラ聖書：',
  'character.createLabel': 'キャラクター idea：',
  'character.emptyPolish': '（soulとフォームを統合して磨く）',
  'character.closing': '完全なJSONを今すぐ。必須キー：{{keys}}。',
  'scene.system':
    'あなたは短編ドラマの場所／場面デザイナー。撮れる場所聖書＋本場の脚本断片をJSONだけで出せ。',
  'scene.draftLabel': '現在の場面フォーム：',
  'scene.charsLabel': '物語のキャラ：',
  'scene.propsLabel': '物語の小道具：',
  'scene.priorLabel': '既存場面（continuity）：',
  'scene.createLabel': '場面 idea：',
  'scene.emptyPolish': '（場所と脚本を磨く）',
  'scene.closing': '完全なJSONを今すぐ。必須キー：{{keys}}。',
  'prop.system':
    'あなたは短編ドラマの小道具デザイナー。JSONだけ返せ。見た目・材質・状態を具体的に。',
  'prop.draftLabel': '現在の小道具フォーム：',
  'prop.createLabel': '小道具 idea：',
  'prop.emptyPolish': '（小道具の見た目を磨く）',
  'prop.closing': '完全なJSONを今すぐ。必須キー：{{keys}}。',
  'prop.fallbackName': '小道具',
  'action.system':
    'あなたは短編ドラマの動作監督。有効なJSONだけ出せ。部位・テンポ・重量・経路を具体的に。',
  'action.storyContext': '物語脈絡（任意）：{{title}}',
  'action.styleNote': '作風メモ：{{style}}',
  'action.existingDraft': '既存ドラフト（磨いて補完）：',
  'action.userIdea': 'ユーザー構想：{{idea}}',
  'action.closing': 'JSONのみ。必須キー：{{keys}}。',
  'profile.mustEveryKey': 'このリストの全キーを必ず出せ：{{keys}}。',
  'profile.valuesAreStrings':
    '各値はJSON文字列。nullや配列は不可。本当に不明なときだけ空文字。',
  'profile.visualTagsRule':
    'visualTagsは界面言語のカンマ区切り文字列。JSON配列は禁止。',
  'profile.fillConcrete': '短編ドラマ continuity のため具体的に埋めよ。'
})

extra.es = fromEn({
  'improve.mode':
    'MODO MEJORAR: fusiona TODAS las fuentes en un resultado completo. Conserva la identidad salvo que el usuario pida cambiarla.',
  'improve.draftDefault': 'Campos actuales del formulario:',
  'improve.userRequest': 'Petición de mejora (vacío = pulir y fusionar todo):',
  'improve.emptyDefault': '(pulir todos los campos para continuidad)',
  'improve.createDefault': 'Idea / dirección:',
  'improve.explicitContext':
    'Contexto explícito SOLO de esta petición (continuidad; no importes otro mundo muestra):',
  'improve.storyTitle': 'Título: {{title}}',
  'improve.styleNote': 'Nota de estilo: {{style}}',
  'improve.closingDefault': 'Devuelve el resultado completo ahora.',
  'storyMeta.system':
    'Eres showrunner de drama corto. Escribe biblia visual y reglas duras. SOLO JSON.',
  'storyMeta.draftLabel': 'Campos actuales de la historia:',
  'storyMeta.createLabel': 'Idea / título de la historia:',
  'storyMeta.emptyPolish': '(pulir biblia visual y hardRules)',
  'storyMeta.closing':
    'SOLO JSON: {"styleNote":"…","hardRules":"…"}. Ambas claves obligatorias.',
  'storyMeta.contextLabel': 'Contexto (elenco / escenas / atrezzo):',
  'character.system':
    'Eres diseñador de personajes de drama corto para vídeo IA. Devuelve SOLO un JSON. spokenLanguages = array BCP-47.',
  'character.draftLabel': 'Campos actuales del perfil:',
  'character.soulLabel': 'soul.md / biblia vinculada:',
  'character.createLabel': 'Idea de personaje:',
  'character.emptyPolish': '(pulir e integrar soul)',
  'character.closing': 'JSON completo ahora. Claves: {{keys}}.',
  'scene.system':
    'Eres diseñador de localizaciones. Biblia del lugar + guion de esta escena. SOLO JSON.',
  'scene.draftLabel': 'Campos actuales de la escena:',
  'scene.charsLabel': 'Personajes de la historia:',
  'scene.propsLabel': 'Atrezzo de la historia:',
  'scene.priorLabel': 'Escenas previas (continuidad):',
  'scene.createLabel': 'Idea de escena:',
  'scene.emptyPolish': '(pulir lugar + guion)',
  'scene.closing': 'JSON completo. Claves: {{keys}}.',
  'prop.system':
    'Eres diseñador de atrezzo. SOLO un JSON. Aspecto, material y estado concretos.',
  'prop.draftLabel': 'Campos actuales del atrezzo:',
  'prop.createLabel': 'Idea de atrezzo:',
  'prop.emptyPolish': '(pulir aspecto del atrezzo)',
  'prop.closing': 'JSON completo. Claves: {{keys}}.',
  'prop.fallbackName': 'Atrezzo',
  'action.system':
    'Eres director de movimiento. SOLO JSON válido. Cuerpo, tempo, peso, trayectorias.',
  'action.storyContext': 'Contexto de historia (opcional): {{title}}',
  'action.styleNote': 'Nota de estilo: {{style}}',
  'action.existingDraft': 'Borrador existente a pulir:',
  'action.userIdea': 'Idea del usuario: {{idea}}',
  'action.closing': 'Solo JSON. Claves: {{keys}}.',
  'profile.mustEveryKey': 'DEBES emitir CADA clave de esta lista: {{keys}}.',
  'profile.valuesAreStrings':
    'Cada valor DEBE ser una cadena JSON. Vacío solo si es desconocido.',
  'profile.visualTagsRule':
    'visualTags: una cadena separada por comas. NUNCA un array JSON.',
  'profile.fillConcrete': 'Rellena con detalle concreto para continuidad.'
})

extra.fr = fromEn({
  'improve.mode':
    'MODE AMÉLIORER : fusionnez TOUTES les sources en un résultat complet. Gardez l’identité sauf demande explicite.',
  'improve.draftDefault': 'Champs actuels du formulaire :',
  'improve.userRequest': 'Demande d’amélioration (vide = tout peaufiner) :',
  'improve.emptyDefault': '(peaufiner tous les champs pour la continuité)',
  'improve.createDefault': 'Idée / direction :',
  'improve.explicitContext':
    'Contexte explicite de CETTE requête seulement (continuité ; n’importez aucun autre monde) :',
  'improve.storyTitle': 'Titre : {{title}}',
  'improve.styleNote': 'Note de style : {{style}}',
  'improve.closingDefault': 'Produisez le résultat complet maintenant.',
  'storyMeta.system':
    'Vous êtes showrunner. Écrivez bible visuelle + règles dures. JSON uniquement.',
  'storyMeta.draftLabel': 'Champs actuels de l’histoire :',
  'storyMeta.createLabel': 'Idée / titre :',
  'storyMeta.emptyPolish': '(peaufiner bible + hardRules)',
  'storyMeta.closing':
    'JSON uniquement : {"styleNote":"…","hardRules":"…"}. Les deux clés sont obligatoires.',
  'storyMeta.contextLabel': 'Contexte (cast / scènes / accessoires) :',
  'character.system':
    'Vous êtes designer de personnages. Un seul JSON. spokenLanguages = tableau BCP-47.',
  'character.draftLabel': 'Champs profil actuels :',
  'character.soulLabel': 'soul.md / bible liée :',
  'character.createLabel': 'Idée de personnage :',
  'character.emptyPolish': '(peaufiner et intégrer le soul)',
  'character.closing': 'JSON complet. Clés : {{keys}}.',
  'scene.system':
    'Vous êtes designer de lieux. Bible du lieu + script de cette scène. JSON seul.',
  'scene.draftLabel': 'Champs scène actuels :',
  'scene.charsLabel': 'Personnages de l’histoire :',
  'scene.propsLabel': 'Accessoires de l’histoire :',
  'scene.priorLabel': 'Scènes déjà là (continuité) :',
  'scene.createLabel': 'Idée de scène :',
  'scene.emptyPolish': '(peaufiner lieu + script)',
  'scene.closing': 'JSON complet. Clés : {{keys}}.',
  'prop.system':
    'Vous êtes designer d’accessoires. Un seul JSON. Aspect, matière, état concrets.',
  'prop.draftLabel': 'Champs accessoire actuels :',
  'prop.createLabel': 'Idée d’accessoire :',
  'prop.emptyPolish': '(peaufiner l’aspect)',
  'prop.closing': 'JSON complet. Clés : {{keys}}.',
  'prop.fallbackName': 'Accessoire',
  'action.system':
    'Vous êtes directeur de mouvement. JSON valide seulement. Corps, tempo, poids, trajectoires.',
  'action.storyContext': 'Contexte d’histoire (optionnel) : {{title}}',
  'action.styleNote': 'Note de style : {{style}}',
  'action.existingDraft': 'Brouillon existant à peaufiner :',
  'action.userIdea': 'Idée utilisateur : {{idea}}',
  'action.closing': 'JSON seulement. Clés : {{keys}}.',
  'profile.mustEveryKey': 'Vous DEVEZ produire CHAQUE clé : {{keys}}.',
  'profile.valuesAreStrings':
    'Chaque valeur DOIT être une chaîne JSON. Vide seulement si inconnu.',
  'profile.visualTagsRule':
    'visualTags : une chaîne séparée par des virgules. JAMAIS un tableau JSON.',
  'profile.fillConcrete': 'Remplissez avec des détails concrets.'
})

extra['pt-BR'] = fromEn({
  'improve.mode':
    'MODO MELHORAR: una TODAS as fontes num resultado completo. Mantenha a identidade salvo pedido explícito.',
  'improve.draftDefault': 'Campos atuais do formulário:',
  'improve.userRequest': 'Pedido de melhoria (vazio = polir e unir tudo):',
  'improve.emptyDefault': '(polir todos os campos para continuidade)',
  'improve.createDefault': 'Ideia / direção:',
  'improve.explicitContext':
    'Contexto explícito SÓ deste pedido (continuidade; não importe outro mundo):',
  'improve.storyTitle': 'Título: {{title}}',
  'improve.styleNote': 'Nota de estilo: {{style}}',
  'improve.closingDefault': 'Entregue o resultado completo agora.',
  'storyMeta.system':
    'Você é showrunner. Escreva bíblia visual e regras duras. SÓ JSON.',
  'storyMeta.draftLabel': 'Campos atuais da história:',
  'storyMeta.createLabel': 'Ideia / título:',
  'storyMeta.emptyPolish': '(polir bíblia + hardRules)',
  'storyMeta.closing':
    'SÓ JSON: {"styleNote":"…","hardRules":"…"}. As duas chaves são obrigatórias.',
  'storyMeta.contextLabel': 'Contexto (elenco / cenas / objetos):',
  'character.system':
    'Você é designer de personagens. SÓ um JSON. spokenLanguages = array BCP-47.',
  'character.draftLabel': 'Campos atuais do perfil:',
  'character.soulLabel': 'soul.md / bíblia ligada:',
  'character.createLabel': 'Ideia de personagem:',
  'character.emptyPolish': '(polir e integrar soul)',
  'character.closing': 'JSON completo. Chaves: {{keys}}.',
  'scene.system':
    'Você é designer de locações. Bíblia do lugar + roteiro desta cena. SÓ JSON.',
  'scene.draftLabel': 'Campos atuais da cena:',
  'scene.charsLabel': 'Personagens da história:',
  'scene.propsLabel': 'Objetos da história:',
  'scene.priorLabel': 'Cenas anteriores (continuidade):',
  'scene.createLabel': 'Ideia de cena:',
  'scene.emptyPolish': '(polir lugar + roteiro)',
  'scene.closing': 'JSON completo. Chaves: {{keys}}.',
  'prop.system':
    'Você é designer de objetos. SÓ um JSON. Visual, material e estado concretos.',
  'prop.draftLabel': 'Campos atuais do objeto:',
  'prop.createLabel': 'Ideia de objeto:',
  'prop.emptyPolish': '(polir o visual)',
  'prop.closing': 'JSON completo. Chaves: {{keys}}.',
  'prop.fallbackName': 'Objeto',
  'action.system':
    'Você é diretor de movimento. JSON válido só. Corpo, tempo, peso, trajetórias.',
  'action.storyContext': 'Contexto da história (opcional): {{title}}',
  'action.styleNote': 'Nota de estilo: {{style}}',
  'action.existingDraft': 'Rascunho existente para polir:',
  'action.userIdea': 'Ideia do usuário: {{idea}}',
  'action.closing': 'Só JSON. Chaves: {{keys}}.',
  'profile.mustEveryKey': 'Você DEVE emitir CADA chave: {{keys}}.',
  'profile.valuesAreStrings':
    'Cada valor DEVE ser string JSON. Vazio só se desconhecido.',
  'profile.visualTagsRule':
    'visualTags: uma string separada por vírgulas. NUNCA um array JSON.',
  'profile.fillConcrete': 'Preencha com detalhe concreto.'
})

extra.ru = fromEn({
  'improve.mode':
    'РЕЖИМ УЛУЧШЕНИЯ: объедини ВСЕ источники в полный результат. Сохрани идентичность, если пользователь не просит изменить.',
  'improve.draftDefault': 'Текущие поля формы:',
  'improve.userRequest': 'Запрос на улучшение (пусто = отполировать всё):',
  'improve.emptyDefault': '(отполировать все поля для непрерывности)',
  'improve.createDefault': 'Идея / направление:',
  'improve.explicitContext':
    'Явный контекст ТОЛЬКО этого запроса (непрерывность; не тащи другой мир):',
  'improve.storyTitle': 'Название: {{title}}',
  'improve.styleNote': 'Заметка о стиле: {{style}}',
  'improve.closingDefault': 'Выдай полный результат сейчас.',
  'storyMeta.system':
    'Ты шоураннер короткой драмы. Напиши визуальную библию и жёсткие правила. ТОЛЬКО JSON.',
  'storyMeta.draftLabel': 'Текущие поля истории:',
  'storyMeta.createLabel': 'Идея / название:',
  'storyMeta.emptyPolish': '(отполировать библию и hardRules)',
  'storyMeta.closing':
    'ТОЛЬКО JSON: {"styleNote":"…","hardRules":"…"}. Оба ключа обязательны.',
  'storyMeta.contextLabel': 'Контекст (каст / сцены / реквизит):',
  'character.system':
    'Ты дизайнер персонажей. ТОЛЬКО один JSON. spokenLanguages = массив BCP-47.',
  'character.draftLabel': 'Текущие поля профиля:',
  'character.soulLabel': 'Связанный soul.md / библия:',
  'character.createLabel': 'Идея персонажа:',
  'character.emptyPolish': '(отполировать и встроить soul)',
  'character.closing': 'Полный JSON. Ключи: {{keys}}.',
  'scene.system':
    'Ты дизайнер локаций. Библия места + сценарий этой сцены. ТОЛЬКО JSON.',
  'scene.draftLabel': 'Текущие поля сцены:',
  'scene.charsLabel': 'Персонажи истории:',
  'scene.propsLabel': 'Реквизит истории:',
  'scene.priorLabel': 'Прежние сцены (непрерывность):',
  'scene.createLabel': 'Идея сцены:',
  'scene.emptyPolish': '(отполировать место + сценарий)',
  'scene.closing': 'Полный JSON. Ключи: {{keys}}.',
  'prop.system':
    'Ты дизайнер реквизита. ТОЛЬКО один JSON. Вид, материал, состояние.',
  'prop.draftLabel': 'Текущие поля реквизита:',
  'prop.createLabel': 'Идея реквизита:',
  'prop.emptyPolish': '(отполировать вид)',
  'prop.closing': 'Полный JSON. Ключи: {{keys}}.',
  'prop.fallbackName': 'Реквизит',
  'action.system':
    'Ты режиссёр движения. Только валидный JSON. Тело, темп, вес, траектории.',
  'action.storyContext': 'Контекст истории (необязательно): {{title}}',
  'action.styleNote': 'Заметка о стиле: {{style}}',
  'action.existingDraft': 'Существующий черновик:',
  'action.userIdea': 'Идея пользователя: {{idea}}',
  'action.closing': 'Только JSON. Ключи: {{keys}}.',
  'profile.mustEveryKey': 'Нужно выдать КАЖДЫЙ ключ: {{keys}}.',
  'profile.valuesAreStrings':
    'Каждое значение — JSON-строка. Пусто только если неизвестно.',
  'profile.visualTagsRule':
    'visualTags: одна строка через запятую. НЕ JSON-массив.',
  'profile.fillConcrete': 'Заполняй конкретными деталями.'
})

extra.hi = fromEn({
  'improve.mode':
    'सुधार मोड: नीचे के सभी स्रोत मिलाकर पूरा परिणाम दो। उपयोगकर्ता न कहे तो पहचान बनाए रखो।',
  'improve.draftDefault': 'वर्तमान फ़ॉर्म फ़ील्ड:',
  'improve.userRequest': 'सुधार अनुरोध (खाली = सब पॉलिश करो):',
  'improve.emptyDefault': '(निरंतरता के लिए सभी फ़ील्ड पॉलिश करो)',
  'improve.createDefault': 'विचार / दिशा:',
  'improve.explicitContext':
    'केवल इसी अनुरोध का स्पष्ट संदर्भ (निरंतरता; कोई और नमूना संसार न लाओ):',
  'improve.storyTitle': 'शीर्षक: {{title}}',
  'improve.styleNote': 'शैली नोट: {{style}}',
  'improve.closingDefault': 'अभी पूरा परिणाम दो।',
  'storyMeta.system':
    'तुम शॉर्ट-ड्रामा शोरनर हो। विज़ुअल बाइबल और सख्त नियम लिखो। केवल JSON।',
  'storyMeta.draftLabel': 'वर्तमान कहानी फ़ील्ड:',
  'storyMeta.createLabel': 'कहानी विचार / शीर्षक:',
  'storyMeta.emptyPolish': '(विज़ुअल बाइबल + hardRules पॉलिश करो)',
  'storyMeta.closing':
    'केवल JSON: {"styleNote":"…","hardRules":"…"}। दोनों कुंजी ज़रूरी।',
  'storyMeta.contextLabel': 'संदर्भ (कास्ट / दृश्य / प्रॉप्स):',
  'character.system':
    'तुम पात्र डिज़ाइनर हो। केवल एक JSON। spokenLanguages = BCP-47 ऐरे।',
  'character.draftLabel': 'वर्तमान प्रोफ़ाइल फ़ील्ड:',
  'character.soulLabel': 'लिंक किया soul.md / बाइबल:',
  'character.createLabel': 'पात्र idea:',
  'character.emptyPolish': '(soul मिलाकर पॉलिश करो)',
  'character.closing': 'पूरा JSON अभी। कुंजियाँ: {{keys}}।',
  'scene.system':
    'तुम लोकेशन डिज़ाइनर हो। स्थान बाइबल + इस दृश्य की पटकथा। केवल JSON।',
  'scene.draftLabel': 'वर्तमान दृश्य फ़ील्ड:',
  'scene.charsLabel': 'कहानी के पात्र:',
  'scene.propsLabel': 'कहानी के प्रॉप्स:',
  'scene.priorLabel': 'पिछले दृश्य (निरंतरता):',
  'scene.createLabel': 'दृश्य idea:',
  'scene.emptyPolish': '(स्थान + पटकथा पॉलिश करो)',
  'scene.closing': 'पूरा JSON। कुंजियाँ: {{keys}}।',
  'prop.system':
    'तुम प्रॉप डिज़ाइनर हो। केवल एक JSON। रूप, सामग्री, स्थिति स्पष्ट।',
  'prop.draftLabel': 'वर्तमान प्रॉप फ़ील्ड:',
  'prop.createLabel': 'प्रॉप idea:',
  'prop.emptyPolish': '(प्रॉप का रूप पॉलिश करो)',
  'prop.closing': 'पूरा JSON। कुंजियाँ: {{keys}}।',
  'prop.fallbackName': 'प्रॉप',
  'action.system':
    'तुम मोशन डायरेक्टर हो। केवल वैध JSON। अंग, गति, भार, पथ।',
  'action.storyContext': 'कहानी संदर्भ (वैकल्पिक): {{title}}',
  'action.styleNote': 'शैली नोट: {{style}}',
  'action.existingDraft': 'मौजूदा ड्राफ्ट (पॉलिश करो):',
  'action.userIdea': 'उपयोगकर्ता विचार: {{idea}}',
  'action.closing': 'केवल JSON। कुंजियाँ: {{keys}}।',
  'profile.mustEveryKey': 'इस सूची की हर कुंजी दो: {{keys}}।',
  'profile.valuesAreStrings':
    'हर मान JSON स्ट्रिंग हो। अज्ञात हो तभी खाली।',
  'profile.visualTagsRule':
    'visualTags: कॉमा से अलग एक स्ट्रिंग। JSON ऐरे नहीं।',
  'profile.fillConcrete': 'ठोस विवरण से भरो।'
})

extra.ar = fromEn({
  'improve.mode':
    'وضع التحسين: اددمج كل المصادر في نتيجة كاملة. أبقِ الهوية ما لم يطلب المستخدم التغيير.',
  'improve.draftDefault': 'حقول النموذج الحالية:',
  'improve.userRequest': 'طلب التحسين (فارغ = لمّع وادمج الكل):',
  'improve.emptyDefault': '(لمّع كل الحقول للاستمرارية)',
  'improve.createDefault': 'فكرة / اتجاه:',
  'improve.explicitContext':
    'سياق صريح لهذا الطلب فقط (استمرارية؛ لا تستورد عالماً نموذجياً آخر):',
  'improve.storyTitle': 'العنوان: {{title}}',
  'improve.styleNote': 'ملاحظة الأسلوب: {{style}}',
  'improve.closingDefault': 'أخرج النتيجة الكاملة الآن.',
  'storyMeta.system':
    'أنت شورنر دراما قصيرة. اكتب إنجيلًا بصريًا وقواعد صارمة. JSON فقط.',
  'storyMeta.draftLabel': 'حقول القصة الحالية:',
  'storyMeta.createLabel': 'فكرة / عنوان القصة:',
  'storyMeta.emptyPolish': '(لمّع الإنجيل البصري وhardRules)',
  'storyMeta.closing':
    'JSON فقط: {"styleNote":"…","hardRules":"…"}. المفتاحان إلزاميان.',
  'storyMeta.contextLabel': 'السياق (طاقم / مشاهد / إكسسوارات):',
  'character.system':
    'أنت مصمم شخصيات. JSON واحد فقط. spokenLanguages = مصفوفة BCP-47.',
  'character.draftLabel': 'حقول الملف الحالية:',
  'character.soulLabel': 'soul.md / الإنجيل المرتبط:',
  'character.createLabel': 'فكرة الشخصية:',
  'character.emptyPolish': '(لمّع وادمج soul)',
  'character.closing': 'JSON كامل الآن. المفاتيح: {{keys}}.',
  'scene.system':
    'أنت مصمم مواقع. إنجيل المكان + سكربت هذا المشهد. JSON فقط.',
  'scene.draftLabel': 'حقول المشهد الحالية:',
  'scene.charsLabel': 'شخصيات القصة:',
  'scene.propsLabel': 'إكسسوارات القصة:',
  'scene.priorLabel': 'مشاهد سابقة (استمرارية):',
  'scene.createLabel': 'فكرة المشهد:',
  'scene.emptyPolish': '(لمّع المكان والسكربت)',
  'scene.closing': 'JSON كامل. المفاتيح: {{keys}}.',
  'prop.system':
    'أنت مصمم إكسسوارات. JSON واحد. المظهر والخامة والحالة واضحة.',
  'prop.draftLabel': 'حقول الإكسسوار الحالية:',
  'prop.createLabel': 'فكرة الإكسسوار:',
  'prop.emptyPolish': '(لمّع مظهر الإكسسوار)',
  'prop.closing': 'JSON كامل. المفاتيح: {{keys}}.',
  'prop.fallbackName': 'إكسسوار',
  'action.system':
    'أنت مخرج حركة. JSON صالح فقط. الجسد والإيقاع والوزن والمسارات.',
  'action.storyContext': 'سياق القصة (اختياري): {{title}}',
  'action.styleNote': 'ملاحظة الأسلوب: {{style}}',
  'action.existingDraft': 'مسودة موجودة للصقل:',
  'action.userIdea': 'فكرة المستخدم: {{idea}}',
  'action.closing': 'JSON فقط. المفاتيح: {{keys}}.',
  'profile.mustEveryKey': 'يجب إخراج كل مفتاح في القائمة: {{keys}}.',
  'profile.valuesAreStrings':
    'كل قيمة يجب أن تكون سلسلة JSON. فارغة فقط إن جُهلت.',
  'profile.visualTagsRule':
    'visualTags: سلسلة مفصولة بفواصل. ليست مصفوفة JSON.',
  'profile.fillConcrete': 'املأ بتفاصيل ملموسة.'
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
