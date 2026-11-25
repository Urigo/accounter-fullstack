import { type MigrationExecutor } from '../pg-migrator.js';

/**
 * Adds `depreciation.asset_tax_category_id`: the asset's own cost account. It defaults to the tax
 * category of the charge that bought the asset, which is wrong when one charge buys several assets
 * (e.g. an acquisition booked through misc expenses, with no charge tax category at all).
 *
 * The foreign key is declared inline on the new column, and no rows are updated: an `ADD
 * CONSTRAINT` validation or an UPDATE runs queries as the migration role, which hit the forced
 * row-level security on this table when that role isn't a superuser.
 */
export default {
  name: '2026-11-24T12-00-00.depreciation-asset-tax-category.sql',
  run: ({ sql }) => sql`
    ALTER TABLE accounter_schema.depreciation
      ADD COLUMN IF NOT EXISTS asset_tax_category_id UUID NULL
        CONSTRAINT depreciation_asset_tax_category_id_fk
          REFERENCES accounter_schema.tax_categories (id);

    COMMENT ON COLUMN accounter_schema.depreciation.asset_tax_category_id IS
      'The asset''s cost account. NULL takes the tax category of the charge that bought the asset; set it when one charge buys several assets';
  `,
} satisfies MigrationExecutor;
