import type { MediaGenMaterialSection } from './mediaGenPrep'

/**
 * Camera / performance templates for intro and photo-book stills + clips.
 * Distinct from MediaGen LLM recipes (`follow-asset` / `identity-lock` in promptTemplates).
 */
export const INTRO_VIDEO_TEMPLATE_IDS = [
  'hero-walkin',
  'talking-head',
  'turnaround',
  'atmosphere',
  'action-beat',
  'close-up',
  'over-shoulder',
  'follow-asset',
  'low-angle-hero',
  'high-angle',
  'tracking-side',
  'dolly-in',
  'handheld',
  'silhouette',
  'window-light',
  'insert-detail',
  'pov',
  'slow-motion'
] as const

export type IntroVideoTemplateId = (typeof INTRO_VIDEO_TEMPLATE_IDS)[number]

export const DEFAULT_INTRO_VIDEO_TEMPLATE: IntroVideoTemplateId = 'hero-walkin'

export type IntroDirectorLocale = 'zh-HK' | 'en'

export type IntroVideoTemplateDef = {
  id: IntroVideoTemplateId
  group: 'performance' | 'camera'
  stillPrompt: Record<IntroDirectorLocale, string>
  director: Record<IntroDirectorLocale, string>
}

export const INTRO_TEMPLATE_GROUPS: Array<{
  id: IntroVideoTemplateDef['group']
  ids: IntroVideoTemplateId[]
}> = [
  {
    id: 'performance',
    ids: [
      'hero-walkin',
      'talking-head',
      'turnaround',
      'atmosphere',
      'action-beat',
      'close-up',
      'over-shoulder',
      'follow-asset'
    ]
  },
  {
    id: 'camera',
    ids: [
      'low-angle-hero',
      'high-angle',
      'tracking-side',
      'dolly-in',
      'handheld',
      'silhouette',
      'window-light',
      'insert-detail',
      'pov',
      'slow-motion'
    ]
  }
]

