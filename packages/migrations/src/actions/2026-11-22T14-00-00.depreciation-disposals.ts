import { type MigrationExecutor } from '../pg-migrator.js';

/**
 * Disposals of depreciated assets: sales, supplier cost refunds and write-offs.
 *
 * A disposal removes `disposed_cost` (local currency, excluding VAT) from one depreciation record,
 * on `disposal_date`, for `proceeds`. Partial disposals are allowed and an asset can have several;
 * the depreciation engine (`depreciation/helpers/asset-depreciation.helper.ts`) derives the slice's
 * accumulated depreciation, net book value and gain or loss, so none of those are stored.
 *
 * - `charge_id` is the charge that carries the money (the sale or the refund); its ledger books the
 *   derecognition. A write-off may have none, and is then booked by the year's depreciation charge.
 *   `ON DELETE RESTRICT`: a charge holding a disposal is not empty, so it is never deleted silently.
 * - The `(owner_id, depreciation_id)` FK, backed by the new `(owner_id, id)` unique constraint on
 *   `depreciation`, keeps a disposal and its asset in the same tenant; deleting the asset deletes its
 *   disposals.
 *
 * RLS is in `2026-11-22T14-30-00.rls-depreciation-disposals.ts`.
 */
export default {
  name: '2026-11-22T14-00-00.depreciation-disposals.sql',
  run: ({ sql }) => sql`
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
                 WHERE t.typname = 'depreciation_disposal_type' AND n.nspname = 'accounter_schema') THEN
    CREATE TYPE accounter_schema.depreciation_disposal_type AS ENUM ('SALE', 'COST_REFUND', 'WRITE_OFF');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'depreciation_owner_id_unique') THEN
    ALTER TABLE accounter_schema.depreciation
      ADD CONSTRAINT depreciation_owner_id_unique UNIQUE (owner_id, id);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS accounter_schema.depreciation_disposals
(
    id              uuid        DEFAULT uuidv7()          NOT NULL
        CONSTRAINT depreciation_disposals_pk PRIMARY KEY,
    owner_id        uuid                                  NOT NULL
        CONSTRAINT depreciation_disposals_owner_id_fk REFERENCES accounter_schema.businesses (id),
    depreciation_id uuid                                  NOT NULL,
    charge_id       uuid
        CONSTRAINT depreciation_disposals_charge_id_fk
            REFERENCES accounter_schema.charges (id) ON DELETE RESTRICT,
    type            accounter_schema.depreciation_disposal_type NOT NULL,
    disposal_date   date                                  NOT NULL,
    disposed_cost   numeric                               NOT NULL
        CONSTRAINT depreciation_disposals_disposed_cost_positive CHECK (disposed_cost > 0),
    proceeds        numeric     DEFAULT 0                 NOT NULL
        CONSTRAINT depreciation_disposals_proceeds_non_negative CHECK (proceeds >= 0),
    description     text,
    created_at      timestamptz DEFAULT clock_timestamp() NOT NULL,
    updated_at      timestamptz DEFAULT clock_timestamp() NOT NULL,
    CONSTRAINT depreciation_disposals_depreciation_fk
        FOREIGN KEY (owner_id, depreciation_id)
            REFERENCES accounter_schema.depreciation (owner_id, id)
            ON DELETE CASCADE
);

COMMENT ON COLUMN accounter_schema.depreciation_disposals.disposed_cost IS
  'Part of the asset cost that leaves the books, local currency, excluding VAT';
COMMENT ON COLUMN accounter_schema.depreciation_disposals.proceeds IS
  'Consideration for the disposed part, local currency, excluding VAT (equals disposed_cost for a cost refund, 0 for a write-off)';

CREATE INDEX IF NOT EXISTS depreciation_disposals_depreciation_id_index
    ON accounter_schema.depreciation_disposals (depreciation_id);
CREATE INDEX IF NOT EXISTS depreciation_disposals_charge_id_index
    ON accounter_schema.depreciation_disposals (charge_id);
CREATE INDEX IF NOT EXISTS depreciation_disposals_disposal_date_index
    ON accounter_schema.depreciation_disposals (disposal_date);
CREATE INDEX IF NOT EXISTS depreciation_disposals_owner_id_index
    ON accounter_schema.depreciation_disposals (owner_id);

ALTER TABLE accounter_schema.user_context
    ADD COLUMN IF NOT EXISTS depreciation_disposal_gain_tax_category_id uuid NULL,
    ADD COLUMN IF NOT EXISTS depreciation_disposal_loss_tax_category_id uuid NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_context_tax_categories_id_fk_40') THEN
    ALTER TABLE accounter_schema.user_context
      ADD CONSTRAINT user_context_tax_categories_id_fk_40
        FOREIGN KEY (depreciation_disposal_gain_tax_category_id)
          REFERENCES accounter_schema.tax_categories (id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_context_tax_categories_id_fk_41') THEN
    ALTER TABLE accounter_schema.user_context
      ADD CONSTRAINT user_context_tax_categories_id_fk_41
        FOREIGN KEY (depreciation_disposal_loss_tax_category_id)
          REFERENCES accounter_schema.tax_categories (id);
  END IF;
END $$;
`,
} satisfies MigrationExecutor;
