import { describe, expect, it, vi } from 'vitest';
import {
  buildReindexStatement,
  discoverTrigramIndexes,
  formatBytes,
  formatDuration,
  isConcurrentLeftover,
  parseArgs,
  quoteIdentifier,
} from '../reindex-trigram-indexes.js';

describe('buildReindexStatement', () => {
  it('always emits CONCURRENTLY', () => {
    // The whole point of the tool: six of the seven trigram indexes were originally created
    // non-concurrently, and a plain REINDEX would take ACCESS EXCLUSIVE on charges,
    // transactions and documents.
    expect(buildReindexStatement('accounter_schema', 'idx_charges_desc_trgm')).toBe(
      'REINDEX INDEX CONCURRENTLY "accounter_schema"."idx_charges_desc_trgm"',
    );
  });

  it('quotes both schema and index name', () => {
    const statement = buildReindexStatement('accounter_schema', 'idx_docs_desc_trgm');
    expect(statement).toContain('"accounter_schema"."idx_docs_desc_trgm"');
  });

  it('never emits a bare REINDEX', () => {
    const statement = buildReindexStatement('s', 'i');
    expect(statement).not.toMatch(/REINDEX INDEX "s"/);
  });
});

describe('quoteIdentifier', () => {
  it('wraps in double quotes', () => {
    expect(quoteIdentifier('simple')).toBe('"simple"');
  });

  it('escapes embedded double quotes by doubling them', () => {
    expect(quoteIdentifier('we"ird')).toBe('"we""ird"');
  });

  it('neutralises an identifier that tries to close the quote and inject', () => {
    // Names come from the catalog, not user input, but REINDEX takes no bind parameters so
    // the statement is string-built and must be quoted properly regardless.
    expect(quoteIdentifier('x"; DROP TABLE charges; --')).toBe(
      '"x""; DROP TABLE charges; --"',
    );
  });
});

describe('parseArgs', () => {
  it('defaults to the accounter schema, no action', () => {
    const options = parseArgs([]);
    expect(options.schema).toBe('accounter_schema');
    expect(options.dryRun).toBe(false);
    expect(options.confirm).toBe(false);
  });

  it('defaults statement_timeout to 0 (disabled)', () => {
    // A GIN rebuild can far exceed the app's 120s default; being killed part-way leaves an
    // invalid index behind.
    expect(parseArgs([]).statementTimeoutMs).toBe(0);
  });

  it('reads --dry-run and --confirm', () => {
    expect(parseArgs(['--dry-run']).dryRun).toBe(true);
    expect(parseArgs(['--confirm']).confirm).toBe(true);
  });

  it('accepts an explicit schema and timeout', () => {
    const options = parseArgs(['--schema', 'other_schema', '--statement-timeout-ms', '600000']);
    expect(options.schema).toBe('other_schema');
    expect(options.statementTimeoutMs).toBe(600_000);
  });

  it('falls back to 0 for a non-numeric timeout rather than NaN', () => {
    expect(parseArgs(['--statement-timeout-ms', 'soon']).statementTimeoutMs).toBe(0);
  });
});

describe('isConcurrentLeftover', () => {
  it.each(['idx_charges_desc_trgm_ccnew', 'idx_x_ccnew1', 'idx_x_ccnew12'])(
    'detects %j as a failed-rebuild leftover',
    name => {
      expect(isConcurrentLeftover(name)).toBe(true);
    },
  );

  it.each(['idx_charges_desc_trgm', 'idx_ccnew_something', 'idx_financial_entities_name_trgm'])(
    'does not flag %j',
    name => {
      expect(isConcurrentLeftover(name)).toBe(false);
    },
  );
});

describe('discoverTrigramIndexes', () => {
  it('finds indexes by opclass rather than by a hardcoded name list', async () => {
    // The stale-list failure mode is exactly what this tool exists to prevent: the set grew
    // from six to seven and any copied list silently skipped the new one.
    const query = vi.fn().mockResolvedValue({
      rows: [
        {
          schema: 'accounter_schema',
          index_name: 'idx_charges_desc_trgm',
          table_name: 'charges',
          is_valid: true,
          is_ready: true,
          bytes: '32768',
        },
      ],
    });

    const indexes = await discoverTrigramIndexes({ query } as never, 'accounter_schema');

    expect(indexes).toEqual([
      {
        schema: 'accounter_schema',
        indexName: 'idx_charges_desc_trgm',
        tableName: 'charges',
        isValid: true,
        isReady: true,
        bytes: 32768,
      },
    ]);

    const [sql, params] = query.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('pg_opclass');
    expect(sql).not.toContain('idx_charges_desc_trgm');
    expect(params[0]).toBe('accounter_schema');
    expect(params[1]).toEqual(['gin_trgm_ops', 'gist_trgm_ops']);
  });

  it('coerces bigint byte counts arriving as strings', async () => {
    const query = vi.fn().mockResolvedValue({
      rows: [
        {
          schema: 's',
          index_name: 'i',
          table_name: 't',
          is_valid: false,
          is_ready: false,
          bytes: '9007199254740993',
        },
      ],
    });
    const [index] = await discoverTrigramIndexes({ query } as never, 's');
    expect(typeof index?.bytes).toBe('number');
    expect(index?.isValid).toBe(false);
  });
});

describe('formatBytes', () => {
  it.each([
    [0, '0 B'],
    [512, '512 B'],
    [1024, '1.0 KiB'],
    [32768, '32.0 KiB'],
    [1024 * 1024 * 5, '5.0 MiB'],
    [1024 ** 3 * 2, '2.0 GiB'],
  ])('formats %i as %s', (bytes, expected) => {
    expect(formatBytes(bytes)).toBe(expected);
  });
});

describe('formatDuration', () => {
  it.each([
    [16, '16ms'],
    [1500, '1.5s'],
    [65_000, '1m 5s'],
    [3_600_000, '60m 0s'],
  ])('formats %ims as %s', (ms, expected) => {
    expect(formatDuration(ms)).toBe(expected);
  });
});
