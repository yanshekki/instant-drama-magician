import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createMockApi, reseedMockApi } from '../../../test/mockApi'
import {
  makeAction,
  makeCharacter,
  makeProp,
  makeScene,
  makeTimelineEntry
} from '../../../test/pageFixtures'
import { TimelineSpatialPanel } from './TimelineSpatialPanel'

const api = createMockApi()
vi.mock('../../../lib/api', () => ({
  getApi: () => api
}))
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'en' } })
}))

describe('TimelineSpatialPanel', () => {
  beforeEach(() => {
    reseedMockApi(api)
    api.spatial.compileBeat = vi.fn().mockResolvedValue({
      kind: 'idm-spatial-package',
      playblastPath: '/tmp/playblast.png',
      blocking: {
        version: 1,
        aspect: '16:9',
        markers: [
          {
            id: 'character:char-1',
            entityId: 'char-1',
            kind: 'character',
            name: 'Aria',
            x: 0.5,
            z: 0.5
          }
        ],
        camera: { x: 0.5, y: 0.2, z: 0.1, fov: 35, lookAtX: 0.5, lookAtY: 0.1, lookAtZ: 0.5 }
      }
    })
    api.spatial.attachRef = vi.fn().mockResolvedValue({
      playblastPath: '/tmp/playblast.png'
    })
    api.spatial.generateMesh = vi.fn().mockResolvedValue({
      mesh: { path: '/tmp/p1.gltf' }
    })
    api.spatial.blenderStatus = vi.fn().mockResolvedValue({
      available: false,
      path: null,
      version: null
    })
  })

  afterEach(() => cleanup())

  it('exports a clay still via attachRef', async () => {
    render(
      <TimelineSpatialPanel
        entry={makeTimelineEntry() as never}
        characters={[makeCharacter() as never]}
        scenes={[makeScene() as never]}
        propsList={[makeProp() as never]}
        actions={[makeAction() as never]}
      />
    )
    await waitFor(() => expect(api.spatial.compileBeat).toHaveBeenCalled())
    const exportBtn = screen.getByText('timeline.desk.spatialExportPlayblast')
    const canvas = screen.getByTestId('shot-stage')
    expect(
      Boolean(
        exportBtn.compareDocumentPosition(canvas) & Node.DOCUMENT_POSITION_FOLLOWING
      )
    ).toBe(true)
    fireEvent.click(exportBtn)
    await waitFor(() => expect(api.spatial.attachRef).toHaveBeenCalled())
    fireEvent.click(screen.getByText('timeline.desk.spatialGenMesh'))
    await waitFor(() => expect(api.spatial.generateMesh).toHaveBeenCalled())
  })
})