export const INTRO_VIDEO_TEMPLATES: IntroVideoTemplateDef[] = [
  {
    id: 'hero-walkin',
    group: 'performance',
    stillPrompt: {
      'zh-HK':
        '全身或膝上構圖，角色剛踏入畫面中央，重心在前腳、步伐未完全收住。鏡頭略低、主體清晰、場景深度可讀。眼神對準鏡頭或行進方向。禁止裁掉頭頂或腳。',
      en: 'Full or knee-up frame as the character has just stepped into center, weight on the leading foot. Slightly low camera, readable depth. Eyes to camera or along the path. Do not crop the crown or feet.'
    },
    director: {
      'zh-HK':
        '英雄入場：角色由畫面外走進鏡頭中央，步伐有重量與節奏，停步後對鏡頭有短暫眼神。鏡頭可輕微前推，背景保持穩定，身份與服裝全程可辨。',
      en: 'Hero walk-in: enter from off-frame toward center with weight and rhythm, then hold a brief look to camera. A slight push-in is allowed; keep identity and wardrobe readable.'
    }
  },
  {
    id: 'talking-head',
    group: 'performance',
    stillPrompt: {
      'zh-HK':
        '頭肩中近景，眼睛落在上三分之一，口型自然微開或將言。背景簡潔穩定，臉部光線清楚，勿遮住五官。',
      en: 'Head-and-shoulders medium close-up, eyes on the upper third, mouth naturally parted as if about to speak. Stable simple background, clear face light, features unobstructed.'
    },
    director: {
      'zh-HK':
        '對鏡自介：中近景頭肩，口型自然、對鏡頭說話，肩線穩定。可有極小點頭，禁止大幅晃鏡或走位出畫。',
      en: 'Talking head: medium close-up, natural lip sync to camera, stable shoulders. Tiny nods only; no wild handheld or walking out of frame.'
    }
  },
  {
    id: 'turnaround',
    group: 'performance',
    stillPrompt: {
      'zh-HK':
        '全身入畫，角色呈四分之三側面，一腳略提起或重心轉移，暗示即將原地轉身。服裝輪廓完整，頭到腳都在框內。',
      en: 'Full body, three-quarter stance with a hint of rotation (weight shift or lifted heel). Complete costume silhouette, head-to-toe in frame.'
    },
    director: {
      'zh-HK':
        '轉體展示：角色原地緩慢轉一圈，依次展示正面、側面與背面造型。轉速均勻，停在正面結束。鏡頭固定或極慢環繞，勿跳剪。',
      en: 'Turnaround: slow in-place rotation showing front, three-quarter, and back, ending on front. Even speed; locked-off or very slow orbit, no jump cuts.'
    }
  },
  {
    id: 'atmosphere',
    group: 'performance',
    stillPrompt: {
      'zh-HK':
        '人小景大或中景，角色靜處於場景光影之中。環境層次（建築、天氣、實物）主導畫面，臉仍可辨。空氣感、塵、雨或光束可加強，勿變成空鏡。',
      en: 'Wide or medium: the character holds inside the location’s light. Environment leads, face still readable. Atmosphere (dust, rain, beams) is welcome; never an empty plate.'
    },
    director: {
      'zh-HK':
        '氛圍鏡頭：角色靜處場景之中，光影與環境主導。只做呼吸、眨眼與極小重心轉移。鏡頭可極慢推移，禁止劇烈動作搶戲。',
      en: 'Atmosphere: hold in the space; light and environment lead. Breath, blink, tiny weight shifts only. Ultra-slow drift allowed; no action stealing the shot.'
    }
  },
  {
    id: 'action-beat',
    group: 'performance',
    stillPrompt: {
      'zh-HK':
        '捕捉選定動作的高潮姿勢：起勢或收勢清楚、四肢可讀、重心合理。鏡頭選擇能看清動作線的角度，勿用極端變形廣角。',
      en: 'Peak pose of the chosen action: clear start or finish, readable limbs, believable balance. Angle that shows the action line; avoid extreme distorting wide-angle.'
    },
    director: {
      'zh-HK':
        '動作節拍：跟隨選定動作做一個清晰短拍，開始姿勢與結束姿勢都須可讀。中段只做一次發力，然後穩定。鏡頭跟隨動作，但保持臉與身份。',
      en: 'Action beat: one readable short beat of the chosen action, with clear start and end poses. One impulse in the middle, then settle. Follow the move; keep the face.'
    }
  },
  {
    id: 'close-up',
    group: 'performance',
    stillPrompt: {
      'zh-HK':
        '面容或關鍵細節特寫，眼睛銳利，皮膚質感與微表情可見。焦點在瞳孔或指定物件，背景大幅虛化但色調與場景一致。',
      en: 'Face or key-detail close-up: sharp eyes, skin and micro-expression visible. Focus on the pupil or named object; background soft but color-matched to the set.'
    },
    director: {
      'zh-HK':
        '特寫：緩緩推近面容或關鍵細節，微表情與眼神是重點。呼吸帶動肩線極小起伏。禁止突然變焦或切到全身。',
      en: 'Close-up: slow push onto face or a key detail; micro-expression and eyes lead. Tiny breath in the shoulders. No snap zooms or cut to full body.'
    }
  },
  {
    id: 'over-shoulder',
    group: 'performance',
    stillPrompt: {
      'zh-HK':
        '過肩構圖：近景肩與後腦佔畫面一側，前方是場景或道具。角色頭部朝向遠景主體，空間關係清楚，雙肩不要切掉。',
      en: 'Over-shoulder: near shoulder and nape occupy one side; the space or prop leads beyond. Head aims at the far subject; do not crop both shoulders off.'
    },
    director: {
      'zh-HK':
        '過肩：鏡頭過角色肩頭望向場景或道具，交代空間關係。角色可微轉頭，肩線穩定。前景肩保持半透明遮擋，勿完全擋住臉。',
      en: 'Over-shoulder: look past the shoulder into the space or prop. A slight head turn is allowed; keep the near shoulder as a soft occluder, not a face-block.'
    }
  },
  {
    id: 'follow-asset',
    group: 'performance',
    stillPrompt: {
      'zh-HK':
        '角色與指定場景／道具同框，資產輪廓完整可辨。構圖交代「人如何使用或靠近該物」，手與物的接觸或距離清楚。',
      en: 'Character and named scene/prop share the frame; the asset is fully readable. Show how the person uses or approaches it; hand-to-object distance is clear.'
    },
    director: {
      'zh-HK':
        '跟隨資產：鏡頭隨角色與場景／道具的關係移動，資產始終可辨。角色靠近、觸碰或繞行該物，動作連貫，禁止換成另一件道具。',
      en: 'Follow asset: move with the character-to-scene/prop relationship; keep the asset readable. Approach, touch, or circle it in one continuous beat. Do not swap the prop.'
    }
  },
  {
    id: 'low-angle-hero',
    group: 'camera',
    stillPrompt: {
      'zh-HK':
        '低機位仰拍英雄構圖，鏡頭低於胸口，垂直線略向內收。角色佔畫面主導，天空或建築高處入畫，臉仍清楚，禁止畸變成卡通下巴。',
      en: 'Low-angle hero: camera below chest, mild converging verticals. The figure dominates; sky or high architecture in frame; face clear, no cartoon jaw distortion.'
    },
    director: {
      'zh-HK':
        '低機英雄：自下而上緩緩升起或固定仰拍，角色如紀念碑。可配合一次踏步或抬頭。保持身份，勿過度廣角扭曲五官。',
      en: 'Low-angle hero: slow rise or locked low look-up, figure as monument. One step or chin lift allowed. Keep identity; do not ultra-wide the face.'
    }
  },
  {
    id: 'high-angle',
    group: 'camera',
    stillPrompt: {
      'zh-HK':
        '高機位俯瞰，鏡頭在角色斜上方，地面或街道圖案可讀。角色完整入畫，頭部朝向清楚，勿變成平面地圖符號。',
      en: 'High angle from above-front; ground pattern readable. Full figure in frame, head orientation clear; not a flat map icon.'
    },
    director: {
      'zh-HK':
        '高機俯瞰：自斜上方緩慢下降或平移，交代角色在空間中的位置。角色可抬頭看鏡頭一次。禁止直上直下的監視器感。',
      en: 'High angle: slow drop or slide from above-front to place the figure in space. One look-up to camera allowed. Avoid CCTV straight-down.'
    }
  },
  {
    id: 'tracking-side',
    group: 'camera',
    stillPrompt: {
      'zh-HK':
        '正側跟拍靜幀：角色側面全身或膝上，行進方向留有前方空間。背景呈水平速度感（虛化條紋可有），臉部輪廓清楚。',
      en: 'Side-on tracking still: profile full or knee-up, lead room in the travel direction. Horizontal motion blur in the bg is optional; profile readable.'
    },
    director: {
      'zh-HK':
        '側面跟隨：鏡頭與角色同速橫移，保持側面構圖。步伐循環自然，背景向後流動。禁止突然改成正面或停下跟丟。',
      en: 'Lateral track: camera matches pace in profile. Natural gait; background streams backward. Do not snap to frontal or lose the follow.'
    }
  },
  {
    id: 'dolly-in',
    group: 'camera',
    stillPrompt: {
      'zh-HK':
        '中景構圖，角色面向鏡頭或微側，像軌道即將推近的第一格。眼睛有對焦點，前景可有輕微遮擋增加深度。',
      en: 'Medium shot facing or slight three-quarter, composed as the first frame of a dolly-in. Eyes have a focus point; mild foreground occluder for depth.'
    },
    director: {
      'zh-HK':
        '軌道推近：鏡頭沿直線緩慢推向眼睛或胸口，速度均勻，結束於中近景。角色只做呼吸與眼神。禁止推到變形大特寫。',
      en: 'Dolly-in: straight slow push toward eyes or chest, even speed, ending MCU. Breath and eyes only. Do not crash into a distorted ECU.'
    }
  },
  {
    id: 'handheld',
    group: 'camera',
    stillPrompt: {
      'zh-HK':
        '輕微手持構圖：地平線差約一兩度，主體仍居中可讀。像現場抓拍，但五官清楚、不運動模糊到無法辨認。',
      en: 'Mild handheld still: horizon off by a degree or two, subject still readable. Reportage feel without motion-smearing the face.'
    },
    director: {
      'zh-HK':
        '手持：鏡頭有呼吸般的微顫，跟隨角色小幅度移動。不要劇烈搖晃到臉糊掉。可有一次重新取景，然後穩定。',
      en: 'Handheld: breath-like micro-shake following small moves. Do not smear the face. One reframe, then settle.'
    }
  },
  {
    id: 'silhouette',
    group: 'camera',
    stillPrompt: {
      'zh-HK':
        '逆光剪影：角色輪廓完整（頭、肩、服裝外沿），內部幾乎無細節，背景是亮的天空、門口或燈光。仍須是該角色的體型，不是路人。',
      en: 'Backlit silhouette: complete outline (head, shoulders, costume edge), almost no interior detail, bright sky/door/light behind. Still this character’s body, not a stranger.'
    },
    director: {
      'zh-HK':
        '剪影：逆光下只見輪廓，角色緩慢走過亮部。可在結尾踏入半光讓臉短暫可辨。禁止從頭到尾變成黑塊或換成另一人。',
      en: 'Silhouette: outline only in backlight, slow walk across the bright field. Optional step into half-light so the face reads at the end. Never a black blob or a different person.'
    }
  },
  {
    id: 'window-light',
    group: 'camera',
    stillPrompt: {
      'zh-HK':
        '窗光或門口光：一側強光、一側柔暗，臉有明確光比。可見窗框、紗簾或門口線條。角色靠近光源，眼神有高光。',
      en: 'Window or doorway light: strong key on one side, soft fall-off on the other. Window frame, sheer, or jamb visible. Character near the source; catchlight in the eyes.'
    },
    director: {
      'zh-HK':
        '窗光：角色在窗邊或門口，光比固定。可轉身讓光線掃過臉。鏡頭緩慢橫移，保持光的方向，不要突然補光變平。',
      en: 'Window light: hold the ratio at the window or door. A turn so light wipes the face is allowed. Slow lateral move; never flatten with sudden fill.'
    }
  },
  {
    id: 'insert-detail',
    group: 'camera',
    stillPrompt: {
      'zh-HK':
        '插入特寫：手、道具、衣領或場景物件佔畫面主體，角色身份以手型、服裝或背景一角暗示。物件材質清楚，文字或紋樣可讀。',
      en: 'Insert: hands, prop, collar, or set dressing dominate. Identity is hinted by hands, wardrobe, or a sliver of the figure. Material readable; text or pattern sharp.'
    },
    director: {
      'zh-HK':
        '插入特寫：鏡頭落在手與物件的互動，慢動作拿起、放下或摩挲。可在頭尾露出角色肩或臉一角。禁止換成無關的商品特寫。',
      en: 'Insert: hands and object, slow pick-up, set-down, or rub. A sliver of shoulder or face at head/tail is good. Do not swap in an unrelated product shot.'
    }
  },
  {
    id: 'pov',
    group: 'camera',
    stillPrompt: {
      'zh-HK':
        '主觀視角：畫面即角色眼前所見，可有極淡的肩、手或髮絲入前景。場景透視從眼睛高度出發，勿用航拍。',
      en: 'POV: the frame is what the character sees; a faint shoulder, hand, or hair in the foreground is allowed. Eye-height perspective, not aerial.'
    },
    director: {
      'zh-HK':
        '主觀：鏡頭即角色視線，隨轉頭與走步輕微搖移。可有眨眼黑場極短。保持場景連續，禁止上帝視角切出去。',
      en: 'POV: camera is the gaze, with small pans from head turns and steps. A blink-black is ok if brief. Keep spatial continuity; no god’s-eye cutaway.'
    }
  },
  {
    id: 'slow-motion',
    group: 'camera',
    stillPrompt: {
      'zh-HK':
        '慢動作靜幀：捕捉動作中段的張力（髮、衣、雨、塵未落下）。姿勢拉伸但解剖合理，表情清楚。',
      en: 'Slow-motion still: mid-action tension (hair, cloth, rain, dust suspended). Stretched but anatomical pose; expression readable.'
    },
    director: {
      'zh-HK':
        '慢動作節拍：把一個短動作拉長，衣與髮延遲跟隨。開始與結束仍須可讀，中段不要停成靜止照片。鏡頭可微推。',
      en: 'Slow-motion beat: stretch one short action; cloth and hair drag. Start and end still readable; the middle must keep moving. A tiny push-in is allowed.'
    }
  }
]

