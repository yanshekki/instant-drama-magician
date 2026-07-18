/**
 * Professional character-sheet layouts for Grok Imagine.
 * Includes wardrobe layers (nude body / base undergarments / full costume)
 * for future costume-swap pipelines.
 */

export type SheetSizeClass = 'wide' | 'square' | 'tall'

export type WardrobeLayer =
  | 'identity'
  | 'nude'
  | 'base'
  | 'costume'
  | 'detail'

export type SheetGroupKey =
  | 'sheetGroupCore'
  | 'sheetGroupAngles'
  | 'sheetGroupWardrobe'
  | 'sheetGroupDetail'

export type SheetVariantId =
  | 'bible'
  | 'turnaround'
  | 'expression'
  | 'costume'
  | 'hero'
  | 'face_id'
  | 'bust'
  | 'three_quarter'
  | 'profile'
  | 'back'
  | 'low_angle'
  | 'high_angle'
  | 'action'
  | 'dialogue'
  | 'hands'
  | 'identity_lock'
  // Wardrobe pipeline (costume swap foundation)
  | 'body_nude_turnaround'
  | 'body_nude_front'
  | 'body_nude_t_pose'
  /** Upper half-bare: bare torso; simple solid bottoms only */
  | 'body_half_bare_turnaround'
  | 'body_half_bare_front'
  | 'body_half_bare_t_pose'
  /** Lower half-bare: bare legs; simple solid top only */
  | 'body_half_bare_lower_turnaround'
  | 'body_half_bare_lower_front'
  | 'body_half_bare_lower_t_pose'
  /** Full unclothed anatomical plates (provider-dependent; user opt-in) */
  | 'body_bare_turnaround'
  | 'body_bare_front'
  | 'body_bare_t_pose'
  | 'base_layer_turnaround'
  | 'base_layer_hero'
  | 'costume_hero'
  | 'costume_turnaround'
  | 'costume_detail_board'
  // Extra detail
  | 'feet_shoes'
  | 'accessories'
  | 'silhouette'

export interface SheetVariantDef {
  id: SheetVariantId
  /** i18n key under characters.* */
  labelKey: string
  /** Gallery label (English short tag stored in JSON) */
  galleryLabel: string
  sizeClass: SheetSizeClass
  groupKey: SheetGroupKey
  /** Costume-swap pipeline layer tag */
  wardrobeLayer: WardrobeLayer
  /**
   * Layout instruction only (appended after shared identity lock).
   * Keep panel count low for ~720p–1K native canvas.
   */
  layout: string
  /**
   * True unclothed anatomical body (not unitard). Many image APIs may refuse;
   * UI should warn and leave the choice to the adult user.
   */
  requiresUnclothedSupport?: boolean
}

/**
 * Body-plate for costume-swap foundation.
 * Grok Imagine blocks true unclothed / “nude/bare” prompts (no_image_in_sandbox).
 * Use a seamless matte skin-tone unitard so proportions stay readable for wardrobe CG
 * without triggering the provider safety filter.
 */
const WARDROBE_NUDE_ADDON =
  'PRODUCTION COSTUME-DESIGN BODY PROPORTION PLATE (NOT adult content, NOT unclothed photography): ' +
  'neutral clinical studio lighting, plain gray cyclorama, professional figure-drawing pose. ' +
  'No fashion photography, no lingerie styling, no bedroom or glamorous set. ' +
  'Subject wears a seamless matte skin-tone unitard / full-body form-fit base suit ' +
  '(or species-appropriate solid matte body suit) that reveals exact body silhouette and proportions — ' +
  'face and hair visible; NO outer costume, NO logos, NO props, NO shoes, NO accessories. ' +
  'The unitard is production under-suit only (like a CG body mesh), never outer wardrobe. ' +
  'Preserve face, hair, body proportions, and surface markings for later wardrobe CG. ' +
  'Ignore any outer costume description for this sheet. Explicitly clothed in unitard — never unclothed.'

/**
 * Upper half-bare: bare upper body; simple solid coverage on lower body only.
 * Adult characters only. Clinical figure study — not erotic.
 */
