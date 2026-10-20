import { sql } from 'slonik';
import { type MigrationExecutor } from '../pg-migrator.js';

/**
 * Adds `provider_credentials.business_id`: the business entity that represents a provider in the
 * tenant's books (e.g. the Deel business that issues the Deel invoices). It is not a secret, so it
 * lives next to the encrypted payload rather than inside it.
 *
 * The Deel business id used to be hard-coded on the server. It is backfilled for the Deel
 * credentials of the tenant that owns that business, so its ledger is unchanged by the deploy.
 * `updated_at` is left as it was — it is shown as the integration's "connected since" date.
 */
export default {
  name: '2026-10-20T12-00-00.provider-credentials-business-id.sql',
  run: async ({ connection }) => {
    await connection.query(sql.unsafe`
      ALTER TABLE accounter_schema.provider_credentials
        ADD COLUMN IF NOT EXISTS business_id UUID NULL
          REFERENCES accounter_schema.businesses(id) ON DELETE SET NULL
    `);

    // The update runs with no tenant session, so FORCE RLS would hide every row from it.
    await connection.query(sql.unsafe`
      ALTER TABLE accounter_schema.provider_credentials NO FORCE ROW LEVEL SECURITY
    `);
    await connection.query(sql.unsafe`
      ALTER TABLE accounter_schema.businesses NO FORCE ROW LEVEL SECURITY
    `);
    await connection.query(sql.unsafe`
      ALTER TABLE accounter_schema.provider_credentials DISABLE TRIGGER set_updated_at
    `);

    await connection.query(sql.unsafe`
      UPDATE accounter_schema.provider_credentials pc
      SET business_id = '8d34f668-7233-4ce3-9c9c-82550b0839ff'
      WHERE pc.provider = 'deel'
        AND pc.business_id IS NULL
        AND EXISTS (
          SELECT 1
          FROM accounter_schema.businesses b
          WHERE b.id = '8d34f668-7233-4ce3-9c9c-82550b0839ff'
            AND b.owner_id = pc.owner_id
        )
    `);

    await connection.query(sql.unsafe`
      ALTER TABLE accounter_schema.provider_credentials ENABLE TRIGGER set_updated_at
    `);
    await connection.query(sql.unsafe`
      ALTER TABLE accounter_schema.businesses FORCE ROW LEVEL SECURITY
    `);
    await connection.query(sql.unsafe`
      ALTER TABLE accounter_schema.provider_credentials FORCE ROW LEVEL SECURITY
    `);
  },
} satisfies MigrationExecutor;
