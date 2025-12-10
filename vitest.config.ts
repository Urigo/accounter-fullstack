import 'reflect-metadata';
import tsconfigPaths from 'vite-tsconfig-paths';
import { defaultExclude, defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    alias: {},
    exclude: [...defaultExclude, '**/dist/**', '**/build/**'],
    setupFiles: ['./scripts/vitest-setup.ts'],
    globalSetup: ['./scripts/vitest-global-setup.ts'],
    projects: [
      {
        test: {
          name: 'unit',
          include: ['**/*.test.ts', '**/*.spec.ts'],
          exclude: [
            ...defaultExclude,
            '**/dist/**',
            '**/build/**',
            'packages/server/src/__tests__/**',
            'packages/server/src/demo-fixtures/**',
            '**/*.integration.test.ts',
          ],
          globals: true,
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
          ],
          exclude: [
            ...defaultExclude,
            '**/dist/**',
            '**/build/**',
            'packages/server/src/demo-fixtures/**',
          ],
          globals: true,
          setupFiles: ['./scripts/vitest-setup.ts'],
          globalSetup: ['./scripts/vitest-global-setup.ts'],
        },
      },
    ],
  },
});
