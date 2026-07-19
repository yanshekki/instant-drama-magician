import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import {
  defaultConfigPath,
  defaultDataDir,
  loadConfigFile,
  resolveGlobals,
  saveConfigFile
} from './config'

describe('cli config', () => {
  const prev = { ...process.env }
  let dir: string

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'idm-cfg-'))
    process.env = { ...prev }
    delete process.env.IDM_URL
    delete process.env.IDM_TOKEN
    delete process.env.IDM_DATA_DIR
    delete process.env.XDG_CONFIG_HOME
    delete process.env.XDG_DATA_HOME
  })

  afterEach(() => {
    process.env = prev
    rmSync(dir, { recursive: true, force: true })
  })

  it('loadConfigFile returns empty when missing', () => {
    expect(loadConfigFile(join(dir, 'nope.json'))).toEqual({})
  })

  it('save and load config file', () => {
    const path = join(dir, 'config.json')
    saveConfigFile({ url: 'http://x', token: 't' }, path)
    expect(loadConfigFile(path)).toMatchObject({ url: 'http://x', token: 't' })
  })

  it('resolveGlobals prefers flags over env over file', () => {
    const path = join(dir, 'c.json')
    mkdirSync(dir, { recursive: true })
    writeFileSync(path, JSON.stringify({ url: 'http://file', token: 'file' }))
    process.env.IDM_URL = 'http://env'
    process.env.IDM_TOKEN = 'env'
    const g = resolveGlobals(
      { url: 'http://flag', token: null, json: true },
      path
    )
    expect(g.url).toBe('http://flag')
    // token null in flags falls through - actually flags.token ?? env
    // Partial with token: null means flags.token is null, then ?? env
    expect(g.token).toBe('env')
    expect(g.json).toBe(true)
  })

  it('defaultDataDir uses XDG or home', () => {
    process.env.XDG_DATA_HOME = join(dir, 'share')
    expect(defaultDataDir()).toContain('idm')
  })

  it('defaultConfigPath uses XDG config', () => {
    process.env.XDG_CONFIG_HOME = join(dir, 'cfg')
    expect(defaultConfigPath()).toContain('idm')
  })
})
