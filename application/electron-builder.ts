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
  // GitHub Releases is the update feed. This makes electron-builder emit the
  // update metadata (latest.yml / latest-linux.yml / latest-mac.yml + blockmaps)
  // next to the installers so electron-updater can find new versions. Actual
  // uploading is done by the Release workflow (build runs with --publish never),
  // so nothing is pushed until you publish the draft release yourself.
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
