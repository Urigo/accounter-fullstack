import { type MigrationExecutor } from '../pg-migrator.js';

/**
 * Adds `provider_credentials.business_id`: the business entity that represents a provider in the
 * tenant's books (e.g. the Deel business that issues the Deel invoices). It is not a secret, so it
 * lives next to the encrypted payload rather than inside it.
 *
 * The column starts empty; each workspace sets its provider's business in the provider integration
 * settings.
 */
export default {
  name: '2026-10-20T12-00-00.provider-credentials-business-id.sql',
  run: ({ sql }) => sql`
    ALTER TABLE accounter_schema.provider_credentials
      ADD COLUMN IF NOT EXISTS business_id UUID NULL
        REFERENCES accounter_schema.businesses(id) ON DELETE SET NULL;
  `,
} satisfies MigrationExecutor;
