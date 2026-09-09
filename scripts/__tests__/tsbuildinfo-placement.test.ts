import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * `tsc` trusts its build info without checking that the output it describes is still on
 * disk. If the build info outlives its `outDir`, the next build decides everything is up
 * to date, skips the emit, and exits 0 having produced nothing at all.
 *
 * Deploys and CI hit exactly that: a fresh checkout has no (git-ignored) `dist`, but a
 * restored `node_modules` cache still has the build info. It broke the staging server
 * with `ERR_MODULE_NOT_FOUND` on `dist/bootstrap-telemetry.js` — a green build followed
 * by an empty `dist`.
 *
 * So every program that *emits* keeps its build info inside its own `outDir`, where the
 * two are created and discarded together. Type-checking (`--noEmit`) programs have no
 * output to fall out of sync with, and keep theirs in `node_modules/.cache/tsbuildinfo/`
 * so CI can cache them.
 */

const repoRoot = join(import.meta.dirname, '../..');
const packagesDir = join(repoRoot, 'packages');

/** Strip `//` and `/* *\/` comments, leaving anything inside string literals alone. */
function stripJsonComments(text: string): string {
  let out = '';
  let inString = false;
  for (let i = 0; i < text.length; ) {
    const char = text[i]!;
    if (inString) {
      if (char === '\\') {
        out += text.slice(i, i + 2);
        i += 2;
        continue;
      }
      if (char === '"') inString = false;
      out += char;
      i += 1;
      continue;
    }
    if (char === '"') {
      inString = true;
      out += char;
      i += 1;
      continue;
    }
    if (char === '/' && text[i + 1] === '/') {
      const newline = text.indexOf('\n', i);
      i = newline === -1 ? text.length : newline;
      continue;
    }
    if (char === '/' && text[i + 1] === '*') {
      const close = text.indexOf('*/', i + 2);
      i = close === -1 ? text.length : close + 2;
      continue;
    }
    out += char;
    i += 1;
  }
  return out;
}

type CompilerOptions = {
  noEmit?: boolean;
  outDir?: string;
  tsBuildInfoFile?: string;
};

/**
 * The three options this file cares about, resolved through the `extends` chain. A
 * relative path is resolved against the directory of the config that *declares* it,
 * which is what makes an inherited `outDir` point somewhere else entirely.
 */
function resolveOptions(configPath: string): CompilerOptions {
  const raw = JSON.parse(stripJsonComments(readFileSync(configPath, 'utf8'))) as {
    extends?: string;
    compilerOptions?: Record<string, unknown>;
  };
  const own = raw.compilerOptions ?? {};
  const configDir = dirname(configPath);

  const inherited: CompilerOptions = raw.extends
    ? resolveOptions(resolve(configDir, raw.extends))
    : {};

  return {
    noEmit: 'noEmit' in own ? Boolean(own['noEmit']) : inherited.noEmit,
    outDir:
      typeof own['outDir'] === 'string' ? resolve(configDir, own['outDir']) : inherited.outDir,
    tsBuildInfoFile:
      typeof own['tsBuildInfoFile'] === 'string'
        ? resolve(configDir, own['tsBuildInfoFile'])
        : inherited.tsBuildInfoFile,
  };
}

/**
 * Whether `file` sits under `dir`.
 *
 * Both halves matter, and neither is covered by a bare `startsWith('..')`:
 *
 * - `relative()` gives up and returns an *absolute* path when the two share no root at
 *   all — different Windows drive letters, or a UNC path — and an absolute result starts
 *   with neither `..` nor anything else recognizable. Reading that as "inside" would make
 *   this whole file pass silently on exactly the paths it exists to reject.
 * - A directory genuinely inside `dir` may be *named* something like `..cache`, whose
 *   relative path starts with `..` without escaping anything. Hence the separator.
 */
function isInside(dir: string, file: string): boolean {
  const rel = relative(dir, file);
  if (isAbsolute(rel)) return false;
  return rel !== '..' && !rel.startsWith(`..${sep}`);
}

type TscInvocation = {
  /** Workspace directory name under `packages/`. */
  pkg: string;
  /** The npm script the invocation was reached through, for failure messages. */
  script: string;
  configPath: string;
};

