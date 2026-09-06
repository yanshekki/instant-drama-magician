import { basename } from 'path'

/**
 * Minimal textured-plane glTF 2.0 (JSON). Billboard / clay proxy for Blender —
 * not a production character mesh. Texture file must sit beside the .gltf.
 */
export function buildProxyGltf(opts: {
  name: string
  textureFileName: string
  /** Width of the plane in meters. */
  width?: number
  height?: number
}): string {
  const w = opts.width && opts.width > 0 ? opts.width : 1
  const h = opts.height && opts.height > 0 ? opts.height : 1.7
  const hw = w / 2
  const positions = new Float32Array([
    -hw, 0, 0, hw, 0, 0, hw, h, 0, -hw, h, 0
  ])
  const normals = new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1])
  const uvs = new Float32Array([0, 1, 1, 1, 1, 0, 0, 0])
  const indices = new Uint16Array([0, 1, 2, 0, 2, 3])
  const posB64 = Buffer.from(positions.buffer).toString('base64')
  const nrmB64 = Buffer.from(normals.buffer).toString('base64')
  const uvB64 = Buffer.from(uvs.buffer).toString('base64')
  const idxB64 = Buffer.from(indices.buffer).toString('base64')
  const tex = basename(opts.textureFileName)
  const doc = {
    asset: { version: '2.0', generator: 'instant-drama-magician-spatial-proxy' },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0, name: opts.name }],
    meshes: [
      {
        name: opts.name,
        primitives: [
          {
            attributes: { POSITION: 0, NORMAL: 1, TEXCOORD_0: 2 },
            indices: 3,
            material: 0
          }
        ]
      }
    ],
    materials: [
      {
        name: `${opts.name}-clay`,
        pbrMetallicRoughness: {
          baseColorTexture: { index: 0 },
          metallicFactor: 0,
          roughnessFactor: 1
        }
      }
    ],
    textures: [{ source: 0 }],
    images: [{ uri: tex, mimeType: guessMime(tex) }],
    accessors: [
      {
        bufferView: 0,
        componentType: 5126,
        count: 4,
        type: 'VEC3',
        min: [-hw, 0, 0],
        max: [hw, h, 0]
      },
      { bufferView: 1, componentType: 5126, count: 4, type: 'VEC3' },
      { bufferView: 2, componentType: 5126, count: 4, type: 'VEC2' },
      { bufferView: 3, componentType: 5123, count: 6, type: 'SCALAR' }
    ],
    bufferViews: [
      { buffer: 0, byteLength: positions.byteLength },
      { buffer: 1, byteLength: normals.byteLength },
      { buffer: 2, byteLength: uvs.byteLength },
      { buffer: 3, byteLength: indices.byteLength, target: 34963 }
    ],
    buffers: [
      { byteLength: positions.byteLength, uri: `data:application/octet-stream;base64,${posB64}` },
      { byteLength: normals.byteLength, uri: `data:application/octet-stream;base64,${nrmB64}` },
      { byteLength: uvs.byteLength, uri: `data:application/octet-stream;base64,${uvB64}` },
      { byteLength: indices.byteLength, uri: `data:application/octet-stream;base64,${idxB64}` }
    ]
  }
  return `${JSON.stringify(doc, null, 2)}\n`
}

function guessMime(fileName: string): string {
  const lower = fileName.toLowerCase()
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg'
  if (lower.endsWith('.webp')) return 'image/webp'
  return 'image/png'
}

export function proxyMeshSizeForEntity(
  entityType: string
): { width: number; height: number } {
  switch (entityType) {
    case 'character':
    case 'costume':
    case 'action':
      return { width: 0.7, height: 1.7 }
    case 'scene':
      return { width: 4, height: 2.4 }
    default:
      return { width: 0.4, height: 0.4 }
  }
}
