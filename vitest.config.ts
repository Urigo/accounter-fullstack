import 'reflect-metadata';
import { createRequire } from 'node:module';
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
const graphqlCjsEntry = createRequire(import.meta.url).resolve('graphql');

const alias = [
  { find: '@', replacement: resolve(__dirname, 'packages/client/src') },
  {
    find: '@accounter/pcn874-generator',
    replacement: resolve(__dirname, 'packages/pcn874-generator/src/index.ts'),
  },
  {
    find: '@accounter/modern-poalim-scraper',
    replacement: resolve(__dirname, 'packages/modern-poalim-scraper/src/index.ts'),
  },
  // `graphql` ships CJS (`main`) and ESM (`module`) entries with no `exports` map. Vite
  // resolves source imports to the ESM one while externalized deps (yoga, envelop) load
  // the CJS one under Node, so tests would see two `GraphQLError` classes and yoga would
  // mask errors that pass in production. Pin the CJS entry Node itself resolves.
  { find: /^graphql$/, replacement: graphqlCjsEntry },
];

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
    // `**/.claude/**`: Claude Code keeps its git worktrees in `.claude/worktrees/<name>/`, each a
    // full checkout of this repo inside the repo folder. Vitest globs with `dot: true`, so
    // without this entry every `**/*.test.ts` pattern also matches the copies in there, and a
    // `yarn test` in the main checkout runs another branch's tests against this checkout's
    // database. One of those copies is the demo seed test, which resets the database it is
    // pointed at. `scripts/__tests__/vitest-collection.test.ts` holds this in place.
    exclude: [...defaultExclude, '**/dist/**', '**/build/**', '**/.claude/**'],
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
          // Every entry starts with `**/` on purpose. The `include` above matches at any depth,
          // so an exclude anchored at the repo root only covers this checkout: a second copy of
          // the repo anywhere below it (a git worktree, a vendored clone) would have its
          // database-backed and demo seed tests collected here as "unit" tests.
          exclude: [
            '**/packages/server/src/__tests__/**',
            '**/packages/server/src/demo-fixtures/**',
            '**/*.integration.test.ts',
            // Client tests live in the `client` project below, which runs without a database.
            '**/packages/client/**',
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
          // Root-anchored `include` patterns cannot reach a nested checkout, so this project
          // never had the `unit` problem; the exclude is written at any depth to match it.
          exclude: ['**/packages/server/src/demo-fixtures/**'],
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
