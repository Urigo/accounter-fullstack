import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  ACCOUNTANT_STATUSES,
  CHARGE_SORT_FIELDS,
  CHARGE_TYPES,
  chargeFiltersInput,
  UNSUPPORTED_UPSTREAM_CHARGE_FILTER_FIELDS,
} from '../charge-filters.js';
import { SEARCH_CHARGES_FILTER_ALIASES, searchChargesTool } from '../charges.js';
import {
  DOCUMENT_TYPES,
  DOCUMENTS_FILTER_ALIASES,
  documentsFiltersInput,
} from '../document-details.js';
import { KNOWN_CHARGE_TYPENAMES } from '../entity-shapes.js';
import { transactionFiltersInput } from '../transaction-details.js';

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

/**
 * Field names of an `input` type in `schema.graphql`.
 *
 * Descriptions inside the block are `"""` strings that never contain braces, so
 * the non-greedy body match is safe; the field match is anchored to the start of
 * a line to skip words inside those descriptions.
 */
function inputFields(schema: string, name: string): string[] {
  const match = schema.match(new RegExp(`^input ${name} \\{([^}]*)\\}`, 'm'));
  if (!match) throw new Error(`input ${name} not found in schema.graphql`);
  const fields = [...match[1]!.matchAll(/^\s{2}(\w+):/gm)].map(field => field[1]!);
  // A regex that stops matching would make every coverage check below pass
  // vacuously — the exact failure these tests exist to prevent.
  if (fields.length === 0) throw new Error(`no fields parsed from input ${name}`);
  return fields;
}

describe('generated schema contract', () => {
  it('Tag exposes a non-null ownerId', () => {
    expect(typeBlock(loadSchema(), 'Tag')).toContain('ownerId: UUID!');
  });

  it('TaxCategory exposes ownerId', () => {
    expect(typeBlock(loadSchema(), 'TaxCategory')).toMatch(/ownerId: UUID!?/);
  });

  // `chargeType` is derived from `__typename`, so a charge type
  // added upstream would quietly classify as `unknown` — data the model reads as
  // "not categorized" rather than "the connector is out of date".
  it('every charge implementation has a chargeType mapping', () => {
    const typenames = [...loadSchema().matchAll(/^type (\w+) implements Charge\b/gm)].map(
      match => match[1]!,
    );
    expect(typenames.length).toBeGreaterThan(0);
    expect([...typenames].sort()).toEqual([...KNOWN_CHARGE_TYPENAMES].sort());
  });

  /**
   * Every row a tool returns must name its owning business, or a caller with
   * several memberships cannot group a merged result. Transactions were the hole:
   * the type had no owner at all, so `accounter_get_transactions` returned rows
   * that could not be attributed. `Transaction.ownerId` was added upstream for
   * exactly this, and it is non-null — a nullable field would push the problem
   * back onto the caller.
   */
  it('Transaction exposes a non-null ownerId', () => {
    expect(loadSchema()).toMatch(/^interface Transaction \{[^}]*ownerId: UUID!/m);
  });

  // The interface being right is not enough: `transactionsByIDs` resolves to the
  // concrete types, so a missing field there would 404 the selection at runtime.
  it('every Transaction implementation exposes ownerId', () => {
    const schema = loadSchema();
    const implementations = [...schema.matchAll(/^type (\w+) implements Transaction\b/gm)].map(
      match => match[1]!,
    );
    expect(implementations.length).toBeGreaterThan(0);
    for (const name of implementations) {
      expect(typeBlock(schema, name)).toContain('ownerId: UUID!');
    }
  });

  // Transactions carry `amountLocal`/`exchangeRate` derived from these fields.
  it('Transaction exposes eventExchangeRates', () => {
    expect(loadSchema()).toMatch(/^interface Transaction \{[^}]*eventExchangeRates: ExchangeRates/m);
  });

  // Same row-attribution rule as Tag/TaxCategory/Transaction above: without it
  // `accounter_list_clients` cannot tag rows, and its defense-in-depth owner
  // filter — which drops any row outside the resolved scope — would drop every
  // row instead of none, turning a missing field into an empty result.
  it('Client exposes a non-null ownerId', () => {
    expect(typeBlock(loadSchema(), 'Client')).toContain('ownerId: UUID!');
  });

  /**
   * `accounter_list_businesses` reads `isClient` through an inline fragment on
   * `LtdFinancialEntity`, because `allBusinesses` is typed to the `Business`
   * interface which does not carry the field. That selection is only total
   * because `Business.__resolveType` returns `LtdFinancialEntity` for every
   * node. Pin the field here; the resolver half is pinned by the directory
   * tool's own suite, which asserts the `?? false` fallback rather than
   * assuming the fragment always matches.
   */
  it('LtdFinancialEntity exposes a non-null isClient', () => {
    expect(typeBlock(loadSchema(), 'LtdFinancialEntity')).toContain('isClient: Boolean!');
  });

  // The flag is only useful as a filter if upstream can apply it before paging.
  // Filtering an already-sliced page would report "the clients on page 1" while
  // reading as "the clients".
  it('allBusinesses accepts an isClient predicate', () => {
    // Matched up to the return type rather than with a `[^)]*` run: the
    // argument's own description contains parentheses.
    const args = loadSchema().match(/allBusinesses\([\s\S]*?\): PaginatedBusinesses/);
    expect(args?.[0]).toContain('isClient: Boolean');
  });

  /**
   * The connector reads a client's Green Invoice id through
   * `integrations { greenInvoiceInfo { greenInvoiceId } }` and selects nothing
   * else on that type on purpose: `greenInvoiceId` resolves from a value already
   * in hand, while its siblings each call the external Green Invoice API. If the
   * nested shape were flattened upstream the selection would break loudly, which
   * is the good outcome — this pins it so the reason is on record.
   */
  it('ClientIntegrations exposes greenInvoiceInfo', () => {
    expect(typeBlock(loadSchema(), 'ClientIntegrations')).toContain(
      'greenInvoiceInfo: GreenInvoiceClient',
    );
  });
});