/**
 * Every `tsc` invocation reachable from a package's `build` script that emits.
 *
 * `build` scripts chain (`yarn typecheck && tsup src/index.ts`), so `yarn <name>` is
 * followed into the named script when the package declares one. Invocations passing
 * `--noEmit`, and configs that set `noEmit`, are dropped: they produce no output, so
 * where their build info lives cannot desynchronize from anything.
 */
function emittingTscInvocations(pkg: string): TscInvocation[] {
  const pkgDir = join(packagesDir, pkg);
  const manifest = JSON.parse(readFileSync(join(pkgDir, 'package.json'), 'utf8')) as {
    scripts?: Record<string, string>;
  };
  const scripts = manifest.scripts ?? {};

  const found: TscInvocation[] = [];
  const visited = new Set<string>();

  function walk(scriptName: string) {
    if (visited.has(scriptName)) return;
    visited.add(scriptName);
    const body = scripts[scriptName];
    if (!body) return;

    for (const command of body.split(/&&|\|\||;|\|/)) {
      const words = command.trim().split(/\s+/).filter(Boolean);
      if (words.length === 0) continue;

      // `yarn <script>` delegates; `yarn tsc` runs the binary, since no package here
      // declares a script by that name.
      const [head, ...rest] = words[0] === 'yarn' ? words.slice(1) : words;
      if (head === undefined) continue;
      if (head !== 'tsc') {
        if (words[0] === 'yarn' && head in scripts) walk(head);
        continue;
      }
      if (rest.includes('--noEmit')) continue;

      const projectFlag = rest.findIndex(word => word === '-p' || word === '--project');
      const configPath = join(
        pkgDir,
        projectFlag === -1 ? 'tsconfig.json' : (rest[projectFlag + 1] ?? 'tsconfig.json'),
      );
      if (!existsSync(configPath)) continue;
      if (resolveOptions(configPath).noEmit) continue;

      found.push({ pkg, script: scriptName, configPath });
    }
  }

  walk('build');
  return found;
}

const packageDirs = readdirSync(packagesDir, { withFileTypes: true })
  .filter(entry => entry.isDirectory() && existsSync(join(packagesDir, entry.name, 'package.json')))
  .map(entry => entry.name)
  .sort();

describe('isInside', () => {
  const dir = resolve(sep, 'a', 'dist');

  it.each([
    ['the file itself', join(dir, '.tsbuildinfo'), true],
    ['a nested file', join(dir, 'nested', '.tsbuildinfo'), true],
    // `..cache` escapes nothing; `relative()` still returns it prefixed with two dots.
    ['a directory whose name begins with two dots', join(dir, '..cache', 'x'), true],
    ['the directory itself', dir, true],
    ['a path that walks out', resolve(sep, 'a', 'node_modules', '.cache', 'x'), false],
    // Shares `/a/dist` as a *string* prefix without being inside it.
    ['a sibling with a shared prefix', resolve(sep, 'a', 'dist-2', 'x'), false],
  ])('%s', (_case, file, expected) => {
    expect(isInside(dir, file)).toBe(expected);
  });
});

describe('TypeScript build-info placement', () => {
  it('finds the emitting builds it means to check', () => {
    const emitting = packageDirs.flatMap(emittingTscInvocations);

    // A parser that silently matches nothing would make every assertion below vacuous.
    expect(emitting.map(({ configPath }) => relative(repoRoot, configPath)).sort()).toContain(
      'packages/server/tsconfig.build.json',
    );
  });

  for (const pkg of packageDirs) {
    const emitting = emittingTscInvocations(pkg);
    if (emitting.length === 0) continue;

    for (const { script, configPath } of emitting) {
      const config = relative(repoRoot, configPath);

      it(`${config} (${pkg} \`${script}\`) keeps its build info inside outDir`, () => {
        const { outDir, tsBuildInfoFile } = resolveOptions(configPath);

        expect(outDir, `${config} emits but declares no outDir`).toBeDefined();

        // Unset is fine: TypeScript's own default already sits inside `outDir`.
        if (tsBuildInfoFile === undefined) return;

        expect(
          isInside(outDir!, tsBuildInfoFile),
          `${config} points tsBuildInfoFile at ${relative(repoRoot, tsBuildInfoFile)}, outside ` +
            `its outDir (${relative(repoRoot, outDir!)}). Build info that outlives the output ` +
            `makes this build emit nothing and still exit 0 — see the comment at the top of ` +
            `this file.`,
        ).toBe(true);
      });
    }
  }
});
