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
  { channel: 'updates:status', description: 'Update status (channel-aware)' },
  { channel: 'updates:check', description: 'Check GitHub Releases (desktop packaged)' },
  { channel: 'updates:download', description: 'Download desktop update' },
  { channel: 'updates:install', description: 'Quit and install desktop update' },
  { channel: 'updates:checkNpm', description: 'Check npm registry for CLI package' },
  {
    channel: 'updates:openReleasePage',
    description: 'Open GitHub Releases in browser',
    argsHint: '["1.2.0"?]'
  },
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
  { channel: 'app:rebuildMenu', description: 'Rebuild native menu', desktopOnly: true },
  {
    channel: 'activity:clear',
    description: 'activity: clear',
    argsHint: '[{...}]',
    destructive: true
  },
  {
    channel: 'activity:openLogFolder',
    description: 'activity: open log folder',
    argsHint: '[{...}]'
  },
  {
    channel: 'activity:query',
    description: 'activity: query',
    argsHint: '[{...}]'
  },
  {
    channel: 'ai:applyGrokDefaults',
    description: 'ai: apply grok defaults',
    argsHint: '[{...}]'
  },
  {
    channel: 'ai:applyLlmPreset',
    description: 'ai: apply llm preset',
    argsHint: '[{...}]'
  },
  {
    channel: 'ai:probeChat',
    description: 'ai: probe chat',
    argsHint: '[{...}]'
  },
  {
    channel: 'ai:probeVideo',
    description: 'ai: probe video',
    argsHint: '[{...}]'
  },
  {
    channel: 'characters:aiFill',
    description: 'characters: ai fill',
    argsHint: '[{idea?, locale?, existingDraft?}]'
  },
  {
    channel: 'characters:commitSheet',
    description: 'characters: commit sheet',
    argsHint: '[{...}]'
  },
  {
    channel: 'characters:generateIntroVideo',
    description: 'characters: generate intro video',
    argsHint: '[{...}]'
  },
  {
    channel: 'characters:generateSheet',
    description: 'characters: generate sheet',
    argsHint: '[{...}]'
  },
  {
    channel: 'characters:generateSoul',
    description: 'characters: generate soul',
    argsHint: '[{...}]'
  },
  {
    channel: 'characters:importSoulMd',
    description: 'characters: import soul md',
    argsHint: '[{...}]'
  },
  {
    channel: 'characters:importSoulMdUrl',
    description: 'characters: import soul md url',
    argsHint: '[{...}]'
  },
  {
    channel: 'characters:readSoulContent',
    description: 'characters: read soul content',
    argsHint: '[{...}]'
  },
  {
    channel: 'characters:suggestWardrobe',
    description: 'characters: suggest wardrobe',
    argsHint: '[{...}]'
  },
  {
    channel: 'characters:swapCostume',
    description: 'characters: swap costume',
    argsHint: '[{...}]'
  },
  {
    channel: 'characters:writeSoulContent',
    description: 'characters: write soul content',
    argsHint: '[{...}]'
  },
  {
    channel: 'costumes:aiFill',
    description: 'costumes: ai fill',
    argsHint: '[{idea?, locale?, existingDraft?}]'
  },
  {
    channel: 'costumes:generateDressed',
    description: 'costumes: generate dressed',
    argsHint: '[{...}]'
  },
  {
    channel: 'costumes:generateIntroVideo',
    description: 'costumes: generate intro video',
    argsHint: '[{...}]'
  },
  {
    channel: 'costumes:get',
    description: 'costumes: get',
    argsHint: '["id"]'
  },
  {
    channel: 'costumes:linkCharacter',
    description: 'costumes: link character',
    argsHint: '[{storyId, id...}]'
  },
  {
    channel: 'costumes:listForCharacter',
    description: 'costumes: list for character',
    argsHint: '["id"]'
  },
  {
    channel: 'costumes:setActive',
    description: 'costumes: set active',
    argsHint: '[{...}]'
  },
  {
    channel: 'costumes:unlinkCharacter',
    description: 'costumes: unlink character',
    argsHint: '[{storyId, id...}]',
    destructive: true
  },
  {
    channel: 'gateway:ensure',
    description: 'gateway: ensure',
    argsHint: '[{...}]'
  },
  {
    channel: 'gateway:installHints',
    description: 'gateway: install hints',
    argsHint: '[{...}]'
  },
  {
    channel: 'gateway:openAdmin',
    description: 'gateway: open admin',
    argsHint: '[{...}]'
  },
  {
    channel: 'gateway:status',
    description: 'gateway: status',
    argsHint: '[]'
  },
  {
    channel: 'generation:cancel',
    description: 'generation: cancel',
    argsHint: '[{...}]',
    destructive: true
  },
  {
    channel: 'generation:progress',
    description: 'generation: progress',
    argsHint: '[]'
  },
  {
    channel: 'generation:run',
    description: 'generation: run',
    argsHint: '[{...}]'
  },
  {
    channel: 'generation:runClip',
    description: 'generation: run clip',
    argsHint: '[{...}]'
  },
  {
    channel: 'media:deleteExport',
    description: 'media: delete export',
    argsHint: '[{...}]'
  },
  {
    channel: 'media:discardSheetDraft',
    description: 'media: discard sheet draft',
    argsHint: '[{...}]',
    destructive: true
  },
  {
    channel: 'media:exportConcat',
    description: 'media: export concat',
    argsHint: '[{...}]'
  },
  {
    channel: 'media:exportFinal',
    description: 'media: export final',
    argsHint: '[{...}]'
  },
  {
    channel: 'media:exportPreflight',
    description: 'media: export preflight',
    argsHint: '[{...}]'
  },
  {
    channel: 'media:exportStoryboard',
    description: 'media: export storyboard',
    argsHint: '[{...}]'
  },
  {
    channel: 'media:importClip',
    description: 'media: import clip',
    argsHint: '[{...}]'
  },
  {
    channel: 'media:listExports',
    description: 'media: list exports',
    argsHint: '[{...}]'
  },
  {
    channel: 'media:openClip',
    description: 'media: open clip',
    argsHint: '[{...}]'
  },
  {
    channel: 'media:pickBgm',
    description: 'media: pick bgm',
    argsHint: '[{...}]'
  },
  {
    channel: 'media:pickRefImage',
    description: 'media: pick ref image',
    argsHint: '[{...}]'
  },
  {
    channel: 'props:aiFill',
    description: 'props: ai fill',
    argsHint: '[{idea?, locale?, existingDraft?}]'
  },
  {
    channel: 'props:commitPlate',
    description: 'props: commit plate',
    argsHint: '[{...}]'
  },
  {
    channel: 'props:generateIntroVideo',
    description: 'props: generate intro video',
    argsHint: '[{...}]'
  },
  {
    channel: 'props:generatePlate',
    description: 'props: generate plate',
    argsHint: '[{...}]'
  },
  {
    channel: 'actions:aiFill',
    description: 'actions: ai fill',
    argsHint: '[{idea?, locale?, existingDraft?}]'
  },
  {
    channel: 'actions:commitPlate',
    description: 'actions: commit plate',
    argsHint: '[{...}]'
  },
  {
    channel: 'actions:generateIntroVideo',
    description: 'actions: generate intro video',
    argsHint: '[{...}]'
  },
  {
    channel: 'actions:generatePlate',
    description: 'actions: generate plate',
    argsHint: '[{...}]'
  },
  {
    channel: 'actions:linkStory',
    description: 'actions: link story',
    argsHint: '[{storyId, id...}]'
  },
  {
    channel: 'actions:unlinkStory',
    description: 'actions: unlink story',
    argsHint: '[{storyId, id...}]',
    destructive: true
  },
  {
    channel: 'scenes:aiFill',
    description: 'scenes: ai fill',
    argsHint: '[{idea?, locale?, existingDraft?}]'
  },
  {
    channel: 'scenes:commitPlate',
    description: 'scenes: commit plate',
    argsHint: '[{...}]'
  },
  {
    channel: 'scenes:copyGalleryFrom',
    description: 'scenes: copy gallery from',
    argsHint: '[{...}]'
  },
  {
    channel: 'scenes:generateIntroVideo',
    description: 'scenes: generate intro video',
    argsHint: '[{...}]'
  },
  {
    channel: 'scenes:generatePlate',
    description: 'scenes: generate plate',
    argsHint: '[{...}]'
  },
  {
    channel: 'scenes:swapAtmosphere',
    description: 'scenes: swap atmosphere',
    argsHint: '[{...}]'
  },
  {
    channel: 'souls:categories',
    description: 'souls: categories',
    argsHint: '[]'
  },
  {
    channel: 'souls:ensureIndex',
    description: 'souls: ensure index',
    argsHint: '[{...}]'
  },
  {
    channel: 'souls:get',
    description: 'souls: get',
    argsHint: '["id"]'
  },
  {
    channel: 'souls:list',
    description: 'souls: list',
    argsHint: '[]'
  },
  {
    channel: 'souls:searchLocal',
    description: 'souls: search local',
    argsHint: '[{...}]'
  },
  {
    channel: 'souls:suggestions',
    description: 'souls: suggestions',
    argsHint: '[{...}]'
  },
  {
    channel: 'stories:aiFillMeta',
    description: 'stories: ai fill meta',
    argsHint: '[{...}]'
  },
  {
    channel: 'stories:aiFillScript',
    description: 'stories: ai fill script',
    argsHint: '[{...}]'
  },
  {
    channel: 'stories:commitCover',
    description: 'stories: commit cover',
    argsHint: '[{...}]'
  },
  {
    channel: 'stories:generateCover',
    description: 'stories: generate cover',
    argsHint: '[{...}]'
  },
  {
    channel: 'stories:linkCharacter',
    description: 'stories: link character',
    argsHint: '[{storyId, id...}]'
  },
  {
    channel: 'stories:linkProp',
    description: 'stories: link prop',
    argsHint: '[{storyId, id...}]'
  },
  {
    channel: 'stories:linkScene',
    description: 'stories: link scene',
    argsHint: '[{storyId, id...}]'
  },
  {
    channel: 'stories:linkAction',
    description: 'stories: link action',
    argsHint: '[{storyId, id...}]'
  },
  {
    channel: 'stories:listCast',
    description: 'stories: list cast',
    argsHint: '["id"]'
  },
  {
    channel: 'stories:setCharacterCostume',
    description: 'stories: set character costume',
    argsHint: '[{...}]'
  },
  {
    channel: 'stories:unlinkCharacter',
    description: 'stories: unlink character',
    argsHint: '[{storyId, id...}]',
    destructive: true
  },
  {
    channel: 'stories:unlinkProp',
    description: 'stories: unlink prop',
    argsHint: '[{storyId, id...}]',
    destructive: true
  },
  {
    channel: 'stories:unlinkScene',
    description: 'stories: unlink scene',
    argsHint: '[{storyId, id...}]',
    destructive: true
  },
  {
    channel: 'stories:unlinkAction',
    description: 'stories: unlink action',
    argsHint: '[{storyId, id...}]',
    destructive: true
  },
  {
    channel: 'support:exportReport',
    description: 'support: export report',
    argsHint: '[{...}]'
  },
  {
    channel: 'timeline:clearEntryStill',
    description: 'timeline: clear entry still',
    argsHint: '[{...}]'
  },
  {
    channel: 'timeline:getAdvancedPrep',
    description: 'timeline: get advanced prep',
    argsHint: '[{...}]'
  },
  {
    channel: 'timeline:setCastPrep',
    description: 'timeline: set cast prep',
    argsHint: '[{...}]'
  },
  {
    channel: 'timeline:setMedia',
    description: 'timeline: set media',
    argsHint: '[{...}]'
  },
  {
    channel: 'videoPrep:confirm',
    description: 'videoPrep: confirm',
    argsHint: '[{...}]'
  },
  {
    channel: 'videoPrep:create',
    description: 'videoPrep: create',
    argsHint: '[{...}]'
  },
  {
    channel: 'videoPrep:openFromStill',
    description: 'videoPrep: open from still',
    argsHint: '[{...}]'
  },
  {
    channel: 'videoPrep:regenStill',
    description: 'videoPrep: regen still',
    argsHint: '[{...}]'
  },
  {
    channel: 'webServer:generateToken',
    description: 'webServer: generate token',
    argsHint: '[{...}]'
  },
  {
    channel: 'webServer:start',
    description: 'webServer: start',
    argsHint: '[{...}]'
  },
  {
    channel: 'webServer:status',
    description: 'webServer: status',
    argsHint: '[]'
  },
  {
    channel: 'webServer:stop',
    description: 'webServer: stop',
    argsHint: '[{...}]'
  }
]

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
  'updates:checkNpm',
  'updates:download',
  'updates:install',
  'updates:openReleasePage',
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
