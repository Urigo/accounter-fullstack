import 'reflect-metadata';
import tsconfigPaths from 'vite-tsconfig-paths';
import { defaultExclude, defineConfig } from 'vitest/config';

// eslint-disable-next-line import/no-default-export
export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    alias: {},
    exclude: [...defaultExclude],
    setupFiles: ['./scripts/vitest-setup.ts'],
  },
});
