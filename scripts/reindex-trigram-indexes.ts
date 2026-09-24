/* eslint-disable no-console -- this is an operator-facing CLI; its stdout is the product. */

/**
 * Rebuild every GIN trigram index in the schema, always `CONCURRENTLY`.
 *
 * Why this exists
 * ---------------
 * Postgres 18 changed full-text search and `pg_trgm` to use the cluster's default collation
 * provider instead of always libc. A cluster whose provider is ICU (`datlocprovider = 'i'`)
 * or builtin (`'b'`) must reindex its FTS and `pg_trgm` indexes after `pg_upgrade`; on libc
 * (`'c'`) it is not required but is cheap insurance. The entire charges / transactions /
 * documents / counterparty free-text search is `ILIKE '%…%'` served by these indexes, so
 * getting it wrong means wrong search results, not merely slow ones.
 *
 * Two traps this tool exists to remove:
 *
 * 1. **`CONCURRENTLY` is not optional.** Only `idx_financial_entities_name_trgm` was
 *    originally built concurrently; the rest came from a plain
 *    `CREATE INDEX IF NOT EXISTS` in `2026-03-23T12-00-00.index-search-strings.ts`. A plain
 *    `REINDEX` takes `ACCESS EXCLUSIVE` and would block all writes to `charges`,
 *    `transactions` and `documents` for the duration.
 * 2. **A hardcoded list goes stale.** The set grew from six to seven when
 *    `idx_financial_entities_name_trgm` was added, and a runbook copied before that change
 *    silently skips it. So this discovers the indexes from `pg_index`/`pg_opclass` at
 *    runtime — whatever trigram indexes exist are the ones rebuilt.
 *
 * Usage
 * -----
 *   yarn db:reindex-trgm --dry-run     # list what would be rebuilt, touch nothing
 *   yarn db:reindex-trgm --confirm     # actually rebuild
 *
 * The target comes from `POSTGRES_*`, and running this against a deployed database is the
 * whole point (upgrade day, or a PITR-restored rehearsal server) — so it prints the target
 * and refuses to act without `--confirm`.
 */
import { config } from 'dotenv';
import pg from 'pg';

config();

/** Opclasses that mark an index as a trigram index. */
const TRIGRAM_OPCLASSES = ['gin_trgm_ops', 'gist_trgm_ops'];

export type TrigramIndex = {
  schema: string;
  indexName: string;
  tableName: string;
  isValid: boolean;
  isReady: boolean;
  bytes: number;
};

export type ParsedArgs = {
  schema: string;
  dryRun: boolean;
  confirm: boolean;
  statementTimeoutMs: number;
};

/**
 * Quote an identifier for interpolation. Index and schema names come from the catalog rather
 * than user input, but they still reach a string-built statement — `REINDEX` takes no bind
 * parameters — so quote them properly rather than trusting the source.
 */
export function quoteIdentifier(identifier: string): string {
  return `"${identifier.replace(/"/g, '""')}"`;
}

export function buildReindexStatement(schema: string, indexName: string): string {
  return `REINDEX INDEX CONCURRENTLY ${quoteIdentifier(schema)}.${quoteIdentifier(indexName)}`;
}

export function parseArgs(argv: readonly string[]): ParsedArgs {
  const args = [...argv];
  const getValue = (flag: string): string | undefined => {
    const index = args.indexOf(flag);
    if (index === -1) return undefined;
    return args[index + 1];
  };

  const timeoutRaw = getValue('--statement-timeout-ms');
  const parsedTimeout = timeoutRaw === undefined ? Number.NaN : Number(timeoutRaw);

  return {
    schema: getValue('--schema') ?? process.env.POSTGRES_SCHEMA ?? 'accounter_schema',
    dryRun: args.includes('--dry-run'),
    confirm: args.includes('--confirm'),
    // 0 disables the per-statement timeout. A GIN rebuild on a large table can far exceed
    // the app's 120s default, and being killed part-way leaves an invalid index behind.
    statementTimeoutMs: Number.isFinite(parsedTimeout) ? parsedTimeout : 0,
  };
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KiB', 'MiB', 'GiB', 'TiB'];
  let value = bytes / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(1)} ${units[unitIndex]}`;
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ${Math.round(seconds % 60)}s`;
}

