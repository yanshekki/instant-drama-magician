/**
 * Built-in photo-book actions (not Prisma rows).
 * Shot.actionId uses `sys:<id>` so it never collides with library UUIDs.
 */
export const SYSTEM_PHOTO_ACTION_PREFIX = 'sys:'

export const SYSTEM_PHOTO_ACTION_IDS = [
  'walk-in',
  'look-back',
  'sit-down',
  'turn-show',
  'hold-prop',
  'mirror-look',
  'run-start',
  'stand-survey',
  'lean-wall',
  'draw-item',
  'kneel',
  'wave'
] as const

export type SystemPhotoActionId = (typeof SYSTEM_PHOTO_ACTION_IDS)[number]

export type SystemPhotoActionLocale = 'zh-HK' | 'en'

export type SystemPhotoActionDef = {
  id: SystemPhotoActionId
  stillPrompt: Record<SystemPhotoActionLocale, string>
  videoPrompt: Record<SystemPhotoActionLocale, string>
}

export const SYSTEM_PHOTO_ACTIONS: SystemPhotoActionDef[] = [
  {
    id: 'walk-in',
    stillPrompt: {
      'zh-HK':
        '步行入場的靜姿：前腳落地、後腳跟上，身體略前傾。步伐自然，不是跑步。全身或膝上入畫。',
      en: 'Walk-in pose: leading foot down, trail foot catching up, slight forward lean. A walk, not a run. Full or knee-up.'
    },
    videoPrompt: {
      'zh-HK':
        '角色走入畫面，兩三步後在標記點停住。步伐節奏穩定，手臂自然擺動，停步後視線明確。',
      en: 'Walk into frame for two or three steps and stop on a mark. Even gait, natural arm swing, clear eyeline at the stop.'
    }
  },
  {
    id: 'look-back',
    stillPrompt: {
      'zh-HK':
        '回眸：身體仍朝前或微側，頭轉向鏡頭或後方光源，頸線拉長。眼神銳利，肩未完全轉過來。',
      en: 'Look-back: body still forward or slight profile, head turned to camera or a rear light, long neck. Sharp eyes; shoulders not fully around.'
    },
    videoPrompt: {
      'zh-HK':
        '先看前方，再慢慢回眸看鏡頭或身後，停住約一息。頭髮與衣領可延遲跟隨。不要整個人轉成正面走位。',
      en: 'Look ahead, then slowly look back to camera or behind, hold one breath. Hair and collar may lag. Do not fully turn and walk frontal.'
    }
  },
  {
    id: 'sit-down',
    stillPrompt: {
      'zh-HK':
        '坐下過程的中段或剛坐穩：膝彎、重心下降、手可扶椅或膝。表情從容，勿懸空坐在沒有座具的地方。',
      en: 'Mid sit or just settled: knees bent, weight dropping, a hand on seat or knee. Calm face. Do not hover with no seat.'
    },
    videoPrompt: {
      'zh-HK':
        '由站到坐，一次完成，接觸點清楚（椅、階、箱）。坐下後整理衣擺，然後靜住。禁止彈跳或瞬移坐下。',
      en: 'Stand to sit in one beat with a clear contact (chair, step, crate). Settle the clothes, then hold. No bounce or teleport sit.'
    }
  },
  {
    id: 'turn-show',
    stillPrompt: {
      'zh-HK':
        '轉身展示的四分之三角度，一手可輕輕拉開衣襟或展示側面輪廓。腳位成轉體預備。',
      en: 'Three-quarter turn-to-show: one hand may ease a lapel or reveal the side silhouette. Feet set for rotation.'
    },
    videoPrompt: {
      'zh-HK':
        '原地轉向，讓鏡頭看清正面到背面再回到四分之三。速度慢，停頓清楚。不是跳舞，是展示造型。',
      en: 'In-place turn so the camera reads front to back to three-quarter. Slow, with holds. Display, not a dance.'
    }
  },
  {
    id: 'hold-prop',
    stillPrompt: {
      'zh-HK':
        '雙手或單手持指定道具，握法合理，道具朝向鏡頭可辨。眼睛看道具或看鏡頭，肩放鬆。',
      en: 'Hold the named prop with a believable grip, object readable to camera. Eyes on the prop or to camera; shoulders easy.'
    },
    videoPrompt: {
      'zh-HK':
        '把道具拿到鏡頭可讀的位置，可輕輕轉動展示，然後穩定。手不要擋住識別特徵。禁止換成另一件物品。',
      en: 'Bring the prop to a readable hold, optional slow turn to show it, then steady. Hands must not hide identifiers. Do not swap the object.'
    }
  },
  {
    id: 'mirror-look',
    stillPrompt: {
      'zh-HK':
        '對鏡或對玻璃：角色看向反射面，臉與鏡中臉至少一個清楚。手可整理頭髮或衣領。',
      en: 'Mirror or glass: looking at the reflection; at least one of face or reflected face is sharp. A hand may tidy hair or collar.'
    },
    videoPrompt: {
      'zh-HK':
        '走近鏡面，對視自己，可伸手整理。鏡頭可過肩看鏡。保持同一人，不要鏡中是另一張臉。',
      en: 'Approach the glass, meet their own gaze, optional tidy. Over-shoulder into the reflection is allowed. Same person; never a different face in the mirror.'
    }
  },
  {
    id: 'run-start',
    stillPrompt: {
      'zh-HK':
        '起跑瞬間：後腳蹬地、前腳邁出、身體前傾，手臂反向擺。不是已經全速衝刺的模糊殘影。',
      en: 'Run start: back foot drive, front foot reaching, body lean, opposite arm. Not a full-sprint smear.'
    },
    videoPrompt: {
      'zh-HK':
        '由靜止加速跑出畫面或跑向標記點，前三步清楚。鏡頭可側面跟隨。不要無故飛起或滑步。',
      en: 'From still into a run for the first three readable steps, optional side follow. No floating or skating.'
    }
  },
  {
    id: 'stand-survey',
    stillPrompt: {
      'zh-HK':
        '佇立環顧：雙腳站穩，頭微轉、視線掃過場景。雙手自然下垂或插袋，警覺但不緊張。',
      en: 'Stand and survey: planted feet, head slightly turned, gaze sweeping the space. Hands down or in pockets; alert, not tense.'
    },
    videoPrompt: {
      'zh-HK':
        '站在原地慢慢轉頭掃描環境，可停在一處多看一秒。腳步幾乎不動。禁止來回踱步搶戲。',
      en: 'On the spot, slowly scan the space with the head; hold one beat on a point. Feet almost still. No pacing that steals the shot.'
    }
  },
  {
    id: 'lean-wall',
    stillPrompt: {
      'zh-HK':
        '倚牆或門框：一肩或背部接觸堅實表面，重心在一腿，另一腿可彎。接觸點有擠壓，不是懸空。',
      en: 'Lean on wall or jamb: shoulder or back on a solid plane, weight on one leg, other knee easy. Real contact, not hovering.'
    },
    videoPrompt: {
      'zh-HK':
        '走近並倚上牆或門，調整重心後靜住，可低頭或抬眼。接觸始終成立。禁止穿牆。',
      en: 'Walk up and settle into the lean, then hold; optional look down or up. Contact stays true. No clipping through the wall.'
    }
  },
  {
    id: 'draw-item',
    stillPrompt: {
      'zh-HK':
        '由口袋、袖、袋或腰間取出物件的中段：手已握住物件，物件剛露出。另一手可拉開遮擋。',
      en: 'Mid draw from pocket, sleeve, bag, or belt: the hand already has the object, just becoming visible. The other hand may clear a cover.'
    },
    videoPrompt: {
      'zh-HK':
        '一次取出指定物件到鏡頭前，動作連貫。取出後展示一拍。不要變出第二件無關的東西。',
      en: 'Draw the named object into view in one continuous move, then show it for a beat. Do not produce a second unrelated item.'
    }
  },
  {
    id: 'kneel',
    stillPrompt: {
      'zh-HK':
        '單膝或雙膝跪地，軀幹仍有控制，頭可低或抬視。衣擺與地面接觸合理，不是滑倒。',
      en: 'One or both knees down, torso still controlled, head bowed or looking up. Cloth meets the ground believably; not a slip.'
    },
    videoPrompt: {
      'zh-HK':
        '由站到跪，一次完成，然後穩定。可伸手觸地或捧物。不要反覆起跪。',
      en: 'Stand to kneel in one beat, then hold. A hand to the ground or an object is allowed. No bobbing up and down.'
    }
  },
  {
    id: 'wave',
    stillPrompt: {
      'zh-HK':
        '揮手致意的高點：一臂舉起，手掌向外，另一臂自然。面向鏡頭或微側，表情明確。',
      en: 'Peak of a wave: one arm raised, palm out, other arm easy. To camera or slight three-quarter; expression readable.'
    },
    videoPrompt: {
      'zh-HK':
        '舉手揮一兩下後放下或停在半空。節奏從容，像打招呼不是求救。身體不要大幅跳動。',
      en: 'Wave once or twice, then lower or hold. A greeting, not a distress signal. No hopping.'
    }
  }
]

