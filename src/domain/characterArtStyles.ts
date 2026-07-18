/**
 * Visual art styles for character reference generation.
 * Injected after identity lock, before layout — keeps style consistent per run.
 */

export type ArtStyleFamily = 'photo' | 'cgi' | 'anime' | 'illust'

export type ArtStyleId =
  | 'photo_cinematic'
  | 'photo_portrait'
  | 'photo_documentary'
  | 'cgi_film'
  | 'cgi_stylized'
  | 'cgi_clay'
  | 'anime_modern'
  | 'anime_shonen'
  | 'anime_shoujo'
  | 'anime_gekiga'
  | 'anime_chibi'
  | 'donghua'
  | 'manhwa'
  | 'comic_western'
  | 'concept_game'
  | 'illustration_soft'

export interface ArtStyleDef {
  id: ArtStyleId
  labelKey: string
  groupKey:
    | 'artGroupPhoto'
    | 'artGroup3d'
    | 'artGroupAnime'
    | 'artGroupIllust'
  family: ArtStyleFamily
  /** English block for image models */
  promptBlock: string
}

export const DEFAULT_ART_STYLE: ArtStyleId = 'photo_cinematic'

export const ART_STYLES: ArtStyleDef[] = [
  // ── Photoreal / live-action ────────────────────────────────
  {
    id: 'photo_cinematic',
    labelKey: 'artPhotoCinematic',
    groupKey: 'artGroupPhoto',
    family: 'photo',
    promptBlock:
      'MANDATORY MEDIUM = LIVE-ACTION PHOTOREAL FILM STILL. Real camera photography look, naturalistic materials, cinematic color grade, subtle film grain optional. MUST look like a real photo / movie frame. FORBIDDEN: anime, cel-shading, 2D illustration, cartoon outlines, clay, pure CGI plastic look.'
  },
  {
    id: 'photo_portrait',
    labelKey: 'artPhotoPortrait',
    groupKey: 'artGroupPhoto',
    family: 'photo',
    promptBlock:
      'MANDATORY MEDIUM = PHOTOREAL STUDIO PORTRAIT PHOTOGRAPHY. Softbox / beauty-dish lighting, commercial headshot clarity, real lens bokeh if any. MUST be a real photograph look. FORBIDDEN: anime, comic ink, 3D toy render, flat cel color.'
  },
  {
    id: 'photo_documentary',
    labelKey: 'artPhotoDocumentary',
    groupKey: 'artGroupPhoto',
    family: 'photo',
    promptBlock:
      'MANDATORY MEDIUM = PHOTOREAL DOCUMENTARY PHOTO. Natural available light, honest textures, low glamour, reportage feel. MUST look shot on a real camera. FORBIDDEN: anime, stylized CGI, illustration.'
  },
  // ── 3D / CGI ───────────────────────────────────────────────
  {
    id: 'cgi_film',
    labelKey: 'artCgiFilm',
    groupKey: 'artGroup3d',
    family: 'cgi',
    promptBlock:
      'MANDATORY MEDIUM = FILM-QUALITY 3D CGI CHARACTER RENDER (Unreal / VFX lookdev). Physically based materials, ray-traced highlights, clean mesh silhouette, studio HDRI. MUST look 3D-rendered, not a real photo and not 2D anime. FORBIDDEN: live-action photography, anime lineart, flat comic ink.'
  },
  {
    id: 'cgi_stylized',
    labelKey: 'artCgiStylized',
    groupKey: 'artGroup3d',
    family: 'cgi',
    promptBlock:
      'MANDATORY MEDIUM = STYLIZED PREMIUM 3D (feature-animation CGI). Rounded readable forms, soft PBR, polished lookdev, expressive proportions. MUST be 3D CGI. FORBIDDEN: photoreal live-action photo, 2D anime cel, sketchy comic.'
  },
  {
    id: 'cgi_clay',
    labelKey: 'artCgiClay',
    groupKey: 'artGroup3d',
    family: 'cgi',
    promptBlock:
      'MANDATORY MEDIUM = 3D CLAY / SCULPT CHARACTER. Soft matte clay material, sculpted forms, stop-motion CGI hybrid lighting. MUST read as clay sculpture 3D. FORBIDDEN: photoreal skin photo, anime cel, ink comic.'
  },
  // ── Anime / 2D ─────────────────────────────────────────────
  {
    id: 'anime_modern',
    labelKey: 'artAnimeModern',
    groupKey: 'artGroupAnime',
    family: 'anime',
    promptBlock:
      'MANDATORY MEDIUM = 2D MODERN JAPANESE TV ANIME. Clean digital lineart, soft cel-shading, anime eyes and hair clumps, flat/gradient color, character design sheet. The entire image MUST be pure 2D anime. FORBIDDEN: photoreal photography, real skin pores, 3D SSS render, Western comic ink only, oil painting.'
  },
  {
    id: 'anime_shonen',
    labelKey: 'artAnimeShonen',
    groupKey: 'artGroupAnime',
    family: 'anime',
    promptBlock:
      'MANDATORY MEDIUM = 2D SHONEN ANIME KEY VISUAL. Bold linework, high-contrast cel color, sharp anime eyes, dynamic silhouette. MUST be shonen anime 2D. FORBIDDEN: photoreal photo, 3D CGI, soft watercolor only.'
  },
  {
    id: 'anime_shoujo',
    labelKey: 'artAnimeShoujo',
    groupKey: 'artGroupAnime',
    family: 'anime',
    promptBlock:
      'MANDATORY MEDIUM = 2D SHOUJO ANIME. Delicate lineart, soft gradients, luminous anime eyes, gentle color script. MUST be shoujo anime illustration. FORBIDDEN: photoreal photo, hard 3D render, gritty comic ink.'
  },
  {
    id: 'anime_gekiga',
    labelKey: 'artAnimeGekiga',
    groupKey: 'artGroupAnime',
    family: 'anime',
    promptBlock:
      'MANDATORY MEDIUM = 2D GEKIGA / REALIST ANIME (serious drama animation). Mature line quality, restrained palette, still clearly 2D anime forms. FORBIDDEN: live-action photo, chibi, pure 3D CGI.'
  },
  {
    id: 'anime_chibi',
    labelKey: 'artAnimeChibi',
    groupKey: 'artGroupAnime',
    family: 'anime',
    promptBlock:
      'MANDATORY MEDIUM = 2D CHIBI / SUPER-DEFORMED ANIME. Large head, small body, cute simplified features, clean flat colors. MUST be chibi anime. FORBIDDEN: photoreal proportions, realistic 3D, detailed live-action.'
  },
  {
    id: 'donghua',
    labelKey: 'artDonghua',
    groupKey: 'artGroupAnime',
    family: 'anime',
    promptBlock:
      'MANDATORY MEDIUM = CHINESE DONGHUA (国漫) CHARACTER KEY ART. Refined costume detail, elegant silhouette, high-quality 2D/2.5D animation look. MUST read as donghua, not Hollywood photo. FORBIDDEN: photoreal live-action, Western newspaper comic only.'
  },
  {
    id: 'manhwa',
    labelKey: 'artManhwa',
    groupKey: 'artGroupAnime',
    family: 'anime',
    promptBlock:
      'MANDATORY MEDIUM = KOREAN MANHWA / WEBTOON FULL-COLOR ART. Soft digital paint + clean contours, glossy hair, webtoon portrait sensibility. MUST be manhwa 2D. FORBIDDEN: photoreal photo, clay 3D, American superhero ink only.'
  },
  // ── Illustration / other ───────────────────────────────────
  {
    id: 'comic_western',
    labelKey: 'artComicWestern',
    groupKey: 'artGroupIllust',
    family: 'illust',
    promptBlock:
      'MANDATORY MEDIUM = WESTERN COMIC-BOOK ART. Confident ink lines, flat or limited cel color, graphic shapes, design-sheet comic style. MUST be comic illustration. FORBIDDEN: photoreal photo, pure anime eye style only, clay render.'
  },
  {
    id: 'concept_game',
    labelKey: 'artConceptGame',
    groupKey: 'artGroupIllust',
    family: 'illust',
    promptBlock:
      'MANDATORY MEDIUM = AAA GAME CHARACTER CONCEPT ART. Paintover design sheet, strong silhouette, production concept quality. MUST look like concept art, not a final game screenshot and not a live-action photo. FORBIDDEN: pure photoreal portrait photo, chibi anime only.'
  },
  {
    id: 'illustration_soft',
    labelKey: 'artIllustrationSoft',
    groupKey: 'artGroupIllust',
    family: 'illust',
    promptBlock:
      'MANDATORY MEDIUM = SOFT DIGITAL ILLUSTRATION. Gentle brush rendering, storybook-adjacent polish, coherent character design. MUST be painted illustration. FORBIDDEN: photoreal camera photo, hard anime cel only, clay 3D.'
  }
]

