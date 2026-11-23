import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

/**
 * No code may *set* ALLOW_DEMO_SEED or ALLOW_REMOTE_DB.
 *
 * Both are per-command opt-ins: they mean "the person running this command chose to". On
 * 2026-11-23 the demo-seed E2E granted itself ALLOW_DEMO_SEED when spawning the seed, so a plain
 * test run was enough to TRUNCATE whatever database .env pointed at -- production. This pins
 * that shape out of the codebase: reading, comparing and deleting the flags is fine; putting
 * them into an env object or assigning them is not, outside the allowlist below.
 *
 * Not an ESLint rule because `eslint.config.mjs` ignores `**\/__tests__/`, which is exactly
 * where the offending code lived.
 */

const repoRoot = join(import.meta.dirname, '../..');

const FLAGS = new Set(['ALLOW_DEMO_SEED', 'ALLOW_REMOTE_DB']);
/** The constants `local-db-guard.ts` exports for those names, e.g. `[ALLOW_REMOTE_DB_ENV]: '1'`. */
const FLAG_CONSTANTS = new Set(['ALLOW_DEMO_SEED_ENV', 'ALLOW_REMOTE_DB_ENV']);

/** Files that may set a flag, each with why. Keep it short. */
const ALLOWED = new Map([
  [
    'packages/migrations/src/__tests__/local-db-guard.test.ts',
    'unit tests of the guard; flags go into plain objects passed as `env`, never process.env',
  ],
  [
    'packages/server/src/__tests__/helpers/test-db-config.guard.test.ts',
    'tests the ALLOW_REMOTE_DB opt-in itself and restores process.env after each test',
  ],
  [
    'packages/server/src/__tests__/helpers/demo-seed-test-env.test.ts',
    'unit tests of the demo-seed E2E env check; flags go into plain objects passed as `env`',
  ],
  [
    'scripts/__tests__/demo-seed-guard.test.ts',
    'unit tests of the database-name rule; flags go into plain objects passed as `env`',
  ],
  [
    'scripts/__tests__/seed-demo-data.test.ts',
    'runs the seed in-process with `pg` replaced by a recorder; env is stubbed per test and restored',
  ],
  [
    'scripts/__tests__/seed-guards.test.ts',
    'spawns the seeds with a from-scratch env, a temp cwd and unresolvable hosts',
  ],
  [
    'scripts/__tests__/vitest-global-setup.test.ts',
    'plays the root .env through a dotenv stand-in with the pool helpers replaced; env is restored',
  ],
]);

/** `file:line: code` for every place `text` sets a flag. */
export function findFlagSettings(file: string, text: string): string[] {
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  const hits: string[] = [];

  const namesFlag = (node: ts.Node): boolean => {
    if (ts.isIdentifier(node) || ts.isStringLiteralLike(node)) {
      return FLAGS.has(node.text);
    }
    if (ts.isComputedPropertyName(node)) {
      return namesFlag(node.expression) || namesFlagConstant(node.expression);
    }
    return false;
  };
  const namesFlagConstant = (node: ts.Node): boolean =>
    ts.isIdentifier(node) && FLAG_CONSTANTS.has(node.text);

  const accessesFlag = (node: ts.Expression): boolean => {
    if (ts.isPropertyAccessExpression(node)) {
      return FLAGS.has(node.name.text);
    }
    if (ts.isElementAccessExpression(node)) {
      const key = node.argumentExpression;
      return (ts.isStringLiteralLike(key) && FLAGS.has(key.text)) || namesFlagConstant(key);
    }
    return false;
  };

  const isAssignment = (kind: ts.SyntaxKind) =>
    kind >= ts.SyntaxKind.FirstAssignment && kind <= ts.SyntaxKind.LastAssignment;

  const visit = (node: ts.Node): void => {
    const sets =
      ((ts.isPropertyAssignment(node) || ts.isShorthandPropertyAssignment(node)) &&
        namesFlag(node.name)) ||
      (ts.isBinaryExpression(node) &&
        isAssignment(node.operatorToken.kind) &&
        accessesFlag(node.left));
    if (sets) {
      const { line } = source.getLineAndCharacterOfPosition(node.getStart(source));
      hits.push(`${file}:${line + 1}: ${node.getText(source)}`);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);

  return hits;
}

/** Tracked and untracked (not ignored) source files that mention a flag at all. */
function candidateFiles(): string[] {
  try {
    return execFileSync(
      'git',
      [
        'grep',
        '--untracked',
        '-l',
        '-E',
        'ALLOW_(DEMO_SEED|REMOTE_DB)',
        '--',
        '*.ts',
        '*.tsx',
        '*.mts',
        '*.cts',
        '*.js',
        '*.mjs',
        '*.cjs',
      ],
      { cwd: repoRoot, encoding: 'utf8' },
    )
      .split('\n')
      .filter(Boolean);
  } catch (error) {
    // git grep exits 1 when nothing matches.
    if ((error as { status?: number }).status === 1) return [];
    throw error;
  }
}

const settingsIn = (file: string) =>
  findFlagSettings(file, readFileSync(join(repoRoot, file), 'utf8'));

describe('per-command opt-in flags are never set in code', () => {
  it('no file outside the allowlist sets ALLOW_DEMO_SEED or ALLOW_REMOTE_DB', () => {
    const offenders = candidateFiles()
      .filter(file => !ALLOWED.has(file))
      .flatMap(settingsIn);

    expect(
      offenders,
      'These are per-command opt-ins. Take them from the caller (process.env), never set them.',
    ).toEqual([]);
  });

  // A stale entry is a silent exemption waiting for new code to move into that path.
  it('every allowlisted file still exists and still sets a flag', () => {
    for (const file of ALLOWED.keys()) {
      expect(settingsIn(file), file).not.toEqual([]);
    }
  });
});

describe('findFlagSettings', () => {
  const find = (code: string) => findFlagSettings('x.ts', code);

  it.each([
    // The shape that wiped production.
    "spawn('node', [], { env: { ...process.env, ALLOW_DEMO_SEED: '1' } });",
    "const env = { 'ALLOW_REMOTE_DB': '1' };",
    "const env = { [ALLOW_REMOTE_DB_ENV]: '1' };",
    "const env = { ['ALLOW_DEMO_SEED']: '1' };",
    'const env = { ALLOW_DEMO_SEED };',
    "process.env.ALLOW_DEMO_SEED = '1';",
    "process.env['ALLOW_REMOTE_DB'] = '1';",
    "process.env[ALLOW_REMOTE_DB_ENV] = '1';",
    "process.env.ALLOW_REMOTE_DB ??= '1';",
    "Object.assign(process.env, { ALLOW_DEMO_SEED: '1' });",
  ])('flags %s', code => {
    expect(find(code)).toHaveLength(1);
  });

  it.each([
    "if (process.env.ALLOW_DEMO_SEED !== '1') process.exit(1);",
    "const allowed = process.env['ALLOW_REMOTE_DB'] === '1';",
    'delete env[ALLOW_REMOTE_DB_ENV];',
    "export const ALLOW_REMOTE_DB_ENV = 'ALLOW_REMOTE_DB';",
    '// run with ALLOW_DEMO_SEED=1 yarn seed:staging-demo',
    "console.error('ALLOW_DEMO_SEED=1 required');",
    'const message = `${ALLOW_REMOTE_DB_ENV}=1 <your command>`;',
  ])('does not flag %s', code => {
    expect(find(code)).toEqual([]);
  });
});
