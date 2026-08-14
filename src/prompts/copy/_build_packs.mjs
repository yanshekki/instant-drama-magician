/** One-shot writer for PromptCatalog copy tables. Run: node src/prompts/copy/_build_packs.mjs */
import { writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const dir = dirname(fileURLToPath(import.meta.url))

const storyJson =
  '{"characterName":"…","characterNames":["…"],"sceneHint":"…","propName":"…","mood":"…","atmosphere":"…","camera":"…","sfx":"…","units":[{"type":"action","who":"…","text":"…"},{"type":"expression","who":"…","text":"…"},{"type":"dialogue","who":"…","line":"…","tone":"…","parenthetical":"…"},{"type":"note","text":"…"}]}'

const packs = {
  en: {
    'speechLock.named':
      'SPEECH LOCK · Character "{{who}}": audible speech AND lip-sync MUST be {{primaryName}} ({{primary}}) only. Do not speak {{forbid}} or any other language. Keep the same speech language on every clip. Do not translate dialogue.',
    'speechLock.unnamed':
      'SPEECH LOCK · Speaking characters: audible speech AND lip-sync MUST be {{primaryName}} ({{primary}}) only. Do not speak {{forbid}} or any other language. Keep the same speech language on every clip. Do not translate dialogue.',
    'speechLock.namedMulti':
      'SPEECH LOCK · Character "{{who}}": audible speech AND lip-sync MUST be {{primaryName}} ({{primary}}). Other allowed languages ONLY if the written script line is already in that language: {{extras}}. Never invent a third language. Never switch languages between clips. Do not switch to {{forbid}}. Do not translate dialogue.',
    'speechLock.unnamedMulti':
      'SPEECH LOCK · Speaking characters: audible speech AND lip-sync MUST be {{primaryName}} ({{primary}}). Other allowed languages ONLY if the written script line is already in that language: {{extras}}. Never invent a third language. Never switch languages between clips. Do not switch to {{forbid}}. Do not translate dialogue.',
    'storyBeats.system': [
      'You write short-drama TIMELINE BEATS for AI video.',
      'Each beat = ONE short clip screenplay (not a single spoken line).',
      'A beat MUST include rich performance content: mood, atmosphere, actions, expressions, optional camera/sfx, and zero or more spoken dialogue lines (1–4 lines common).',
      'Return ONLY a JSON array (no fences). Each item shape:',
      storyJson,
      'Rules:',
      '- units.type dialogue.line = ONLY words the character speaks (no stage directions inside line).',
      '- Put physical business in action; face/micro-performance in expression; delivery in tone/parenthetical.',
      '- Multiple dialogue units in one beat are encouraged when the clip has a short exchange or self-talk.',
      '- Pure action beats (no dialogue) are allowed.',
      '- Write 4–8 beats. Use only cast names provided.',
      '- Prefer conflict, clear visual action, filmable detail.',
      '- Stay faithful to the title, style, cast, and scenes provided; if thin, invent freely within that cast/world.',
      "- SPEECH: write each dialogue.line in that speaker's primary spoken language from the cast list. Do not switch languages between beats. Do not translate lines unless that is the character's listed language."
    ].join('\n'),
    'storyBeats.userLead':
      'GENERATE full clip screenplay beats using ALL cast, scenes, props, style, and idea below.',
    'storyBeats.eachBeat':
      'Each beat needs mood + atmosphere + actions/expressions + optional multi-line dialogue.',
    'storyBeats.story': 'Story: {{title}}',
    'storyBeats.style': 'Style: {{style}}',
    'storyBeats.userDir': 'User direction: {{idea}}',
    'storyBeats.cast': 'Cast:',
    'storyBeats.scenes': 'Scenes:',
    'storyBeats.props': 'Props: {{props}}',
    'storyBeats.returnJson': 'Return beats JSON array only.',
    'storyBeats.noCast': '(no cast)',
    'storyBeats.noScenes': '(no scenes — invent locations in sceneHint)',
    'storyBeats.none': '(none)',
    'videoPolish.system': [
      'You write ONE final image-to-video prompt for a short-drama AI video model.',
      'Return ONLY the prompt text — no markdown fences, no title, no explanation.',
      'Rules:',
      '- Write the director prompt in the user interface language; keep character names and required dialogue language codes clear.',
      '- Person still: IDENTITY LOCK (face, hair, body, wardrobe, colors). Location plate: SPACE LOCK (architecture, materials, layout, signage, palette) — empty set preferred; no new cast faces.',
      '- Use ALL provided profile / soul / beat / location facts that affect look, motion, speech, or atmosphere; ignore empty fields.',
      '- Invent only what is needed to complete a filmable clip from the materials and seed — do not import a fixed sample world, Demo story, or facts not present in materials/seed.',
      '- Condense long soul.md into actionable performance + identity beats; do not dump the whole bible verbatim.',
      '- Duration 6–10s; continuous action; cinematic; no text overlays, logos, watermarks, or extra unrelated people.',
      '- Anatomically correct humans unless the script requires otherwise (two hands, two arms, two legs).',
      '- If multi-character, keep each listed subject consistent; primary focus first.',
      '- If HARD RULES appear in materials, keep them and place them at the end of your output (highest priority).',
      '- SPEECH LOCK is mandatory: never drop, rewrite, or translate it. Expand language codes to full names. Every clip must use the character primary spoken language; do not switch languages between clips; do not translate dialogue lines.',
      '- Director revision may refine style/action but must NOT violate HARD RULES.'
    ].join('\n'),
    'videoPolish.hardRulesKeep':
      'HARD RULES (HIGHEST PRIORITY — keep every line; object labels like [Character · Name] must stay). Place the full HARD RULES block at the END of your output. Do not weaken, drop, or reassign rules.',
    'clip.task': 'TASK: Short-drama timeline clip (image-to-video).',
    'clip.hasRef':
      'A reference still may be attached — lock identity/location continuity to it when relevant.',
    'clip.characters': 'Characters:',
    'clip.scene': 'Scene:',
    'clip.prop': 'Prop:',
    'clip.action': 'Action / motion guide:',
    'clip.beat': 'Beat / dialogue:',
    'clip.prev': 'Previous clip continuity:',
    'clip.revision': 'DIRECTOR REVISION (must follow):',
    'clip.templateDraft': 'Template draft (improve):',
    'intro.task': 'TASK: Self-introduction casting clip (image-to-video).',
    'intro.hasRef':
      'Reference still is attached to the video API — lock identity to that image.',
    'intro.noRef':
      'No reference still path in this text; still lock to profile appearance/costume.',
    'intro.dossier': 'Character dossier:',
    'intro.templateDraft': 'Template draft (improve; do not ignore dossier):',
    'common.durationAspect': 'Duration: {{seconds}}s. Aspect: {{aspect}}.',
    'common.templateDraft': 'Template draft:'
  },
  'zh-HK': {
    'speechLock.named':
      'SPEECH LOCK · 角色「{{who}}」：可聽語音同口型必須只用{{primaryName}}（{{primary}}）。禁止改講{{forbid}}或其他語言。每段都要同一種口白。唔好翻譯對白。',
    'speechLock.unnamed':
      'SPEECH LOCK · 出場角色：可聽語音同口型必須只用{{primaryName}}（{{primary}}）。禁止改講{{forbid}}或其他語言。每段都要同一種口白。唔好翻譯對白。',
    'speechLock.namedMulti':
      'SPEECH LOCK · 角色「{{who}}」：可聽語音同口型必須用{{primaryName}}（{{primary}}）。只有腳本該句已經係以下語言先可以講第二種：{{extras}}。禁止第三種語言。禁止每段轉換。禁止改講{{forbid}}。唔好翻譯對白。',
    'speechLock.unnamedMulti':
      'SPEECH LOCK · 出場角色：可聽語音同口型必須用{{primaryName}}（{{primary}}）。只有腳本該句已經係以下語言先可以講第二種：{{extras}}。禁止第三種語言。禁止每段轉換。禁止改講{{forbid}}。唔好翻譯對白。',
    'storyBeats.system': [
      '你為短劇時間軸撰寫「劇情段落」——每一段 = 一小段 AI 影片的完整拍攝腳本，而非一句對白。',
      '每段必須有豐富表演內容：心情、氣氛、動作、表情、可選鏡頭／聲效，以及 0 至多句口白（常見 1–4 句）。',
      '只回傳 JSON 陣列（不要代碼塊）。每項形狀：',
      storyJson,
      '規則：',
      '- dialogue.line 只寫角色講出口的話，不要把動作寫進口白。',
      '- 肢體動作放 action；表情微表演放 expression；語氣放 tone／parenthetical。',
      '- 一段可有多句對白（對話回合或自語）。',
      '- 允許純動作段（無對白）。',
      '- 寫 4–8 段。角色名必須用提供名單。',
      '- 要有衝突、可視動作、可拍細節。',
      '- 忠於已提供的標題、風格、選角與場景；不足就在同一世界內自由補齊。',
      '- 口白：dialogue.line 必須用該角色主語言寫（見角色名單）。禁止段與段轉語言。除非角色名單寫明，否則唔好改寫成其他語言。'
    ].join('\n'),
    'storyBeats.userLead':
      '生成完整「短片腳本」段落：使用下方全部選角、場景、道具、風格與構想。',
    'storyBeats.eachBeat':
      '每段要有心情、氣氛、動作／表情，以及可選的多句對白。',
    'storyBeats.story': '故事：{{title}}',
    'storyBeats.style': '風格：{{style}}',
    'storyBeats.userDir': '用戶指示：{{idea}}',
    'storyBeats.cast': '角色：',
    'storyBeats.scenes': '場景：',
    'storyBeats.props': '道具：{{props}}',
    'storyBeats.returnJson': '只回傳段落 JSON 陣列。',
    'storyBeats.noCast': '（無角色）',
    'storyBeats.noScenes': '（無場景 — sceneHint 可寫地點）',
    'storyBeats.none': '（無）',
    'videoPolish.system': [
      '你為短劇 AI 圖生影片模型撰寫「一條」最終 image-to-video 導演提示詞。',
      '只回傳提示詞正文——不要 markdown 代碼塊、標題或解釋。',
      '規則：',
      '- 提示詞全文用用戶介面語言書寫；角色姓名與口白語言要求須清楚標示。',
      '- 人物靜圖：IDENTITY LOCK（臉、髮、體型、服裝、顏色）。場景靜幀：SPACE LOCK（建築、材質、格局、招牌、色盤）——空鏡為主，勿新增角色臉。',
      '- 凡已提供且影響外形、動作、口白、氣氛或場地的人設／soul／段落／地點資料均須用上；空白欄位可略。',
      '- 只按材料與 seed 補齊可拍細節；勿引入固定樣本世界、Demo 故事、或材料／seed 未出現的事實。',
      '- 長篇 soul.md 須濃縮為可拍的表演與身份要點，不可整篇照貼。',
      '- 時長 6–10 秒；動作連貫；電影感；無字幕、logo、浮水印、無關路人。',
      '- 除非劇情要求，否則解剖結構正常（雙手雙腳）。',
      '- 多角色時保持每位主體一致；主焦點優先。',
      '- 若材料含 HARD RULES（生成鐵則），必須保留並放在輸出最尾（最高優先）。',
      '- SPEECH LOCK 必須保留：不得刪改或翻譯；語言代碼要寫成全名。每段跟角色主口語，禁止段與段轉語言，禁止翻譯對白。',
      '- 導演修訂可調整氣氛／動作，但不得違反 HARD RULES。'
    ].join('\n'),
    'videoPolish.hardRulesKeep':
      'HARD RULES／生成鐵則（最高優先——保留每一行；[Character · 名] 等物件標籤不可刪）。必須將完整 HARD RULES 區塊放在輸出最尾。不得削弱、刪除或套錯主體。',
    'clip.task': '任務：短劇時間軸片段（圖生影片）。',
    'clip.hasRef': '可能附有參考靜圖——相關時鎖定身份／場地連續性。',
    'clip.characters': '角色：',
    'clip.scene': '場景：',
    'clip.prop': '道具：',
    'clip.action': '動作指導：',
    'clip.beat': '段落／對白：',
    'clip.prev': '前一段連續性：',
    'clip.revision': '導演修訂（必須遵守）：',
    'clip.templateDraft': '模板草稿（請改進）：',
    'intro.task': '任務：自我介紹選角短片（圖生影片）。',
    'intro.hasRef': '參考靜圖會交予影片 API——必須鎖定該圖身份。',
    'intro.noRef': '本文無靜圖路徑；仍須鎖定人設外貌／戲服。',
    'intro.dossier': '角色檔案：',
    'intro.templateDraft': '模板草稿（請改進；勿忽略檔案）：',
    'common.durationAspect': '時長：{{seconds}} 秒。畫面比例：{{aspect}}。',
    'common.templateDraft': '模板草稿：'
  }
}

packs['zh-CN'] = {
  'speechLock.named':
    'SPEECH LOCK · 角色「{{who}}」：可听语音和口型必须只用{{primaryName}}（{{primary}}）。禁止改说{{forbid}}或其他语言。每段都要同一种口白。不要翻译对白。',
  'speechLock.unnamed':
    'SPEECH LOCK · 出场角色：可听语音和口型必须只用{{primaryName}}（{{primary}}）。禁止改说{{forbid}}或其他语言。每段都要同一种口白。不要翻译对白。',
  'speechLock.namedMulti':
    'SPEECH LOCK · 角色「{{who}}」：可听语音和口型必须用{{primaryName}}（{{primary}}）。只有剧本该句已经是以下语言才可以讲第二种：{{extras}}。禁止第三种语言。禁止每段转换。禁止改说{{forbid}}。不要翻译对白。',
  'speechLock.unnamedMulti':
    'SPEECH LOCK · 出场角色：可听语音和口型必须用{{primaryName}}（{{primary}}）。只有剧本该句已经是以下语言才可以讲第二种：{{extras}}。禁止第三种语言。禁止每段转换。禁止改说{{forbid}}。不要翻译对白。',
  'storyBeats.system': packs['zh-HK']['storyBeats.system']
    .replaceAll('唔好', '不要')
    .replaceAll('係', '是')
    .replaceAll('嗰', '那'),
  'storyBeats.userLead': '生成完整「短片脚本」段落：使用下方全部选角、场景、道具、风格与构想。',
  'storyBeats.eachBeat': '每段要有心情、气氛、动作／表情，以及可选的多句对白。',
  'storyBeats.story': '故事：{{title}}',
  'storyBeats.style': '风格：{{style}}',
  'storyBeats.userDir': '用户指示：{{idea}}',
  'storyBeats.cast': '角色：',
  'storyBeats.scenes': '场景：',
  'storyBeats.props': '道具：{{props}}',
  'storyBeats.returnJson': '只回传段落 JSON 数组。',
  'storyBeats.noCast': '（无角色）',
  'storyBeats.noScenes': '（无场景 — sceneHint 可写地点）',
  'storyBeats.none': '（无）',
  'videoPolish.system': packs['zh-HK']['videoPolish.system']
    .replaceAll('用戶', '用户')
    .replaceAll('須', '须')
    .replaceAll('場', '场')
    .replaceAll('與', '与')
    .replaceAll('為', '为')
    .replaceAll('則', '则')
    .replaceAll('時', '时')
    .replaceAll('長', '长')
    .replaceAll('連', '连')
    .replaceAll('無', '无')
  ,
  'videoPolish.hardRulesKeep':
    'HARD RULES／生成铁则（最高优先——保留每一行；[Character · 名] 等物件标签不可删）。必须将完整 HARD RULES 区块放在输出最末。不得削弱、删除或套错主体。',
  'clip.task': '任务：短剧时间轴片段（图生影片）。',
  'clip.hasRef': '可能附有参考静图——相关时锁定身份／场地连续性。',
  'clip.characters': '角色：',
  'clip.scene': '场景：',
  'clip.prop': '道具：',
  'clip.action': '动作指导：',
  'clip.beat': '段落／对白：',
  'clip.prev': '前一段连续性：',
  'clip.revision': '导演修订（必须遵守）：',
  'clip.templateDraft': '模板草稿（请改进）：',
  'intro.task': '任务：自我介绍选角短片（图生影片）。',
  'intro.hasRef': '参考静图会交予影片 API——必须锁定该图身份。',
  'intro.noRef': '本文无静图路径；仍须锁定人设外貌／戏服。',
  'intro.dossier': '角色档案：',
  'intro.templateDraft': '模板草稿（请改进；勿忽略档案）：',
  'common.durationAspect': '时长：{{seconds}} 秒。画面比例：{{aspect}}。',
  'common.templateDraft': '模板草稿：'
}

packs.ja = {
  'speechLock.named':
    'SPEECH LOCK · キャラクター「{{who}}」：聞こえる音声と口の動きは必ず{{primaryName}}（{{primary}}）のみ。{{forbid}}や他言語に切り替えるな。クリップごとに言語を変えるな。台詞を翻訳するな。',
  'speechLock.unnamed':
    'SPEECH LOCK · 出演キャラクター：聞こえる音声と口の動きは必ず{{primaryName}}（{{primary}}）のみ。{{forbid}}や他言語に切り替えるな。クリップごとに言語を変えるな。台詞を翻訳するな。',
  'speechLock.namedMulti':
    'SPEECH LOCK · キャラクター「{{who}}」：聞こえる音声と口の動きは必ず{{primaryName}}（{{primary}}）。台本のその行が既にその言語である場合のみ第二言語を許可：{{extras}}。第三言語は禁止。クリップ間で切り替えるな。{{forbid}}へ変えるな。台詞を翻訳するな。',
  'speechLock.unnamedMulti':
    'SPEECH LOCK · 出演キャラクター：聞こえる音声と口の動きは必ず{{primaryName}}（{{primary}}）。台本のその行が既にその言語である場合のみ第二言語を許可：{{extras}}。第三言語は禁止。クリップ間で切り替えるな。{{forbid}}へ変えるな。台詞を翻訳するな。',
  'storyBeats.system': [
    'あなたはAI動画用の短編ドラマ「タイムライン・ビート」を書く。',
    '各ビート＝短いクリップ一本分の撮影脚本（一言の台詞ではない）。',
    '心情・雰囲気・動作・表情・任意のカメラ／効果音、0〜複数の台詞（よく1–4）を必ず含める。',
    'JSON配列だけを返す（フェンス禁止）。各要素の形：',
    storyJson,
    '規則：',
    '- dialogue.line は口に出す言葉だけ。ト書きを混ぜない。',
    '- 身体動作は action、表情は expression、言い方は tone／parenthetical。',
    '- 短い会話や独白では複数の dialogue を勧める。',
    '- 台詞なしの動作ビートも可。',
    '- 4–8本。キャスト名は提供リストのみ。',
    '- 対立・見える動作・撮れる细节。',
    '- タイトル・作風・キャスト・場面に忠実。足りなければ同じ世界で補う。',
    '- 台詞はキャスト表の主言語で書く。ビートごとに言語を変えない。指定以外へ翻訳しない。'
  ].join('\n'),
  'storyBeats.userLead':
    '以下のキャスト・場面・小道具・作風・指示をすべて使い、短いクリップ脚本ビートを生成せよ。',
  'storyBeats.eachBeat':
    '各ビートに心情・雰囲気・動作／表情、任意の複数台詞が必要。',
  'storyBeats.story': '物語：{{title}}',
  'storyBeats.style': '作風：{{style}}',
  'storyBeats.userDir': 'ユーザー指示：{{idea}}',
  'storyBeats.cast': 'キャスト：',
  'storyBeats.scenes': '場面：',
  'storyBeats.props': '小道具：{{props}}',
  'storyBeats.returnJson': 'ビートのJSON配列だけを返せ。',
  'storyBeats.noCast': '（キャストなし）',
  'storyBeats.noScenes': '（場面なし — sceneHint に場所を書いてよい）',
  'storyBeats.none': '（なし）',
  'videoPolish.system': [
    '短編ドラマ用AIの image-to-video 向けに、最終演出プロンプトを一条だけ書く。',
    'プロンプト本文だけを返す。markdownフェンス・見出し・解説は禁止。',
    '規則：',
    '- 演出文はユーザー界面言語。キャラ名と台詞言語の指定は明確に。',
    '- 人物スチール：IDENTITY LOCK。場所プレート：SPACE LOCK。空セット優先。新しい顔を足すな。',
    '- 見た目・動き・台詞・雰囲気に効く資料はすべて使え。空欄は略してよい。',
    '- 材料とseedだけで撮れる细节を補う。固定サンプル世界やDemo事実を持ち込むな。',
    '- 長い soul.md は演技と身元の要点に圧縮し、全文貼るな。',
    '- 6–10秒。動作は連続。映画的。字幕・ロゴ・透かし・無関係な通行人なし。',
    '- 脚本が求めない限り人体は正常（両手両足）。',
    '- 複数キャラは各自を一貫。主焦点を先に。',
    '- HARD RULES があれば残し、出力の末尾へ（最優先）。',
    '- SPEECH LOCK は必須。削除・改変・翻訳するな。言語コードはフルネームに。主言語を守れ。クリップ間で言語を変えるな。',
    '- 演出修正は雰囲気／動作のみ。HARD RULES を破るな。'
  ].join('\n'),
  'videoPolish.hardRulesKeep':
    'HARD RULES（最優先——各行を残せ。[Character · 名] などのラベルを消すな）。完全な HARD RULES ブロックを出力の末尾に置け。弱めたり付け替えたりするな。',
  'clip.task': '任務：短編ドラマのタイムライン・クリップ（image-to-video）。',
  'clip.hasRef': '参照スチールが付く場合あり——関係するなら身元／場所の連続性をロック。',
  'clip.characters': 'キャラクター：',
  'clip.scene': '場面：',
  'clip.prop': '小道具：',
  'clip.action': '動作ガイド：',
  'clip.beat': 'ビート／台詞：',
  'clip.prev': '前クリップの連続性：',
  'clip.revision': '演出修正（必ず従え）：',
  'clip.templateDraft': 'テンプレ草案（改善せよ）：',
  'intro.task': '任務：自己紹介のキャスティング短編（image-to-video）。',
  'intro.hasRef': '参照スチールは動画APIへ渡す——その画像の身元にロックせよ。',
  'intro.noRef': '本文にスチール経路はない。それでもプロフィールの外見／衣装にロック。',
  'intro.dossier': 'キャラクター資料：',
  'intro.templateDraft': 'テンプレ草案（改善せよ。資料を無視するな）：',
  'common.durationAspect': '尺：{{seconds}}秒。画角：{{aspect}}。',
  'common.templateDraft': 'テンプレ草案：'
}

function fromEn(over) {
  return { ...packs.en, ...over }
}

packs.es = fromEn({
  'speechLock.named':
    'SPEECH LOCK · Personaje "{{who}}": el habla audible Y el lip-sync DEBEN ser solo {{primaryName}} ({{primary}}). No hables {{forbid}} ni otro idioma. Mantén el mismo idioma en cada clip. No traduzcas el diálogo.',
  'speechLock.unnamed':
    'SPEECH LOCK · Personajes que hablan: el habla audible Y el lip-sync DEBEN ser solo {{primaryName}} ({{primary}}). No hables {{forbid}} ni otro idioma. Mantén el mismo idioma en cada clip. No traduzcas el diálogo.',
  'speechLock.namedMulti':
    'SPEECH LOCK · Personaje "{{who}}": el habla audible Y el lip-sync DEBEN ser {{primaryName}} ({{primary}}). Otros idiomas SOLO si la línea del guion ya está en ese idioma: {{extras}}. Nunca un tercer idioma. No cambies de idioma entre clips. No pases a {{forbid}}. No traduzcas el diálogo.',
  'speechLock.unnamedMulti':
    'SPEECH LOCK · Personajes que hablan: el habla audible Y el lip-sync DEBEN ser {{primaryName}} ({{primary}}). Otros idiomas SOLO si la línea del guion ya está en ese idioma: {{extras}}. Nunca un tercer idioma. No cambies de idioma entre clips. No pases a {{forbid}}. No traduzcas el diálogo.',
  'storyBeats.userLead':
    'GENERA beats de guion de clip usando TODO el elenco, escenas, props, estilo e idea de abajo.',
  'storyBeats.eachBeat':
    'Cada beat necesita ánimo + atmósfera + acciones/expresiones + diálogo opcional.',
  'storyBeats.story': 'Historia: {{title}}',
  'storyBeats.style': 'Estilo: {{style}}',
  'storyBeats.userDir': 'Indicación del usuario: {{idea}}',
  'storyBeats.cast': 'Elenco:',
  'storyBeats.scenes': 'Escenas:',
  'storyBeats.props': 'Atrezzo: {{props}}',
  'storyBeats.returnJson': 'Devuelve solo el array JSON de beats.',
  'storyBeats.noCast': '(sin elenco)',
  'storyBeats.noScenes': '(sin escenas — inventa lugares en sceneHint)',
  'storyBeats.none': '(ninguno)',
  'clip.task': 'TAREA: clip de línea de tiempo de drama corto (imagen a vídeo).',
  'clip.characters': 'Personajes:',
  'clip.scene': 'Escena:',
  'clip.prop': 'Atrezzo:',
  'clip.action': 'Guía de acción / movimiento:',
  'clip.beat': 'Beat / diálogo:',
  'clip.prev': 'Continuidad del clip anterior:',
  'clip.revision': 'REVISIÓN DEL DIRECTOR (obligatoria):',
  'clip.templateDraft': 'Borrador de plantilla (mejora):',
  'intro.task': 'TAREA: clip de presentación de casting (imagen a vídeo).',
  'intro.dossier': 'Dossier del personaje:',
  'intro.templateDraft': 'Borrador de plantilla (mejora; no ignores el dossier):',
  'common.durationAspect': 'Duración: {{seconds}}s. Relación: {{aspect}}.',
  'common.templateDraft': 'Borrador de plantilla:'
})

packs.fr = fromEn({
  'speechLock.named':
    'SPEECH LOCK · Personnage « {{who}} » : la voix audible ET le lip-sync DOIVENT être uniquement {{primaryName}} ({{primary}}). Ne passez pas à {{forbid}} ni à une autre langue. Gardez la même langue à chaque clip. Ne traduisez pas les répliques.',
  'speechLock.unnamed':
    'SPEECH LOCK · Personnages parlants : la voix audible ET le lip-sync DOIVENT être uniquement {{primaryName}} ({{primary}}). Ne passez pas à {{forbid}} ni à une autre langue. Gardez la même langue à chaque clip. Ne traduisez pas les répliques.',
  'speechLock.namedMulti':
    'SPEECH LOCK · Personnage « {{who}} » : la voix audible ET le lip-sync DOIVENT être {{primaryName}} ({{primary}}). Autres langues UNIQUEMENT si la réplique écrite est déjà dans cette langue : {{extras}}. Jamais une troisième langue. Ne changez pas de langue entre les clips. Ne passez pas à {{forbid}}. Ne traduisez pas.',
  'speechLock.unnamedMulti':
    'SPEECH LOCK · Personnages parlants : la voix audible ET le lip-sync DOIVENT être {{primaryName}} ({{primary}}). Autres langues UNIQUEMENT si la réplique écrite est déjà dans cette langue : {{extras}}. Jamais une troisième langue. Ne changez pas de langue entre les clips. Ne passez pas à {{forbid}}. Ne traduisez pas.',
  'storyBeats.userLead':
    'GÉNÉREZ des beats de scénario de clip avec TOUT le casting, scènes, accessoires, style et idée ci-dessous.',
  'storyBeats.eachBeat':
    'Chaque beat doit avoir humeur + atmosphère + actions/expressions + dialogues optionnels.',
  'storyBeats.story': 'Histoire : {{title}}',
  'storyBeats.style': 'Style : {{style}}',
  'storyBeats.userDir': 'Consigne utilisateur : {{idea}}',
  'storyBeats.cast': 'Casting :',
  'storyBeats.scenes': 'Scènes :',
  'storyBeats.props': 'Accessoires : {{props}}',
  'storyBeats.returnJson': 'Renvoyez uniquement le tableau JSON des beats.',
  'storyBeats.noCast': '(pas de casting)',
  'storyBeats.noScenes': '(pas de scènes — inventez les lieux dans sceneHint)',
  'storyBeats.none': '(aucun)',
  'clip.task': 'TÂCHE : clip de timeline de court-métrage (image vers vidéo).',
  'clip.characters': 'Personnages :',
  'clip.scene': 'Scène :',
  'clip.prop': 'Accessoire :',
  'clip.action': 'Guide d’action / mouvement :',
  'clip.beat': 'Beat / dialogues :',
  'clip.prev': 'Continuité du clip précédent :',
  'clip.revision': 'RÉVISION DU RÉALISATEUR (obligatoire) :',
  'clip.templateDraft': 'Brouillon de modèle (à améliorer) :',
  'intro.task': 'TÂCHE : clip de présentation de casting (image vers vidéo).',
  'intro.dossier': 'Dossier personnage :',
  'intro.templateDraft': 'Brouillon de modèle (améliorez ; n’ignorez pas le dossier) :',
  'common.durationAspect': 'Durée : {{seconds}} s. Format : {{aspect}}.',
  'common.templateDraft': 'Brouillon de modèle :'
})

packs['pt-BR'] = fromEn({
  'speechLock.named':
    'SPEECH LOCK · Personagem "{{who}}": a fala audível E o lip-sync DEVEM ser só {{primaryName}} ({{primary}}). Não fale {{forbid}} nem outro idioma. Mantenha o mesmo idioma em cada clipe. Não traduza o diálogo.',
  'speechLock.unnamed':
    'SPEECH LOCK · Personagens que falam: a fala audível E o lip-sync DEVEM ser só {{primaryName}} ({{primary}}). Não fale {{forbid}} nem outro idioma. Mantenha o mesmo idioma em cada clipe. Não traduza o diálogo.',
  'speechLock.namedMulti':
    'SPEECH LOCK · Personagem "{{who}}": a fala audível E o lip-sync DEVEM ser {{primaryName}} ({{primary}}). Outros idiomas SÓ se a linha do roteiro já estiver nesse idioma: {{extras}}. Nunca um terceiro idioma. Não troque de idioma entre clipes. Não mude para {{forbid}}. Não traduza.',
  'speechLock.unnamedMulti':
    'SPEECH LOCK · Personagens que falam: a fala audível E o lip-sync DEVEM ser {{primaryName}} ({{primary}}). Outros idiomas SÓ se a linha do roteiro já estiver nesse idioma: {{extras}}. Nunca um terceiro idioma. Não troque de idioma entre clipes. Não mude para {{forbid}}. Não traduza.',
  'storyBeats.userLead':
    'GERE beats de roteiro de clipe usando TODO o elenco, cenas, props, estilo e ideia abaixo.',
  'storyBeats.eachBeat':
    'Cada beat precisa de humor + atmosfera + ações/expressões + diálogo opcional.',
  'storyBeats.story': 'História: {{title}}',
  'storyBeats.style': 'Estilo: {{style}}',
  'storyBeats.userDir': 'Indicação do usuário: {{idea}}',
  'storyBeats.cast': 'Elenco:',
  'storyBeats.scenes': 'Cenas:',
  'storyBeats.props': 'Objetos: {{props}}',
  'storyBeats.returnJson': 'Devolva só o array JSON dos beats.',
  'storyBeats.noCast': '(sem elenco)',
  'storyBeats.noScenes': '(sem cenas — invente lugares em sceneHint)',
  'storyBeats.none': '(nenhum)',
  'clip.task': 'TAREFA: clipe da timeline de drama curto (imagem para vídeo).',
  'clip.characters': 'Personagens:',
  'clip.scene': 'Cena:',
  'clip.prop': 'Objeto:',
  'clip.action': 'Guia de ação / movimento:',
  'clip.beat': 'Beat / diálogo:',
  'clip.prev': 'Continuidade do clipe anterior:',
  'clip.revision': 'REVISÃO DO DIRETOR (obrigatória):',
  'clip.templateDraft': 'Rascunho de modelo (melhorar):',
  'intro.task': 'TAREFA: clipe de apresentação de elenco (imagem para vídeo).',
  'intro.dossier': 'Dossiê do personagem:',
  'intro.templateDraft': 'Rascunho de modelo (melhore; não ignore o dossiê):',
  'common.durationAspect': 'Duração: {{seconds}}s. Proporção: {{aspect}}.',
  'common.templateDraft': 'Rascunho de modelo:'
})

packs.ru = fromEn({
  'speechLock.named':
    'SPEECH LOCK · Персонаж «{{who}}»: слышимая речь И артикуляция ДОЛЖНЫ быть только {{primaryName}} ({{primary}}). Не переходите на {{forbid}} или другой язык. Один язык на всех клипах. Не переводите реплики.',
  'speechLock.unnamed':
    'SPEECH LOCK · Говорящие персонажи: слышимая речь И артикуляция ДОЛЖНЫ быть только {{primaryName}} ({{primary}}). Не переходите на {{forbid}} или другой язык. Один язык на всех клипах. Не переводите реплики.',
  'speechLock.namedMulti':
    'SPEECH LOCK · Персонаж «{{who}}»: слышимая речь И артикуляция ДОЛЖНЫ быть {{primaryName}} ({{primary}}). Другие языки ТОЛЬКО если строка сценария уже на этом языке: {{extras}}. Третий язык запрещён. Не меняйте язык между клипами. Не переходите на {{forbid}}. Не переводите.',
  'speechLock.unnamedMulti':
    'SPEECH LOCK · Говорящие персонажи: слышимая речь И артикуляция ДОЛЖНЫ быть {{primaryName}} ({{primary}}). Другие языки ТОЛЬКО если строка сценария уже на этом языке: {{extras}}. Третий язык запрещён. Не меняйте язык между клипами. Не переходите на {{forbid}}. Не переводите.',
  'storyBeats.userLead':
    'Сгенерируй биты сценария клипа, используя ВЕСЬ каст, сцены, реквизит, стиль и идею ниже.',
  'storyBeats.eachBeat':
    'В каждом бите нужны настроение + атмосфера + действия/мимика + необязательный диалог.',
  'storyBeats.story': 'История: {{title}}',
  'storyBeats.style': 'Стиль: {{style}}',
  'storyBeats.userDir': 'Указание пользователя: {{idea}}',
  'storyBeats.cast': 'Каст:',
  'storyBeats.scenes': 'Сцены:',
  'storyBeats.props': 'Реквизит: {{props}}',
  'storyBeats.returnJson': 'Верни только JSON-массив битов.',
  'storyBeats.noCast': '(нет каста)',
  'storyBeats.noScenes': '(нет сцен — придумай места в sceneHint)',
  'storyBeats.none': '(нет)',
  'clip.task': 'ЗАДАЧА: клип шкалы короткой драмы (изображение в видео).',
  'clip.characters': 'Персонажи:',
  'clip.scene': 'Сцена:',
  'clip.prop': 'Реквизит:',
  'clip.action': 'Гид по действию / движению:',
  'clip.beat': 'Бит / диалог:',
  'clip.prev': 'Непрерывность предыдущего клипа:',
  'clip.revision': 'ПРАВКА РЕЖИССЁРА (обязательно):',
  'clip.templateDraft': 'Черновик шаблона (улучшить):',
  'intro.task': 'ЗАДАЧА: клип самопредставления для кастинга (изображение в видео).',
  'intro.dossier': 'Досье персонажа:',
  'intro.templateDraft': 'Черновик шаблона (улучши; не игнорируй досье):',
  'common.durationAspect': 'Длительность: {{seconds}} с. Соотношение: {{aspect}}.',
  'common.templateDraft': 'Черновик шаблона:'
})

packs.hi = fromEn({
  'speechLock.named':
    'SPEECH LOCK · पात्र "{{who}}": सुनाई देने वाली बोली और होंठों की गति केवल {{primaryName}} ({{primary}}) हो। {{forbid}} या कोई और भाषा न बोलें। हर क्लिप पर वही भाषा रखें। संवाद का अनुवाद न करें।',
  'speechLock.unnamed':
    'SPEECH LOCK · बोलने वाले पात्र: सुनाई देने वाली बोली और होंठों की गति केवल {{primaryName}} ({{primary}}) हो। {{forbid}} या कोई और भाषा न बोलें। हर क्लिप पर वही भाषा रखें। संवाद का अनुवाद न करें।',
  'speechLock.namedMulti':
    'SPEECH LOCK · पात्र "{{who}}": सुनाई देने वाली बोली और होंठों की गति {{primaryName}} ({{primary}}) हो। दूसरी भाषा तभी जब पंक्ति पहले से उस भाषा में हो: {{extras}}। तीसरी भाषा वर्जित। क्लिप के बीच भाषा न बदलें। {{forbid}} पर न जाएँ। अनुवाद न करें।',
  'speechLock.unnamedMulti':
    'SPEECH LOCK · बोलने वाले पात्र: सुनाई देने वाली बोली और होंठों की गति {{primaryName}} ({{primary}}) हो। दूसरी भाषा तभी जब पंक्ति पहले से उस भाषा में हो: {{extras}}। तीसरी भाषा वर्जित। क्लिप के बीच भाषा न बदलें। {{forbid}} पर न जाएँ। अनुवाद न करें।',
  'storyBeats.userLead':
    'नीचे का पूरा कास्ट, दृश्य, प्रॉप्स, शैली और विचार इस्तेमाल कर क्लिप पटकथा बीट बनाएँ।',
  'storyBeats.eachBeat':
    'हर बीट में मूड + माहौल + क्रिया/अभिव्यक्ति + वैकल्पिक संवाद चाहिए।',
  'storyBeats.story': 'कहानी: {{title}}',
  'storyBeats.style': 'शैली: {{style}}',
  'storyBeats.userDir': 'उपयोगकर्ता निर्देश: {{idea}}',
  'storyBeats.cast': 'कास्ट:',
  'storyBeats.scenes': 'दृश्य:',
  'storyBeats.props': 'प्रॉप्स: {{props}}',
  'storyBeats.returnJson': 'केवल बीट्स का JSON ऐरे लौटाएँ।',
  'storyBeats.noCast': '(कोई कास्ट नहीं)',
  'storyBeats.noScenes': '(कोई दृश्य नहीं — sceneHint में स्थान लिखें)',
  'storyBeats.none': '(कोई नहीं)',
  'clip.task': 'कार्य: लघु नाटक टाइमलाइन क्लिप (छवि से वीडियो)।',
  'clip.characters': 'पात्र:',
  'clip.scene': 'दृश्य:',
  'clip.prop': 'प्रॉप:',
  'clip.action': 'क्रिया / गति गाइड:',
  'clip.beat': 'बीट / संवाद:',
  'clip.prev': 'पिछले क्लिप की निरंतरता:',
  'clip.revision': 'निर्देशक संशोधन (पालन अनिवार्य):',
  'clip.templateDraft': 'टेम्पलेट मसौदा (सुधारें):',
  'intro.task': 'कार्य: कास्टिंग परिचय क्लिप (छवि से वीडियो)।',
  'intro.dossier': 'पात्र डोजियर:',
  'intro.templateDraft': 'टेम्पलेट मसौदा (सुधारें; डोजियर न छोड़ें):',
  'common.durationAspect': 'अवधि: {{seconds}} सेकंड। अनुपात: {{aspect}}।',
  'common.templateDraft': 'टेम्पलेट मसौदा:'
})

packs.ar = fromEn({
  'speechLock.named':
    'SPEECH LOCK · الشخصية «{{who}}»: الكلام المسموع ومزامنة الشفاه يجب أن تكون {{primaryName}} ({{primary}}) فقط. لا تتحدث {{forbid}} ولا أي لغة أخرى. أبقِ اللغة نفسها في كل مقطع. لا تترجم الحوار.',
  'speechLock.unnamed':
    'SPEECH LOCK · الشخصيات المتحدثة: الكلام المسموع ومزامنة الشفاه يجب أن تكون {{primaryName}} ({{primary}}) فقط. لا تتحدث {{forbid}} ولا أي لغة أخرى. أبقِ اللغة نفسها في كل مقطع. لا تترجم الحوار.',
  'speechLock.namedMulti':
    'SPEECH LOCK · الشخصية «{{who}}»: الكلام المسموع ومزامنة الشفاه يجب أن تكون {{primaryName}} ({{primary}}). لغات أخرى فقط إذا كان سطر النص بهذه اللغة أصلًا: {{extras}}. لغة ثالثة ممنوعة. لا تبدّل اللغة بين المقاطع. لا تنتقل إلى {{forbid}}. لا تترجم.',
  'speechLock.unnamedMulti':
    'SPEECH LOCK · الشخصيات المتحدثة: الكلام المسموع ومزامنة الشفاه يجب أن تكون {{primaryName}} ({{primary}}). لغات أخرى فقط إذا كان سطر النص بهذه اللغة أصلًا: {{extras}}. لغة ثالثة ممنوعة. لا تبدّل اللغة بين المقاطع. لا تنتقل إلى {{forbid}}. لا تترجم.',
  'storyBeats.userLead':
    'أنشئ إيقاعات سيناريو المقطع باستخدام كل الطاقم والمشاهد والإكسسوارات والأسلوب والفكرة أدناه.',
  'storyBeats.eachBeat':
    'كل إيقاع يحتاج مزاجًا + أجواء + أفعال/تعبيرات + حوارًا اختياريًا.',
  'storyBeats.story': 'القصة: {{title}}',
  'storyBeats.style': 'الأسلوب: {{style}}',
  'storyBeats.userDir': 'توجيه المستخدم: {{idea}}',
  'storyBeats.cast': 'الطاقم:',
  'storyBeats.scenes': 'المشاهد:',
  'storyBeats.props': 'الإكسسوارات: {{props}}',
  'storyBeats.returnJson': 'أرجع مصفوفة JSON للإيقاعات فقط.',
  'storyBeats.noCast': '(لا طاقم)',
  'storyBeats.noScenes': '(لا مشاهد — اخترع الأماكن في sceneHint)',
  'storyBeats.none': '(لا شيء)',
  'clip.task': 'المهمة: مقطع خط زمني لدراما قصيرة (صورة إلى فيديو).',
  'clip.characters': 'الشخصيات:',
  'clip.scene': 'المشهد:',
  'clip.prop': 'الإكسسوار:',
  'clip.action': 'دليل الحركة:',
  'clip.beat': 'الإيقاع / الحوار:',
  'clip.prev': 'استمرارية المقطع السابق:',
  'clip.revision': 'مراجعة المخرج (إلزامية):',
  'clip.templateDraft': 'مسودة القالب (حسّنها):',
  'intro.task': 'المهمة: مقطع تعريف للتمثيل (صورة إلى فيديو).',
  'intro.dossier': 'ملف الشخصية:',
  'intro.templateDraft': 'مسودة القالب (حسّنها؛ لا تتجاهل الملف):',
  'common.durationAspect': 'المدة: {{seconds}} ث. النسبة: {{aspect}}.',
  'common.templateDraft': 'مسودة القالب:'
})

const fileName = {
  en: 'en.ts',
  'zh-HK': 'zh-HK.ts',
  'zh-CN': 'zh-CN.ts',
  ja: 'ja.ts',
  es: 'es.ts',
  fr: 'fr.ts',
  'pt-BR': 'pt-BR.ts',
  ru: 'ru.ts',
  hi: 'hi.ts',
  ar: 'ar.ts'
}

const exportName = {
  en: 'enPromptCopy',
  'zh-HK': 'zhHkPromptCopy',
  'zh-CN': 'zhCnPromptCopy',
  ja: 'jaPromptCopy',
  es: 'esPromptCopy',
  fr: 'frPromptCopy',
  'pt-BR': 'ptBrPromptCopy',
  ru: 'ruPromptCopy',
  hi: 'hiPromptCopy',
  ar: 'arPromptCopy'
}

for (const [id, table] of Object.entries(packs)) {
  const body = `import type { PromptCopyTable } from './keys'\n\nexport const ${exportName[id]}: PromptCopyTable = ${JSON.stringify(table, null, 2)}\n`
  writeFileSync(join(dir, fileName[id]), body)
  console.log('wrote', fileName[id], Object.keys(table).length)
}