export function isIntroVideoTemplateId(
  raw: string | null | undefined
): raw is IntroVideoTemplateId {
  return INTRO_VIDEO_TEMPLATE_IDS.includes(raw as IntroVideoTemplateId)
}

export function parseIntroVideoTemplateId(
  raw: string | null | undefined
): IntroVideoTemplateId | undefined {
  return isIntroVideoTemplateId(raw) ? raw : undefined
}

export function introTemplateLabelKey(id: IntroVideoTemplateId): string {
  return `introTemplates.${id}`
}

export function introDirectorLocale(
  lang?: string | null
): IntroDirectorLocale {
  return (lang || '').toLowerCase().startsWith('en') ? 'en' : 'zh-HK'
}

export function getIntroVideoTemplate(
  id: IntroVideoTemplateId
): IntroVideoTemplateDef | undefined {
  return INTRO_VIDEO_TEMPLATES.find((t) => t.id === id)
}

export function introTemplateStillBlock(
  id: IntroVideoTemplateId,
  locale?: string | null
): string {
  const loc = introDirectorLocale(locale)
  const def = getIntroVideoTemplate(id)
  const line = def?.stillPrompt[loc] ?? id
  return loc === 'en'
    ? `Camera still template (${id}):\n${line}`
    : `鏡頭靜圖範本（${id}）：\n${line}`
}

