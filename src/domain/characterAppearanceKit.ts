/**
 * Modular short-drama appearance kit: one template per facial/body part.
 * UI labels stay zh+en in this catalog; chrome keys live in i18next.
 * Assembled text writes into Character.appearance (image/video handlers unchanged).
 */
import { APPEARANCE_TEMPLATE_EXTRAS } from './characterAppearanceKitExtras'
import {
  assembleFieldKitPrompt,
  fieldKitHasSelection,
  fieldKitPartLabel,
  fieldKitSearchHaystack,
  fieldKitTemplateKeywords,
  fieldKitTemplateLabel,
  fieldKitTemplateStructure,
  getFieldKitTemplate,
  listFieldKitTemplates,
  mergeFieldKitIntoProfileJson as mergeOneKit,
  parseFieldKit,
  sanitizeFieldKit,
  setFieldKitPart,
  type FieldKitSelection,
  type FieldKitSpec
} from './fieldKit'

export {
  isChineseLocale,
  paginateItems,
  FIELD_KIT_PAGE_SIZE as APPEARANCE_KIT_PAGE_SIZE
} from './fieldKit'

export const APPEARANCE_PART_IDS = [
  'face',
  'eyes',
  'nose',
  'mouth',
  'hair',
  'skin',
  'body',
  'mark'
] as const

export type AppearancePartId = (typeof APPEARANCE_PART_IDS)[number]

export interface AppearanceKitSelection {
  face?: string
  eyes?: string
  nose?: string
  mouth?: string
  hair?: string
  skin?: string
  body?: string
  mark?: string
  notes?: string
  [key: string]: string | undefined
}

export interface AppearanceTemplateDef {
  id: string
  part: AppearancePartId
  labelZh: string
  labelEn: string
  keywordsZh: readonly string[]
  keywordsEn: readonly string[]
  structureZh: string
  structureEn: string
  /** English image-model fragment */
  promptBlock: string
}

type PartCopy = { zhHK: string; zhCN: string; en: string }

const PART_COPY: Record<AppearancePartId | 'aura' | 'notes', PartCopy> = {
  face: { zhHK: '臉型', zhCN: '脸型', en: 'Face' },
  eyes: { zhHK: '眼型', zhCN: '眼型', en: 'Eyes' },
  nose: { zhHK: '鼻型', zhCN: '鼻型', en: 'Nose' },
  mouth: { zhHK: '嘴型', zhCN: '嘴型', en: 'Mouth' },
  hair: { zhHK: '髮型', zhCN: '发型', en: 'Hair' },
  skin: { zhHK: '膚色', zhCN: '肤色', en: 'Skin' },
  body: { zhHK: '體型', zhCN: '体型', en: 'Body' },
  mark: { zhHK: '辨識', zhCN: '辨识', en: 'Mark' },
  aura: { zhHK: '氣場', zhCN: '气场', en: 'Aura' },
  notes: { zhHK: '備註', zhCN: '备注', en: 'Notes' }
}

export function appearancePartLabel(
  part: AppearancePartId | 'aura' | 'notes',
  locale?: string | null
): string {
  return fieldKitPartLabel(APPEARANCE_KIT, part, locale)
}

export function appearanceTemplateLabel(
  def: AppearanceTemplateDef,
  locale?: string | null
): string {
  return fieldKitTemplateLabel(def, locale)
}

export function appearanceTemplateStructure(
  def: AppearanceTemplateDef,
  locale?: string | null
): string {
  return fieldKitTemplateStructure(def, locale)
}

export function appearanceTemplateKeywords(
  def: AppearanceTemplateDef,
  locale?: string | null
): readonly string[] {
  return fieldKitTemplateKeywords(def, locale)
}

