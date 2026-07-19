/**
 * Channel catalog for CLI help + agent tool schemas.
 * Names match IPC / createRuntime. Descriptions are agent-facing English.
 */
export interface ChannelSpec {
  channel: string
  description: string
  /** Rough arg hints for agents */
  argsHint?: string
  destructive?: boolean
  desktopOnly?: boolean
}

/** Core channels available in headless/web runtime today */
export const CORE_CHANNELS: ChannelSpec[] = [
  { channel: 'stories:list', description: 'List all stories', argsHint: '[]' },
  { channel: 'stories:get', description: 'Get story by id', argsHint: '["storyId"]' },
  {
    channel: 'stories:create',
    description: 'Create story',
    argsHint: '[{"title":"My drama"}]'
  },
  {
    channel: 'stories:update',
    description: 'Update story fields',
    argsHint: '["id", {"title":"..."}]'
  },
  {
    channel: 'stories:delete',
    description: 'Delete story',
    argsHint: '["id"]',
    destructive: true
  },
  {
    channel: 'stories:seedDemo',
    description: 'Seed demo story',
    argsHint: '["zh-HK"|"en"]'
  },
  { channel: 'characters:list', description: 'List characters', argsHint: '[{}]' },
  {
    channel: 'characters:get',
    description: 'Get character by id',
    argsHint: '["id"]'
  },
  {
    channel: 'characters:create',
    description: 'Create character',
    argsHint: '[{"name":"..."}]'
  },
  {
    channel: 'characters:update',
    description: 'Update character',
    argsHint: '["id", {...}]'
  },
  {
    channel: 'characters:delete',
    description: 'Delete character',
    argsHint: '["id"]',
    destructive: true
  },
  { channel: 'scenes:list', description: 'List scenes', argsHint: '[{}]' },
  { channel: 'scenes:create', description: 'Create scene', argsHint: '[{...}]' },
  { channel: 'scenes:update', description: 'Update scene', argsHint: '["id", {...}]' },
  {
    channel: 'scenes:delete',
    description: 'Delete scene',
    argsHint: '["id"]',
    destructive: true
  },
  { channel: 'props:list', description: 'List props', argsHint: '[{}]' },
  { channel: 'props:create', description: 'Create prop', argsHint: '[{...}]' },
  { channel: 'props:update', description: 'Update prop', argsHint: '["id", {...}]' },
  {
    channel: 'props:delete',
    description: 'Delete prop',
    argsHint: '["id"]',
    destructive: true
  },
  { channel: 'actions:list', description: 'List actions', argsHint: '[{}]' },
  { channel: 'actions:get', description: 'Get action', argsHint: '["id"]' },
  { channel: 'actions:create', description: 'Create action', argsHint: '[{...}]' },
  { channel: 'actions:update', description: 'Update action', argsHint: '["id", {...}]' },
  {
    channel: 'actions:delete',
    description: 'Delete action',
    argsHint: '["id"]',
    destructive: true
  },
  { channel: 'costumes:list', description: 'List costumes', argsHint: '[]' },
  { channel: 'costumes:create', description: 'Create costume', argsHint: '[{...}]' },
  {
    channel: 'costumes:update',
    description: 'Update costume',
    argsHint: '["id", {...}]'
  },
  {
    channel: 'costumes:delete',
    description: 'Delete costume',
    argsHint: '["id"]',
    destructive: true
  },
  {
    channel: 'timeline:list',
    description: 'List timeline entries for story',
    argsHint: '["storyId"]'
  },
  {
    channel: 'timeline:create',
    description: 'Create timeline beat',
    argsHint: '[{...}]'
  },
  {
    channel: 'timeline:update',
    description: 'Update timeline entry',
    argsHint: '["id", {...}]'
  },
  {
    channel: 'timeline:delete',
    description: 'Delete timeline entry',
    argsHint: '["id"]',
    destructive: true
  },
  {
    channel: 'timeline:reorder',
    description: 'Reorder timeline',
    argsHint: '["storyId", ["id1","id2"]]'
  },
  { channel: 'settings:get', description: 'Get app settings (secrets may be present)' },
  {
    channel: 'settings:set',
    description: 'Merge settings partial',
    argsHint: '[{"locale":"zh-HK"}]'
  },
  { channel: 'ai:status', description: 'AI provider status' },
  { channel: 'ai:listModels', description: 'List available models' },
  { channel: 'ai:testChat', description: 'Smoke-test chat provider' },
  { channel: 'app:getInfo', description: 'App version and paths' },
  {
    channel: 'app:exportFullBackup',
    description: 'Export full data zip (headless: path in result)'
  },
  {
    channel: 'app:importFullBackup',
    description: 'Import full backup zip',
    argsHint: '["/path/to.zip"]',
    destructive: true
  },
  {
    channel: 'project:exportBackup',
    description: 'Export single project backup'
  },
  {
    channel: 'project:importBackup',
    description: 'Import project backup',
    destructive: true
  },
  { channel: 'diagnostics:full', description: 'Full diagnostics probe' },
  { channel: 'activity:recent', description: 'Recent activity log', argsHint: '[80]' },
  { channel: 'activity:getPath', description: 'Activity log file path' },
  { channel: 'media:checkFfmpeg', description: 'Probe FFmpeg binary' },
  {
    channel: 'media:toPreviewUrl',
    description: 'Resolve media path to preview URL',
    argsHint: '["/abs/path"]'
  },
  {
    channel: 'media:saveAs',
    description: 'Copy media to destination',
    argsHint: '["src","dest"]'
  },
  { channel: 'updates:status', description: 'Update status (web-skipped on server)' },
  { channel: 'updates:check', description: 'Check updates (desktop-oriented)' },
  {
    channel: 'shell:openPath',
    description: 'Open path (headless may no-op)',
    desktopOnly: true
  },
  {
    channel: 'shell:showItemInFolder',
    description: 'Reveal in folder (desktop)',
    desktopOnly: true
  },
  {
    channel: 'shell:openExternal',
    description: 'Open external URL (desktop)',
    desktopOnly: true
  },
  { channel: 'app:rebuildMenu', description: 'Rebuild native menu', desktopOnly: true }
]

