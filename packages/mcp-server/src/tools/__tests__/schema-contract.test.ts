import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { KNOWN_CHARGE_TYPENAMES } from '../entity-shapes.js';

/**
 * Phase 1 (`Tag.ownerId`) has no server-side unit test — the tags module has no
 * suite — so it is covered by typecheck + codegen. This pins the one field the
 * MCP tools actually depend on: `accounter_list_tags` selects `ownerId`, and if
 * the field were dropped upstream the failure would surface only at runtime as
 * a sanitized UPSTREAM_ERROR that does not name the field.
 */

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../..');
const SCHEMA_PATH = resolve(REPO_ROOT, 'schema.graphql');

/**
 * `schema.graphql` is generated and git-ignored, so a fresh checkout has none
 * until `yarn generate:graphql` runs. Read it lazily — inside the test rather
 * than at collection time — and fail with the command to run; otherwise this
 * surfaces as a bare `ENOENT` while collecting, which says nothing about the fix
 * and takes the whole file's tests down with it.
 *
 * Deliberately a failure rather than a skip: skipping would leave the contract
 * unchecked in exactly the situation where codegen has not run, so the guard
 * would be absent precisely when it is most likely to be needed.
 */
function loadSchema(): string {
  if (!existsSync(SCHEMA_PATH)) {
    throw new Error(
      `schema.graphql not found at ${SCHEMA_PATH}. It is generated and git-ignored — run ` +
        '`yarn generate:graphql` from the repo root before running this suite.',
    );
  }
  return readFileSync(SCHEMA_PATH, 'utf8');
}

function typeBlock(schema: string, name: string): string {
  const match = schema.match(new RegExp(`^type ${name} [^{]*\\{[^}]*\\}`, 'm'));
  if (!match) throw new Error(`type ${name} not found in schema.graphql`);
  return match[0];
}

describe('generated schema contract', () => {
  it('Tag exposes a non-null ownerId', () => {
    expect(typeBlock(loadSchema(), 'Tag')).toContain('ownerId: UUID!');
  });

  it('TaxCategory exposes ownerId', () => {
    expect(typeBlock(loadSchema(), 'TaxCategory')).toMatch(/ownerId: UUID!?/);
  });

  // `chargeType` / `flowKind` are derived from `__typename`, so a charge type
  // added upstream would quietly classify as `unknown` — data the model reads as
  // "not categorized" rather than "the connector is out of date".
  it('every charge implementation has a chargeType mapping', () => {
    const typenames = [...loadSchema().matchAll(/^type (\w+) implements Charge\b/gm)].map(
      match => match[1]!,
    );
    expect(typenames.length).toBeGreaterThan(0);
    expect([...typenames].sort()).toEqual([...KNOWN_CHARGE_TYPENAMES].sort());
  });

  // Transactions carry `amountLocal`/`exchangeRate` derived from these fields.
  it('Transaction exposes eventExchangeRates', () => {
    expect(loadSchema()).toMatch(/^interface Transaction \{[^}]*eventExchangeRates: ExchangeRates/m);
  });
});
