import 'reflect-metadata';
import path from 'node:path';
import tsconfigPaths from 'vite-tsconfig-paths';
import { defaultExclude, defineConfig } from 'vitest/config';

const __dirname = new URL('.', import.meta.url).pathname;

export default defineConfig({
  plugins: [
    tsconfigPaths({
      projects: [path.resolve(__dirname, './tsconfig.json')],
    }),
  ],
  test: {
    globals: true,
    exclude: [...defaultExclude, '**/dist/**', '**/build/**'],
    setupFiles: [path.resolve(__dirname, '../../scripts/vitest-setup.ts')],
    globalSetup: [path.resolve(__dirname, '../../scripts/vitest-global-setup.ts')],
  },
  resolve: {
    alias: {
      '@modules': path.resolve(__dirname, './src/modules'),
      '@shared/gql-types': path.resolve(__dirname, './src/__generated__/types.js'),
      '@shared/enums': path.resolve(__dirname, './src/shared/enums.js'),
      '@shared/tokens': path.resolve(__dirname, './src/shared/tokens.js'),
      '@shared/helpers': path.resolve(__dirname, './src/shared/helpers/index.js'),
      '@shared/errors': path.resolve(__dirname, './src/shared/errors.js'),
      '@accounter/green-invoice-graphql': path.resolve(
        __dirname,
        '../green-invoice-graphql/src/index.js',
      ),
      '@accounter/pcn874-generator': path.resolve(__dirname, '../pcn874-generator/src/index.js'),
      '@accounter/shaam6111-generator': path.resolve(
        __dirname,
        '../shaam6111-generator/src/index.js',
      ),
      '@accounter/shaam-uniform-format-generator': path.resolve(
        __dirname,
        '../shaam-uniform-format-generator/src/index.js',
      ),
    },
  },
});