/**
 * Filter-input coverage.
 *
 * The tools wrap upstream filter inputs, and the failure mode is silent: a field
 * added to `ChargeFilter`/`DocumentsFilters`/`TransactionsFilters` upstream is
 * simply unreachable through MCP, and nothing breaks — the model just cannot ask
 * for it. Several fields were missing exactly this way. These tests compare each
 * tool's input keys against the generated schema, so the next added field fails
 * the suite instead of going unnoticed.
 *
 * Fields intentionally renamed are declared in the per-tool alias maps, and the
 * `ChargeFilter` fields upstream accepts-but-ignores are declared in
 * `UNSUPPORTED_UPSTREAM_CHARGE_FILTER_FIELDS` — so an exception has to be
 * written down, not just absent.
 */
describe('tool inputs cover the upstream filter inputs', () => {
  it('accounter_get_charges accepts every honored ChargeFilter field', () => {
    const exposed = new Set(Object.keys(chargeFiltersInput.shape));
    const unsupported = new Set<string>(UNSUPPORTED_UPSTREAM_CHARGE_FILTER_FIELDS);
    const missing = inputFields(loadSchema(), 'ChargeFilter').filter(
      field => !exposed.has(field) && !unsupported.has(field),
    );
    expect(missing).toEqual([]);
  });

  // The exception list must stay an exception list: a field named there but
  // absent from the schema means the list is stale and silently excusing nothing.
  it('every unsupported-upstream ChargeFilter field still exists in the schema', () => {
    const schemaFields = new Set(inputFields(loadSchema(), 'ChargeFilter'));
    for (const field of UNSUPPORTED_UPSTREAM_CHARGE_FILTER_FIELDS) {
      expect(schemaFields.has(field)).toBe(true);
    }
  });

  it('accounter_search_charges accepts every honored ChargeFilter field', () => {
    const exposed = new Set(Object.keys(searchChargesTool.inputSchema.shape));
    const unsupported = new Set<string>(UNSUPPORTED_UPSTREAM_CHARGE_FILTER_FIELDS);
    const aliases: Record<string, string> = { ...SEARCH_CHARGES_FILTER_ALIASES };
    const missing = inputFields(loadSchema(), 'ChargeFilter')
      .filter(field => !unsupported.has(field))
      .filter(field => !exposed.has(aliases[field] ?? field));
    expect(missing).toEqual([]);
  });

  // An alias pointing at a field that no longer exists upstream would quietly
  // exempt a real field from the check above.
  it('every search_charges alias names a real ChargeFilter field', () => {
    const schemaFields = new Set(inputFields(loadSchema(), 'ChargeFilter'));
    for (const upstreamField of Object.keys(SEARCH_CHARGES_FILTER_ALIASES)) {
      expect(schemaFields.has(upstreamField)).toBe(true);
    }
  });

  it('accounter_get_documents accepts every DocumentsFilters field', () => {
    const exposed = new Set(Object.keys(documentsFiltersInput.shape));
    const aliases: Record<string, string> = { ...DOCUMENTS_FILTER_ALIASES };
    const missing = inputFields(loadSchema(), 'DocumentsFilters').filter(
      field => !exposed.has(aliases[field] ?? field),
    );
    expect(missing).toEqual([]);
  });

  it('accounter_get_transactions accepts every TransactionsFilters field', () => {
    const exposed = new Set(Object.keys(transactionFiltersInput.shape));
    const missing = inputFields(loadSchema(), 'TransactionsFilters').filter(
      field => !exposed.has(field),
    );
    expect(missing).toEqual([]);
  });

  // The enum vocabularies are duplicated as zod enums, so a value added upstream
  // would be rejected as invalid input rather than passed through.
  it('the charge enum vocabularies match the schema', () => {
    const schema = loadSchema();
    const enumValues = (name: string): string[] => {
      const match = schema.match(new RegExp(`^enum ${name} \\{([^}]*)\\}`, 'm'));
      if (!match) throw new Error(`enum ${name} not found in schema.graphql`);
      return [...match[1]!.matchAll(/^\s{2}(\w+)$/gm)].map(value => value[1]!);
    };
    expect([...CHARGE_TYPES].sort()).toEqual(enumValues('ChargeType').sort());
    expect([...ACCOUNTANT_STATUSES].sort()).toEqual(enumValues('AccountantStatus').sort());
    expect([...CHARGE_SORT_FIELDS].sort()).toEqual(enumValues('ChargeSortByField').sort());
    expect([...DOCUMENT_TYPES].sort()).toEqual(enumValues('DocumentType').sort());
  });
});