/** Full desktop IPC surface (~137) — used by tools schema even before web port */
export const DESKTOP_CHANNEL_NAMES: string[] = [
  'activity:clear',
  'activity:getPath',
  'activity:openLogFolder',
  'activity:query',
  'activity:recent',
  'ai:applyGrokDefaults',
  'ai:applyLlmPreset',
  'ai:listModels',
  'ai:probeChat',
  'ai:probeVideo',
  'ai:status',
  'ai:testChat',
  'app:exportFullBackup',
  'app:getInfo',
  'app:importFullBackup',
  'app:rebuildMenu',
  'characters:aiFill',
  'characters:commitSheet',
  'characters:create',
  'characters:delete',
  'characters:generateIntroVideo',
  'characters:generateSheet',
  'characters:generateSoul',
  'characters:get',
  'characters:importSoulMd',
  'characters:importSoulMdUrl',
  'characters:list',
  'characters:readSoulContent',
  'characters:suggestWardrobe',
  'characters:swapCostume',
  'characters:update',
  'characters:writeSoulContent',
  'costumes:aiFill',
  'costumes:create',
  'costumes:delete',
  'costumes:generateDressed',
  'costumes:generateIntroVideo',
  'costumes:get',
  'costumes:linkCharacter',
  'costumes:list',
  'costumes:listForCharacter',
  'costumes:setActive',
  'costumes:unlinkCharacter',
  'costumes:update',
  'diagnostics:full',
  'gateway:ensure',
  'gateway:installHints',
  'gateway:openAdmin',
  'gateway:status',
  'generation:cancel',
  'generation:progress',
  'generation:run',
  'generation:runClip',
  'media:checkFfmpeg',
  'media:deleteExport',
  'media:discardSheetDraft',
  'media:exportConcat',
  'media:exportFinal',
  'media:exportPreflight',
  'media:exportStoryboard',
  'media:importClip',
  'media:listExports',
  'media:openClip',
  'media:pickBgm',
  'media:pickRefImage',
  'media:saveAs',
  'media:toPreviewUrl',
  'project:exportBackup',
  'project:importBackup',
  'props:aiFill',
  'props:commitPlate',
  'props:create',
  'props:delete',
  'props:generateIntroVideo',
  'props:generatePlate',
  'props:list',
  'props:update',
  'actions:aiFill',
  'actions:commitPlate',
  'actions:create',
  'actions:delete',
  'actions:generateIntroVideo',
  'actions:generatePlate',
  'actions:get',
  'actions:linkStory',
  'actions:list',
  'actions:unlinkStory',
  'actions:update',
  'scenes:aiFill',
  'scenes:commitPlate',
  'scenes:copyGalleryFrom',
  'scenes:create',
  'scenes:delete',
  'scenes:generateIntroVideo',
  'scenes:generatePlate',
  'scenes:list',
  'scenes:swapAtmosphere',
  'scenes:update',
  'settings:get',
  'settings:set',
  'shell:openExternal',
  'shell:openPath',
  'shell:showItemInFolder',
  'souls:categories',
  'souls:ensureIndex',
  'souls:get',
  'souls:list',
  'souls:searchLocal',
  'souls:suggestions',
  'stories:aiFillMeta',
  'stories:aiFillScript',
  'stories:commitCover',
  'stories:create',
  'stories:delete',
  'stories:generateCover',
  'stories:get',
  'stories:linkCharacter',
  'stories:linkProp',
  'stories:linkScene',
  'stories:linkAction',
  'stories:list',
  'stories:listCast',
  'stories:seedDemo',
  'stories:setCharacterCostume',
  'stories:unlinkCharacter',
  'stories:unlinkProp',
  'stories:unlinkScene',
  'stories:unlinkAction',
  'stories:update',
  'support:exportReport',
  'timeline:clearEntryStill',
  'timeline:create',
  'timeline:delete',
  'timeline:getAdvancedPrep',
  'timeline:list',
  'timeline:reorder',
  'timeline:setCastPrep',
  'timeline:setMedia',
  'timeline:update',
  'updates:check',
  'updates:download',
  'updates:install',
  'updates:status',
  'videoPrep:confirm',
  'videoPrep:create',
  'videoPrep:openFromStill',
  'videoPrep:regenStill',
  'webServer:generateToken',
  'webServer:start',
  'webServer:status',
  'webServer:stop'
]

export function specFor(channel: string): ChannelSpec {
  const found = CORE_CHANNELS.find((c) => c.channel === channel)
  if (found) return found
  return {
    channel,
    description: `Invoke channel ${channel}`,
    argsHint: '[...args]'
  }
}

export function toOpenAiTools(
  channels: string[]
): Array<{
  type: 'function'
  function: {
    name: string
    description: string
    parameters: Record<string, unknown>
  }
}> {
  return channels.map((ch) => {
    const s = specFor(ch)
    const name = ch.replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 64)
    return {
      type: 'function' as const,
      function: {
        name: name.startsWith('idm_') ? name : `idm_${name}`,
        description: `${s.description} (channel: ${ch})`,
        parameters: {
          type: 'object',
          properties: {
            args: {
              type: 'array',
              description: `Arguments for ${ch}. Hint: ${s.argsHint || '[]'}`,
              items: {}
            }
          },
          required: []
        }
      }
    }
  })
}
