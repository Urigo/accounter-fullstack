import { execFile } from 'node:child_process';
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, relative, sep } from 'node:path';
import { promisify } from 'node:util';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/**
 * Which test files each vitest project collects, asked of vitest itself.
 *
 * The `unit` project includes every `*.test.ts` at any depth, and used to exclude the
 * database-backed and demo seed directories with patterns anchored at the repo root. Those
 * patterns did not cover the second copy of the repo that a git worktree puts under
 * `.claude/worktrees/<name>/`, so a plain `yarn test` ran that copy's
 * `demo-fixtures/__tests__/seed-and-validate.test.ts` as a unit test, and that test resets the
 * database it is pointed at.
 *
 * Each case below runs `vitest list --filesOnly --json`, the command that prints what a project
 * would run. With `--filesOnly` it only globs: no test file is loaded, the global setup does
 * not run, and no database is involved (the child gets a dead local address to make that
 * certain). It is run three times:
 *
 * - against this checkout, which is what a developer's `yarn test` sees, worktrees included;
 * - against a throwaway tree with the real `vitest.config.ts`, because a CI checkout holds no
 *   nested checkout and the first run alone would pass there no matter what the config says;
 * - from `packages/server` with that package's own config, which is what a run started inside
 *   the package (an editor's test runner, for one) uses instead of the root config.
 */

const repoRoot = join(import.meta.dirname, '../..');
const rootConfig = join(repoRoot, 'vitest.config.ts');
const serverRoot = join(repoRoot, 'packages/server');
const serverConfig = join(serverRoot, 'vitest.config.ts');
const vitestBin = join(
  dirname(createRequire(import.meta.url).resolve('vitest/package.json')),
  'vitest.mjs',
);

type Collected = Record<string, string[]>;

/** The key for files of a config that defines no named projects. */
const UNNAMED = '(no project)';

/** Project name -> sorted paths relative to `root`, for every project in the given config. */
async function collect(root: string, config: string): Promise<Collected> {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    // Nothing below connects. Should a future vitest start running the global setup for
    // `list`, this is a local address with nothing listening on it.
    POSTGRES_HOST: 'localhost',
    POSTGRES_PORT: '1',
  };
  // This process is itself a vitest worker; do not hand its worker identity to the child.
  for (const name of Object.keys(env)) {
    if (name.startsWith('VITEST')) delete env[name];
  }

  const { stdout } = await promisify(execFile)(
    process.execPath,
    [vitestBin, 'list', '--filesOnly', '--json', '--root', root, '--config', config],
    { cwd: root, env, maxBuffer: 64 * 1024 * 1024 },
  );

  const collected: Collected = {};
  for (const { file, projectName = UNNAMED } of JSON.parse(stdout) as Array<{
    file: string;
    projectName?: string;
  }>) {
    (collected[projectName] ??= []).push(relative(root, file).split(sep).join('/'));
  }
  for (const files of Object.values(collected)) files.sort();
  return collected;
}

/** A repo-shaped tree: one file per kind of test, under the directory given. */
const CHECKOUT_FILES = {
  unit: [
    'packages/migrations/src/__tests__/local-db-guard.test.ts',
    'packages/server/src/modules/charges/helpers/common.helper.test.ts',
    'scripts/__tests__/env-templates.test.ts',
  ],
  client: ['packages/client/src/helpers/form.test.ts', 'packages/client/src/lib/table.test.tsx'],
  integration: [
    'packages/server/src/__tests__/db-bootstrap.test.ts',
    'packages/server/src/modules/charges/__tests__/charges.integration.test.ts',
  ],
  'demo-seed': ['packages/server/src/demo-fixtures/__tests__/seed-and-validate.test.ts'],
} satisfies Collected;

/** The files a second checkout must never contribute, wherever it sits. */
const DATABASE_BACKED_FILES = [
  ...CHECKOUT_FILES.client,
  ...CHECKOUT_FILES.integration,
  ...CHECKOUT_FILES['demo-seed'],
];

const WORKTREE = '.claude/worktrees/some-branch';
const OTHER_NESTED_CHECKOUT = 'vendor/accounter-fullstack';

let fixtureRoot: string;
let inFixture: Collected;
let inThisCheckout: Collected;
let inServerPackage: Collected;

