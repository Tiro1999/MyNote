import { resolve } from 'path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'

const finance = process.env.MYNOTE_FINANCE !== 'off'
const define = { __FEATURE_FINANCE__: JSON.stringify(finance) }
const shared = { '@shared': resolve('src/shared') }

export default defineConfig({
  main: {
    define,
    resolve: { alias: shared }
  },
  preload: {
    define,
    resolve: { alias: shared }
  },
  renderer: {
    define,
    resolve: {
      alias: {
        ...shared,
        '@renderer': resolve('src/renderer/src')
      }
    },
    plugins: [react()]
  }
})
