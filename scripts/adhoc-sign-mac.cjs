/**
 * electron-builder afterPack hook.
 * electron-builder 25 treats identity "-" as a keychain name, so mac.identity
 * stays null and this hook applies the ad-hoc signature after pack.
 * Non-darwin packs return immediately.
 */
const path = require('path')

const ENTITLEMENTS = [
  'com.apple.security.cs.allow-jit',
  'com.apple.security.cs.allow-unsigned-executable-memory',
  'com.apple.security.cs.disable-library-validation'
]

function loadOsxSign() {
  try {
    return require('@electron/osx-sign')
  } catch {
    const builderEntry = require.resolve('electron-builder')
    return require(require.resolve('@electron/osx-sign', { paths: [builderEntry] }))
  }
}

module.exports = async function adhocSignMac(context) {
  if (context.electronPlatformName !== 'darwin') return

  const appName = context.packager.appInfo.productFilename
  const appPath = path.join(context.appOutDir, `${appName}.app`)
  const { signAsync } = loadOsxSign()

  console.log(`ad-hoc signing ${appPath}`)
  await signAsync({
    app: appPath,
    identity: '-',
    identityValidation: false,
    platform: 'darwin',
    hardenedRuntime: true,
    timestamp: 'none',
    preAutoEntitlements: false,
    preEmbedProvisioningProfile: false,
    optionsForFile() {
      return {
        entitlements: ENTITLEMENTS,
        hardenedRuntime: true,
        timestamp: 'none'
      }
    }
  })
}