export function isSystemPhotoActionId(
  raw: string | null | undefined
): boolean {
  const id = raw?.trim() || ''
  if (!id.startsWith(SYSTEM_PHOTO_ACTION_PREFIX)) return false
  const slug = id.slice(SYSTEM_PHOTO_ACTION_PREFIX.length)
  return SYSTEM_PHOTO_ACTION_IDS.includes(slug as SystemPhotoActionId)
}

export function parseSystemPhotoActionId(
  raw: string | null | undefined
): SystemPhotoActionId | undefined {
  const id = raw?.trim() || ''
  if (!id.startsWith(SYSTEM_PHOTO_ACTION_PREFIX)) return undefined
  const slug = id.slice(SYSTEM_PHOTO_ACTION_PREFIX.length)
  return SYSTEM_PHOTO_ACTION_IDS.includes(slug as SystemPhotoActionId)
    ? (slug as SystemPhotoActionId)
    : undefined
}

export function systemPhotoActionStorageId(id: SystemPhotoActionId): string {
  return `${SYSTEM_PHOTO_ACTION_PREFIX}${id}`
}

export function systemPhotoActionLabelKey(id: SystemPhotoActionId): string {
  return `systemPhotoActions.${id}`
}

function actionLocale(lang?: string | null): SystemPhotoActionLocale {
  return (lang || '').toLowerCase().startsWith('en') ? 'en' : 'zh-HK'
}

export function getSystemPhotoAction(
  raw: string | null | undefined
): SystemPhotoActionDef | undefined {
  const id = parseSystemPhotoActionId(raw)
  if (!id) return undefined
  return SYSTEM_PHOTO_ACTIONS.find((a) => a.id === id)
}

export function systemPhotoActionNotes(
  raw: string | null | undefined,
  locale?: string | null,
  kind: 'still' | 'video' = 'still'
): string | null {
  const def = getSystemPhotoAction(raw)
  if (!def) return null
  const loc = actionLocale(locale)
  const body = kind === 'video' ? def.videoPrompt[loc] : def.stillPrompt[loc]
  const label = loc === 'en' ? `System action (${def.id})` : `系統動作（${def.id}）`
  return `${label}:\n${body}`
}
