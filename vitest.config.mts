import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    exclude: ['.claude/worktrees/**', 'e2e/**', 'node_modules/**'],
  },
})
