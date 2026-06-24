import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node', // DOM이 필요한 파일은 상단에 `// @vitest-environment jsdom`
    include: ['tests/**/*.test.js'],
  },
})
