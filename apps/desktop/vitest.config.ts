import { defineConfig } from 'vitest/config';

// Unit tests only. The Playwright launch test (tests/e2e) runs with `npm run e2e`.
export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**', '.build/**', 'tests/e2e/**'],
  },
});
