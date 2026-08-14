import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['src/renderer/src/**/*.test.ts', 'src/main/**/*.test.ts', 'src/shared/**/*.test.ts'],
    environment: 'node'
  }
})
