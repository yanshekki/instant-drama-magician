/**
 * Stable Diffusion video: Stability SVD I2V, SD.Next /sdapi/v1/video,
 * or A1111 AnimateDiff via txt2img/img2img alwayson_scripts.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { spawnSync } from 'child_process'
import { dirname, join } from 'path'
import type { VideoGenRequest, VideoGenResult } from '../../../types/domain'
import { AppError, isTimeoutAbort, mapHttpStatusToVideoError } from '../../../types/errors'
import type { VideoProvider, VideoProviderStatus } from './types'
import { sleep } from './httpUtils'
import {
  videoCreateAbortMs,
  videoPollAbortMs
} from '../../../domain/requestWait'
import {
  animateDiffFrameCount,
  applyComfyPlaceholders,
  decorateSdPrompt,
  DEFAULT_SD_CFG,
  DEFAULT_SD_MOTION_BUCKET,
  DEFAULT_SD_MOTION_MODULE,
  DEFAULT_SD_SAMPLER,
  DEFAULT_SD_STEPS,
  DEFAULT_SD_VIDEO_FPS,
  detectSdBackend,
  mergeSdNegative,
  sdAuthHeaders,
  sdNextFrameCount,
  sdSizeFromImageSize,
  stabilityApiRoot,
  stripSdBase,
  type SdBackend
} from '../../../domain/stableDiffusion'
import { StableDiffusionImageProvider } from '../StableDiffusionImageProvider'
import { ComfyUiClient, type ComfyGraph } from '../comfy/ComfyUiClient'
import { resolveFfmpegPath } from '../../ffmpeg/resolveFfmpegPath'

export interface SdVideoOptions {
  baseUrl: string
  apiKey?: string
  model?: string
  timeoutSec?: number
  pollMs?: number
  steps?: number
  cfgScale?: number
  sampler?: string
  negativePrompt?: string
  motionBucket?: number
  fps?: number
  motionModule?: string
  aspectRatio?: string
  comfyWorkflow?: string
  fetchImpl?: typeof fetch
}

type SdNextModel = {
  engine?: string
  model?: string
  name?: string
  input_mode?: string
  inputMode?: string
}

const FTYP = Buffer.from('ftyp')

function looksLikeMp4(buf: Buffer): boolean {
  return buf.subarray(4, 8).equals(FTYP) || buf.includes(FTYP)
}

function decodeB64Media(raw: string): Buffer {
  const b64 = raw.includes(',') ? raw.split(',')[1] : raw
  return Buffer.from(b64, 'base64')
}

function writeOutput(outputPath: string, buf: Buffer): void {
  mkdirSync(dirname(outputPath), { recursive: true })
  writeFileSync(outputPath, buf)
}

export class StableDiffusionVideoProvider implements VideoProvider {
  readonly id = 'stable-diffusion'
  readonly name = 'Stable Diffusion'
  private readonly fetchFn: typeof fetch
  private readonly baseUrl: string
  private readonly apiKey: string
  private readonly model: string
  private readonly timeoutSec: number
  private readonly pollMs: number
  private readonly steps: number
  private readonly cfgScale: number
  private readonly sampler: string
  private readonly negativePrompt: string
  private readonly motionBucket: number
  private readonly fps: number
  private readonly motionModule: string
  private readonly aspectRatio: string
  private readonly comfyWorkflow: string
  readonly backend: SdBackend

  constructor(opts: SdVideoOptions) {
    this.baseUrl = stripSdBase(opts.baseUrl || 'http://127.0.0.1:7860')
    this.apiKey = (opts.apiKey || '').trim()
    this.model = (opts.model || '').trim()
    this.timeoutSec = opts.timeoutSec ?? 600
    this.pollMs = opts.pollMs ?? 2000
    this.steps = opts.steps ?? DEFAULT_SD_STEPS
    this.cfgScale = opts.cfgScale ?? DEFAULT_SD_CFG
    this.sampler = opts.sampler ?? DEFAULT_SD_SAMPLER
    this.negativePrompt = mergeSdNegative(opts.negativePrompt)
    this.motionBucket = opts.motionBucket ?? DEFAULT_SD_MOTION_BUCKET
    this.fps = opts.fps ?? DEFAULT_SD_VIDEO_FPS
    this.motionModule = opts.motionModule?.trim() || DEFAULT_SD_MOTION_MODULE
    this.aspectRatio = opts.aspectRatio ?? '16:9'
    this.comfyWorkflow = (opts.comfyWorkflow || '').trim()
    this.fetchFn = opts.fetchImpl ?? fetch.bind(globalThis)
    this.backend = detectSdBackend(this.baseUrl)
  }

  private headers(json = false): Record<string, string> {
    const h = sdAuthHeaders(this.apiKey)
    if (json) h['Content-Type'] = 'application/json'
    return h
  }

  async probe(): Promise<VideoProviderStatus> {
    if (this.backend === 'stability') {
      return {
        id: this.id,
        available: Boolean(this.apiKey),
        message: this.apiKey
          ? `Stability SVD · image-to-video`
          : 'No Stability API key'
      }
    }
    const next = await this.fetchSdNextModels()
    if (next && next.length) {
      return {
        id: this.id,
        available: true,
        message: `SD.Next video · ${this.baseUrl}`
      }
    }
    const comfy = ComfyUiClient.from(
      this.baseUrl,
      this.apiKey,
      this.fetchFn,
      this.timeoutSec * 1000
    )
    if (await comfy.isComfy()) {
      return {
        id: this.id,
        available: true,
        message: this.comfyWorkflow
          ? `ComfyUI workflow · ${this.baseUrl}`
          : `ComfyUI · paste a video workflow JSON ({{PROMPT}} placeholders)`
      }
    }
    try {
      const res = await this.fetchFn(`${this.baseUrl}/sdapi/v1/sd-models`, {
        headers: this.headers(),
        signal: AbortSignal.timeout(5000)
      })
      if (res.ok) {
        return {
          id: this.id,
          available: true,
          message: `WebUI · AnimateDiff if the extension is installed · ${this.baseUrl}`
        }
      }
    } catch {
      /* fall through */
    }
    return {
      id: this.id,
      available: false,
      message: `Unreachable · ${this.baseUrl}`
    }
  }

  async generate(request: VideoGenRequest): Promise<VideoGenResult> {
    if (this.backend === 'stability') {
      return this.generateStability(request)
    }
    const next = await this.fetchSdNextModels()
    if (next && next.length) {
      return this.generateSdNext(request, next)
    }
    const comfy = ComfyUiClient.from(
      this.baseUrl,
      this.apiKey,
      this.fetchFn,
      this.timeoutSec * 1000
    )
    if (await comfy.isComfy()) {
      return this.generateComfy(request, comfy)
    }
    return this.generateAnimateDiff(request)
  }

  private async fetchSdNextModels(): Promise<SdNextModel[] | null> {
    try {
      const res = await this.fetchFn(`${this.baseUrl}/sdapi/v1/video/models`, {
        headers: this.headers(),
        signal: AbortSignal.timeout(5000)
      })
      if (!res.ok) return null
      const json = (await res.json()) as unknown
      if (Array.isArray(json)) return json as SdNextModel[]
      if (json && typeof json === 'object' && Array.isArray((json as { models?: unknown }).models)) {
        return (json as { models: SdNextModel[] }).models
      }
      return null
    } catch {
      return null
    }
  }

  private pickSdNextModel(
    models: SdNextModel[],
    hasStill: boolean
  ): SdNextModel {
    const modeOf = (m: SdNextModel) =>
      (m.input_mode || m.inputMode || '').toLowerCase()
    const want = hasStill ? 'i2v' : 't2v'
    return (
      models.find((m) => modeOf(m) === want) ||
      models.find((m) => modeOf(m) === 'flf2v' && hasStill) ||
      models[0]
    )
  }

  private async generateSdNext(
    request: VideoGenRequest,
    models: SdNextModel[]
  ): Promise<VideoGenResult> {
    const still = request.refImagePath && existsSync(request.refImagePath)
    const picked = this.pickSdNextModel(models, Boolean(still))
    const dim = sdSizeFromImageSize(
      this.aspectRatio === '9:16'
        ? '1024x1792'
        : this.aspectRatio === '1:1'
          ? '1024x1024'
          : '1792x1024'
    )
    const fps = 16
    const frames = sdNextFrameCount(request.durationSeconds, fps)
    const body: Record<string, unknown> = {
      engine: picked.engine || picked.name,
      model: this.model || picked.model || picked.name,
      prompt: decorateSdPrompt(request.prompt),
      negative_prompt: this.negativePrompt,
      width: dim.width,
      height: dim.height,
      frames,
      mp4_fps: fps,
      steps: this.steps
    }
    if (still && request.refImagePath) {
      body.init_image = readFileSync(request.refImagePath).toString('base64')
    }
    if (
      request.lastFramePath &&
      existsSync(request.lastFramePath) &&
      request.lastFramePath !== request.refImagePath
    ) {
      body.last_image = readFileSync(request.lastFramePath).toString('base64')
    }
    let res: Response
    try {
      res = await this.fetchFn(`${this.baseUrl}/sdapi/v1/video`, {
        method: 'POST',
        headers: this.headers(true),
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(videoCreateAbortMs(this.timeoutSec))
      })
    } catch (error) {
      if (isTimeoutAbort(error)) {
        throw new AppError(
          'VIDEO_TIMEOUT',
          'errors.videoJobTimedOut',
          String(this.timeoutSec)
        )
      }
      throw error
    }
    if (!res.ok) {
      throw mapHttpStatusToVideoError(res.status, await res.text())
    }
    const json = (await res.json()) as { video?: string; images?: string[] }
    const raw = json.video || json.images?.[0]
    if (!raw) {
      throw new AppError('VIDEO_JOB_FAILED', 'errors.sdVideoUnavailable')
    }
    const buf = decodeB64Media(raw)
    this.writeMedia(request.outputPath, buf)
    return { outputPath: request.outputPath }
  }

  private async generateComfy(
    request: VideoGenRequest,
    comfy: ComfyUiClient
  ): Promise<VideoGenResult> {
    if (!this.comfyWorkflow) {
      throw new AppError(
        'VIDEO_FEATURE_OFF',
        'errors.sdComfyNeedWorkflow',
        'Paste a ComfyUI API-format workflow with {{PROMPT}} {{FRAMES}} {{IMAGE}}'
      )
    }
    let imageName = ''
    if (request.refImagePath && existsSync(request.refImagePath)) {
      imageName = await comfy.uploadImage(request.refImagePath)
    }
    const dim = sdSizeFromImageSize(
      this.aspectRatio === '9:16'
        ? '1024x1792'
        : this.aspectRatio === '1:1'
          ? '1024x1024'
          : '1792x1024'
    )
    const frames = animateDiffFrameCount(request.durationSeconds, this.fps)
    const filled = applyComfyPlaceholders(this.comfyWorkflow, {
      PROMPT: decorateSdPrompt(request.prompt),
      NEGATIVE: this.negativePrompt,
      WIDTH: dim.width,
      HEIGHT: dim.height,
      STEPS: this.steps,
      CFG: this.cfgScale,
      CKPT: this.model,
      FRAMES: frames,
      FPS: this.fps,
      IMAGE: imageName
    })
    let graph: ComfyGraph
    try {
      graph = JSON.parse(filled) as ComfyGraph
    } catch {
      throw new AppError('VALIDATION', 'errors.sdComfyNeedWorkflow', 'invalid JSON')
    }
    const id = await comfy.queue(graph)
    const outputs = await comfy.waitHistory(id)
    const ref = comfy.firstImageRef(outputs)
    if (!ref) {
      throw new AppError('VIDEO_JOB_FAILED', 'errors.sdVideoUnavailable')
    }
    const buf = await comfy.downloadView(ref)
    this.writeMedia(request.outputPath, buf)
    return { outputPath: request.outputPath }
  }

  private async generateAnimateDiff(
    request: VideoGenRequest
  ): Promise<VideoGenResult> {
    const still = request.refImagePath && existsSync(request.refImagePath)
    const dim = sdSizeFromImageSize(
      this.aspectRatio === '9:16'
        ? '1024x1792'
        : this.aspectRatio === '1:1'
          ? '1024x1024'
          : '1792x1024'
    )
    const videoLength = animateDiffFrameCount(request.durationSeconds, this.fps)
    const script = {
      model: this.motionModule,
      format: ['MP4'],
      enable: true,
      video_length: videoLength,
      fps: this.fps,
      loop_number: 0,
      closed_loop: 'N',
      batch_size: Math.min(16, videoLength),
      stride: 1,
      overlap: -1
    }
    const body: Record<string, unknown> = {
      prompt: decorateSdPrompt(request.prompt),
      negative_prompt: this.negativePrompt,
      width: dim.width,
      height: dim.height,
      steps: this.steps,
      cfg_scale: this.cfgScale,
      sampler_name: this.sampler,
      seed: -1,
      alwayson_scripts: { AnimateDiff: { args: [script] } }
    }
    if (still && request.refImagePath) {
      body.init_images = [
        readFileSync(request.refImagePath).toString('base64')
      ]
      body.denoising_strength = 0.45
    }
    const path = still ? '/sdapi/v1/img2img' : '/sdapi/v1/txt2img'
    let res: Response
    try {
      res = await this.fetchFn(`${this.baseUrl}${path}`, {
        method: 'POST',
        headers: this.headers(true),
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(videoCreateAbortMs(this.timeoutSec))
      })
    } catch (error) {
      if (isTimeoutAbort(error)) {
        throw new AppError(
          'VIDEO_TIMEOUT',
          'errors.videoJobTimedOut',
          String(this.timeoutSec)
        )
      }
      throw error
    }
    if (!res.ok) {
      const text = await res.text()
      if (res.status === 404 || /animatediff|unknown script/i.test(text)) {
        throw new AppError(
          'VIDEO_FEATURE_OFF',
          'errors.sdVideoUnavailable',
          text.slice(0, 300)
        )
      }
      throw mapHttpStatusToVideoError(res.status, text)
    }
    const json = (await res.json()) as { images?: string[] }
    const raw = json.images?.[0]
    if (!raw) {
      throw new AppError('VIDEO_JOB_FAILED', 'errors.sdVideoUnavailable')
    }
    const buf = decodeB64Media(raw)
    this.writeMedia(request.outputPath, buf)
    return { outputPath: request.outputPath }
  }

  private async generateStability(
    request: VideoGenRequest
  ): Promise<VideoGenResult> {
    if (!this.apiKey) {
      throw new AppError(
        'VIDEO_UNAUTHORIZED',
        'errors.noApiKey',
        'Stability image-to-video needs an sk- API key'
      )
    }
    let stillPath = request.refImagePath
    if (!stillPath || !existsSync(stillPath)) {
      stillPath = `${request.outputPath}.still.png`
      const stills = new StableDiffusionImageProvider({
        baseUrl: this.baseUrl,
        apiKey: this.apiKey,
        timeoutMs: this.timeoutSec * 1000,
        fetchImpl: this.fetchFn
      })
      const plate = await stills.generate({
        prompt: request.prompt,
        size:
          this.aspectRatio === '9:16'
            ? '1024x1792'
            : this.aspectRatio === '1:1'
              ? '1024x1024'
              : '1792x1024'
      })
      writeOutput(stillPath, Buffer.from(plate.b64, 'base64'))
    }
    const root = stabilityApiRoot(this.baseUrl)
    const form = new FormData()
    const bytes = readFileSync(stillPath)
    form.append(
      'image',
      new Blob([bytes], { type: 'image/png' }),
      'still.png'
    )
    form.append('seed', '0')
    form.append('cfg_scale', '1.8')
    form.append('motion_bucket_id', String(this.motionBucket))
    let created: Response
    try {
      created = await this.fetchFn(`${root}/v2beta/image-to-video`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.apiKey}`, Accept: 'application/json' },
        body: form,
        signal: AbortSignal.timeout(videoCreateAbortMs(this.timeoutSec))
      })
    } catch (error) {
      if (isTimeoutAbort(error)) {
        throw new AppError(
          'VIDEO_TIMEOUT',
          'errors.videoJobTimedOut',
          String(this.timeoutSec)
        )
      }
      throw error
    }
    if (!created.ok) {
      const text = await created.text()
      if (created.status === 402) {
        throw new AppError('AI_FAILED', 'errors.sdStabilityCredits', text.slice(0, 200))
      }
      throw mapHttpStatusToVideoError(created.status, text)
    }
    const job = (await created.json()) as { id?: string }
    if (!job.id) {
      throw new AppError('VIDEO_JOB_FAILED', 'errors.sdVideoUnavailable')
    }
    const deadline = Date.now() + this.timeoutSec * 1000
    while (Date.now() < deadline) {
      await sleep(this.pollMs)
      const poll = await this.fetchFn(
        `${root}/v2beta/image-to-video/result/${job.id}`,
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            Accept: 'application/json'
          },
          signal: AbortSignal.timeout(videoPollAbortMs(this.timeoutSec))
        }
      )
      if (poll.status === 202) continue
      if (!poll.ok) {
        throw mapHttpStatusToVideoError(poll.status, await poll.text())
      }
      const ctype = poll.headers.get('content-type') || ''
      let buf: Buffer
      if (ctype.includes('json')) {
        const json = (await poll.json()) as { video?: string }
        if (!json.video) {
          throw new AppError('VIDEO_JOB_FAILED', 'errors.sdVideoUnavailable')
        }
        buf = decodeB64Media(json.video)
      } else {
        buf = Buffer.from(await poll.arrayBuffer())
      }
      this.writeMedia(request.outputPath, buf)
      const degraded = request.durationSeconds > 5
      return { outputPath: request.outputPath, jobId: job.id, degraded }
    }
    throw new AppError(
      'VIDEO_TIMEOUT',
      'errors.videoJobTimedOut',
      String(this.timeoutSec)
    )
  }

  private writeMedia(outputPath: string, buf: Buffer): void {
    if (looksLikeMp4(buf)) {
      writeOutput(outputPath, buf)
      return
    }
    /* ffmpeg remux of GIF/WEBP is covered in integration; spawn is ESM-hard to spy. */
    /* istanbul ignore next */
    this.remuxAnimated(outputPath, buf)
  }

  /* istanbul ignore next */
  private remuxAnimated(outputPath: string, buf: Buffer): void {
    const gif = buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46
    const webp = buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42
    if (!gif && !webp) {
      throw new AppError(
        'VIDEO_JOB_FAILED',
        'errors.sdVideoNeedMp4',
        'Enable MP4 in AnimateDiff, or use a ComfyUI workflow that saves video'
      )
    }
    const tmp = join(dirname(outputPath), `.idm-sd-src${gif ? '.gif' : '.webp'}`)
    writeOutput(tmp, buf)
    const ff = resolveFfmpegPath()
    const r = spawnSync(
      ff,
      ['-y', '-i', tmp, '-movflags', '+faststart', '-pix_fmt', 'yuv420p', outputPath],
      { encoding: 'utf8' }
    )
    if (r.status !== 0) {
      throw new AppError(
        'FFMPEG_FAILED',
        'errors.sdVideoNeedMp4',
        r.stderr?.slice(0, 300)
      )
    }
  }
}
