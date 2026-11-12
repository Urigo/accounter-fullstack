import { sql } from 'slonik';
import { type MigrationExecutor } from '../pg-migrator.js';

/**
 * Re-key accounter_schema.poalim_securities_transactions (created in 2026-08-13T12-00-00) on the
 * fields the bank never restates, so a re-scraped execution updates its row instead of adding one.
 *
 * The original dedup index included value_date, settlement_date, trade_price and
 * net_value_trade_currency. All four change between an execution's first appearance and its
 * settlement: a fund's price is fixed at end of day, and value/settlement dates move forward as
 * the trade clears (dividends by a day or two, bonds from T+0 to T+n). Each restated scrape
 * therefore missed the ON CONFLICT and inserted a second row, leaving the stale one behind — and
 * the stale row can never pair with its cash leg, since that match runs on value_date and net
 * value.
 *
 * The new identity is the loose key plus `occurrence`: the response carries no per-execution id,
 * so two genuine executions that agree on every key field (same day, security, direction and
 * size) are told apart by an ordinal.
 *
 * Existing duplicates are resolved before the new index is built — see `resolveExecutionGroup`.
 * The resolution deletes a row only when a later version of that same execution is stored; when
 * that cannot be told, both rows are kept as separate executions. The rows are re-scrapable
 * source data, and nothing references them.
 *
 * Index changes:
 *   - DROP unique index poalim_securities_transactions_dedup_uindex (… value_date, settlement_date,
 *     trade_price, net_value_trade_currency …)
 *   - ADD  unique index poalim_securities_transactions_dedup_uindex (loose key, occurrence)
 */

/** One stored row of a loose-key group holding more than one row. */
export type StoredExecution = {
  id: string;
  value_date: string | null;
  settlement_date: string | null;
  last_tranaction_date: string | null;
  trade_price: number | null;
  net_value_trade_currency: number | null;
  /** The uuidv7 timestamp of the id, in ms; null for a pre-uuidv7 (v4) id, which carries none. */
  inserted_at_ms: number | null;
};

/** uuidv7 rows inserted this close together came from one upload. */
const SAME_UPLOAD_WINDOW_MS = 60_000;

/** The dates the bank moves forward as an execution settles. Null sorts first. */
const snapshotOf = (row: StoredExecution) => [
  row.value_date ?? '',
  row.settlement_date ?? '',
  row.last_tranaction_date ?? '',
];

function compareSnapshots(a: StoredExecution, b: StoredExecution) {
  const [x, y] = [snapshotOf(a), snapshotOf(b)];
  for (const [i, value] of x.entries()) {
    const other = y[i]!;
    if (value !== other) return value < other ? -1 : 1;
  }
  return 0;
}

/**
 * Whether `later` can be a restatement of `earlier`: every settlement date is the same or later
 * and at least one moved, and — where both ids carry a timestamp — it was stored by a later
 * upload. Rows with identical dates are never a restatement of one another: one scrape reports
 * each execution once, so they are separate executions (or indistinguishable, and kept).
 */
function canSupersede(later: StoredExecution, earlier: StoredExecution) {
  const [x, y] = [snapshotOf(earlier), snapshotOf(later)];
  if (y.some((value, i) => value < x[i]!) || y.every((value, i) => value === x[i])) {
    return false;
  }
  if (earlier.inserted_at_ms !== null) {
    return (
      later.inserted_at_ms !== null &&
      later.inserted_at_ms - earlier.inserted_at_ms > SAME_UPLOAD_WINDOW_MS
    );
  }
  return true;
}

const gap = (a: number | null, b: number | null) =>
  a === null || b === null ? (a === b ? 0 : Number.POSITIVE_INFINITY) : Math.abs(a - b);

/**
 * Splits one loose-key group into the rows to delete and the ordinals of the rows that stay.
 *
 * Each row may be superseded by at most one later row, and each row supersedes at most one
 * earlier row: a restatement replaces exactly one execution. Pairs are taken greedily, earliest
 * versions first and each to its nearest later version (by snapshot, then price and net value),
 * so a chain of restatements A → A' → A'' collapses to A'', and a later upload that restated only
 * some of a group's executions removes only those — the old uploader skipped unchanged rows, so
 * the newest upload is not a complete picture of the group.
 */
export function resolveExecutionGroup(rows: readonly StoredExecution[]): {
  deleteIds: string[];
  occurrences: Map<string, number>;
} {
  const pairs = rows.flatMap(earlier =>
    rows.filter(later => canSupersede(later, earlier)).map(later => ({ earlier, later })),
  );
  pairs.sort(
    (a, b) =>
      compareSnapshots(a.earlier, b.earlier) ||
      compareSnapshots(a.later, b.later) ||
      gap(a.earlier.trade_price, a.later.trade_price) -
        gap(b.earlier.trade_price, b.later.trade_price) ||
      gap(a.earlier.net_value_trade_currency, a.later.net_value_trade_currency) -
        gap(b.earlier.net_value_trade_currency, b.later.net_value_trade_currency) ||
      a.earlier.id.localeCompare(b.earlier.id) ||
      a.later.id.localeCompare(b.later.id),
  );

  const superseded = new Set<string>();
  const successors = new Set<string>();
  for (const { earlier, later } of pairs) {
    if (superseded.has(earlier.id) || successors.has(later.id)) continue;
    superseded.add(earlier.id);
    successors.add(later.id);
  }

  const survivors = rows
    .filter(row => !superseded.has(row.id))
    .sort(
      (a, b) =>
        (a.trade_price ?? Number.NEGATIVE_INFINITY) - (b.trade_price ?? Number.NEGATIVE_INFINITY) ||
        (a.net_value_trade_currency ?? Number.NEGATIVE_INFINITY) -
          (b.net_value_trade_currency ?? Number.NEGATIVE_INFINITY) ||
        a.id.localeCompare(b.id),
    );

  return {
    deleteIds: [...superseded],
    occurrences: new Map(survivors.map((row, index) => [row.id, index + 1])),
  };
}

