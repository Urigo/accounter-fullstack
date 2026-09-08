import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The Server Tests workflow is filtered by `paths`, so a PR that touches none of them
 * silently skips the job rather than failing it — an omission never shows up as a red
 * check. That job is also the only workflow that runs vitest, so anything it does not
 * trigger on is simply untested.
 *
 * These tests assert what the filter *matches*, not how it is written, so narrowing it
 * to an enumerated list still has to cover everything the job tests.
 */

const repoRoot = join(import.meta.dirname, '../..');
const workflowPath = '.github/workflows/server-tests.yml';

/** The `paths:` entries of the workflow's `pull_request` trigger. */
function readPullRequestPaths(): string[] {
  const workflow = readFileSync(join(repoRoot, workflowPath), 'utf8');

  // The filter is the only `paths:` block in this workflow, and it ends where the
  // top-level `jobs:` key begins.
  const block = workflow.slice(workflow.indexOf('    paths:'), workflow.indexOf('\njobs:'));
  expect(block, `no pull_request paths block found in ${workflowPath}`).not.toBe('');

  return [...block.matchAll(/^\s+- '(?<path>[^']+)'$/gm)].map(match => match.groups!['path']!);
}

/**
 * GitHub's path-filter globbing: `**` crosses directory separators, `*` does not.
 * Mirrored here so the tests below check the filter the way Actions evaluates it.
 */
function matches(pattern: string, filePath: string): boolean {
  let source = '';
  for (let i = 0; i < pattern.length; ) {
    if (pattern.startsWith('**/', i)) {
      source += '(?:.*/)?';
      i += 3;
    } else if (pattern.startsWith('**', i)) {
      source += '.*';
      i += 2;
    } else if (pattern[i] === '*') {
      source += '[^/]*';
      i += 1;
    } else {
      source += pattern[i]!.replace(/[.*+?^${}()|[\]\\]/, String.raw`\$&`);
      i += 1;
    }
  }
  return new RegExp(`^${source}$`).test(filePath);
}

/** Workspace package name -> directory name under `packages/`. */
function readWorkspacePackages(): Map<string, string> {
  const packages = new Map<string, string>();
  for (const dir of readdirSync(join(repoRoot, 'packages'), { withFileTypes: true })) {
    if (!dir.isDirectory()) continue;
    try {
      const manifest = readFileSync(join(repoRoot, 'packages', dir.name, 'package.json'), 'utf8');
      packages.set(JSON.parse(manifest).name, dir.name);
    } catch {
      // Not a workspace package (no manifest) — ignore.
    }
  }
  return packages;
}

describe('server-tests workflow path filter', () => {
  const paths = readPullRequestPaths();
  const triggers = (filePath: string) => paths.some(pattern => matches(pattern, filePath));

  const workspacePackages = readWorkspacePackages();
  const serverManifest = JSON.parse(
    readFileSync(join(repoRoot, 'packages/server/package.json'), 'utf8'),
  );
  const serverWorkspaceDeps = Object.keys(serverManifest.dependencies ?? {})
    .filter(name => workspacePackages.has(name))
    .map(name => workspacePackages.get(name)!);

  it('finds the workflow and the server dependency graph', () => {
    expect(paths.length).toBeGreaterThan(0);
    // Guards against the parsing above silently returning nothing if the manifest moves.
    expect(serverWorkspaceDeps.length).toBeGreaterThan(0);
  });

  it('covers every workspace package the server depends on', () => {
    const uncovered = serverWorkspaceDeps.filter(dir => !triggers(`packages/${dir}/src/index.ts`));

    expect(
      uncovered,
      `packages/server depends on these workspace packages, but a change to them would not ` +
        `trigger ${workflowPath}. Add 'packages/<name>/**' to its pull_request paths:\n` +
        uncovered.map(dir => `  - 'packages/${dir}/**'`).join('\n'),
    ).toEqual([]);
  });

  it('covers every package whose tests this job runs', () => {
    // `yarn test:integration` runs the unit, client and integration projects, which span
    // the whole monorepo — so any package holding tests must be able to trigger the job.
    const uncovered = [...workspacePackages.values()].filter(
      dir => !triggers(`packages/${dir}/src/example.test.ts`),
    );

    expect(
      uncovered,
      `this job runs the tests in these packages, but a change to them would not trigger ` +
        `${workflowPath}, so their tests would not run on such a PR:\n` +
        uncovered.map(dir => `  - packages/${dir}`).join('\n'),
    ).toEqual([]);
  });

  it('covers the root files that define the test run', () => {
    // A dependency bump or a change to the vitest projects this job invokes must not
    // skip it — that is exactly how a Vitest major landed without server tests running.
    for (const file of ['package.json', 'yarn.lock', 'vitest.config.ts', workflowPath]) {
      expect(triggers(file), `a change to ${file} would not trigger ${workflowPath}`).toBe(true);
    }
  });

  it('does not trigger on documentation-only changes', () => {
    // The filter should stay a filter: widening it to everything would make the guarantee
    // above trivial and run the full suite on every README edit.
    expect(triggers('README.md')).toBe(false);
    expect(triggers('docs/architecture/authentication.md')).toBe(false);
  });
});
