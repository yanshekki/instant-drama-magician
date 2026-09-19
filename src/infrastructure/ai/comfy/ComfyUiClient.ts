/**
 * ComfyUI HTTP: /system_stats, /prompt, /history, /view, /upload/image.
 */
import { readFileSync } from 'fs'
import { basename } from 'path'
import { AppError, isTimeoutAbort } from '../../../types/errors'
import { sdAuthHeaders, stripSdBase } from '../../../domain/stableDiffusion'
import { sleep } from '../video/httpUtils'

export type ComfyGraph = Record<
  string,
  { class_type: string; inputs: Record<string, unknown> }
>

export class ComfyUiClient {
  constructor(
    private readonly baseUrl: string,
    private readonly apiKey: string,
    private readonly fetchFn: typeof fetch,
    private readonly timeoutMs: number
  ) {}

  static from(
    baseUrl: string,
    apiKey: string,
    fetchFn: typeof fetch,
    timeoutMs: number
  ): ComfyUiClient {
    return new ComfyUiClient(stripSdBase(baseUrl), apiKey, fetchFn, timeoutMs)
  }

  private headers(json = false): Record<string, string> {
    const h = sdAuthHeaders(this.apiKey)
    if (json) h['Content-Type'] = 'application/json'
    return h
  }

  async isComfy(): Promise<boolean> {
    try {
      const res = await this.fetchFn(`${this.baseUrl}/system_stats`, {
        headers: this.headers(),
        signal: AbortSignal.timeout(4000)
      })
      return res.ok
    } catch {
      return false
    }
  }

  async queue(graph: ComfyGraph): Promise<string> {
    let res: Response
    try {
      res = await this.fetchFn(`${this.baseUrl}/prompt`, {
        method: 'POST',
        headers: this.headers(true),
        body: JSON.stringify({ prompt: graph }),
        signal: AbortSignal.timeout(this.timeoutMs)
      })
    } catch (error) {
      if (isTimeoutAbort(error)) {
        throw new AppError('AI_TIMEOUT', 'errors.imageTimedOut', 'errors.requestWaitHint')
      }
      throw error
    }
    if (!res.ok) {
      throw new AppError(
        'AI_FAILED',
        'errors.sdComfyPromptFailed',
        (await res.text()).slice(0, 400)
      )
    }
    const json = (await res.json()) as { prompt_id?: string }
    if (!json.prompt_id) {
      throw new AppError('AI_FAILED', 'errors.sdComfyPromptFailed', 'no prompt_id')
    }
    return json.prompt_id
  }

  async waitHistory(promptId: string): Promise<Record<string, unknown>> {
    const deadline = Date.now() + this.timeoutMs
    while (Date.now() < deadline) {
      const res = await this.fetchFn(`${this.baseUrl}/history/${promptId}`, {
        headers: this.headers(),
        signal: AbortSignal.timeout(15000)
      })
      if (res.ok) {
        const json = (await res.json()) as Record<string, { outputs?: unknown }>
        const entry = json[promptId]
        if (entry?.outputs) return entry.outputs as Record<string, unknown>
      }
      await sleep(800)
    }
    throw new AppError('AI_TIMEOUT', 'errors.imageTimedOut', 'errors.requestWaitHint')
  }

  firstImageRef(outputs: Record<string, unknown>): {
    filename: string
    subfolder: string
    type: string
  } | null {
    for (const node of Object.values(outputs)) {
      if (!node || typeof node !== 'object') continue
      const imgs = (node as { images?: Array<Record<string, string>> }).images
      if (imgs?.[0]?.filename) {
        return {
          filename: imgs[0].filename,
          subfolder: imgs[0].subfolder || '',
          type: imgs[0].type || 'output'
        }
      }
      const gifs = (node as { gifs?: Array<Record<string, string>> }).gifs
      if (gifs?.[0]?.filename) {
        return {
          filename: gifs[0].filename,
          subfolder: gifs[0].subfolder || '',
          type: gifs[0].type || 'output'
        }
      }
    }
    return null
  }