export default {
  name: '2026-10-15T14-00-00.poalim-securities-transactions-restatable-dedup.sql',
  run: async ({ connection }) => {
    // The cleanup runs with no tenant session, so FORCE RLS would hide every row from it.
    await connection.query(sql.unsafe`
      ALTER TABLE accounter_schema.poalim_securities_transactions NO FORCE ROW LEVEL SECURITY
    `);

    await connection.query(sql.unsafe`
      ALTER TABLE accounter_schema.poalim_securities_transactions
        ADD COLUMN IF NOT EXISTS occurrence SMALLINT NOT NULL DEFAULT 1
    `);

    await connection.query(sql.unsafe`
      COMMENT ON COLUMN accounter_schema.poalim_securities_transactions.occurrence IS
        'Ordinal (1..n) among executions that share every other dedup-key field. The response has no per-execution id, so this is what keeps two same-day, same-size executions apart'
    `);

    const rows = await connection.any(sql.unsafe`
      SELECT
        grp,
        id::text AS id,
        value_date::text AS value_date,
        settlement_date::text AS settlement_date,
        last_tranaction_date::text AS last_tranaction_date,
        trade_price::float8 AS trade_price,
        net_value_trade_currency::float8 AS net_value_trade_currency,
        CASE
          WHEN uuid_extract_version(id) = 7
            THEN (EXTRACT(EPOCH FROM uuid_extract_timestamp(id)) * 1000)::float8
        END AS inserted_at_ms
      FROM (
        SELECT
          t.*,
          DENSE_RANK() OVER (
            ORDER BY owner_id, bank_number, branch_number, account_number, security, trade_date,
                     trade_type, transaction_type, nv, payment_type, payment_date, ex_date, cancel_date
          )::int AS grp,
          COUNT(*) OVER (
            PARTITION BY owner_id, bank_number, branch_number, account_number, security, trade_date,
                         trade_type, transaction_type, nv, payment_type, payment_date, ex_date, cancel_date
          ) AS group_size
        FROM accounter_schema.poalim_securities_transactions t
      ) keyed
      WHERE group_size > 1
    `);

    const groups = new Map<number, StoredExecution[]>();
    for (const { grp, ...row } of rows as readonly (StoredExecution & { grp: number })[]) {
      groups.set(grp, [...(groups.get(grp) ?? []), row]);
    }

    const deleteIds: string[] = [];
    const renumbered: Array<[string, number]> = [];
    let groupsWithSeveralExecutions = 0;
    for (const group of groups.values()) {
      const resolution = resolveExecutionGroup(group);
      deleteIds.push(...resolution.deleteIds);
      renumbered.push(...[...resolution.occurrences].filter(([, occurrence]) => occurrence !== 1));
      if (resolution.occurrences.size > 1) groupsWithSeveralExecutions += 1;
    }

    if (deleteIds.length > 0) {
      await connection.query(sql.unsafe`
        DELETE FROM accounter_schema.poalim_securities_transactions
        WHERE id = ANY(${sql.array(deleteIds, 'uuid')})
      `);
    }
    if (renumbered.length > 0) {
      await connection.query(sql.unsafe`
        UPDATE accounter_schema.poalim_securities_transactions t
        SET occurrence = r.occurrence
        FROM unnest(
          ${sql.array(
            renumbered.map(([id]) => id),
            'uuid',
          )},
          ${sql.array(
            renumbered.map(([, occurrence]) => occurrence),
            'int4',
          )}
        ) AS r(id, occurrence)
        WHERE t.id = r.id
      `);
    }
    // eslint-disable-next-line no-console
    console.log(
      `Deleted ${deleteIds.length} superseded Poalim securities execution row(s); ` +
        `${groupsWithSeveralExecutions} group(s) kept as several same-key executions.`,
    );

    await connection.query(sql.unsafe`
      DROP INDEX IF EXISTS accounter_schema.poalim_securities_transactions_dedup_uindex
    `);

    // value_date, settlement_date, trade_price and net_value_trade_currency are deliberately out:
    // the bank restates them as an execution settles, and a key that moves is no key. What is left
    // is fixed at execution time; `occurrence` separates executions that agree on all of it.
    // NULLS NOT DISTINCT because the corporate-action columns are null for plain buy/sell rows.
    await connection.query(sql.unsafe`
      CREATE UNIQUE INDEX poalim_securities_transactions_dedup_uindex
        ON accounter_schema.poalim_securities_transactions (
          owner_id,
          bank_number,
          branch_number,
          account_number,
          security,
          trade_date,
          trade_type,
          transaction_type,
          nv,
          payment_type,
          payment_date,
          ex_date,
          cancel_date,
          occurrence
        )
        NULLS NOT DISTINCT
    `);

    await connection.query(sql.unsafe`
      ALTER TABLE accounter_schema.poalim_securities_transactions FORCE ROW LEVEL SECURITY
    `);
  },
} satisfies MigrationExecutor;
