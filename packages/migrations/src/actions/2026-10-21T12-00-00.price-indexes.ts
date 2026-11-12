import { type MigrationExecutor } from '../pg-migrator.js';

/**
 * Global (tenant-independent) store of CBS price indexes, synced by the server from
 * api.cbs.gov.il. Only the consumer price index (code 120010) is synced today; the key is generic
 * so other CBS indexes (e.g. residential construction inputs, 200010) need no schema change.
 *
 * CBS publishes each month once, in the base that was current at the time, and links bases with
 * chain coefficients. `chained_value` is the published value expressed in the oldest base of the
 * series (CBS's calculator "mult" figure), so the change between any two months is a plain ratio
 * of chained values regardless of base changes in between.
 */
export default {
  name: '2026-10-21T12-00-00.price-indexes.sql',
  run: ({ sql }) => sql`
CREATE TABLE IF NOT EXISTS accounter_schema.price_index_bases (
  index_code integer NOT NULL,
  base_label text NOT NULL,
  first_period date NOT NULL CHECK (extract(day FROM first_period) = 1),
  chain_coefficient numeric,
  chained_factor numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (index_code, base_label)
);

COMMENT ON COLUMN accounter_schema.price_index_bases.chain_coefficient IS
  'CBS coefficient linking this base to the previous one; NULL for the oldest base';
COMMENT ON COLUMN accounter_schema.price_index_bases.chained_factor IS
  'Product of chain coefficients down to the oldest base; value * chained_factor = chained value';

CREATE TABLE IF NOT EXISTS accounter_schema.price_index_values (
  index_code integer NOT NULL,
  period date NOT NULL CHECK (extract(day FROM period) = 1),
  value numeric NOT NULL,
  base_label text NOT NULL,
  chained_value numeric NOT NULL,
  monthly_change_pct numeric,
  yearly_change_pct numeric,
  published_on date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (index_code, period),
  FOREIGN KEY (index_code, base_label)
    REFERENCES accounter_schema.price_index_bases (index_code, base_label)
);

COMMENT ON COLUMN accounter_schema.price_index_values.value IS
  'Index value as published by CBS, in base_label';
COMMENT ON COLUMN accounter_schema.price_index_values.published_on IS
  'Publication date; the index is the "known" index from the following day (Income Tax Ordinance s.88)';

CREATE INDEX IF NOT EXISTS price_index_values_published_on_idx
  ON accounter_schema.price_index_values (index_code, published_on);
`,
} satisfies MigrationExecutor;