const APPEARANCE_TEMPLATES_CORE: AppearanceTemplateDef[] = [
  // ── Face ──────────────────────────────────────────────────
  {
    id: 'seed',
    part: 'face',
    labelZh: '瓜子臉',
    labelEn: 'Seed / pointed oval',
    keywordsZh: ['清貴', '女主輪廓', '收尖下頜'],
    keywordsEn: ['elegant', 'heroine outline', 'tapered jaw'],
    structureZh: '中庭勻稱，下頜收尖，輪廓修長',
    structureEn: 'balanced midface, tapered chin, slender outline',
    promptBlock: 'oval pointed seed-shaped face, tapered jaw, balanced midface'
  },
  {
    id: 'oval',
    part: 'face',
    labelZh: '鵝蛋臉',
    labelEn: 'Classic oval',
    keywordsZh: ['端正', '萬能臉', '古典'],
    keywordsEn: ['balanced', 'classic', 'versatile'],
    structureZh: '長寬適中，線條圓潤，五官好擺',
    structureEn: 'moderate length-to-width, soft oval contour',
    promptBlock: 'classic oval face, even proportions, soft contour'
  },
  {
    id: 'round',
    part: 'face',
    labelZh: '圓臉',
    labelEn: 'Round face',
    keywordsZh: ['幼態', '甜美', '親和'],
    keywordsEn: ['youthful', 'sweet', 'approachable'],
    structureZh: '面頰飽滿，下頜圓潤，中庭偏短',
    structureEn: 'full cheeks, rounded jaw, shorter midface',
    promptBlock: 'round face, full cheeks, soft rounded jaw'
  },
  {
    id: 'square',
    part: 'face',
    labelZh: '方臉',
    labelEn: 'Square face',
    keywordsZh: ['英氣', '剛毅', '將門'],
    keywordsEn: ['heroic', 'resolute', 'martial'],
    structureZh: '下頜角分明，額寬接近頜寬',
    structureEn: 'defined jaw angles, forehead width near jaw width',
    promptBlock: 'square face, strong jaw angles, equal forehead and jaw width'
  },
  {
    id: 'long',
    part: 'face',
    labelZh: '長臉',
    labelEn: 'Long face',
    keywordsZh: ['貴氣', '疏離', '貴族'],
    keywordsEn: ['aristocratic', 'aloof', 'noble'],
    structureZh: '面長明顯，中下庭偏長，線條垂直',
    structureEn: 'noticeably long face, elongated mid and lower thirds',
    promptBlock: 'long face, elongated vertical thirds, aristocratic length'
  },
  {
    id: 'heart',
    part: 'face',
    labelZh: '心形臉',
    labelEn: 'Heart face',
    keywordsZh: ['靈動', '可愛', '上寬下收'],
    keywordsEn: ['lively', 'cute', 'wide brow'],
    structureZh: '額與顴較寬，下巴尖細',
    structureEn: 'wider forehead and cheekbones, pointed chin',
    promptBlock: 'heart-shaped face, wide brow, pointed chin'
  },
  {
    id: 'diamond',
    part: 'face',
    labelZh: '菱形臉',
    labelEn: 'Diamond face',
    keywordsZh: ['鋒利', '冷感', '高顴'],
    keywordsEn: ['sharp', 'cool', 'high cheekbones'],
    structureZh: '顴骨最寬，額與頜較窄',
    structureEn: 'widest at cheekbones, narrower brow and jaw',
    promptBlock: 'diamond face, high cheekbones, narrow jaw and brow'
  },
  {
    id: 'inverted_triangle',
    part: 'face',
    labelZh: '倒三角臉',
    labelEn: 'Inverted triangle',
    keywordsZh: ['知性', '鋒利額線', '利落下頜'],
    keywordsEn: ['intellectual', 'sharp brow', 'slim jaw'],
    structureZh: '額寬、下頜急收，線條俐落',
    structureEn: 'wide forehead, rapidly tapering jaw',
    promptBlock: 'inverted-triangle face, wide forehead, slim tapered jaw'
  },
  {
    id: 'rectangular',
    part: 'face',
    labelZh: '國字臉',
    labelEn: 'Rectangular face',
    keywordsZh: ['沉穩', '成熟', '方正'],
    keywordsEn: ['steady', 'mature', 'rectilinear'],
    structureZh: '額頜同寬，面偏長而方正',
    structureEn: 'forehead and jaw similar width, longer rectilinear face',
    promptBlock: 'rectangular face, equal forehead and jaw, mature bone structure'
  },

  // ── Eyes ──────────────────────────────────────────────────
  {
    id: 'phoenix',
    part: 'eyes',
    labelZh: '丹鳳眼',
    labelEn: 'Phoenix eyes',
    keywordsZh: ['貴氣', '女帝', '反派感'],
    keywordsEn: ['regal', 'empress', 'villainess'],
    structureZh: '眼裂細長，眼尾上挑，目光銳利',
    structureEn: 'narrow long slit, upturned outer corners, sharp gaze',
    promptBlock:
      'phoenix eyes, narrow long eye slit, upturned outer corners, sharp gaze'
  },
  {
    id: 'peach',
    part: 'eyes',
    labelZh: '桃花眼',
    labelEn: 'Peach-blossom eyes',
    keywordsZh: ['白月光', '初戀', '柔情'],
    keywordsEn: ['white moonlight', 'first love', 'tender'],
    structureZh: '眼形圓潤，臥蠶明顯，眼神含情',
    structureEn: 'rounded shape, prominent aegyo-sal, affectionate gaze',
    promptBlock:
      'peach blossom eyes, rounded lids, visible aegyo-sal, soft romantic gaze'
  },
  {
    id: 'fox',
    part: 'eyes',
    labelZh: '狐狸眼',
    labelEn: 'Fox eyes',
    keywordsZh: ['魅惑', '狡猾', '危險'],
    keywordsEn: ['enchantress', 'cunning', 'dangerous'],
    structureZh: '細長上挑，眼尾鋒利，眼神帶鉤',
    structureEn: 'long narrow slit, sharp upward tilt, hooked gaze',
    promptBlock: 'fox eyes, long narrow upturned slit, sharp seductive gaze'
  },
  {
    id: 'deer',
    part: 'eyes',
    labelZh: '鹿眼',
    labelEn: 'Deer eyes',
    keywordsZh: ['甜美', '校園', '無辜'],
    keywordsEn: ['sweet', 'campus', 'innocent'],
    structureZh: '瞳仁偏大，眼形圓，清澈無辜',
    structureEn: 'large round pupils, clear innocent look',
    promptBlock: 'deer eyes, large round pupils, clear innocent gaze'
  },
  {
    id: 'almond',
    part: 'eyes',
    labelZh: '杏仁眼',
    labelEn: 'Almond eyes',
    keywordsZh: ['女主', '端正', '東方古典'],
    keywordsEn: ['female lead', 'balanced', 'oriental classic'],
    structureZh: '比例均衡，眼尾微收，傳統東方眼形',
    structureEn: 'balanced almond shape, gently tapered tail',
    promptBlock:
      'almond eyes, balanced oriental eye shape, slightly tapered outer corners'
  },
  {
    id: 'auspicious_phoenix',
    part: 'eyes',
    labelZh: '瑞鳳眼',
    labelEn: 'Auspicious phoenix eyes',
    keywordsZh: ['后位', '溫貴', '柔中帶威'],
    keywordsEn: ['queen', 'noble', 'gentle authority'],
    structureZh: '比丹鳳眼更柔，眼尾輕抬不鋒',
    structureEn: 'softer than phoenix eyes, gentle lifted tail',
    promptBlock:
      'soft phoenix eyes, gentle lifted outer corners, noble calm gaze'
  },
  {
    id: 'sword',
    part: 'eyes',
    labelZh: '英氣劍眉眼',
    labelEn: 'Heroic sword eyes',
    keywordsZh: ['女將軍', '武俠', '英氣'],
    keywordsEn: ['general', 'wuxia', 'heroic'],
    structureZh: '眼裂偏長，眉距近眼，英氣凌厲',
    structureEn: 'long sharp eyes, brows close to lids, martial gaze',
    promptBlock:
      'heroic sword eyes, long sharp slits, eyebrows close to eyes, martial gaze'
  },
  {
    id: 'yandere',
    part: 'eyes',
    labelZh: '病嬌眼',
    labelEn: 'Sickly / yandere eyes',
    keywordsZh: ['執念', '暗黑', '病態美'],
    keywordsEn: ['obsessive', 'dark', 'sickly beauty'],
    structureZh: '眼尾下垂，瞳仁偏大，帶病態柔光',
    structureEn: 'droopy outer corners, large pupils, feverish softness',
    promptBlock:
      'droopy yandere eyes, large pupils, downturned outer corners, sickly soft gaze'
  },
  {
    id: 'cold_gray',
    part: 'eyes',
    labelZh: '冷漠灰眸眼',
    labelEn: 'Cold gray eyes',
    keywordsZh: ['刺客', '冷卻', '寡情'],
    keywordsEn: ['assassin', 'cool', 'emotionless'],
    structureZh: '眼裂偏窄，無波無瀾，灰調冷瞳',
    structureEn: 'narrow emotionless lids, cold gray irises',
    promptBlock: 'cold gray eyes, narrow emotionless slits, icy detached gaze'
  },

  // ── Nose ──────────────────────────────────────────────────
  {
    id: 'sword',
    part: 'nose',
    labelZh: '高挺劍鼻',
    labelEn: 'High straight sword nose',
    keywordsZh: ['冷貴', '強勢', '領袖'],
    keywordsEn: ['cold', 'noble', 'leader'],
    structureZh: '鼻樑高直，鼻翼內收，線條鋒利',
    structureEn: 'high straight bridge, tucked alae, sharp lines',
    promptBlock: 'high straight sword nose, tucked-in alae, sharp nasal lines'
  },
  {
    id: 'petite',
    part: 'nose',
    labelZh: '小巧精緻鼻',
    labelEn: 'Small exquisite nose',
    keywordsZh: ['甜美', '靈動', '幼態'],
    keywordsEn: ['sweet', 'nimble', 'youthful'],
    structureZh: '鼻體小巧，鼻頭圓，鼻翼窄',
    structureEn: 'dainty small nose, rounded tip, narrow alae',
    promptBlock: 'small dainty nose, rounded tip, narrow alae, cute lively'
  },
  {
    id: 'jade',
    part: 'nose',
    labelZh: '冷玉雕鼻',
    labelEn: 'Cold jade-carved nose',
    keywordsZh: ['出塵', '仙氣', '疏離'],
    keywordsEn: ['ethereal', 'detached', 'divine'],
    structureZh: '鼻樑偏長，鼻頭柔，鼻孔窄',
    structureEn: 'long bridge, soft tip, narrow nostrils',
    promptBlock: 'long jade-carved nose, soft tip, narrow nostrils, ethereal'
  },
  {
    id: 'elf',
    part: 'nose',
    labelZh: '上翹精靈鼻',
    labelEn: 'Upturned elf nose',
    keywordsZh: ['靈氣', '活潑', '少年'],
    keywordsEn: ['spirited', 'lively', 'youthful'],
    structureZh: '鼻頭上翹圓潤，鼻樑柔，輕盈',
    structureEn: 'upturned rounded tip, soft bridge',
    promptBlock: 'upturned elf nose, rounded tip, soft bridge, nimble cute'
  },
  {
    id: 'mixed_3d',
    part: 'nose',
    labelZh: '混血立體鼻',
    labelEn: 'Mixed-race 3D nose',
    keywordsZh: ['高級', '性感', '時尚'],
    keywordsEn: ['high-end', 'sexy', 'fashion'],
    structureZh: '根部高、立體強，鼻頭精緻',
    structureEn: 'high root, strong projection, refined tip',
    promptBlock:
      'three-dimensional mixed-race nose, high root, exquisite tip, sculpted'
  },
  {
    id: 'heroic',
    part: 'nose',
    labelZh: '英氣直鼻',
    labelEn: 'Heroic straight nose',
    keywordsZh: ['果決', '冷卻', '能戰'],
    keywordsEn: ['resolute', 'cool', 'battle-ready'],
    structureZh: '鼻樑直、鼻頭穩、鼻翼有力',
    structureEn: 'straight bridge, firm tip, powerful alae',
    promptBlock: 'heroic straight nose, firm tip, strong alae, neat lines'
  },
  {
    id: 'soft_oval',
    part: 'nose',
    labelZh: '柔和橢圓鼻',
    labelEn: 'Soft oval nose',
    keywordsZh: ['溫柔', '親和', '治癒'],
    keywordsEn: ['gentle', 'approachable', 'healing'],
    structureZh: '線條圓潤，鼻頭橢圓，比例適中',
    structureEn: 'smooth lines, rounded tip, balanced proportions',
    promptBlock: 'soft oval nose, rounded tip, balanced proportions, approachable'
  },
  {
    id: 'fox',
    part: 'nose',
    labelZh: '魅惑狐鼻',
    labelEn: 'Charming fox nose',
    keywordsZh: ['危險', '美艷', '勾人'],
    keywordsEn: ['dangerous', 'beautiful', 'seductive'],
    structureZh: '鼻頭微鉤尖，鼻樑窄，鼻翼極收',
    structureEn: 'slightly hooked pointed tip, narrow bridge, very narrow alae',
    promptBlock:
      'fox nose, slightly hooked pointed tip, narrow bridge, seductive'
  },
  {
    id: 'noble',
    part: 'nose',
    labelZh: '成熟貴婦鼻',
    labelEn: 'Mature noblewoman nose',
    keywordsZh: ['優雅', '權勢', '成熟'],
    keywordsEn: ['elegant', 'powerful', 'mature'],
    structureZh: '鼻樑適中，鼻頭圓潤，骨相有尊嚴',
    structureEn: 'moderate bridge, rounded tip, dignified bone',
    promptBlock:
      'mature noble nose, moderate bridge, rounded tip, elegant dignity'
  },

  // ── Mouth ─────────────────────────────────────────────────
  {
    id: 'cherry',
    part: 'mouth',
    labelZh: '櫻桃小嘴',
    labelEn: 'Cherry mouth',
    keywordsZh: ['甜美', '無辜', '幼態'],
    keywordsEn: ['sweet', 'innocent', 'youthful'],
    structureZh: '唇形小巧，上下協調，唇峰明顯，嘴角微揚',
    structureEn: 'small balanced lips, clear peaks, slightly upturned corners',
    promptBlock:
      'cherry-small mouth, balanced lips, clear cupid bow, slightly upturned corners'
  },
  {
    id: 'm_thin',
    part: 'mouth',
    labelZh: 'M型薄唇',
    labelEn: 'M-shaped thin lips',
    keywordsZh: ['冷感', '高級', '疏離'],
    keywordsEn: ['cold', 'high-class', 'detached'],
    structureZh: 'M 形唇峰突出，唇線清晰，唇薄，嘴角平',
    structureEn: 'prominent M peaks, thin lips, flat corners',
    promptBlock: 'M-shaped thin lips, sharp cupid bow, flat corners, cool'
  },
  {
    id: 'petal',
    part: 'mouth',
    labelZh: '飽滿花瓣唇',
    labelEn: 'Full petal lips',
    keywordsZh: ['溫柔', '性感', '治癒'],
    keywordsEn: ['gentle', 'sexy', 'healing'],
    structureZh: '上下唇飽滿，唇珠明顯，線條柔如花瓣',
    structureEn: 'full upper and lower lips, visible lip bead, petal-soft lines',
    promptBlock: 'full petal lips, obvious lip bead, soft rounded lines'
  },
  {
    id: 'sharp_thin',
    part: 'mouth',
    labelZh: '鋒利薄唇',
    labelEn: 'Sharp thin lips',
    keywordsZh: ['危險', '心機', '攻擊性'],
    keywordsEn: ['dangerous', 'scheming', 'aggressive'],
    structureZh: '唇薄、唇峰尖，嘴角微垂，線條帶攻擊',
    structureEn: 'thin sharp peaks, slightly downturned corners',
    promptBlock:
      'sharp thin lips, pointed peaks, slightly downturned corners, aggressive'
  },
  {
    id: 'smile',
    part: 'mouth',
    labelZh: '微笑唇',
    labelEn: 'Smile lips',
    keywordsZh: ['親切', '治癒', '好接近'],
    keywordsEn: ['amiable', 'healing', 'approachable'],
    structureZh: '嘴角天生上揚，無表情也像微笑，線條軟',
    structureEn: 'naturally upturned corners even at rest, soft lines',
    promptBlock:
      'smile lips, naturally upturned corners at rest, soft friendly line'
  },
  {
    id: 'thick',
    part: 'mouth',
    labelZh: '性感厚唇',
    labelEn: 'Sexy full lips',
    keywordsZh: ['魅惑', '成熟', '視覺強'],
    keywordsEn: ['charming', 'mature', 'seductive'],
    structureZh: '明顯豐厚，唇珠突出，圓線，視覺強',
    structureEn: 'noticeably full, protruding lip bead, rounded impact',
    promptBlock: 'sexy full thick lips, protruding lip bead, rounded impact'
  },
  {
    id: 'classical',
    part: 'mouth',
    labelZh: '古典丹唇',
    labelEn: 'Classical red lips',
    keywordsZh: ['東方', '貴氣', '古典美'],
    keywordsEn: ['oriental', 'noble', 'classic beauty'],
    structureZh: '色澤偏豔，形狀精巧，比例均衡，如古畫唇',
    structureEn: 'vivid color, exquisite shape, painting-like balance',
    promptBlock:
      'classical cinnabar lips, exquisite balanced shape, oriental painting line'
  },
  {
    id: 'youthful',
    part: 'mouth',
    labelZh: '少年感薄潤唇',
    labelEn: 'Youthful thin moist lips',
    keywordsZh: ['乾淨', '少年', '清爽'],
    keywordsEn: ['clean', 'youthful', 'boyish'],
    structureZh: '唇薄潤、唇峰弱，線條自然，清透',
    structureEn: 'thin moist shape, no sharp peaks, clean soft',
    promptBlock: 'youthful thin moist lips, natural line, no sharp cupid bow'
  },
  {
    id: 'fox',
    part: 'mouth',
    labelZh: '魅惑狐唇',
    labelEn: 'Enchanting fox lips',
    keywordsZh: ['危險', '勾人', '反差'],
    keywordsEn: ['dangerous', 'seductive', 'contrast'],
    structureZh: '唇峰尖、嘴角微揚，唇線偏長，帶攻擊魅力',
    structureEn: 'sharp peaks, slightly upturned corners, long lip line',
    promptBlock:
      'enchanting fox lips, sharp peaks, slightly upturned long lip line'
  },

  // ── Hair ──────────────────────────────────────────────────
  {
    id: 'long_straight_black',
    part: 'hair',
    labelZh: '冷感長直黑髮',
    labelEn: 'Long black straight — cool goddess',
    keywordsZh: ['冷艷', '白月光', '禁慾'],
    keywordsEn: ['cool glamorous', 'white moonlight', 'ascetic'],
    structureZh: '烏黑長直，中分或微偏分，鏡面光澤',
    structureEn: 'long straight black hair, center or slight side part, glossy',
    promptBlock:
      'long straight glossy black hair, center part, cool goddess silhouette'
  },
  {
    id: 'long_volume_wave',
    part: 'hair',
    labelZh: '熟女大波浪',
    labelEn: 'Long voluminous waves — mature aristocrat',
    keywordsZh: ['成熟', '貴族', '豐盈'],
    keywordsEn: ['mature', 'aristocrat', 'voluminous'],
    structureZh: '長捲大波浪，髮量豐、有層次光澤',
    structureEn: 'long voluminous wavy curls, layered shine',
    promptBlock: 'long voluminous wavy hair, rich curls, mature aristocratic'
  },
  {
    id: 'high_ponytail',
    part: 'hair',
    labelZh: '女將軍高馬尾',
    labelEn: 'High ponytail — girl warrior',
    keywordsZh: ['英氣', '利落', '能戰'],
    keywordsEn: ['heroic', 'neat', 'warrior'],
    structureZh: '高位馬尾，額髮服帖或少量碎髮',
    structureEn: 'high ponytail, sleek or lightly wispy bangs',
    promptBlock: 'high warrior ponytail, sleek crown, athletic silhouette'
  },
  {
    id: 'space_buns',
    part: 'hair',
    labelZh: '雙丸子甜感髮',
    labelEn: 'Space buns — sweet active',
    keywordsZh: ['甜美', '活潑', '校園'],
    keywordsEn: ['sweet', 'active', 'campus'],
    structureZh: '左右雙丸子，剩餘髮絲自然或帶瀏海',
    structureEn: 'twin space buns, leftover strands or bangs',
    promptBlock: 'twin space-bun meatball hairstyle, playful youthful'
  },
  {
    id: 'sleek_bob',
    part: 'hair',
    labelZh: '齊下巴知性短髮',
    labelEn: 'Sleek chin-length bob — intelligent lead',
    keywordsZh: ['知性', '俐落', '女主'],
    keywordsEn: ['intelligent', 'sleek', 'lead'],
    structureZh: '齊下巴短 bob，線條乾淨，貼臉',
    structureEn: 'chin-length sleek bob, clean edge',
    promptBlock: 'sleek chin-length bob, clean intelligent silhouette'
  },
  {
    id: 'wet_side_wave',
    part: 'hair',
    labelZh: '側分濕髮波浪',
    labelEn: 'Side-part wet waves — villainous sexy',
    keywordsZh: ['反派', '性感', '危險'],
    keywordsEn: ['villainous', 'sexy', 'dangerous'],
    structureZh: '深側分，濕潤波浪貼面，光澤重',
    structureEn: 'deep side part, wet-look waves, high gloss',
    promptBlock: 'side-parted wet-look wavy hair, glossy villainous sexy'
  },
  {
    id: 'hanfu_updo',
    part: 'hair',
    labelZh: '古典盤髮',
    labelEn: 'Classical Hanfu updo — immortal',
    keywordsZh: ['古典', '仙氣', '東方'],
    keywordsEn: ['classical', 'immortal', 'oriental'],
    structureZh: '高盤或半盤，步搖／簪飾可選，髮絲柔',
    structureEn: 'elaborate ancient Chinese updo, optional ornaments',
    promptBlock:
      'classical Hanfu updo, ornate oriental hair, immortal elegant'
  },
  {
    id: 'twin_braids',
    part: 'hair',
    labelZh: '雙麻花辮',
    labelEn: 'Twin braided pigtails — schoolgirl',
    keywordsZh: ['無辜', '校園', '清純'],
    keywordsEn: ['innocent', 'schoolgirl', 'pure'],
    structureZh: '左右雙辮，髮根服帖，可留劉海',
    structureEn: 'twin braided pigtails, neat roots, optional bangs',
    promptBlock: 'twin braided pigtails, innocent schoolgirl hair'
  },
  {
    id: 'silver_long',
    part: 'hair',
    labelZh: '銀白長髮',
    labelEn: 'Long silver-white — mystical fantasy',
    keywordsZh: ['神秘', '幻想', '出塵'],
    keywordsEn: ['mystical', 'fantasy', 'otherworldly'],
    structureZh: '銀白長髮披散，光澤冷，髮絲流動',
    structureEn: 'long flowing silver-white hair, cool sheen',
    promptBlock: 'long flowing silver-white hair, mystical fantasy sheen'
  },
  {
    id: 'short_textured',
    part: 'hair',
    labelZh: '短碎髮利落',
    labelEn: 'Short textured crop',
    keywordsZh: ['利落', '中性', '現代'],
    keywordsEn: ['neat', 'androgynous', 'modern'],
    structureZh: '短碎層次，額髮可立可服，輪廓乾淨',
    structureEn: 'short textured layers, clean silhouette',
    promptBlock: 'short textured crop, modern androgynous layers'
  },
  {
    id: 'slicked_back',
    part: 'hair',
    labelZh: '背頭',
    labelEn: 'Slicked-back hair',
    keywordsZh: ['冷貴', '成熟', '權力'],
    keywordsEn: ['cold noble', 'mature', 'power'],
    structureZh: '整頭後梳，額際露出，油光或乾爽皆可',
    structureEn: 'fully slicked back, exposed forehead',
    promptBlock: 'slicked-back hair, exposed forehead, sharp mature silhouette'
  },
  {
    id: 'center_part_medium',
    part: 'hair',
    labelZh: '中分中長髮',
    labelEn: 'Center-part medium length',
    keywordsZh: ['溫潤', '中性', '日常'],
    keywordsEn: ['gentle', 'unisex', 'everyday'],
    structureZh: '中分及肩或過肩，微曲或直，服帖',
    structureEn: 'center part, shoulder-to-collarbone length, slight wave or straight',
    promptBlock: 'center-part medium-length hair, unisex everyday fall'
  },

  // ── Skin ──────────────────────────────────────────────────
  {
    id: 'cool_porcelain',
    part: 'skin',
    labelZh: '冷白瓷膚',
    labelEn: 'Cool porcelain',
    keywordsZh: ['冷感', '瓷白', '貴氣'],
    keywordsEn: ['cool', 'porcelain', 'regal'],
    structureZh: '冷調白皙，細膩少紅暈',
    structureEn: 'cool-toned fair porcelain, low flush',
    promptBlock: 'cool porcelain fair skin, fine texture, low flush'
  },
  {
    id: 'warm_ivory',
    part: 'skin',
    labelZh: '暖象牙膚',
    labelEn: 'Warm ivory',
    keywordsZh: ['柔暖', '親和', '健康淡白'],
    keywordsEn: ['warm', 'approachable', 'ivory'],
    structureZh: '暖白象牙，輕微血色',
    structureEn: 'warm ivory, slight natural blush',
    promptBlock: 'warm ivory skin, slight natural blush'
  },
  {
    id: 'wheat',
    part: 'skin',
    labelZh: '自然麥色',
    labelEn: 'Natural wheat',
    keywordsZh: ['日常', '接地', '自然'],
    keywordsEn: ['everyday', 'grounded', 'natural'],
    structureZh: '中等麥色，不過度曬傷',
    structureEn: 'medium wheat tone, not sunburnt',
    promptBlock: 'natural wheat skin tone, even medium complexion'
  },
  {
    id: 'sickly_cool',
    part: 'skin',
    labelZh: '病態冷青膚',
    labelEn: 'Sickly cool pallor',
    keywordsZh: ['病態美', '虛弱', '暗黑'],
    keywordsEn: ['sickly beauty', 'frail', 'dark'],
    structureZh: '冷白帶青，唇色偏淡',
    structureEn: 'cool pale with green-gray undertone',
    promptBlock: 'sickly cool pale skin, gray-green undertone, faint lips'
  },
  {
    id: 'honey',
    part: 'skin',
    labelZh: '蜜色膚',
    labelEn: 'Honey',
    keywordsZh: ['暖感', '高級', '光澤'],
    keywordsEn: ['warm', 'luxe', 'glow'],
    structureZh: '暖蜜色，帶光澤',
    structureEn: 'warm honey glow',
    promptBlock: 'warm honey skin, luminous glow'
  },
  {
    id: 'deep',
    part: 'skin',
    labelZh: '深膚色',
    labelEn: 'Deep complexion',
    keywordsZh: ['立體', '沉穩', '有存在感'],
    keywordsEn: ['sculpted', 'grounded', 'presence'],
    structureZh: '深膚均勻，高光沿骨相走',
    structureEn: 'deep even complexion, highlights follow bone',
    promptBlock: 'deep complexion, even rich skin, sculpted highlights'
  },
  {
    id: 'sun_kissed',
    part: 'skin',
    labelZh: '小麥健康色',
    labelEn: 'Sun-kissed healthy',
    keywordsZh: ['健康', '戶外', '活力'],
    keywordsEn: ['healthy', 'outdoor', 'vital'],
    structureZh: '偏暖小麥，像日照後健康色',
    structureEn: 'warm sun-kissed tan, healthy',
    promptBlock: 'sun-kissed wheat skin, healthy outdoor glow'
  },
  {
    id: 'translucent_cool',
    part: 'skin',
    labelZh: '透明感冷白',
    labelEn: 'Translucent cool white',
    keywordsZh: ['仙氣', '薄透', '冷光'],
    keywordsEn: ['ethereal', 'translucent', 'cool light'],
    structureZh: '薄透冷白，隱約青筋可有可無',
    structureEn: 'translucent cool white, optional faint veins',
    promptBlock: 'translucent cool-white skin, ethereal thin complexion'
  },
  {
    id: 'rosy',
    part: 'skin',
    labelZh: '紅潤膚',
    labelEn: 'Rosy flush',
    keywordsZh: ['健康', '甜美', '有血色'],
    keywordsEn: ['healthy', 'sweet', 'flushed'],
    structureZh: '兩頰與鼻尖帶穩定紅潤',
    structureEn: 'steady blush on cheeks and nose tip',
    promptBlock: 'rosy healthy flush on cheeks, vital complexion'
  },

  // ── Body ──────────────────────────────────────────────────
  {
    id: 'slim_tall',
    part: 'body',
    labelZh: '纖瘦高挑',
    labelEn: 'Slim tall',
    keywordsZh: ['模特', '修長', '貴氣'],
    keywordsEn: ['model', 'long-limbed', 'regal'],
    structureZh: '身高顯高，肩窄腰細，四肢修長',
    structureEn: 'tall slim build, narrow shoulders, long limbs',
    promptBlock: 'slim tall build, long limbs, narrow waist'
  },
  {
    id: 'balanced',
    part: 'body',
    labelZh: '勻稱標準',
    labelEn: 'Balanced average',
    keywordsZh: ['萬能', '自然', '好拍'],
    keywordsEn: ['versatile', 'natural', 'filmable'],
    structureZh: '肩腰臀比例均衡，不誇張',
    structureEn: 'balanced shoulder-waist-hip, unexaggerated',
    promptBlock: 'balanced average body proportions, natural silhouette'
  },
  {
    id: 'petite',
    part: 'body',
    labelZh: '嬌小玲瓏',
    labelEn: 'Petite',
    keywordsZh: ['嬌小', '靈巧', '幼態'],
    keywordsEn: ['petite', 'nimble', 'youthful'],
    structureZh: '骨架小，身高偏矮，比例精緻',
    structureEn: 'small frame, shorter stature, refined scale',
    promptBlock: 'petite small frame, compact refined proportions'
  },
  {
    id: 'soft_curves',
    part: 'body',
    labelZh: '軟曲線',
    labelEn: 'Soft curves',
    keywordsZh: ['柔美', '豐潤', '治癒'],
    keywordsEn: ['soft', 'curvy', 'healing'],
    structureZh: '肩圓、腰線柔，有適度曲線',
    structureEn: 'rounded shoulders, soft waist, moderate curves',
    promptBlock: 'soft curved figure, moderate fullness, gentle silhouette'
  },
  {
    id: 'athletic',
    part: 'body',
    labelZh: '運動力量型',
    labelEn: 'Athletic',
    keywordsZh: ['力量', '能戰', '緊實'],
    keywordsEn: ['powerful', 'battle-ready', 'toned'],
    structureZh: '肩背有型，腰腹緊，四肢有肌肉線',
    structureEn: 'defined shoulders, tight core, visible muscle lines',
    promptBlock: 'athletic toned build, defined shoulders, martial fitness'
  },
  {
    id: 'lanky_youth',
    part: 'body',
    labelZh: '少年瘦削',
    labelEn: 'Lanky youthful',
    keywordsZh: ['少年', '未長開', '薄'],
    keywordsEn: ['youthful', 'lanky', 'thin'],
    structureZh: '偏瘦偏長，肩未完全展開',
    structureEn: 'thin lanky, not fully filled-out shoulders',
    promptBlock: 'lanky youthful thin build, slightly unfinished shoulders'
  },
  {
    id: 'broad',
    part: 'body',
    labelZh: '寬肩魁梧',
    labelEn: 'Broad-shouldered',
    keywordsZh: ['沉穩', '保護欲', '厚實'],
    keywordsEn: ['steady', 'protective', 'solid'],
    structureZh: '肩寬胸厚，骨架大',
    structureEn: 'broad shoulders, thick chest, large frame',
    promptBlock: 'broad-shouldered solid build, wide frame'
  },
  {
    id: 'bony_ethereal',
    part: 'body',
    labelZh: '骨感清冷',
    labelEn: 'Bony ethereal',
    keywordsZh: ['清冷', '仙氣', '薄'],
    keywordsEn: ['cold', 'ethereal', 'bony'],
    structureZh: '鎖骨與腕踝偏薄，脂肪少',
    structureEn: 'visible collarbones, thin wrists, low fat',
    promptBlock: 'bony ethereal slim build, visible collarbones, cold beauty'
  },
  {
    id: 'mature_full',
    part: 'body',
    labelZh: '成熟豐滿',
    labelEn: 'Mature full',
    keywordsZh: ['成熟', '分量', '貴婦'],
    keywordsEn: ['mature', 'presence', 'noble'],
    structureZh: '體態更豐、有分量，不幼態',
    structureEn: 'fuller mature figure, visual weight',
    promptBlock: 'mature full figure, dignified presence, not youthful-skinny'
  },

  // ── Marks ─────────────────────────────────────────────────
  {
    id: 'beauty_mole',
    part: 'mark',
    labelZh: '美人痣',
    labelEn: 'Beauty mark',
    keywordsZh: ['辨識', '古典', '一點媚'],
    keywordsEn: ['identifier', 'classic', 'charm'],
    structureZh: '嘴角或顴側一顆小痣',
    structureEn: 'small mole near mouth corner or cheekbone',
    promptBlock: 'small beauty mark mole near mouth or cheek'
  },
  {
    id: 'tear_mole',
    part: 'mark',
    labelZh: '淚痣',
    labelEn: 'Tear mole',
    keywordsZh: ['哀感', '記憶點', '柔情'],
    keywordsEn: ['melancholy', 'memorable', 'tender'],
    structureZh: '眼尾下方一顆淚痣',
    structureEn: 'mole just below the outer eye corner',
    promptBlock: 'tear mole under the outer eye corner'
  },
  {
    id: 'faint_scar',
    part: 'mark',
    labelZh: '淺疤',
    labelEn: 'Faint scar',
    keywordsZh: ['往事', '鋒利', '故事感'],
    keywordsEn: ['history', 'edge', 'story'],
    structureZh: '眉骨或唇邊一道淺疤，不血腥',
    structureEn: 'faint scar on brow or lip edge, not gory',
    promptBlock: 'faint thin scar on brow or lip edge, not gory'
  },
  {
    id: 'freckles',
    part: 'mark',
    labelZh: '雀斑',
    labelEn: 'Freckles',
    keywordsZh: ['親近', '日光', '自然'],
    keywordsEn: ['approachable', 'sunlit', 'natural'],
    structureZh: '鼻樑與頰上淺淡雀斑',
    structureEn: 'light freckles across nose and cheeks',
    promptBlock: 'light freckles across the nose and cheeks'
  },
  {
    id: 'dimples',
    part: 'mark',
    labelZh: '酒窩',
    labelEn: 'Dimples',
    keywordsZh: ['親和', '甜', '微笑記憶點'],
    keywordsEn: ['friendly', 'sweet', 'smile cue'],
    structureZh: '單側或雙側笑時酒窩',
    structureEn: 'one or both cheek dimples when smiling',
    promptBlock: 'cheek dimples, visible when smiling'
  },
  {
    id: 'heterochromia',
    part: 'mark',
    labelZh: '異色瞳',
    labelEn: 'Heterochromia',
    keywordsZh: ['超常', '記憶點', '非日常'],
    keywordsEn: ['uncanny', 'memorable', 'other'],
    structureZh: '左右瞳色明顯不同',
    structureEn: 'clearly different left and right iris colors',
    promptBlock: 'heterochromia, distinctly different iris colors'
  },
  {
    id: 'aegyo_sal',
    part: 'mark',
    labelZh: '臥蠶明顯',
    labelEn: 'Prominent aegyo-sal',
    keywordsZh: ['幼態', '水光', '可愛'],
    keywordsEn: ['youthful', 'dewy', 'cute'],
    structureZh: '下眼瞼臥蠶飽滿，不腫',
    structureEn: 'full aegyo-sal under eyes, not puffy',
    promptBlock: 'prominent aegyo-sal under-eye bags, youthful not puffy'
  },
  {
    id: 'none',
    part: 'mark',
    labelZh: '無特殊標記',
    labelEn: 'No distinctive mark',
    keywordsZh: ['乾淨', '素面'],
    keywordsEn: ['clean', 'unmarked'],
    structureZh: '臉上無痣無疤無異色瞳',
    structureEn: 'no moles, scars, or heterochromia',
    promptBlock: ''
  }
]