export function introTemplatePolishBlock(
  id: IntroVideoTemplateId,
  locale?: string | null
): string {
  const loc = introDirectorLocale(locale)
  const def = getIntroVideoTemplate(id)
  const line = def?.director[loc] ?? id
  return loc === 'en'
    ? `Shot performance template (${id}):\n${line}`
    : `鏡頭表演範本（${id}）：\n${line}`
}

/** Merge a camera template into MediaGen userExtra (no-op when id is missing/invalid). */
export function mergeIntroTemplateUserExtra(
  templateId: string | null | undefined,
  extra: string | null | undefined,
  locale?: string | null
): string | null {
  const id = parseIntroVideoTemplateId(templateId)
  const block = id ? introTemplatePolishBlock(id, locale) : ''
  const extraTrim = extra?.trim() || ''
  const parts = [block, extraTrim].filter(Boolean)
  return parts.length ? parts.join('\n\n') : null
}

/**
 * Single-shot camera kinds (stills + clips). Sheets / plates / comic pages /
 * identity swaps keep their own layout pickers.
 */
const CAMERA_TEMPLATE_KINDS = new Set([
  'story-cover',
  'timeline-still',
  'character-photoshoot',
  'key-art',
  'comic-intro',
  'character-intro',
  'scene-intro',
  'prop-intro',
  'costume-intro',
  'action-intro',
  'timeline-clip',
  'character-photoshoot-clip'
])

