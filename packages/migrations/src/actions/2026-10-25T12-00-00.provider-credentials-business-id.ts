import { type MigrationExecutor } from '../pg-migrator.js';

/**
 * Adds `provider_credentials.business_id`: the business entity that represents a provider in the
 * tenant's books (e.g. the Deel business that issues the Deel invoices). It is not a secret, so it
 * lives next to the encrypted payload rather than inside it.
 *
 * The column starts empty; each workspace sets its provider's business in the provider integration
 * settings.
 *
 * `updated_at` is shown as when the credentials were last updated, so the trigger maintaining it now
 * fires only when the payload changes — not when only the business does. (The upsert sets
 * `updated_at` itself, and re-encryption uses a random IV, so re-saving a token still counts.)
 */
export default {
  name: '2026-10-25T12-00-00.provider-credentials-business-id.sql',
  run: ({ sql }) => sql`
    ALTER TABLE accounter_schema.provider_credentials
      ADD COLUMN IF NOT EXISTS business_id UUID NULL
        REFERENCES accounter_schema.businesses(id) ON DELETE SET NULL;

    DROP TRIGGER IF EXISTS set_updated_at ON accounter_schema.provider_credentials;
    CREATE TRIGGER set_updated_at
      BEFORE UPDATE ON accounter_schema.provider_credentials
      FOR EACH ROW
      WHEN (OLD.payload IS DISTINCT FROM NEW.payload)
      EXECUTE FUNCTION accounter_schema.update_general_updated_at();
  `,
} satisfies MigrationExecutor;
