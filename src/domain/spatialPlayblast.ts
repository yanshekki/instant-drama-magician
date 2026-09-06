import { deflateSync } from 'zlib'
import type { SpatialBlocking, SpatialMarker } from './spatialRef'

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    }
    table[n] = c >>> 0
  }
  return table
})()

function crc32(buf: Buffer): number {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]!) & 0xff]! ^ (c >>> 8)
  }
  return (c ^ 0xffffffff) >>> 0
}

function pngChunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length, 0)
  const typeBuf = Buffer.from(type, 'ascii')
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0)
  return Buffer.concat([len, typeBuf, data, crc])
}

function setPixel(
  pixels: Uint8Array,
  width: number,
  x: number,
  y: number,
  r: number,
  g: number,
  b: number
): void {
  if (x < 0 || y < 0 || x >= width) return
  const i = (y * width + x) * 3
  if (i + 2 >= pixels.length) return
  pixels[i] = r
  pixels[i + 1] = g
  pixels[i + 2] = b
}

function fillRect(
  pixels: Uint8Array,
  width: number,
  height: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  r: number,
  g: number,
  b: number
): void {
  const xa = Math.max(0, Math.min(width, Math.floor(Math.min(x0, x1))))
  const xb = Math.max(0, Math.min(width, Math.ceil(Math.max(x0, x1))))
  const ya = Math.max(0, Math.min(height, Math.floor(Math.min(y0, y1))))
  const yb = Math.max(0, Math.min(height, Math.ceil(Math.max(y0, y1))))
  for (let y = ya; y < yb; y++) {
    for (let x = xa; x < xb; x++) setPixel(pixels, width, x, y, r, g, b)
  }
}

function fillCircle(
  pixels: Uint8Array,
  width: number,
  height: number,
  cx: number,
  cy: number,
  radius: number,
  r: number,
  g: number,
  b: number
): void {
  const rad = Math.max(2, Math.round(radius))
  for (let y = -rad; y <= rad; y++) {
    for (let x = -rad; x <= rad; x++) {
      if (x * x + y * y <= rad * rad) {
        const px = Math.round(cx + x)
        const py = Math.round(cy + y)
        if (py >= 0 && py < height) setPixel(pixels, width, px, py, r, g, b)
      }
    }
  }
}

function markerColor(kind: SpatialMarker['kind']): [number, number, number] {
  switch (kind) {
    case 'character':
      return [232, 232, 232]
    case 'costume':
      return [210, 210, 218]
    case 'prop':
      return [176, 176, 176]
    case 'scene':
      return [150, 150, 154]
    case 'action':
      return [200, 200, 188]
    default:
      return [168, 168, 168]
  }
}

function playblastSize(aspect: '16:9' | '9:16'): { width: number; height: number } {
  return aspect === '9:16' ? { width: 360, height: 640 } : { width: 640, height: 360 }
}

/**
 * Neutral clay still of blocking + camera. Used as a spatial ref for still gen.
 */
export function encodeClayPlayblastPng(blocking: SpatialBlocking): Buffer {
  const { width, height } = playblastSize(blocking.aspect)
  const pixels = new Uint8Array(width * height * 3)
  pixels.fill(168)
  const floorY = Math.floor(height * 0.62)
  fillRect(pixels, width, height, 0, floorY, width, height, 140, 140, 140)

  for (const m of blocking.markers) {
    const px = m.x * (width - 1)
    const py = floorY - m.z * (floorY - height * 0.12)
    const [r, g, b] = markerColor(m.kind)
    if (m.kind === 'character' || m.kind === 'costume' || m.kind === 'action') {
      fillCircle(pixels, width, height, px, py - height * 0.08, height * 0.045, r, g, b)
      fillRect(
        pixels,
        width,
        height,
        px - width * 0.018,
        py - height * 0.07,
        px + width * 0.018,
        py + height * 0.04,
        r,
        g,
        b
      )
    } else if (m.kind === 'scene') {
      fillRect(
        pixels,
        width,
        height,
        px - width * 0.22,
        py - height * 0.08,
        px + width * 0.22,
        py + height * 0.04,
        r,
        g,
        b
      )
    } else {
      fillRect(
        pixels,
        width,
        height,
        px - width * 0.03,
        py - height * 0.03,
        px + width * 0.03,
        py + height * 0.03,
        r,
        g,
        b
      )
    }
  }

  const cam = blocking.camera
  const cx = cam.x * (width - 1)
  const cy = floorY - cam.z * (floorY - height * 0.08)
  const lx = cam.lookAtX * (width - 1)
  const ly = floorY - cam.lookAtZ * (floorY - height * 0.08)
  fillCircle(pixels, width, height, cx, cy, 6, 48, 48, 48)
  const steps = 24
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    const x = cx + (lx - cx) * t
    const y = cy + (ly - cy) * t
    setPixel(pixels, width, Math.round(x), Math.round(y), 32, 32, 32)
  }

  const raw = Buffer.alloc((width * 3 + 1) * height)
  for (let y = 0; y < height; y++) {
    const rowStart = y * (width * 3 + 1)
    raw[rowStart] = 0
    raw.set(pixels.subarray(y * width * 3, (y + 1) * width * 3), rowStart + 1)
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8
  ihdr[9] = 2
  const idat = deflateSync(raw, { level: 9 })
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', idat),
    pngChunk('IEND', Buffer.alloc(0))
  ])
}
