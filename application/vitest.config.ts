import { resolve } from 'path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  define: {
    __FEATURE_FINANCE__: 'true'
  },
  resolve: {
    alias: {
      '@shared': resolve('src/shared'),
      '@renderer': resolve('src/renderer/src')
    }
  },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node'
  }
})
