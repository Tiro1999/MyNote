import type { Configuration } from 'electron-builder'

const config: Configuration = {
  appId: 'io.github.tiro1999.mynote',
  productName: 'MyNote',
  copyright: 'Copyright © 2026',
  directories: {
    buildResources: 'build',
    output: 'dist'
  },
  files: ['out/**'],
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
