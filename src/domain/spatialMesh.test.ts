import { describe, expect, it } from 'vitest'
import { buildProxyGltf, proxyMeshSizeForEntity } from './spatialMesh'

describe('spatialMesh', () => {
  it('builds a textured-plane glTF', () => {
    const json = buildProxyGltf({
      name: 'prop-box',
      textureFileName: 'texture.png',
      ...proxyMeshSizeForEntity('prop')
    })
    const doc = JSON.parse(json) as { asset: { version: string }; images: Array<{ uri: string }> }
    expect(doc.asset.version).toBe('2.0')
    expect(doc.images[0]?.uri).toBe('texture.png')
    expect(proxyMeshSizeForEntity('character').height).toBeGreaterThan(1)
    expect(proxyMeshSizeForEntity('scene').width).toBeGreaterThan(1)
  })
})
