import { type MigrationExecutor } from '../pg-migrator.js';

/**
 * SHAAM 6111 settings that the ledger can't supply (issue #5091):
 *
 * - `shaam6111_settings`: per business and tax year, the 6111 header fields (industry code,
 *   business description, business type, audit opinion, …) and manual amounts for tax-adjustment
 *   lines. A header field left unset for a year is taken from the latest earlier year that sets it,
 *   except the audit opinion, which is set every year.
 * - `financial_entities.contra_irs_code`: the 6111 code for a balance on the opposite side of the
 *   entity's usual one (an overdrawn bank account, a VAT refund due, …).
 * - `user_context.donations_tax_category_id`: the tax category whose expenses are donations
 *   (6111 tax-adjustment line 183).
 *
 * RLS follows `2026-10-21T14-00-00.charges-securities-executions`.
 */
export default {
  name: '2026-11-24T12-00-00.shaam-6111-settings.sql',
  run: ({ sql }) => sql`
    CREATE TABLE IF NOT EXISTS accounter_schema.shaam6111_settings (
      owner_id                 UUID        NOT NULL
                               CONSTRAINT shaam6111_settings_owner_id_fk
                                 REFERENCES accounter_schema.businesses (id) ON DELETE CASCADE,
      year                     SMALLINT    NOT NULL,
      header                   JSONB       NOT NULL DEFAULT '{}'::jsonb,
      tax_adjustment_overrides JSONB       NOT NULL DEFAULT '{}'::jsonb,
      created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
      CONSTRAINT shaam6111_settings_pk PRIMARY KEY (owner_id, year)
    );

    COMMENT ON TABLE accounter_schema.shaam6111_settings IS
      'SHAAM 6111 header settings and manual tax-adjustment amounts, per business and tax year';

    DROP TRIGGER IF EXISTS update_shaam6111_settings_updated_at
      ON accounter_schema.shaam6111_settings;
    CREATE TRIGGER update_shaam6111_settings_updated_at
      BEFORE UPDATE
      ON accounter_schema.shaam6111_settings
      FOR EACH ROW
    EXECUTE PROCEDURE accounter_schema.update_general_updated_at();

    ALTER TABLE accounter_schema.shaam6111_settings ENABLE ROW LEVEL SECURITY;
    ALTER TABLE accounter_schema.shaam6111_settings FORCE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS tenant_isolation ON accounter_schema.shaam6111_settings;
    CREATE POLICY tenant_isolation ON accounter_schema.shaam6111_settings
      FOR ALL
      USING (owner_id = ANY (accounter_schema.get_current_business_scope()))
      WITH CHECK (owner_id = accounter_schema.get_current_business_id());

    DROP POLICY IF EXISTS tenant_isolation_delete ON accounter_schema.shaam6111_settings;
    CREATE POLICY tenant_isolation_delete ON accounter_schema.shaam6111_settings
      AS RESTRICTIVE
      FOR DELETE
      USING (owner_id = accounter_schema.get_current_business_id());

    DROP POLICY IF EXISTS tenant_isolation_update ON accounter_schema.shaam6111_settings;
    CREATE POLICY tenant_isolation_update ON accounter_schema.shaam6111_settings
      AS RESTRICTIVE
      FOR UPDATE
      USING (owner_id = accounter_schema.get_current_business_id());

    ALTER TABLE accounter_schema.financial_entities
      ADD COLUMN IF NOT EXISTS contra_irs_code SMALLINT NULL;

    ALTER TABLE accounter_schema.user_context
      ADD COLUMN IF NOT EXISTS donations_tax_category_id UUID NULL
        CONSTRAINT user_context_donations_tax_category_id_fk
          REFERENCES accounter_schema.tax_categories;
  `,
} satisfies MigrationExecutor;
