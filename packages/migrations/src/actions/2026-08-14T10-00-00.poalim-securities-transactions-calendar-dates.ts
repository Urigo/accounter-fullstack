import { type MigrationExecutor } from '../pg-migrator.js';

export default {
  name: '2026-08-14T10-00-00.poalim-securities-transactions-calendar-dates.sql',
  run: ({ sql }) => sql`
    -- accounter_schema.poalim_securities_transactions (created in 2026-08-13T12-00-00) typed
    -- its date columns TIMESTAMPTZ. That is wrong for this source: the bank sends calendar
    -- dates dressed as instants — always midnight, with the Israel offset of that date
    -- (+02:00 in winter, +03:00 in summer) — and nothing downstream wants a time of day.
    --
    -- As TIMESTAMPTZ the stored instant is 22:00 or 21:00 UTC the previous day, so anything
    -- that renders it outside Israel time reports the wrong day: dateToTimelessDateString
    -- formats in local time, so the upload summary showed a trade dated the 15th as the 14th.
    -- Every other poalim_* table already stores these as DATE (event_date, executing_date).
    --
    -- DATE round-trips correctly regardless of server timezone: Postgres takes the literal
    -- date off the bank's string, and node-postgres parses it back to local midnight.
    ALTER TABLE accounter_schema.poalim_securities_transactions
      ALTER COLUMN trade_date           TYPE DATE USING (trade_date           AT TIME ZONE 'Asia/Jerusalem')::date,
      ALTER COLUMN value_date           TYPE DATE USING (value_date           AT TIME ZONE 'Asia/Jerusalem')::date,
      ALTER COLUMN settlement_date      TYPE DATE USING (settlement_date      AT TIME ZONE 'Asia/Jerusalem')::date,
      ALTER COLUMN payment_date         TYPE DATE USING (payment_date         AT TIME ZONE 'Asia/Jerusalem')::date,
      ALTER COLUMN ex_date              TYPE DATE USING (ex_date              AT TIME ZONE 'Asia/Jerusalem')::date,
      ALTER COLUMN cancel_date          TYPE DATE USING (cancel_date          AT TIME ZONE 'Asia/Jerusalem')::date,
      ALTER COLUMN last_tranaction_date TYPE DATE USING (last_tranaction_date AT TIME ZONE 'Asia/Jerusalem')::date,
      ALTER COLUMN execution_date       TYPE DATE USING (execution_date       AT TIME ZONE 'Asia/Jerusalem')::date;

    COMMENT ON COLUMN accounter_schema.poalim_securities_transactions.execution_date IS
      'The bank sends the sentinel 0001-01-01 for executions with no recorded execution date';
  `,
} satisfies MigrationExecutor;
