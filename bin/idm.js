#!/usr/bin/env node
/**
 * Global entry: npm i -g .  →  `idm` on PATH
 * Resolves tsx from package and runs src/cli/bin.ts
 */
'use strict'

const { spawnSync } = require('child_process')
const path = require('path')
const fs = require('fs')

const root = path.resolve(__dirname, '..')
const entry = path.join(root, 'src', 'cli', 'bin.ts')

function resolveTsx() {
  try {
    return require.resolve('tsx/cli', { paths: [root] })
  } catch {
    try {
      return require.resolve('tsx/cli')
    } catch {
      return null
    }
  }
}

const tsxCli = resolveTsx()
if (!tsxCli) {
  console.error(
    'idm: missing dependency "tsx". Run: npm install  (or npm i -g tsx)'
  )
  process.exit(1)
}

if (!fs.existsSync(entry)) {
  console.error(`idm: entry not found: ${entry}`)
  process.exit(1)
}

const result = spawnSync(
  process.execPath,
  [tsxCli, entry, ...process.argv.slice(2)],
  {
    stdio: 'inherit',
    env: {
      ...process.env,
      // Help packageVersion() when global
      npm_package_version:
        process.env.npm_package_version ||
        (() => {
          try {
            return JSON.parse(
              fs.readFileSync(path.join(root, 'package.json'), 'utf8')
            ).version
          } catch {
            return '1.0.0'
          }
        })()
    },
    cwd: process.cwd()
  }
)

if (result.error) {
  console.error(result.error.message)
  process.exit(1)
}
process.exit(result.status == null ? 1 : result.status)