/**
 * Leftovers from a failed `REINDEX INDEX CONCURRENTLY`: Postgres keeps the new index under a
 * `_ccnew` suffix and marks it invalid. The planner ignores them but they consume space and
 * are updated on every write, so they must be cleaned up by hand.
 */
export function isConcurrentLeftover(indexName: string): boolean {
  return /_ccnew\d*$/.test(indexName);
}

const DISCOVER_TRIGRAM_INDEXES = `
  SELECT n.nspname                  AS schema,
         c.relname                  AS index_name,
         t.relname                  AS table_name,
         i.indisvalid               AS is_valid,
         i.indisready               AS is_ready,
         pg_relation_size(c.oid)    AS bytes
  FROM pg_index i
  JOIN pg_class c      ON c.oid = i.indexrelid
  JOIN pg_class t      ON t.oid = i.indrelid
  JOIN pg_namespace n  ON n.oid = c.relnamespace
  JOIN pg_am am        ON am.oid = c.relam
  WHERE n.nspname = $1
    AND EXISTS (
      SELECT 1
      FROM unnest(i.indclass::oid[]) AS ic(oid)
      JOIN pg_opclass oc ON oc.oid = ic.oid
      WHERE oc.opcname = ANY ($2::text[])
    )
  ORDER BY c.relname
`;

export async function discoverTrigramIndexes(
  client: Pick<pg.Client, 'query'>,
  schema: string,
): Promise<TrigramIndex[]> {
  const result = await client.query(DISCOVER_TRIGRAM_INDEXES, [schema, TRIGRAM_OPCLASSES]);
  return result.rows.map(
    (row: {
      schema: string;
      index_name: string;
      table_name: string;
      is_valid: boolean;
      is_ready: boolean;
      bytes: string | number;
    }) => ({
      schema: row.schema,
      indexName: row.index_name,
      tableName: row.table_name,
      isValid: row.is_valid,
      isReady: row.is_ready,
      bytes: Number(row.bytes),
    }),
  );
}

