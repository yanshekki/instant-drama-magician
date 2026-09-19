/**
 * Stable Diffusion stills: A1111-family /sdapi/v1 or Stability v2beta.
 */
import { existsSync } from 'fs'
import { basename } from 'path'
import { AppError, isTimeoutAbort, mapChatHttpStatus } from '../../types/errors'
import { loadImageBytesForAi } from '../../domain/chatVision'
import {
  comfySamplerName,
  DEFAULT_SD_CFG,
  DEFAULT_SD_DENOISING,
  DEFAULT_SD_SAMPLER,
  DEFAULT_SD_STEPS,
  DEFAULT_STABILITY_MODEL,
  detectSdBackend,
  decorateSdPrompt,
  mergeSdNegative,
  sdAuthHeaders,
  sdSizeFromImageSize,
  stripSdBase,
  type SdBackend
} from '../../domain/stableDiffusion'
import {
  ComfyUiClient,
  defaultImg2ImgGraph,
  defaultTxt2ImgGraph
} from './comfy/ComfyUiClient'

export type SdImageResult = {
  b64: string
  mime: string
  sizeUsed: string
  aspectUsed: string
}

export interface SdImageOptions {
  baseUrl: string
  apiKey?: string
  model?: string
  timeoutMs?: number
  steps?: number
  cfgScale?: number
  sampler?: string
  denoising?: number
  negativePrompt?: string
  artStyle?: string
  fetchImpl?: typeof fetch
}

export class StableDiffusionImageProvider {
  private readonly baseUrl: string
  private readonly apiKey: string
  private readonly model: string
  private readonly timeoutMs: number
  private readonly steps: number
  private readonly cfgScale: number
  private readonly sampler: string
  private readonly denoising: number
  private readonly negativePrompt: string
  private readonly artStyle: string
  private readonly fetchFn: typeof fetch
  readonly backend: SdBackend

  constructor(opts: SdImageOptions) {
    this.baseUrl = stripSdBase(opts.baseUrl || 'http://127.0.0.1:7860')
    this.apiKey = (opts.apiKey || '').trim()
    this.model = (opts.model || '').trim()
    this.timeoutMs = opts.timeoutMs ?? 300_000
    this.steps = opts.steps ?? DEFAULT_SD_STEPS
    this.cfgScale = opts.cfgScale ?? DEFAULT_SD_CFG
    this.sampler = opts.sampler ?? DEFAULT_SD_SAMPLER
    this.denoising = opts.denoising ?? DEFAULT_SD_DENOISING
    this.negativePrompt = mergeSdNegative(opts.negativePrompt)
    this.artStyle = opts.artStyle || ''
    this.fetchFn = opts.fetchImpl ?? fetch
    this.backend = detectSdBackend(this.baseUrl)
  }

  async probe(): Promise<{ available: boolean; message: string }> {
    if (this.backend === 'stability') {
      if (!this.apiKey) {
        return { available: false, message: 'No Stability API key' }
      }
      return {
        available: true,
        message: `Stability · ${this.model || DEFAULT_STABILITY_MODEL}`
      }
    }
    const comfy = ComfyUiClient.from(
      this.baseUrl,
      this.apiKey,
      this.fetchFn,
      this.timeoutMs
    )
    if (await comfy.isComfy()) {
      return { available: true, message: `ComfyUI · ${this.baseUrl}` }
    }
    try {
      const res = await this.fetchFn(`${this.baseUrl}/sdapi/v1/sd-models`, {
        headers: this.headers(),
        signal: AbortSignal.timeout(5000)
      })
      if (res.ok) {
        return { available: true, message: `WebUI · ${this.baseUrl}` }
      }
      return {
        available: false,
        message: `HTTP ${res.status} · ${this.baseUrl} (start WebUI with --api, or ComfyUI on 8188)`
      }
    } catch (error) {
      return {
        available: false,
        message:
          error instanceof Error
            ? error.message
            : `Unreachable · ${this.baseUrl}`
      }
    }
  }

  async listCheckpoints(): Promise<string[]> {
    if (this.backend === 'stability') {
      return ['sd3.5-large', 'sd3.5-medium', 'sd3.5-large-turbo']
    }
    try {
      const res = await this.fetchFn(`${this.baseUrl}/sdapi/v1/sd-models`, {
        headers: this.headers(),
        signal: AbortSignal.timeout(5000)
      })
      if (res.ok) {
        const json = (await res.json()) as Array<{ model_name?: string; title?: string }>
        return json
          .map((m) => m.model_name || m.title || '')
          .filter(Boolean)
      }
    } catch {
      /* Comfy */
    }
    try {
      const res = await this.fetchFn(`${this.baseUrl}/models/checkpoints`, {
        headers: this.headers(),
        signal: AbortSignal.timeout(5000)
      })
      if (res.ok) {
        const json = (await res.json()) as unknown
        return Array.isArray(json) ? json.map(String) : []
      }
    } catch {
      return []
    }
    return []
  }

