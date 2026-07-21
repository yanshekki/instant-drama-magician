import { spawn } from 'child_process'
import { existsSync, mkdirSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { AppError } from '../../types/errors'

export interface TtsRequest {
  text: string
  outputPath: string
  voice?: string
}

export interface TtsProvider {
  readonly id: string
  available(): Promise<boolean>
  speak(request: TtsRequest): Promise<{ outputPath: string; degraded?: boolean }>
}

export class HttpTtsProvider implements TtsProvider {
  readonly id = 'http-tts'
  constructor(
    private readonly url: string,
    private readonly apiKey: string
  ) {}

  async available(): Promise<boolean> {
    return Boolean(this.url)
  }

  async speak(request: TtsRequest): Promise<{ outputPath: string }> {
    const res = await fetch(this.url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ text: request.text, voice: request.voice }),
      signal: AbortSignal.timeout(60_000)
    })
    if (!res.ok) throw new AppError('IO', 'errors.ttsHttpFailed', String(res.status))
    const buf = Buffer.from(await res.arrayBuffer())
    writeFileSync(request.outputPath, buf)
    return { outputPath: request.outputPath }
  }
}

export class LocalCliTtsProvider implements TtsProvider {
  readonly id = 'local-cli-tts'
  private bin: string | null = null

  async available(): Promise<boolean> {
    this.bin = await this.detect()
    return this.bin !== null
  }

  async speak(request: TtsRequest): Promise<{ outputPath: string; degraded?: boolean }> {
    const bin = this.bin ?? (await this.detect())
    if (!bin) throw new AppError('VALIDATION', 'errors.ttsBinaryMissing')

    if (bin === 'espeak') {
      await run(bin, ['-w', request.outputPath, request.text])
      return { outputPath: request.outputPath }
    }
    // piper: echo text | piper -m model -f out (model may be missing → fail)
    await run('sh', [
      '-c',
      `printf %s ${shellQuote(request.text)} | piper --output_file ${shellQuote(request.outputPath)}`
    ])
    return { outputPath: request.outputPath }
  }

  private async detect(): Promise<string | null> {
    for (const name of ['espeak', 'espeak-ng', 'piper']) {
      if (await commandExists(name)) return name === 'espeak-ng' ? 'espeak' : name
    }
    return null
  }
}

export class CompositeTtsProvider implements TtsProvider {
  readonly id = 'composite-tts'
  constructor(
    private readonly httpUrl: string,
    private readonly apiKey: string,
    private readonly local = new LocalCliTtsProvider()
  ) {}

  async available(): Promise<boolean> {
    if (this.httpUrl) return true
    return this.local.available()
  }

  async speak(request: TtsRequest): Promise<{ outputPath: string; degraded?: boolean }> {
    if (this.httpUrl) {
      try {
        return await new HttpTtsProvider(this.httpUrl, this.apiKey).speak(request)
      } catch {
        // fall through
      }
    }
    if (await this.local.available()) {
      return this.local.speak(request)
    }
    // Write empty placeholder wav header-less skip — caller treats as degraded
    throw new AppError('VALIDATION', 'errors.ttsUnavailable')
  }
}

function commandExists(cmd: string): Promise<boolean> {
  return new Promise((resolve) => {
    const child = spawn('which', [cmd])
    child.on('close', (code) => resolve(code === 0))
    child.on('error', () => resolve(false))
  })
}

/** Exported for residual unit tests. */
export function assertSpawnExitOk(code: number | null, cmd: string): void {
  if (code === 0) return
  throw new Error(`${cmd} exited ${code}`)
}

function run(cmd: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: 'ignore' })
    child.on('error', reject)
    child.on('close', (code) => {
      try {
        assertSpawnExitOk(code, cmd)
        resolve()
      } catch (e) {
        reject(e)
      }
    })
  })
}

function shellQuote(s: string): string {
  return `'${s.replace(/'/g, `'\\''`)}'`
}

export function ttsClipPath(mediaRoot: string, storyId: string, entryId: string): string {
  return join(mediaRoot, storyId, 'tts', `${entryId}.wav`)
}

export function ensurePathParent(filePath: string): void {
  mkdirSync(dirname(filePath), { recursive: true })
}

export function fileReady(path: string): boolean {
  return existsSync(path)
}