export function mediaGenKindUsesCameraTemplate(kind: string): boolean {
  return CAMERA_TEMPLATE_KINDS.has(kind)
}

/** Payload override, then stored entity id. Invalid / empty → undefined. */
export function resolveCameraTemplateId(
  payloadId?: string | null,
  storedId?: string | null
): IntroVideoTemplateId | undefined {
  return parseIntroVideoTemplateId(payloadId) ?? parseIntroVideoTemplateId(storedId)
}

export function cameraTemplateStillSection(
  id: IntroVideoTemplateId,
  locale?: string | null
): MediaGenMaterialSection {
  const zh = introDirectorLocale(locale) !== 'en'
  return {
    id: 'camera_template',
    kind: 'prompt-block',
    title: zh ? '鏡頭範本' : 'Camera template',
    entityType: 'layout',
    text: introTemplateStillBlock(id, locale),
    include: true,
    canBeEditBase: false,
    group: 'task'
  }
}

export function injectCameraTemplateStillSection(
  sections: MediaGenMaterialSection[],
  templateId: string | null | undefined,
  locale?: string | null
): MediaGenMaterialSection[] {
  const id = parseIntroVideoTemplateId(templateId)
  if (!id) return sections
  const next = cameraTemplateStillSection(id, locale)
  if (sections.some((s) => s.id === 'camera_template')) {
    return sections.map((s) => (s.id === 'camera_template' ? next : s))
  }
  return [...sections, next]
}

export function applyCameraTemplateStillMaterials(
  sections: MediaGenMaterialSection[],
  fallbackPrompt: string,
  templateId: string | null | undefined,
  locale?: string | null
): { sections: MediaGenMaterialSection[]; fallbackPrompt: string } {
  const id = parseIntroVideoTemplateId(templateId)
  if (!id) return { sections, fallbackPrompt }
  const block = introTemplateStillBlock(id, locale)
  const nextFallback = fallbackPrompt.includes(block)
    ? fallbackPrompt
    : [fallbackPrompt, block].filter(Boolean).join('\n')
  return {
    sections: injectCameraTemplateStillSection(sections, id, locale),
    fallbackPrompt: nextFallback
  }
}

export function mergeCameraTemplateIntoStillPrompt(
  prompt: string,
  templateId: string | null | undefined,
  locale?: string | null
): string {
  const id = parseIntroVideoTemplateId(templateId)
  if (!id) return prompt
  const block = introTemplateStillBlock(id, locale)
  if (!prompt.trim()) return block
  if (prompt.includes(block) || prompt.includes(`(${id})`)) return prompt
  return `${prompt}\n\n${block}`
}