beforeAll(async () => {
  // realpath: on macOS the temp dir is a symlink, and vitest reports resolved paths.
  fixtureRoot = realpathSync(mkdtempSync(join(tmpdir(), 'vitest-collection-')));
  const files = [
    ...Object.values(CHECKOUT_FILES).flat(),
    // A git worktree: a complete second checkout.
    ...Object.values(CHECKOUT_FILES)
      .flat()
      .map(file => `${WORKTREE}/${file}`),
    // A second checkout somewhere else: only the files that must not be picked up from it.
    ...DATABASE_BACKED_FILES.map(file => `${OTHER_NESTED_CHECKOUT}/${file}`),
  ];
  for (const file of files) {
    mkdirSync(dirname(join(fixtureRoot, file)), { recursive: true });
    // Never loaded: `--filesOnly` lists paths. Empty of code on purpose all the same.
    writeFileSync(
      join(fixtureRoot, file),
      '// Placeholder for scripts/__tests__/vitest-collection.test.ts\n',
    );
  }

  [inFixture, inThisCheckout, inServerPackage] = await Promise.all([
    collect(fixtureRoot, rootConfig),
    collect(repoRoot, rootConfig),
    collect(serverRoot, serverConfig),
  ]);
}, 120_000);

afterAll(() => {
  if (fixtureRoot) rmSync(fixtureRoot, { recursive: true, force: true });
});

describe('vitest test collection', () => {
  describe('with a git worktree and another nested checkout in the tree', () => {
    it('gives each project its own files and nothing from either nested checkout', () => {
      // Exact, so it fails both ways: on a file that leaks in from a nested checkout, and on a
      // project that silently stops collecting its own.
      expect(inFixture).toEqual(CHECKOUT_FILES);
    });

    it('collects nothing under .claude/ in any project', () => {
      const leaked = Object.values(inFixture)
        .flat()
        .filter(file => file.split('/').includes('.claude'));

      expect(leaked).toEqual([]);
    });

    it('runs the demo seed test in the demo-seed project only, and only the top-level copy', () => {
      const seedTests = Object.entries(inFixture).flatMap(([project, files]) =>
        files.filter(file => file.includes('seed-and-validate')).map(file => ({ project, file })),
      );

      expect(seedTests).toEqual([
        {
          project: 'demo-seed',
          file: 'packages/server/src/demo-fixtures/__tests__/seed-and-validate.test.ts',
        },
      ]);
    });
  });

  describe('in this checkout', () => {
    it('lists this file in the unit project, so the checks below are not vacuous', () => {
      expect(inThisCheckout['unit']).toContain('scripts/__tests__/vitest-collection.test.ts');
      expect(inThisCheckout['unit']!.length).toBeGreaterThan(100);
    });

    it('has nothing under .claude/ in the unit project', () => {
      const leaked = inThisCheckout['unit']!.filter(file => file.split('/').includes('.claude'));

      expect(
        leaked,
        `the unit project collects ${leaked.length} file(s) from a nested checkout under .claude/, ` +
          `so \`yarn test\` runs another branch's tests against this checkout's database`,
      ).toEqual([]);
    });

    it('has no demo seed test in the unit project', () => {
      expect(inThisCheckout['unit']!.filter(file => file.includes('seed-and-validate'))).toEqual(
        [],
      );
    });

    it('has nothing under .claude/ in any other project either', () => {
      const leaked = Object.entries(inThisCheckout).flatMap(([project, files]) =>
        files
          .filter(file => file.split('/').includes('.claude'))
          .map(file => `[${project}] ${file}`),
      );

      expect(leaked).toEqual([]);
    });

    it('collects the demo seed test exactly once, in the demo-seed project', () => {
      const seedTests = Object.entries(inThisCheckout).flatMap(([project, files]) =>
        files.filter(file => file.includes('seed-and-validate')).map(file => ({ project, file })),
      );

      expect(seedTests).toEqual([
        {
          project: 'demo-seed',
          file: 'packages/server/src/demo-fixtures/__tests__/seed-and-validate.test.ts',
        },
      ]);
    });
  });

  describe('with the config of packages/server', () => {
    it('collects the tests of that package, so the check below is not vacuous', () => {
      expect(Object.keys(inServerPackage)).toEqual([UNNAMED]);
      expect(inServerPackage[UNNAMED]).toContain(
        'src/demo-fixtures/__tests__/use-case-registry.test.ts',
      );
      expect(inServerPackage[UNNAMED]!.length).toBeGreaterThan(100);
    });

    it('does not collect the demo seed test', () => {
      // "Run every test in this package" must not include the one that resets a database.
      expect(inServerPackage[UNNAMED]!.filter(file => file.includes('seed-and-validate'))).toEqual(
        [],
      );
    });
  });
});