const WARDROBE_HALF_BARE_UPPER_ADDON =
  'PRODUCTION UPPER-BODY PARTIAL REFERENCE for costume-design measurements (ADULT character only; clinical figure study; NOT erotic; NOT pornography; NOT suggestive): ' +
  'neutral clinical studio lighting, plain gray cyclorama, professional medical / mannequin standing pose. ' +
  'No fashion photography, no lingerie styling, no bedroom set, no sexualized camera. ' +
  'UPPER HALF BARE: bare torso, chest, shoulders, arms, and neck; face and hair fully visible. ' +
  'LOWER HALF COVERED only with a simple solid matte neutral or skin-tone opaque bottom ' +
  '(plain shorts, brief, or simple wrap — production coverage only, NOT fashion lingerie, NO lace, NO sheer). ' +
  'NO outer costume top, NO bra as fashion item, NO props, NO shoes, NO accessories, NO logos. ' +
  'Preserve face, hair, body proportions, and surface markings for later wardrobe CG / costume fitting. ' +
  'Ignore any outer costume description for this sheet.'

/**
 * Lower half-bare: bare legs; simple solid coverage on upper body only.
 * Adult characters only. Clinical figure study — not erotic.
 */
const WARDROBE_HALF_BARE_LOWER_ADDON =
  'PRODUCTION LOWER-BODY PARTIAL REFERENCE for costume-design measurements (ADULT character only; clinical figure study; NOT erotic; NOT pornography; NOT suggestive): ' +
  'neutral clinical studio lighting, plain gray cyclorama, professional medical / mannequin standing pose. ' +
  'No fashion photography, no lingerie styling, no bedroom set, no sexualized camera. ' +
  'LOWER HALF BARE: bare hips, thighs, legs, and feet; face and hair fully visible. ' +
  'Intimate areas only: MINIMAL solid matte skin-tone or neutral opaque coverage (simple brief — production only, NOT fashion lingerie). ' +
  'UPPER HALF COVERED with a simple solid matte neutral top only ' +
  '(plain tank, undershirt, or wrap — production coverage only, NO fashion styling, NO logos). ' +
  'NO outer costume, NO props, NO shoes, NO accessories. ' +
  'Preserve face, hair, body proportions, and surface markings for later wardrobe CG / costume fitting. ' +
  'Ignore any outer costume description for this sheet.'

/**
 * Full garment-free anatomical plate for costume-swap foundation.
 * Adult characters only. Clinical figure study — not erotic / not fashion nude.
 * May be refused by some providers (e.g. no_image_in_sandbox); unitard plates are safer.
 */
const WARDROBE_BARE_ADDON =
  'PRODUCTION FULL ANATOMICAL BODY REFERENCE for costume-design measurements (ADULT character only; clinical figure study; NOT erotic; NOT pornography; NOT suggestive): ' +
  'neutral clinical studio lighting, plain gray cyclorama, professional medical / mannequin standing pose. ' +
  'No fashion photography, no lingerie pose, no bedroom set, no sexualized camera. ' +
  'Subject is FULLY garment-free (complete bare body form, or species-appropriate bare surface) with face and hair only — ' +
  'NO clothing, NO partial coverings, NO outer costume, NO props, NO shoes, NO accessories. ' +
  'Preserve face, hair, body proportions, and surface markings for later wardrobe CG / costume fitting. ' +
  'Ignore any outer costume description for this sheet.'

const WARDROBE_BASE_ADDON =
  'PRODUCTION BASE-LAYER REFERENCE (undergarment / base clothing for costume swap, NOT erotic): ' +
  'simple solid neutral undergarments or species-appropriate base covering only (e.g. plain briefs + undershirt, or simple wrap). ' +
  'No outer costume, no logos, no fashion lingerie styling, no suggestive pose. ' +
  'Clinical studio light, gray backdrop. Preserve identity for dressing outer costumes later. ' +
  'Ignore outer costume description for this sheet.'

const WARDROBE_COSTUME_ADDON =
  'PRODUCTION COSTUME REFERENCE: full designed outer wardrobe as described; readable materials and silhouette for video continuity.'

