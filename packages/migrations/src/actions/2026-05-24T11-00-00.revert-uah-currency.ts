import { type MigrationExecutor } from '../pg-migrator.js';

export default {
  name: '2026-05-24T11-00-00.revert-uah-currency.sql',
  run: ({ sql }) => sql`
DO $$
DECLARE
  r         RECORD;
  all_cols  JSONB;
  all_views JSONB;
BEGIN
  -- 1. Drop UAH column from exchange_rates (idempotent)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'accounter_schema'
      AND table_name   = 'exchange_rates'
      AND column_name  = 'uah'
  ) THEN
    ALTER TABLE accounter_schema.exchange_rates DROP COLUMN uah;
  END IF;

  -- 2. Skip the enum work if UAH was never added
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel  = 'UAH'
      AND enumtypid  = 'accounter_schema.currency'::regtype
  ) THEN
    RAISE NOTICE 'UAH not in currency enum – nothing more to do';
    RETURN;
  END IF;

  -- 3. Collect all transitively dependent views (ascending OID = creation order)
  DROP TABLE IF EXISTS _revert_uah_dep_views;
  CREATE TEMP TABLE _revert_uah_dep_views AS
  WITH RECURSIVE dep_chain AS (
    -- Views that directly reference a currency-typed table column
    SELECT DISTINCT cls.oid
    FROM   pg_depend    d
    JOIN   pg_attribute a   ON  a.attrelid = d.refobjid
                            AND a.attnum   = d.refobjsubid
                            AND a.atttypid = 'accounter_schema.currency'::regtype
    JOIN   pg_class     cls ON  cls.oid    = d.objid
                            AND cls.relkind = 'v'
    WHERE  d.deptype      = 'n'
      AND  d.refobjsubid <> 0
    UNION
    -- Views that depend on the currency type itself (e.g. NULL::accounter_schema.currency)
    SELECT DISTINCT cls.oid
    FROM   pg_depend    d
    JOIN   pg_class     cls ON  cls.oid    = d.objid
                            AND cls.relkind = 'v'
    WHERE  d.refobjid  = 'accounter_schema.currency'::regtype
      AND  d.deptype   = 'n'
    UNION
    -- Recursive: views that depend on any already-discovered view
    SELECT cls2.oid
    FROM   dep_chain dc
    JOIN   pg_depend  d2   ON  d2.refobjid  = dc.oid
                            AND d2.deptype  = 'n'
    JOIN   pg_class   cls2 ON  cls2.oid     = d2.objid
                            AND cls2.relkind = 'v'
  )
  SELECT
    dc.oid,
    n.nspname          AS schema_name,
    cls.relname        AS view_name,
    pg_get_viewdef(dc.oid, true) AS view_def
  FROM  dep_chain dc
  JOIN  pg_class     cls ON cls.oid = dc.oid
  JOIN  pg_namespace n   ON n.oid   = cls.relnamespace
  ORDER BY dc.oid;

  SELECT COALESCE(
    array_to_json(array_agg(
      jsonb_build_object('schema', schema_name, 'name', view_name, 'def', view_def)
      ORDER BY oid
    ))::JSONB,
    '[]'::JSONB
  ) INTO all_views FROM _revert_uah_dep_views;

  -- 5. Collect base-table columns typed as accounter_schema.currency
  SELECT COALESCE(
    array_to_json(array_agg(
      jsonb_build_object(
        'schema',  c.table_schema,
        'table',   c.table_name,
        'column',  c.column_name,
        'default', c.column_default
      )
    ))::JSONB,
    '[]'::JSONB
  ) INTO all_cols
  FROM   information_schema.columns c
  JOIN   information_schema.tables  t
         ON  t.table_schema = c.table_schema
         AND t.table_name   = c.table_name
         AND t.table_type   = 'BASE TABLE'
  WHERE  c.udt_schema = 'accounter_schema'
    AND  c.udt_name   = 'currency';

  -- 6. Drop dependent views in reverse creation order (dependents first)
  FOR r IN
    SELECT value
    FROM   jsonb_array_elements(all_views) WITH ORDINALITY AS t(value, ord)
    ORDER  BY ord DESC
  LOOP
    EXECUTE format('DROP VIEW IF EXISTS %I.%I',
      r.value->>'schema', r.value->>'name');
  END LOOP;

  -- 7. Cast currency columns to text (drop defaults first to allow the type change)
  FOR r IN SELECT value FROM jsonb_array_elements(all_cols)
  LOOP
    IF (r.value->>'default') IS NOT NULL THEN
      EXECUTE format('ALTER TABLE %I.%I ALTER COLUMN %I DROP DEFAULT',
        r.value->>'schema', r.value->>'table', r.value->>'column');
    END IF;
    EXECUTE format(
      'ALTER TABLE %I.%I ALTER COLUMN %I TYPE text USING %I::text',
      r.value->>'schema', r.value->>'table', r.value->>'column', r.value->>'column'
    );
  END LOOP;

  -- 8. Recreate the enum without UAH
  DROP TYPE accounter_schema.currency;
  CREATE TYPE accounter_schema.currency AS ENUM (
    'ILS', 'USD', 'EUR', 'GBP', 'USDC', 'GRT', 'ETH', 'JPY', 'AUD', 'SEK', 'CAD'
  );

  -- 9. Restore columns to the new enum type and reinstate defaults
  FOR r IN SELECT value FROM jsonb_array_elements(all_cols)
  LOOP
    EXECUTE format(
      'ALTER TABLE %I.%I ALTER COLUMN %I'
      ' TYPE accounter_schema.currency'
      ' USING %I::accounter_schema.currency',
      r.value->>'schema', r.value->>'table', r.value->>'column', r.value->>'column'
    );
    IF (r.value->>'default') IS NOT NULL THEN
      EXECUTE format('ALTER TABLE %I.%I ALTER COLUMN %I SET DEFAULT %s',
        r.value->>'schema', r.value->>'table', r.value->>'column', r.value->>'default');
    END IF;
  END LOOP;

  -- 10. Recreate views in original creation order (bases before dependents)
  FOR r IN SELECT value FROM jsonb_array_elements(all_views)
  LOOP
    EXECUTE format('CREATE VIEW %I.%I AS %s',
      r.value->>'schema', r.value->>'name', r.value->>'def');
  END LOOP;

  DROP TABLE IF EXISTS _revert_uah_dep_views;
END $$;
`,
} satisfies MigrationExecutor;
