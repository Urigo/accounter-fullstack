import 'reflect-metadata';
import tsconfigPaths from 'vite-tsconfig-paths';
import { defaultExclude, defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    alias: {},
    exclude: [...defaultExclude],
    setupFiles: ['./scripts/vitest-setup.ts'],
    globalSetup: ['./scripts/vitest-global-setup.ts'],
  },
});
