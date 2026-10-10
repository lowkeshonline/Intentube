import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['evaluation/jev.test.ts'],
    setupFiles: ['./vitest.setup.ts'],
    testTimeout: 180_000,
    hookTimeout: 30_000,
  },
});