/** Canonical list — order = UI order within groups. */
export const SHEET_VARIANTS: SheetVariantDef[] = [
  // ── Core reference packs ───────────────────────────────────
  {
    id: 'bible',
    labelKey: 'sheetBible',
    galleryLabel: 'Bible sheet',
    sizeClass: 'wide',
    groupKey: 'sheetGroupCore',
    wardrobeLayer: 'identity',
    layout:
      'Wide 16:9 character bible with EXACTLY THREE equal vertical panels left-to-right: ' +
      '(1) full body standing front, feet visible, arms relaxed; ' +
      '(2) full body three-quarter ~45°; ' +
      '(3) head-and-shoulders portrait facing camera. ' +
      'Each figure fills its panel. Same face, hair, body, and costume in all three. Hard gutters, clean studio.'
  },
  {
    id: 'turnaround',
    labelKey: 'sheetTurnaround',
    galleryLabel: 'Turnaround',
    sizeClass: 'wide',
    groupKey: 'sheetGroupCore',
    wardrobeLayer: 'costume',
    layout:
      'Wide 16:9 turnaround with EXACTLY FOUR full-body figures same scale: front, left profile 90°, full back, right profile 90°. ' +
      'Neutral A-pose / relaxed arms, feet planted. Full costume. Maximum figure height.'
  },
  {
    id: 'expression',
    labelKey: 'sheetExpression',
    galleryLabel: 'Expressions',
    sizeClass: 'square',
    groupKey: 'sheetGroupCore',
    wardrobeLayer: 'identity',
    layout:
      'Square 1:1 tight 2×2 of EXACTLY four head-and-shoulders close-ups: neutral, soft smile, anger, surprise. ' +
      'Each face fills ~90% of its cell; identical hair and collar. No full body.'
  },
  {
    id: 'costume',
    labelKey: 'sheetCostume',
    galleryLabel: 'Costume board',
    sizeClass: 'tall',
    groupKey: 'sheetGroupCore',
    wardrobeLayer: 'costume',
    layout:
      'Tall 9:16 costume board: upper ~65% large full-body hero in full costume facing camera; ' +
      'lower band EXACTLY two large detail crops (fabric/pocket + shoes or signature accessory). Readable materials.'
  },
  {
    id: 'identity_lock',
    labelKey: 'sheetIdentityLock',
    galleryLabel: 'Identity lock',
    sizeClass: 'wide',
    groupKey: 'sheetGroupCore',
    wardrobeLayer: 'identity',
    layout:
      'Wide 16:9 identity lock with EXACTLY TWO panels: left 60% large front face close-up; right 40% three-quarter face. ' +
      'Maximize facial detail for video identity; no full body.'
  },
  {
    id: 'face_id',
    labelKey: 'sheetFaceId',
    galleryLabel: 'Face ID',
    sizeClass: 'square',
    groupKey: 'sheetGroupCore',
    wardrobeLayer: 'identity',
    layout:
      'Square 1:1 single large centered front face (or primary head) portrait, upper body included, looking into lens. ' +
      'Sharp primary features, fully in the mandatory art medium. One character only.'
  },

  // ── Camera angles ──────────────────────────────────────────
  {
    id: 'hero',
    labelKey: 'sheetHero',
    galleryLabel: 'Hero full-body',
    sizeClass: 'tall',
    groupKey: 'sheetGroupAngles',
    wardrobeLayer: 'costume',
    layout:
      'Tall 9:16 SINGLE full-body hero standing portrait, eye-level, entire figure visible. ' +
      'Centered neutral stance, studio backdrop, full costume, mandatory art medium.'
  },
  {
    id: 'bust',
    labelKey: 'sheetBust',
    galleryLabel: 'Bust portrait',
    sizeClass: 'square',
    groupKey: 'sheetGroupAngles',
    wardrobeLayer: 'costume',
    layout:
      'Square 1:1 medium bust (chest-up), slight three-quarter body, face toward camera. Dialogue framing, costume collar visible.'
  },
  {
    id: 'three_quarter',
    labelKey: 'sheetThreeQuarter',
    galleryLabel: '3/4 body',
    sizeClass: 'tall',
    groupKey: 'sheetGroupAngles',
    wardrobeLayer: 'costume',
    layout:
      'Tall 9:16 three-quarter body (~knees up), body angled 30–45°, face toward camera. Clear costume silhouette, hands visible.'
  },
  {
    id: 'profile',
    labelKey: 'sheetProfile',
    galleryLabel: 'Side profile',
    sizeClass: 'tall',
    groupKey: 'sheetGroupAngles',
    wardrobeLayer: 'costume',
    layout:
      'Tall 9:16 pure left-side full-body profile 90°, looking left, spine straight. True silhouette; full costume; one character.'
  },
  {
    id: 'back',
    labelKey: 'sheetBack',
    galleryLabel: 'Back view',
    sizeClass: 'tall',
    groupKey: 'sheetGroupAngles',
    wardrobeLayer: 'costume',
    layout:
      'Tall 9:16 full-body back view, standing away from camera, hair and costume back readable. Exit continuity sheet.'
  },
  {
    id: 'low_angle',
    labelKey: 'sheetLowAngle',
    galleryLabel: 'Low angle',
    sizeClass: 'tall',
    groupKey: 'sheetGroupAngles',
    wardrobeLayer: 'costume',
    layout:
      'Tall 9:16 heroic low-angle full body, camera near waist height looking up slightly, powerful stance, face still sharp, full costume.'
  },
  {
    id: 'high_angle',
    labelKey: 'sheetHighAngle',
    galleryLabel: 'High angle',
    sizeClass: 'tall',
    groupKey: 'sheetGroupAngles',
    wardrobeLayer: 'costume',
    layout:
      'Tall 9:16 high-angle three-quarter body, camera slightly above eye line looking down, face readable, full costume.'
  },
  {
    id: 'action',
    labelKey: 'sheetAction',
    galleryLabel: 'Action still',
    sizeClass: 'wide',
    groupKey: 'sheetGroupAngles',
    wardrobeLayer: 'costume',
    layout:
      'Wide 16:9 action freeze-frame of ONE character mid-motion (walk or reach), sharp no motion blur, full costume, soft gray environment.'
  },
  {
    id: 'dialogue',
    labelKey: 'sheetDialogue',
    galleryLabel: 'Dialogue OS',
    sizeClass: 'wide',
    groupKey: 'sheetGroupAngles',
    wardrobeLayer: 'costume',
    layout:
      'Wide 16:9 over-the-shoulder dialogue frame: soft foreground shoulder of the SAME character, background sharp face looking camera-left. Single identity only.'
  },

  // ── Wardrobe layers (costume-swap foundation) ──────────────
  {
    id: 'body_nude_turnaround',
    labelKey: 'sheetBodyNudeTurnaround',
    galleryLabel: 'Body plate turnaround',
    sizeClass: 'wide',
    groupKey: 'sheetGroupWardrobe',
    wardrobeLayer: 'nude',
    layout:
      WARDROBE_NUDE_ADDON +
      ' Wide 16:9 body-proportion turnaround with EXACTLY FOUR full-body figures same scale: front, left 90°, back, right 90°. ' +
      'Neutral A-pose, arms slightly away from torso so silhouette is clear, feet planted. Skin-tone unitard only. Face and hair consistent.'
  },
  {
    id: 'body_nude_front',
    labelKey: 'sheetBodyNudeFront',
    galleryLabel: 'Body plate front',
    sizeClass: 'tall',
    groupKey: 'sheetGroupWardrobe',
    wardrobeLayer: 'nude',
    layout:
      WARDROBE_NUDE_ADDON +
      ' Tall 9:16 SINGLE full-body front body-proportion plate, eye-level, head-to-toe visible, relaxed arms. ' +
      'Clear body proportions for costume fitting. Skin-tone unitard only. Neutral professional stance.'
  },
  {
    id: 'body_nude_t_pose',
    labelKey: 'sheetBodyNudeTPose',
    galleryLabel: 'Body plate T-pose',
    sizeClass: 'wide',
    groupKey: 'sheetGroupWardrobe',
    wardrobeLayer: 'nude',
    layout:
      WARDROBE_NUDE_ADDON +
      ' Wide 16:9 SINGLE full-body T-pose or A-pose (arms horizontal or 30° down), front-facing, skin-tone unitard for bind/rig reference. ' +
      'Feet shoulder-width, face forward, clinical mannequin energy for wardrobe pipeline.'
  },
  {
    id: 'body_half_bare_turnaround',
    labelKey: 'sheetBodyHalfBareUpperTurnaround',
    galleryLabel: 'Body upper half-bare turnaround',
    sizeClass: 'wide',
    groupKey: 'sheetGroupWardrobe',
    wardrobeLayer: 'nude',
    requiresUnclothedSupport: true,
    layout:
      WARDROBE_HALF_BARE_UPPER_ADDON +
      ' Wide 16:9 upper-half-bare turnaround with EXACTLY FOUR full-body figures same scale: front, left 90°, back, right 90°. ' +
      'Neutral A-pose, arms slightly away from torso so upper silhouette is clear, feet planted. Upper half bare + simple bottoms only. Face and hair consistent.'
  },
  {
    id: 'body_half_bare_front',
    labelKey: 'sheetBodyHalfBareUpperFront',
    galleryLabel: 'Body upper half-bare front',
    sizeClass: 'tall',
    groupKey: 'sheetGroupWardrobe',
    wardrobeLayer: 'nude',
    requiresUnclothedSupport: true,
    layout:
      WARDROBE_HALF_BARE_UPPER_ADDON +
      ' Tall 9:16 SINGLE full-body front upper-half-bare plate, eye-level, head-to-toe visible, relaxed arms. ' +
      'Bare upper torso; simple solid bottoms only. Clear body proportions. Neutral professional stance.'
  },
  {
    id: 'body_half_bare_t_pose',
    labelKey: 'sheetBodyHalfBareUpperTPose',
    galleryLabel: 'Body upper half-bare T-pose',
    sizeClass: 'wide',
    groupKey: 'sheetGroupWardrobe',
    wardrobeLayer: 'nude',
    requiresUnclothedSupport: true,
    layout:
      WARDROBE_HALF_BARE_UPPER_ADDON +
      ' Wide 16:9 SINGLE full-body T-pose or A-pose (arms horizontal or 30° down), front-facing, upper half bare for bind/rig reference. ' +
      'Simple solid bottoms only. Feet shoulder-width, face forward, clinical mannequin energy.'
  },
  {
    id: 'body_half_bare_lower_turnaround',
    labelKey: 'sheetBodyHalfBareLowerTurnaround',
    galleryLabel: 'Body lower half-bare turnaround',
    sizeClass: 'wide',
    groupKey: 'sheetGroupWardrobe',
    wardrobeLayer: 'nude',
    requiresUnclothedSupport: true,
    layout:
      WARDROBE_HALF_BARE_LOWER_ADDON +
      ' Wide 16:9 lower-half-bare turnaround with EXACTLY FOUR full-body figures same scale: front, left 90°, back, right 90°. ' +
      'Neutral A-pose, legs slightly apart so lower silhouette is clear, feet planted. Lower half bare + simple top only. Face and hair consistent.'
  },
  {
    id: 'body_half_bare_lower_front',
    labelKey: 'sheetBodyHalfBareLowerFront',
    galleryLabel: 'Body lower half-bare front',
    sizeClass: 'tall',
    groupKey: 'sheetGroupWardrobe',
    wardrobeLayer: 'nude',
    requiresUnclothedSupport: true,
    layout:
      WARDROBE_HALF_BARE_LOWER_ADDON +
      ' Tall 9:16 SINGLE full-body front lower-half-bare plate, eye-level, head-to-toe visible, relaxed arms. ' +
      'Bare legs; simple solid top only. Clear body proportions. Neutral professional stance.'
  },
  {
    id: 'body_half_bare_lower_t_pose',
    labelKey: 'sheetBodyHalfBareLowerTPose',
    galleryLabel: 'Body lower half-bare T-pose',
    sizeClass: 'wide',
    groupKey: 'sheetGroupWardrobe',
    wardrobeLayer: 'nude',
    requiresUnclothedSupport: true,
    layout:
      WARDROBE_HALF_BARE_LOWER_ADDON +
      ' Wide 16:9 SINGLE full-body T-pose or A-pose (arms horizontal or 30° down), front-facing, lower half bare for bind/rig reference. ' +
      'Simple solid top only. Feet shoulder-width, face forward, clinical mannequin energy.'
  },
  {
    id: 'body_bare_turnaround',
    labelKey: 'sheetBodyBareTurnaround',
    galleryLabel: 'Body full-bare turnaround',
    sizeClass: 'wide',
    groupKey: 'sheetGroupWardrobe',
    wardrobeLayer: 'nude',
    requiresUnclothedSupport: true,
    layout:
      WARDROBE_BARE_ADDON +
      ' Wide 16:9 FULL anatomical body turnaround with EXACTLY FOUR full-body figures same scale: front, left 90°, back, right 90°. ' +
      'Neutral A-pose, arms slightly away from torso so silhouette is clear, feet planted. Fully garment-free form only. Face and hair consistent.'
  },
  {
    id: 'body_bare_front',
    labelKey: 'sheetBodyBareFront',
    galleryLabel: 'Body full-bare front',
    sizeClass: 'tall',
    groupKey: 'sheetGroupWardrobe',
    wardrobeLayer: 'nude',
    requiresUnclothedSupport: true,
    layout:
      WARDROBE_BARE_ADDON +
      ' Tall 9:16 SINGLE full-body front FULL anatomical plate, eye-level, head-to-toe visible, relaxed arms. ' +
      'Clear body proportions for costume fitting. Fully garment-free form only. Neutral professional stance.'
  },
  {
    id: 'body_bare_t_pose',
    labelKey: 'sheetBodyBareTPose',
    galleryLabel: 'Body full-bare T-pose',
    sizeClass: 'wide',
    groupKey: 'sheetGroupWardrobe',
    wardrobeLayer: 'nude',
    requiresUnclothedSupport: true,
    layout:
      WARDROBE_BARE_ADDON +
      ' Wide 16:9 SINGLE full-body T-pose or A-pose (arms horizontal or 30° down), front-facing, fully garment-free form for bind/rig reference. ' +
      'Feet shoulder-width, face forward, clinical mannequin energy for wardrobe pipeline.'
  },
  {
    id: 'base_layer_turnaround',
    labelKey: 'sheetBaseLayerTurnaround',
    galleryLabel: 'Base layer turnaround',
    sizeClass: 'wide',
    groupKey: 'sheetGroupWardrobe',
    wardrobeLayer: 'base',
    layout:
      WARDROBE_BASE_ADDON +
      ' Wide 16:9 base-layer turnaround with EXACTLY FOUR full-body figures: front, left 90°, back, right 90°. ' +
      'Only simple undergarments / base clothing (solid gray or beige), no outer costume. Neutral A-pose.'
  },
  {
    id: 'base_layer_hero',
    labelKey: 'sheetBaseLayerHero',
    galleryLabel: 'Base layer hero',
    sizeClass: 'tall',
    groupKey: 'sheetGroupWardrobe',
    wardrobeLayer: 'base',
    layout:
      WARDROBE_BASE_ADDON +
      ' Tall 9:16 SINGLE full-body front in simple base undergarments only, neutral standing pose, head-to-toe. ' +
      'Clean silhouette ready for outer costume overlay later.'
  },
  {
    id: 'costume_hero',
    labelKey: 'sheetCostumeHero',
    galleryLabel: 'Costume hero',
    sizeClass: 'tall',
    groupKey: 'sheetGroupWardrobe',
    wardrobeLayer: 'costume',
    layout:
      WARDROBE_COSTUME_ADDON +
      ' Tall 9:16 SINGLE full-body front in COMPLETE outer costume as designed, hero standing pose, head-to-toe, materials readable.'
  },
  {
    id: 'costume_turnaround',
    labelKey: 'sheetCostumeTurnaround',
    galleryLabel: 'Costume turnaround',
    sizeClass: 'wide',
    groupKey: 'sheetGroupWardrobe',
    wardrobeLayer: 'costume',
    layout:
      WARDROBE_COSTUME_ADDON +
      ' Wide 16:9 FULL COSTUME turnaround EXACTLY FOUR full-body figures: front, left 90°, back, right 90°. ' +
      'Same scale, A-pose, complete outer wardrobe including shoes and outer layers.'
  },
  {
    id: 'costume_detail_board',
    labelKey: 'sheetCostumeDetailBoard',
    galleryLabel: 'Costume details',
    sizeClass: 'square',
    groupKey: 'sheetGroupWardrobe',
    wardrobeLayer: 'costume',
    layout:
      WARDROBE_COSTUME_ADDON +
      ' Square 1:1 detail board with EXACTLY four large close-ups of the full costume: fabric weave, fastener/button, shoes or boots, signature accessory. ' +
      'No full body; material fidelity for wardrobe continuity.'
  },

  // ── Detail ─────────────────────────────────────────────────
  {
    id: 'hands',
    labelKey: 'sheetHands',
    galleryLabel: 'Hands detail',
    sizeClass: 'square',
    groupKey: 'sheetGroupDetail',
    wardrobeLayer: 'detail',
    layout:
      'Square 1:1 close study of character hands (optional small prop). Skin/surface tone matches identity; sharp knuckles. Continuity detail sheet.'
  },
  {
    id: 'feet_shoes',
    labelKey: 'sheetFeetShoes',
    galleryLabel: 'Feet / shoes',
    sizeClass: 'square',
    groupKey: 'sheetGroupDetail',
    wardrobeLayer: 'detail',
    layout:
      'Square 1:1 with EXACTLY TWO large panels: left bare feet (or bare paws/equivalent) standing on seamless floor; ' +
      'right matching designed shoes/boots or footwear if costume has any. Clear silhouette for wardrobe swap.'
  },
  {
    id: 'accessories',
    labelKey: 'sheetAccessories',
    galleryLabel: 'Accessories',
    sizeClass: 'square',
    groupKey: 'sheetGroupDetail',
    wardrobeLayer: 'detail',
    layout:
      'Square 1:1 accessories board: up to FOUR large product-style close-ups of hat, bag, weapon, jewelry, or signature props from the costume description. Clean studio, no full body.'
  },
  {
    id: 'silhouette',
    labelKey: 'sheetSilhouette',
    galleryLabel: 'Silhouette',
    sizeClass: 'tall',
    groupKey: 'sheetGroupDetail',
    wardrobeLayer: 'detail',
    layout:
      'Tall 9:16 pure black solid silhouette of the character full-body front on pure white or light gray, no internal detail, ' +
      'readable outer contour for proportion checks during costume swap. Optional faint second panel side silhouette if space allows — prefer single strong front silhouette.'
  }
]

