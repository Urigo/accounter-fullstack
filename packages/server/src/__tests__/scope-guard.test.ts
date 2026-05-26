import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// Guard: after the multi-business migration, modules must resolve scope/owner
// via ScopeProvider (read scope, write target, per-business preferences) rather
// than reaching into the request's single admin context. This fails if any
// module (outside admin-context itself) reintroduces an `adminContext.ownerId`
// or `adminContext.defaultLocalCurrency` fallback.

const MODULES_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'modules');

const FORBIDDEN = [/adminContext\\??\\.ownerId\\b/, /adminContext\\??\\.defaultLocalCurrency\\b/];

function collectSourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (
        entry.name === 'admin-context' ||
        entry.name === '__generated__' ||
        entry.name === '__tests__'
      ) {
        continue;
      }
      out.push(...collectSourceFiles(full));
    } else if (
      entry.name.endsWith('.ts') &&
      !entry.name.endsWith('.test.ts') &&
      !entry.name.endsWith('.spec.ts')
    ) {
      out.push(full);
    }
  }
  return out;
}

describe('multi-business scope guard', () => {
  it('no module references the single admin-context owner/currency fallback', () => {
    const offenders: string[] = [];
    for (const file of collectSourceFiles(MODULES_DIR)) {
      const content = readFileSync(file, 'utf8');
      for (const pattern of FORBIDDEN) {
        if (pattern.test(content)) {
          offenders.push(`${relative(MODULES_DIR, file)} -> ${pattern.source}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
