import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // src/** rather than src/renderer/** so the pure main-process rules
    // (src/main/imageRules.ts) are covered too.
    include: ['src/**/*.test.ts'],
    environment: 'node'
  }
})