  async generate(options: {
    prompt: string
    size?: string
    aspectRatio?: string
    n?: number
  }): Promise<SdImageResult> {
    const dim = sdSizeFromImageSize(options.size)
    const prompt = decorateSdPrompt(options.prompt, this.artStyle)
    if (this.backend === 'stability') {
      return this.stabilityGenerate({ prompt, dim, imagePath: null })
    }
    const comfy = ComfyUiClient.from(
      this.baseUrl,
      this.apiKey,
      this.fetchFn,
      this.timeoutMs
    )
    if (await comfy.isComfy()) {
      return this.comfyTxt2Img(comfy, prompt, dim, options.size)
    }
    return this.webuiTxt2Img(prompt, dim, options.size)
  }

  async edit(options: {
    prompt: string
    imagePath: string
    size?: string
    aspectRatio?: string
    n?: number
  }): Promise<SdImageResult> {
    if (!existsSync(options.imagePath)) {
      throw new AppError(
        'VALIDATION',
        'errors.visionImageUnreadable',
        'errors.visionImageUnreadableDetail'
      )
    }
    const dim = sdSizeFromImageSize(options.size)
    const prompt = decorateSdPrompt(options.prompt, this.artStyle)
    if (this.backend === 'stability') {
      return this.stabilityGenerate({
        prompt,
        dim,
        imagePath: options.imagePath
      })
    }
    const comfy = ComfyUiClient.from(
      this.baseUrl,
      this.apiKey,
      this.fetchFn,
      this.timeoutMs
    )
    if (await comfy.isComfy()) {
      return this.comfyImg2Img(comfy, prompt, dim, options.imagePath, options.size)
    }
    return this.webuiImg2Img(prompt, dim, options.imagePath, options.size)
  }

  requiresKey(): boolean {
    return this.backend === 'stability'
  }

  private headers(): Record<string, string> {
    return sdAuthHeaders(this.apiKey)
  }

  private async comfyTxt2Img(
    comfy: ComfyUiClient,
    prompt: string,
    dim: ReturnType<typeof sdSizeFromImageSize>,
    sizeUsed?: string
  ): Promise<SdImageResult> {
    const id = await comfy.queue(
      defaultTxt2ImgGraph({
        ckpt: this.model,
        prompt,
        negative: this.negativePrompt,
        width: dim.width,
        height: dim.height,
        steps: this.steps,
        cfg: this.cfgScale,
        sampler: comfySamplerName(this.sampler)
      })
    )
    const outputs = await comfy.waitHistory(id)
    const ref = comfy.firstImageRef(outputs)
    if (!ref) throw new AppError('AI_FAILED', 'errors.imageApiNoB64')
    const buf = await comfy.downloadView(ref)
    return {
      b64: buf.toString('base64'),
      mime: 'image/png',
      sizeUsed: sizeUsed || `${dim.width}x${dim.height}`,
      aspectUsed: dim.aspectRatio
    }
  }

  private async comfyImg2Img(
    comfy: ComfyUiClient,
    prompt: string,
    dim: ReturnType<typeof sdSizeFromImageSize>,
    imagePath: string,
    sizeUsed?: string
  ): Promise<SdImageResult> {
    const imageName = await comfy.uploadImage(imagePath)
    const id = await comfy.queue(
      defaultImg2ImgGraph({
        ckpt: this.model,
        prompt,
        negative: this.negativePrompt,
        imageName,
        steps: this.steps,
        cfg: this.cfgScale,
        sampler: comfySamplerName(this.sampler),
        denoise: this.denoising
      })
    )
    const outputs = await comfy.waitHistory(id)
    const ref = comfy.firstImageRef(outputs)
    if (!ref) throw new AppError('AI_FAILED', 'errors.imageApiNoB64')
    const buf = await comfy.downloadView(ref)
    return {
      b64: buf.toString('base64'),
      mime: 'image/png',
      sizeUsed: sizeUsed || `${dim.width}x${dim.height}`,
      aspectUsed: dim.aspectRatio
    }
  }

  private async webuiTxt2Img(
    prompt: string,
    dim: ReturnType<typeof sdSizeFromImageSize>,
    sizeUsed?: string
  ): Promise<SdImageResult> {
    const body: Record<string, unknown> = {
      prompt,
      negative_prompt: this.negativePrompt,
      width: dim.width,
      height: dim.height,
      steps: this.steps,
      cfg_scale: this.cfgScale,
      sampler_name: this.sampler,
      scheduler: 'Karras',
      seed: -1
    }
    if (this.model) {
      body.override_settings = { sd_model_checkpoint: this.model }
      body.override_settings_restore_afterwards = true
    }
    const json = await this.webuiPost('/sdapi/v1/txt2img', body)
    return this.fromWebuiImages(
      json,
      sizeUsed || `${dim.width}x${dim.height}`,
      dim.aspectRatio
    )
  }

