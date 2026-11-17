import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Every env reference file in the repo (`.env.template`, `.dev.vars.example`) must list only
 * variables that some code reads. A variable is "read" when its name appears in non-test source of
 * an active package or of `scripts/`. That is deliberately lenient: it cannot prove a read, only
 * catch entries nothing mentions any more (removed code, renamed variables, another package's
 * settings left behind). The per-package tests (server, client, mcp-server, gateway) also check the
 * other direction against each schema.
 */

const ROOT = join(import.meta.dirname, '..', '..');

/** Frozen packages keep their own (unmaintained) templates and are not part of the build. */
const FROZEN = new Set([
  'gmail-listener',
  'scraper-local-app',
  'old-accounter',
  'hashavshevet-mesh',
  'payper-mesh',
]);

/** Read only by a dependency, so no source mentions them. */
const READ_BY_LIBRARY: Record<string, string> = {
  ANTHROPIC_API_KEY: '@ai-sdk/anthropic (packages/server/.env.template)',
};

const SKIP_DIRS = new Set(['node_modules', 'dist', 'build', '__generated__', '__tests__', 'gql']);
const SOURCE_FILE = /\.(?:[cm]?[jt]sx?|jsonc)$/;
const TEST_FILE = /\.(?:test|spec)\.[cm]?[jt]sx?$/;

const activePackages = readdirSync(join(ROOT, 'packages')).filter(
  name => !FROZEN.has(name) && statSync(join(ROOT, 'packages', name)).isDirectory(),
);

function* walk(dir: string): Generator<string> {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.') && entry.name !== '.storybook') continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) yield* walk(path);
    } else if (SOURCE_FILE.test(entry.name) && !TEST_FILE.test(entry.name)) {
      yield path;
    }
  }
}

const corpus = [join(ROOT, 'scripts'), ...activePackages.map(name => join(ROOT, 'packages', name))]
  .flatMap(dir => [...walk(dir)])
  .map(file => readFileSync(file, 'utf8'))
  .join('\n');

const templates = [
  '.env.template',
  ...activePackages.flatMap(name =>
    ['.env.template', '.dev.vars.example']
      .map(file => join('packages', name, file))
      .filter(file => {
        try {
          return statSync(join(ROOT, file)).isFile();
        } catch {
          return false;
        }
      }),
  ),
];

/** Variable names in an env file, from active (`VAR=`) and commented-out (`# VAR=`) entries. */
function templateKeys(file: string): string[] {
  return readFileSync(join(ROOT, file), 'utf8')
    .split('\n')
    .map(line => /^#?\s*([A-Z][A-Z0-9_]*)=/.exec(line)?.[1])
    .filter((key): key is string => key !== undefined);
}

describe('env templates', () => {
  it('finds the templates and some source to check them against', () => {
    expect(templates).toContain('.env.template');
    expect(templates).toContain('packages/server/.env.template');
    expect(corpus.length).toBeGreaterThan(100_000);
  });

  it.each(templates)('%s lists only variables some code reads', file => {
    const unread = templateKeys(file).filter(
      key => !(key in READ_BY_LIBRARY) && !new RegExp(`\\b${key}\\b`).test(corpus),
    );
    expect(unread, `${relative(ROOT, join(ROOT, file))}: nothing reads these`).toEqual([]);
  });
});
