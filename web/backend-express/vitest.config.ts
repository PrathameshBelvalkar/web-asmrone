import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    // Live tests call asmr.one and Google. They run only with LIVE=1 (npm run test:live).
    exclude: process.env.LIVE === '1' ? [] : ['tests/live/**'],
    environment: 'node',
    restoreMocks: true,
    clearMocks: true,
    testTimeout: 15_000,
  },
});
