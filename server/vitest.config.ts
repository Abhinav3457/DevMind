import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    exclude: ['node_modules', 'dist'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      include: ['src/services/auth.service.ts', 'src/controllers/chat.controller.ts'],
    },
    setupFiles: [],
    testTimeout: 30000,
    hookTimeout: 30000,
  },
});