  private async webuiImg2Img(
    prompt: string,
    dim: ReturnType<typeof sdSizeFromImageSize>,
    imagePath: string,
    sizeUsed?: string
  ): Promise<SdImageResult> {
    const prepared = loadImageBytesForAi(imagePath)
    const b64in = Buffer.from(prepared.bytes).toString('base64')
    const body: Record<string, unknown> = {
      prompt,
      negative_prompt: this.negativePrompt,
      width: dim.width,
      height: dim.height,
      steps: this.steps,
      cfg_scale: this.cfgScale,
      sampler_name: this.sampler,
      denoising_strength: this.denoising,
      init_images: [b64in],
      seed: -1
    }
    if (this.model) {
      body.override_settings = { sd_model_checkpoint: this.model }
      body.override_settings_restore_afterwards = true
    }
    const json = await this.webuiPost('/sdapi/v1/img2img', body)
    return this.fromWebuiImages(
      json,
      sizeUsed || `${dim.width}x${dim.height}`,
      dim.aspectRatio
    )
  }

  private async webuiPost(
    path: string,
    body: Record<string, unknown>
  ): Promise<{ images?: string[] }> {
    let res: Response
    try {
      res = await this.fetchFn(`${this.baseUrl}${path}`, {
        method: 'POST',
        headers: { ...this.headers(), 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(this.timeoutMs)
      })
    } catch (error) {
      if (isTimeoutAbort(error)) {
        throw new AppError(
          'AI_TIMEOUT',
          'errors.imageTimedOut',
          'errors.requestWaitHint'
        )
      }
      throw error
    }
    if (!res.ok) {
      const text = await res.text()
      if (res.status === 404) {
        throw new AppError(
          'AI_UNAVAILABLE',
          'errors.sdWebuiNoApi',
          text.slice(0, 300)
        )
      }
      throw mapChatHttpStatus(res.status, text)
    }
    return (await res.json()) as { images?: string[] }
  }

  private fromWebuiImages(
    json: { images?: string[] },
    sizeUsed: string,
    aspectUsed: string
  ): SdImageResult {
    const raw = json.images?.[0]
    if (!raw) {
      throw new AppError('AI_FAILED', 'errors.imageApiNoB64')
    }
    const b64 = raw.includes(',') ? raw.split(',')[1] : raw
    return {
      b64,
      mime: 'image/png',
      sizeUsed,
      aspectUsed
    }
  }

  private async stabilityGenerate(opts: {
    prompt: string
    dim: ReturnType<typeof sdSizeFromImageSize>
    imagePath: string | null
  }): Promise<SdImageResult> {
    if (!this.apiKey) {
      throw new AppError(
        'AI_UNAUTHORIZED',
        'errors.noApiKey',
        'Stability Platform needs an sk- API key'
      )
    }
    const form = new FormData()
    form.append('prompt', opts.prompt)
    form.append('negative_prompt', this.negativePrompt)
    form.append('output_format', 'png')
    form.append('model', this.model || DEFAULT_STABILITY_MODEL)
    if (opts.imagePath) {
      const prepared = loadImageBytesForAi(opts.imagePath)
      form.append('mode', 'image-to-image')
      form.append('strength', String(this.denoising))
      form.append(
        'image',
        new Blob([new Uint8Array(prepared.bytes)], {
          type: prepared.mime || 'image/png'
        }),
        basename(opts.imagePath)
      )
    } else {
      form.append('aspect_ratio', opts.dim.aspectRatio)
    }
    let res: Response
    try {
      res = await this.fetchFn(
        `${this.baseUrl.replace(/\/v2beta.*$/, '')}/v2beta/stable-image/generate/sd3`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            Accept: 'application/json',
            ...this.stabilityNoContentType()
          },
          body: form,
          signal: AbortSignal.timeout(this.timeoutMs)
        }
      )
    } catch (error) {
      if (isTimeoutAbort(error)) {
        throw new AppError(
          'AI_TIMEOUT',
          'errors.imageTimedOut',
          'errors.requestWaitHint'
        )
      }
      throw error
    }
    if (!res.ok) {
      const text = await res.text()
      if (res.status === 402) {
        throw new AppError('AI_FAILED', 'errors.sdStabilityCredits', text.slice(0, 200))
      }
      throw mapChatHttpStatus(res.status, text)
    }
    const json = (await res.json()) as {
      image?: string
      finish_reason?: string
      artifacts?: Array<{ base64?: string }>
    }
    const b64 = json.image || json.artifacts?.[0]?.base64
    if (!b64) {
      throw new AppError('AI_FAILED', 'errors.imageApiNoB64')
    }
    return {
      b64,
      mime: 'image/png',
      sizeUsed: `${opts.dim.width}x${opts.dim.height}`,
      aspectUsed: opts.dim.aspectRatio
    }
  }

  /** FormData must set its own multipart boundary. */
  private stabilityNoContentType(): Record<string, string> {
    return {}
  }
}