const BY_ID = new Map(SHEET_VARIANTS.map((v) => [v.id, v]))

export const DEFAULT_SHEET_VARIANT: SheetVariantId = 'bible'

export function isSheetVariantId(v: unknown): v is SheetVariantId {
  return typeof v === 'string' && BY_ID.has(v as SheetVariantId)
}

export function getSheetVariant(id: string | undefined | null): SheetVariantDef {
  if (id && BY_ID.has(id as SheetVariantId)) {
    return BY_ID.get(id as SheetVariantId)!
  }
  return BY_ID.get(DEFAULT_SHEET_VARIANT)!
}

/** True bare-body packages that may need provider content support. */
export function sheetRequiresUnclothedSupport(
  id: string | undefined | null
): boolean {
  return Boolean(getSheetVariant(id).requiresUnclothedSupport)
}

export function sheetVariantsByGroup(): Record<SheetGroupKey, SheetVariantDef[]> {
  const out: Record<SheetGroupKey, SheetVariantDef[]> = {
    sheetGroupCore: [],
    sheetGroupAngles: [],
    sheetGroupWardrobe: [],
    sheetGroupDetail: []
  }
  for (const v of SHEET_VARIANTS) {
    out[v.groupKey].push(v)
  }
  return out
}

/** Heuristic: hide nude body sheets when age suggests a minor. */
export function isLikelyMinorAge(ageRange?: string | null): boolean {
  if (!ageRange?.trim()) return false
  const s = ageRange.toLowerCase()
  if (
    /minor|child|kid|infant|toddler|baby|teen|少年|兒童|小孩|未成年|小學|初中|高中生|少女(?!向)/i.test(
      s
    )
  ) {
    // "teen" is ambiguous; still restrict nude for safety
    return true
  }
  const years = s.match(/(\d{1,2})\s*(歲|years?|yo|y\/o)?/i)
  if (years) {
    const n = Number(years[1])
    if (n > 0 && n < 18) return true
  }
  return false
}

