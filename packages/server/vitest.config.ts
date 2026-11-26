import 'reflect-metadata';
import { createRequire } from 'node:module';
import path from 'node:path';
import tsconfigPaths from 'vite-tsconfig-paths';
import { defaultExclude, defineConfig } from 'vitest/config';

const __dirname = import.meta.dirname;

export default defineConfig({
  plugins: [
    tsconfigPaths({
      projects: [path.resolve(__dirname, './tsconfig.json')],
    }),
  ],
  test: {
    globals: true,
    // The demo seed test resets the database it is pointed at. It belongs to the `demo-seed`
    // project of the root config only (`yarn test:demo-seed`). This config is what a run
    // started inside packages/server picks up (an editor's test runner, `yarn vitest` from
    // this directory), and "run every test here" must not include it.
    exclude: [
      ...defaultExclude,
      '**/dist/**',
      '**/build/**',
      '**/demo-fixtures/__tests__/seed-and-validate.test.ts',
    ],
    setupFiles: [path.resolve(__dirname, '../../scripts/vitest-setup.ts')],
    globalSetup: [path.resolve(__dirname, '../../scripts/vitest-global-setup.ts')],
  },
  resolve: {
    alias: [
      // Same single-`graphql`-copy pin as the root `vitest.config.ts`.
      { find: /^graphql$/, replacement: createRequire(import.meta.url).resolve('graphql') },
      {
        find: '@accounter/green-invoice-graphql',
        replacement: path.resolve(__dirname, '../green-invoice-graphql/src/index.js'),
      },
      {
        find: '@accounter/opcn1214-generator',
        replacement: path.resolve(__dirname, '../opcn1214-generator/src/index.ts'),
      },
      {
        find: '@accounter/pcn874-generator',
        replacement: path.resolve(__dirname, '../pcn874-generator/src/index.ts'),
      },
      {
        find: '@accounter/shaam6111-generator',
        replacement: path.resolve(__dirname, '../shaam6111-generator/src/index.js'),
      },
      {
        find: '@accounter/shaam-uniform-format-generator',
        replacement: path.resolve(__dirname, '../shaam-uniform-format-generator/src/index.js'),
      },
    ],
  },
});