function describeTarget(): string {
  const user = process.env.POSTGRES_USER ?? '<default>';
  const host = process.env.POSTGRES_HOST ?? '<default>';
  const port = process.env.POSTGRES_PORT ?? '5432';
  const db = process.env.POSTGRES_DB ?? '<default>';
  return `${user}@${host}:${port}/${db}`;
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));

  const client = new pg.Client({
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
    host: process.env.POSTGRES_HOST,
    port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
    database: process.env.POSTGRES_DB,
    ssl: process.env.POSTGRES_SSL === '1' ? { rejectUnauthorized: false } : false,
  });

  await client.connect();

  try {
    console.log(`Target:  ${describeTarget()}`);
    console.log(`Schema:  ${options.schema}`);

    // The collation provider decides whether this rebuild is *required* or merely prudent,
    // so report it either way -- it is the first question the runbook asks.
    const provider = await client.query<{
      datname: string;
      datlocprovider: string;
      datcollate: string;
    }>(
      `SELECT datname, datlocprovider, datcollate
       FROM pg_database WHERE datname = current_database()`,
    );
    const locProvider = provider.rows[0]?.datlocprovider;
    const providerLabel =
      locProvider === 'c'
        ? 'libc — reindex not strictly required after pg_upgrade, but cheap insurance'
        : locProvider === 'i'
          ? 'ICU — reindex IS REQUIRED after a pg_upgrade to 18'
          : locProvider === 'b'
            ? 'builtin — reindex IS REQUIRED after a pg_upgrade to 18'
            : `unknown (${String(locProvider)})`;
    console.log(`Collation provider: ${providerLabel}`);

    const version = await client.query<{ server_version: string }>('SHOW server_version');
    console.log(`Server:  Postgres ${version.rows[0]?.server_version ?? 'unknown'}`);
    console.log('');

    const indexes = await discoverTrigramIndexes(client, options.schema);

    if (indexes.length === 0) {
      console.log(
        `No trigram indexes found in "${options.schema}". Nothing to do.\n` +
          '(If that is unexpected, check the schema name and that pg_trgm is installed.)',
      );
      return;
    }

    const leftovers = indexes.filter(index => isConcurrentLeftover(index.indexName));
    const invalid = indexes.filter(
      index => !isConcurrentLeftover(index.indexName) && (!index.isValid || !index.isReady),
    );
    const targets = indexes.filter(index => !isConcurrentLeftover(index.indexName));

    console.log(`Found ${targets.length} trigram index(es):`);
    for (const index of targets) {
      const flags = index.isValid && index.isReady ? '' : '  ⚠️  INVALID';
      console.log(
        `  ${index.indexName.padEnd(38)} ${index.tableName.padEnd(20)} ${formatBytes(index.bytes).padStart(10)}${flags}`,
      );
    }
    console.log('');

    if (leftovers.length > 0) {
      console.warn('⚠️  Leftovers from a previously failed REINDEX CONCURRENTLY:');
      for (const index of leftovers) {
        console.warn(`      ${index.schema}.${index.indexName}`);
      }
      console.warn(
        '    These are ignored by the planner but still maintained on every write.\n' +
          '    Drop them before rebuilding:\n' +
          leftovers
            .map(
              index =>
                `      DROP INDEX CONCURRENTLY IF EXISTS ${quoteIdentifier(index.schema)}.${quoteIdentifier(index.indexName)};`,
            )
            .join('\n'),
      );
      console.warn('');
    }

    if (invalid.length > 0) {
      console.warn(
        `⚠️  ${invalid.length} index(es) are invalid and are being rebuilt — the planner is ignoring them right now.\n`,
      );
    }

    if (options.dryRun || !options.confirm) {
      console.log(
        options.dryRun
          ? 'Dry run — nothing was changed. Statements that would run:'
          : 'No --confirm flag given, so nothing was changed. Statements that would run:',
      );
      for (const index of targets) {
        console.log(`  ${buildReindexStatement(index.schema, index.indexName)};`);
      }
      console.log('');
      console.log(`Re-run with --confirm to rebuild against ${describeTarget()}`);
      return;
    }

    // REINDEX ... CONCURRENTLY cannot run inside a transaction block, so each statement is
    // issued on its own with autocommit. No BEGIN anywhere in this function.
    await client.query(`SET statement_timeout = ${Number(options.statementTimeoutMs)}`);
    console.log(
      options.statementTimeoutMs === 0
        ? 'statement_timeout disabled for this session (a large GIN rebuild can take a while).'
        : `statement_timeout = ${options.statementTimeoutMs}ms`,
    );
    console.log('');

    const started = Date.now();
    const failures: Array<{ index: TrigramIndex; error: unknown }> = [];

    for (const [position, index] of targets.entries()) {
      const label = `[${position + 1}/${targets.length}] ${index.indexName}`;
      const indexStarted = Date.now();
      process.stdout.write(`${label} … `);
      try {
        await client.query(buildReindexStatement(index.schema, index.indexName));
        console.log(`done in ${formatDuration(Date.now() - indexStarted)}`);
      } catch (error) {
        console.log('FAILED');
        console.error(`    ${error instanceof Error ? error.message : String(error)}`);
        failures.push({ index, error });
      }
    }

    console.log('');
    console.log(`Total: ${formatDuration(Date.now() - started)}`);

    // Re-read the catalog rather than trusting the absence of errors: a rebuild that was
    // cancelled or interrupted can leave the index invalid without raising here.
    const after = await discoverTrigramIndexes(client, options.schema);
    const stillInvalid = after.filter(index => !index.isValid || !index.isReady);

    if (stillInvalid.length > 0) {
      console.error('');
      console.error('❌ Indexes still invalid after the run:');
      for (const index of stillInvalid) {
        console.error(`      ${index.schema}.${index.indexName}`);
      }
      console.error(
        '    An invalid index is ignored by the planner — free-text search will fall back\n' +
          '    to sequential scans until this is resolved.',
      );
      process.exitCode = 1;
      return;
    }

    if (failures.length > 0) {
      console.error(`❌ ${failures.length} statement(s) failed; see above.`);
      process.exitCode = 1;
      return;
    }

    console.log('✅ All trigram indexes rebuilt and valid.');
  } finally {
    await client.end();
  }
}

// Only run when executed directly, so the helpers above stay unit-testable.
if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error(error);
    process.exit(1);
  });
}
