import { type MigrationExecutor } from '../pg-migrator.js';

export default {
  name: '2026-02-18T15-00-00.make-ledger-owner-non-nullable.sql',
  run: ({ sql }) => sql`
    UPDATE accounter_schema.ledger_records l
    SET
      owner_id = (
        SELECT
          c.owner_id
        FROM
          accounter_schema.charges c
        WHERE
          c.id = l.charge_id
      )
    WHERE
      l.owner_id IS NULL
    RETURNING
      l.id,
      l.owner_id;

    ALTER TABLE "accounter_schema"."ledger_records"
    ALTER COLUMN "owner_id"
    SET NOT NULL;
  `,
} satisfies MigrationExecutor;
