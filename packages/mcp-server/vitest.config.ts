import { defineConfig } from 'vitest/config';

// Package-local Vitest config so `yarn workspace @accounter/mcp-server test`
// runs only this package's tests in isolation. The repo-root config still
// discovers these files via its `unit` project glob when running `yarn test`.
export default defineConfig({
  test: {
    globals: true,
    include: ['src/**/*.test.ts'],
  },
});
