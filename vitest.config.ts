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

const __dirname = import.meta.dirname;

const alias = {
  '@': resolve(__dirname, 'packages/client/src'),
  '@accounter/pcn874-generator': resolve(__dirname, 'packages/pcn874-generator/src/index.ts'),
  '@accounter/modern-poalim-scraper': resolve(
    __dirname,
    'packages/modern-poalim-scraper/src/index.ts',
  ),
};

// Vitest 5 defaults `extends` to true, so every inline project below inherits the
// root `test` options (and the root Vite config, plugins included). Options common
// to all projects are declared once here — repeating them per project would append
// duplicates, since inherited arrays are merged rather than overridden.
export default defineConfig({
  plugins: [tsconfigPaths()],
  resolve: { alias },
  test: {
    globals: true,
    alias,
    exclude: [...defaultExclude, '**/dist/**', '**/build/**'],
    setupFiles: ['./scripts/vitest-setup.ts'],
    // `globalSetup` is deliberately NOT set here. It asserts a local Postgres and seeds it,
    // and inherited arrays are merged rather than overridden, so a project cannot opt out of
    // a root-level entry (`globalSetup: []` still inherits it). The three database-backed
    // projects declare it individually so `client` can run with no database at all.
    projects: [
      {
        test: {
          name: 'unit',
          globalSetup: ['./scripts/vitest-global-setup.ts'],
          include: ['**/*.test.ts', '**/*.spec.ts', '**/*.test.tsx', '**/*.spec.tsx'],
          exclude: [
            'packages/server/src/__tests__/**',
            'packages/server/src/demo-fixtures/**',
            '**/*.integration.test.ts',
            // Client tests live in the `client` project below, which runs without a database.
            'packages/client/**',
          ],
        },
      },
      {
        test: {
          // Browser-facing client tests. Inherits the root `exclude`, `globals`, `alias` and
          // `setupFiles`; only what genuinely differs is set here.
          name: 'client',
          include: [
            'packages/client/src/**/*.test.ts',
            'packages/client/src/**/*.test.tsx',
            'packages/client/src/**/*.spec.ts',
            'packages/client/src/**/*.spec.tsx',
          ],
          // Set here so the per-file `// @vitest-environment happy-dom` pragmas become redundant.
          environment: 'happy-dom',
        },
      },
      {
        test: {
          name: 'integration',
          globalSetup: ['./scripts/vitest-global-setup.ts'],
          include: [
            'packages/server/src/__tests__/**/*.test.ts',
            'packages/server/src/__tests__/**/*.spec.ts',
            'packages/server/src/modules/**/*.integration.test.ts',
            'packages/email-ingestion-gateway/src/**/*.integration.test.ts',
            'packages/scraper-app/src/**/*.integration.test.ts',
          ],
          exclude: ['packages/server/src/demo-fixtures/**'],
        },
      },
      {
        test: {
          name: 'demo-seed',
          globalSetup: ['./scripts/vitest-global-setup.ts'],
          include: ['packages/server/src/demo-fixtures/__tests__/seed-and-validate.test.ts'],
          setupFiles: ['./scripts/vitest-demo-seed-setup.ts'],
        },
      },
    ],
  },
});