export const APPEARANCE_TEMPLATES: AppearanceTemplateDef[] = [
  ...APPEARANCE_TEMPLATES_CORE,
  ...APPEARANCE_TEMPLATE_EXTRAS
]

export const APPEARANCE_KIT: FieldKitSpec<AppearancePartId> = {
  key: 'appearanceKit',
  parts: APPEARANCE_PART_IDS,
  partLabels: {
    face: PART_COPY.face,
    eyes: PART_COPY.eyes,
    nose: PART_COPY.nose,
    mouth: PART_COPY.mouth,
    hair: PART_COPY.hair,
    skin: PART_COPY.skin,
    body: PART_COPY.body,
    mark: PART_COPY.mark
  },
  extraLabels: {
    aura: PART_COPY.aura,
    notes: PART_COPY.notes
  },
  templates: APPEARANCE_TEMPLATES,
  skipAssemble: (def) => def.part === 'mark' && def.id === 'none',
  includeAura: true
}

export function listAppearanceTemplates(
  part: AppearancePartId
): readonly AppearanceTemplateDef[] {
  return listFieldKitTemplates(APPEARANCE_KIT, part) as AppearanceTemplateDef[]
}

export function getAppearanceTemplate(
  part: AppearancePartId,
  id: string | null | undefined
): AppearanceTemplateDef | undefined {
  return getFieldKitTemplate(APPEARANCE_KIT, part, id) as
    | AppearanceTemplateDef
    | undefined
}

