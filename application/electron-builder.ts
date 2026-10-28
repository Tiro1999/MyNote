import type { Configuration } from 'electron-builder'
import { APP_ID } from './src/shared/app'

const config: Configuration = {
  appId: APP_ID,
  productName: 'MyNote',
  copyright: 'Copyright © 2026 Tiro1999',
  directories: {
    buildResources: 'build',
    output: 'dist'
  },
  files: ['out/**'],
  // Update feed for electron-updater; release.yml uploads it, see documentation/software/build/build-and-release.md
  publish: [
    {
      provider: 'github',
      owner: 'Tiro1999',
      repo: 'MyNote'
    }
  ],
  win: {
    target: [{ target: 'nsis', arch: ['x64'] }]
  },
  mac: {
    target: [{ target: 'dmg', arch: ['x64', 'arm64'] }],
    category: 'public.app-category.productivity'
  },
  linux: {
    target: [{ target: 'AppImage', arch: ['x64'] }],
    category: 'Office'
  },
  nsis: {
    oneClick: false,
    perMachine: false,
    allowToChangeInstallationDirectory: true
  }
}

export default config
