import { fileURLToPath } from 'node:url';
import 'reflect-metadata';
import { resolve } from 'node:path';
import tsconfigPaths from 'vite-tsconfig-paths';
import { defaultExclude, defineConfig } from 'vitest/config';

// Node 24+ enables WebStorage (localStorage/sessionStorage) by default.
// In Node 26 without --localstorage-file, localStorage is undefined and
// non-overridable by happy-dom. Disable it so happy-dom owns these globals.
const nodeMajor = parseInt(process.versions.node, 10);
if (nodeMajor >= 24) {
  process.env['NODE_OPTIONS'] = `${process.env['NODE_OPTIONS'] ?? ''} --no-webstorage`.trim();
}

const __dirname = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  plugins: [tsconfigPaths()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'packages/client/src'),
      '@accounter/pcn874-generator': resolve(__dirname, 'packages/pcn874-generator/src/index.ts'),
      '@accounter/modern-poalim-scraper': resolve(
        __dirname,
        'packages/modern-poalim-scraper/src/index.ts',
      ),
    },
  },
  test: {
    globals: true,
    alias: {
      '@': resolve(__dirname, 'packages/client/src'),
      '@accounter/pcn874-generator': resolve(__dirname, 'packages/pcn874-generator/src/index.ts'),
      '@accounter/modern-poalim-scraper': resolve(
        __dirname,
        'packages/modern-poalim-scraper/src/index.ts',
      ),
    },
    exclude: [...defaultExclude, '**/dist/**', '**/build/**'],
    setupFiles: ['./scripts/vitest-setup.ts'],
    globalSetup: ['./scripts/vitest-global-setup.ts'],
    projects: [
      {
        test: {
          name: 'unit',
          include: ['**/*.test.ts', '**/*.spec.ts', '**/*.test.tsx', '**/*.spec.tsx'],
          exclude: [
            ...defaultExclude,
            '**/dist/**',
            '**/build/**',
            'packages/server/src/__tests__/**',
            'packages/server/src/demo-fixtures/**',
            '**/*.integration.test.ts',
          ],
          globals: true,
          alias: {
            '@': resolve(__dirname, 'packages/client/src'),
            '@accounter/pcn874-generator': resolve(
              __dirname,
              'packages/pcn874-generator/src/index.ts',
            ),
            '@accounter/modern-poalim-scraper': resolve(
              __dirname,
              'packages/modern-poalim-scraper/src/index.ts',
            ),
          },
          setupFiles: ['./scripts/vitest-setup.ts'],
          globalSetup: ['./scripts/vitest-global-setup.ts'],
        },
      },
      {
        test: {
          name: 'integration',
          include: [
            'packages/server/src/__tests__/**/*.test.ts',
            'packages/server/src/__tests__/**/*.spec.ts',
            'packages/server/src/modules/**/*.integration.test.ts',
            'packages/email-ingestion-gateway/src/**/*.integration.test.ts',
            'packages/scraper-app/src/**/*.integration.test.ts',
          ],
          exclude: [
            ...defaultExclude,
            '**/dist/**',
            '**/build/**',
            'packages/server/src/demo-fixtures/**',
          ],
          globals: true,
          alias: {
            '@': resolve(__dirname, 'packages/client/src'),
            '@accounter/pcn874-generator': resolve(
              __dirname,
              'packages/pcn874-generator/src/index.ts',
            ),
          },
          setupFiles: ['./scripts/vitest-setup.ts'],
          globalSetup: ['./scripts/vitest-global-setup.ts'],
        },
      },
      {
        test: {
          name: 'demo-seed',
          include: ['packages/server/src/demo-fixtures/__tests__/seed-and-validate.test.ts'],
          exclude: [...defaultExclude, '**/dist/**', '**/build/**'],
          globals: true,
          alias: {
            '@': resolve(__dirname, 'packages/client/src'),
            '@accounter/pcn874-generator': resolve(
              __dirname,
              'packages/pcn874-generator/src/index.ts',
            ),
          },
          setupFiles: ['./scripts/vitest-setup.ts', './scripts/vitest-demo-seed-setup.ts'],
          globalSetup: ['./scripts/vitest-global-setup.ts'],
        },
      },
    ],
  },
});
