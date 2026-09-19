/**
 * Stable Diffusion image channel (not OpenAI /images).
 * WebUI family: A1111 / Forge / SD.Next  POST /sdapi/v1/txt2img|img2img
 * Cloud: Stability Platform v2beta /stable-image/generate/sd3
 */

export const SD_WEBUI_DEFAULT_BASE = 'http://127.0.0.1:7860'
export const STABILITY_API_BASE = 'https://api.stability.ai'
export const DEFAULT_STABILITY_MODEL = 'sd3.5-large'
export const DEFAULT_SD_SAMPLER = 'DPM++ 2M'
export const DEFAULT_SD_STEPS = 28
export const DEFAULT_SD_CFG = 7
export const DEFAULT_SD_DENOISING = 0.45
export const DEFAULT_SD_NEGATIVE =
  'low quality, blurry, watermark, extra fingers, deformed, text, logo'

export const SD_SAMPLERS = [
  'DPM++ 2M',
  'DPM++ 2M Karras',
  'Euler a',
  'Euler',
  'DDIM'
] as const

export type SdBackend = 'webui' | 'stability'

export type SdPixelSize = { width: number; height: number; aspectRatio: string }

export function isStabilityBase(url: string): boolean {
  return /api\.stability\.ai/i.test(url || '')
}

export function detectSdBackend(baseUrl: string): SdBackend {
  return isStabilityBase(baseUrl) ? 'stability' : 'webui'
}

export const COMFY_DEFAULT_PORT_HINT = '8188'

export function comfySamplerName(sampler: string): string {
  const map: Record<string, string> = {
    'DPM++ 2M': 'dpmpp_2m',
    'DPM++ 2M Karras': 'dpmpp_2m',
    Euler: 'euler',
    'Euler a': 'euler_ancestral',
    DDIM: 'ddim'
  }
  return map[sampler] || 'dpmpp_2m'
}

/** Replace {{PROMPT}} style slots in a ComfyUI workflow JSON string. */
export function applyComfyPlaceholders(
  workflowJson: string,
  vars: Record<string, string | number>
): string {
  let out = workflowJson
  for (const [k, v] of Object.entries(vars)) {
    out = out.split(`{{${k}}}`).join(String(v))
  }
  return out
}

/** Slots ComfyUI video workflows should include (API JSON). */
export const SD_COMFY_VIDEO_SLOTS = [
  'PROMPT',
  'NEGATIVE',
  'WIDTH',
  'HEIGHT',
  'STEPS',
  'CFG',
  'CKPT',
  'FRAMES',
  'FPS',
  'IMAGE'
] as const

export function sdComfySlotGuide(): string {
  return SD_COMFY_VIDEO_SLOTS.map((s) => `{{${s}}}`).join(' ')
}

/** OpenAI-style IDM sizes → SDXL-safe multiples of 64. */
export function sdSizeFromImageSize(size?: string): SdPixelSize {
  if (size === '1024x1024') {
    return { width: 1024, height: 1024, aspectRatio: '1:1' }
  }
  if (size === '1024x1792') {
    return { width: 768, height: 1344, aspectRatio: '9:16' }
  }
  return { width: 1344, height: 768, aspectRatio: '16:9' }
}

export function clampSdSteps(n: unknown): number {
  const v = typeof n === 'number' ? n : Number(n)
  if (!Number.isFinite(v)) return DEFAULT_SD_STEPS
  return Math.min(50, Math.max(10, Math.round(v)))
}

export function clampSdCfg(n: unknown): number {
  const v = typeof n === 'number' ? n : Number(n)
  if (!Number.isFinite(v)) return DEFAULT_SD_CFG
  return Math.min(15, Math.max(1, Math.round(v * 10) / 10))
}

export function clampSdDenoising(n: unknown): number {
  const v = typeof n === 'number' ? n : Number(n)
  if (!Number.isFinite(v)) return DEFAULT_SD_DENOISING
  return Math.min(0.8, Math.max(0.2, Math.round(v * 100) / 100))
}

export function coerceSdSampler(v: unknown): string {
  const s = String(v || '').trim()
  if (SD_SAMPLERS.includes(s as (typeof SD_SAMPLERS)[number])) return s
  return DEFAULT_SD_SAMPLER
}

/** Light style suffix only — do not rewrite IDM cinematic prompts. */
export function decorateSdPrompt(prompt: string, artStyle?: string): string {
  const p = (prompt || '').trim()
  const style = (artStyle || '').toLowerCase()
  if (!style) return p
  if (/anime|manga|toon|illustration/.test(style)) {
    if (/anime|manga/i.test(p)) return p
    return `${p}, anime, illustration`
  }
  if (/photo|cinematic|real|live.?action|film/.test(style)) {
    if (/photoreal|cinematic/i.test(p)) return p
    return `${p}, photorealistic, cinematic lighting`
  }
  return p
}

export function mergeSdNegative(extra?: string): string {
  const add = (extra || '').trim()
  if (!add) return DEFAULT_SD_NEGATIVE
  if (add.includes(DEFAULT_SD_NEGATIVE)) return add
  return `${DEFAULT_SD_NEGATIVE}, ${add}`
}

export function stripSdBase(url: string): string {
  return (url || '').trim().replace(/\/+$/, '')
}

export const DEFAULT_SD_MOTION_BUCKET = 127
export const DEFAULT_SD_VIDEO_FPS = 8
export const DEFAULT_SD_MOTION_MODULE = 'mm_sd_v15_v2.ckpt'

export function clampSdMotionBucket(n: unknown): number {
  const v = typeof n === 'number' ? n : Number(n)
  if (!Number.isFinite(v)) return DEFAULT_SD_MOTION_BUCKET
  return Math.min(255, Math.max(1, Math.round(v)))
}

export function clampSdVideoFps(n: unknown): number {
  const v = typeof n === 'number' ? n : Number(n)
  if (!Number.isFinite(v)) return DEFAULT_SD_VIDEO_FPS
  return Math.min(16, Math.max(6, Math.round(v)))
}

/** AnimateDiff frame count: 16–48. */
export function animateDiffFrameCount(
  durationSeconds: number,
  fps: number
): number {
  const f = clampSdVideoFps(fps)
  const d = Number.isFinite(durationSeconds) ? durationSeconds : 2
  return Math.min(48, Math.max(16, Math.round(d * f)))
}

export function sdNextFrameCount(durationSeconds: number, fps: number): number {
  const f = Math.min(24, Math.max(8, fps || 16))
  const d = Number.isFinite(durationSeconds) ? Math.max(1, durationSeconds) : 4
  return Math.min(81, Math.max(16, Math.round(d * f)))
}

/** Bearer, HTTP Basic (user:pass), or none (local WebUI). */
export function sdAuthHeaders(apiKey: string): Record<string, string> {
  const key = (apiKey || '').trim()
  if (!key) return {}
  if (key.includes(':') && !key.startsWith('sk-')) {
    return { Authorization: `Basic ${Buffer.from(key).toString('base64')}` }
  }
  return { Authorization: `Bearer ${key}` }
}

export function stabilityApiRoot(baseUrl: string): string {
  return stripSdBase(baseUrl).replace(/\/v2beta.*$/i, '').replace(/\/v2alpha.*$/i, '')
}
