import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * Phase 1 (`Tag.ownerId`) has no server-side unit test — the tags module has no
 * suite — so it is covered by typecheck + codegen. This pins the one field the
 * MCP tools actually depend on: `accounter_list_tags` selects `ownerId`, and if
 * the field were dropped upstream the failure would surface only at runtime as
 * a sanitized UPSTREAM_ERROR that does not name the field.
 */

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../..');

describe('generated schema contract', () => {
  const schema = readFileSync(resolve(REPO_ROOT, 'schema.graphql'), 'utf8');

  const typeBlock = (name: string): string => {
    const match = schema.match(new RegExp(`^type ${name} [^{]*\\{[^}]*\\}`, 'm'));
    if (!match) throw new Error(`type ${name} not found in schema.graphql`);
    return match[0];
  };

  it('Tag exposes a non-null ownerId', () => {
    expect(typeBlock('Tag')).toContain('ownerId: UUID!');
  });

  it('TaxCategory exposes ownerId', () => {
    expect(typeBlock('TaxCategory')).toMatch(/ownerId: UUID!?/);
  });
});