export function isAppearancePartId(v: string | null | undefined): v is AppearancePartId {
  return Boolean(v && (APPEARANCE_PART_IDS as readonly string[]).includes(v))
}

export function emptyAppearanceKit(): AppearanceKitSelection {
  return {}
}

export function appearanceKitHasSelection(
  kit: AppearanceKitSelection | null | undefined
): boolean {
  return fieldKitHasSelection(APPEARANCE_KIT, kit ?? {})
}

export function countAppearanceKitParts(
  kit: AppearanceKitSelection | null | undefined
): number {
  if (!kit) return 0
  return APPEARANCE_PART_IDS.filter((part) => Boolean(kit[part])).length
}

export function sanitizeAppearanceKit(raw: unknown): AppearanceKitSelection {
  return sanitizeFieldKit(APPEARANCE_KIT, raw) as AppearanceKitSelection
}

export function parseAppearanceKit(
  json: string | null | undefined
): AppearanceKitSelection {
  return parseFieldKit(APPEARANCE_KIT, json) as AppearanceKitSelection
}

export function mergeAppearanceKitIntoProfileJson(
  existing: string | null | undefined,
  kit: AppearanceKitSelection
): string | null {
  return mergeOneKit(existing, APPEARANCE_KIT, kit)
}

export function setAppearanceKitPart(
  kit: AppearanceKitSelection,
  part: AppearancePartId,
  id: string | null | undefined
): AppearanceKitSelection {
  return setFieldKitPart(APPEARANCE_KIT, kit, part, id) as AppearanceKitSelection
}

export function appearanceTemplateSearchHaystack(
  def: AppearanceTemplateDef,
  locale?: string | null
): string {
  return fieldKitSearchHaystack(def, locale)
}

export function assembleAppearancePrompt(
  kit: AppearanceKitSelection,
  locale: string = 'zh-HK'
): string {
  return assembleFieldKitPrompt(APPEARANCE_KIT, kit as FieldKitSelection, locale)
}