  async downloadView(ref: {
    filename: string
    subfolder: string
    type: string
  }): Promise<Buffer> {
    const u = new URL(`${this.baseUrl}/view`)
    u.searchParams.set('filename', ref.filename)
    u.searchParams.set('subfolder', ref.subfolder)
    u.searchParams.set('type', ref.type)
    const res = await this.fetchFn(u.toString(), {
      headers: this.headers(),
      signal: AbortSignal.timeout(this.timeoutMs)
    })
    if (!res.ok) {
      throw new AppError('AI_FAILED', 'errors.sdComfyPromptFailed', `view ${res.status}`)
    }
    return Buffer.from(await res.arrayBuffer())
  }

  async uploadImage(filePath: string): Promise<string> {
    const buf = readFileSync(filePath)
    const form = new FormData()
    form.append(
      'image',
      new Blob([buf], { type: 'image/png' }),
      basename(filePath)
    )
    form.append('overwrite', 'true')
    const res = await this.fetchFn(`${this.baseUrl}/upload/image`, {
      method: 'POST',
      headers: this.headers(),
      body: form,
      signal: AbortSignal.timeout(60000)
    })
    if (!res.ok) {
      throw new AppError('AI_FAILED', 'errors.sdComfyPromptFailed', await res.text())
    }
    const json = (await res.json()) as { name?: string }
    return json.name || basename(filePath)
  }
}

export function defaultTxt2ImgGraph(opts: {
  ckpt: string
  prompt: string
  negative: string
  width: number
  height: number
  steps: number
  cfg: number
  sampler: string
}): ComfyGraph {
  return {
    '4': {
      class_type: 'CheckpointLoaderSimple',
      inputs: { ckpt_name: opts.ckpt || 'model.safetensors' }
    },
    '5': {
      class_type: 'EmptyLatentImage',
      inputs: { width: opts.width, height: opts.height, batch_size: 1 }
    },
    '6': {
      class_type: 'CLIPTextEncode',
      inputs: { text: opts.prompt, clip: ['4', 1] }
    },
    '7': {
      class_type: 'CLIPTextEncode',
      inputs: { text: opts.negative, clip: ['4', 1] }
    },
    '3': {
      class_type: 'KSampler',
      inputs: {
        seed: 0,
        steps: opts.steps,
        cfg: opts.cfg,
        sampler_name: opts.sampler,
        scheduler: 'karras',
        denoise: 1,
        model: ['4', 0],
        positive: ['6', 0],
        negative: ['7', 0],
        latent_image: ['5', 0]
      }
    },
    '8': {
      class_type: 'VAEDecode',
      inputs: { samples: ['3', 0], vae: ['4', 2] }
    },
    '9': {
      class_type: 'SaveImage',
      inputs: { filename_prefix: 'idm', images: ['8', 0] }
    }
  }
}

export function defaultImg2ImgGraph(opts: {
  ckpt: string
  prompt: string
  negative: string
  imageName: string
  steps: number
  cfg: number
  sampler: string
  denoise: number
}): ComfyGraph {
  return {
    '4': {
      class_type: 'CheckpointLoaderSimple',
      inputs: { ckpt_name: opts.ckpt || 'model.safetensors' }
    },
    '10': {
      class_type: 'LoadImage',
      inputs: { image: opts.imageName }
    },
    '11': {
      class_type: 'VAEEncode',
      inputs: { pixels: ['10', 0], vae: ['4', 2] }
    },
    '6': {
      class_type: 'CLIPTextEncode',
      inputs: { text: opts.prompt, clip: ['4', 1] }
    },
    '7': {
      class_type: 'CLIPTextEncode',
      inputs: { text: opts.negative, clip: ['4', 1] }
    },
    '3': {
      class_type: 'KSampler',
      inputs: {
        seed: 0,
        steps: opts.steps,
        cfg: opts.cfg,
        sampler_name: opts.sampler,
        scheduler: 'karras',
        denoise: opts.denoise,
        model: ['4', 0],
        positive: ['6', 0],
        negative: ['7', 0],
        latent_image: ['11', 0]
      }
    },
    '8': {
      class_type: 'VAEDecode',
      inputs: { samples: ['3', 0], vae: ['4', 2] }
    },
    '9': {
      class_type: 'SaveImage',
      inputs: { filename_prefix: 'idm', images: ['8', 0] }
    }
  }
}