const BY_ID = new Map(ART_STYLES.map((s) => [s.id, s]))

export function isArtStyleId(v: unknown): v is ArtStyleId {
  return typeof v === 'string' && BY_ID.has(v as ArtStyleId)
}

export function getArtStyle(id: string | null | undefined): ArtStyleDef {
  if (id && BY_ID.has(id as ArtStyleId)) return BY_ID.get(id as ArtStyleId)!
  return BY_ID.get(DEFAULT_ART_STYLE)!
}

export function artStylesByGroup(): Record<
  ArtStyleDef['groupKey'],
  ArtStyleDef[]
> {
  const out: Record<ArtStyleDef['groupKey'], ArtStyleDef[]> = {
    artGroupPhoto: [],
    artGroup3d: [],
    artGroupAnime: [],
    artGroupIllust: []
  }
  for (const s of ART_STYLES) out[s.groupKey].push(s)
  return out
}

/** Quality / medium language that matches the art family (avoid photo+anime clash). */
export function qualityBlockForFamily(family: ArtStyleFamily): string {
  switch (family) {
    case 'photo':
      return [
        'Quality: tack-sharp focus on eyes or primary face/head features, high micro-detail appropriate to photoreal media (skin pores or fur strands or metal micro-scratches as fits the species),',
        'professional three-point studio lighting unless the style says otherwise, prime-lens look (50–85mm), no motion blur, no heavy face-softening beauty filter, no watermark or text.'
      ].join(' ')
    case 'cgi':
      return [
        'Quality: clean 3D character presentation, readable materials (PBR), consistent topology silhouette, sharp primary forms,',
        'studio HDRI or three-point CG light, no noise grain unless clay style, no watermark or text, not a real photograph.'
      ].join(' ')
    case 'anime':
      return [
        'Quality: clean 2D character design sheet craft, consistent line weight, stable face model across panels, controlled cel or soft-shade color,',
        'avoid photoreal photography, avoid live-action look, avoid 3D SSS photo shading, no watermark or text labels.'
      ].join(' ')
    case 'illust':
    default:
      return [
        'Quality: professional illustration design-sheet clarity, consistent character design, readable silhouette and costume/materials,',
        'studio-neutral backdrop, no watermark, no UI text captions.'
      ].join(' ')
  }
}