export function sheetVariantsForProfile(opts?: {
  ageRange?: string | null
}): SheetVariantDef[] {
  const minor = isLikelyMinorAge(opts?.ageRange)
  if (!minor) return SHEET_VARIANTS
  return SHEET_VARIANTS.filter((v) => v.wardrobeLayer !== 'nude')
}

export function sheetVariantsByGroupForProfile(opts?: {
  ageRange?: string | null
}): Record<SheetGroupKey, SheetVariantDef[]> {
  const out: Record<SheetGroupKey, SheetVariantDef[]> = {
    sheetGroupCore: [],
    sheetGroupAngles: [],
    sheetGroupWardrobe: [],
    sheetGroupDetail: []
  }
  for (const v of sheetVariantsForProfile(opts)) {
    out[v.groupKey].push(v)
  }
  return out
}

/** Shared identity lock (entity may be human, animal, spirit, robot, virtual, etc.). */
export function buildSheetIdentityLock(
  profile: {
    name: string
    ageRange?: string
    gender?: string
    appearance?: string
    costume?: string
    visualTags?: string
    mannerisms?: string
  },
  qualityBlock?: string,
  options?: { skipOuterCostume?: boolean }
): string {
  const quality =
    qualityBlock ??
    'Quality: tack-sharp focus on primary face/head features, high micro-detail appropriate to the medium, professional studio lighting, no motion blur, no watermark or text.'

  const identity = [
    `Create a character reference still for AI video continuity.`,
    `CRITICAL IDENTITY LOCK: exactly ONE character subject in every panel (may be human, animal, creature, spirit, robot, or other designed entity — but never swap species or design mid-sheet).`,
    `Do not invent a second character; keep the same body plan, markings, colors, and head design across all panels.`,
    `Head/face (or equivalent) must stay consistent: same eyes or sensors, same silhouette of head, same surface colors and key identifiers.`,
    quality,
    `Camera: stable reference framing, straight verticals, no fish-eye unless layout requires a special angle.`,
    `Background: clean seamless light-gray or off-white studio cyclorama, empty, even; no clutter unless the layout asks for a small costume/prop detail.`,
    `Forbidden: watermarks, logos, captions, text, UI chrome, random extra limbs, deformed extremities (unless the shot is intentionally hands/detail-only).`,
    `Subject name/concept: ${profile.name}`,
    profile.ageRange ? `Age or maturity presentation: ${profile.ageRange}` : '',
    profile.gender ? `Gender / presentation: ${profile.gender}` : '',
    profile.appearance
      ? options?.skipOuterCostume
        ? `Appearance — FACE / HAIR / BODY PROPORTIONS ONLY (must match): ${profile.appearance}. ` +
          'STRIP from this description any clothing, coats, umbrellas, bags, shoes, jewelry, or props — they must NOT appear.'
        : `Appearance (must match exactly): ${profile.appearance}`
      : '',
    options?.skipOuterCostume
      ? 'Outer costume / props: COMPLETELY IGNORE for this sheet. No umbrella, bag, coat, or fashion items. Body or base-layer plate only.'
      : profile.costume
        ? `Costume / exterior design (must match exactly): ${profile.costume}`
        : '',
    profile.visualTags
      ? options?.skipOuterCostume
        ? `Visual tags (identity only; drop clothing/prop tags): ${profile.visualTags}`
        : `Visual tags: ${profile.visualTags}`
      : '',
    profile.mannerisms
      ? `Subtle pose/mannerism hints only (do not change identity): ${profile.mannerisms.slice(0, 180)}`
      : ''
  ]
    .filter(Boolean)
    .join(' ')

  return identity
}
