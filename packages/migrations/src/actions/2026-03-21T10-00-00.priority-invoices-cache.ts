import type { MigrationExecutor } from '../pg-migrator.js';

export default {
  name: '2026-03-21T10-00-00.priority-invoices-cache',
  run: ({ sql }) => sql`
    CREATE TABLE IF NOT EXISTS accounter_schema.priority_invoices (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      owner_id UUID NOT NULL REFERENCES accounter_schema.financial_entities(id),
      source_connection_id UUID REFERENCES accounter_schema.source_connections(id) ON DELETE SET NULL,

      -- Priority invoice fields (AINVOICES entity)
      ivnum TEXT NOT NULL,
      ivtype TEXT,
      custname TEXT,
      cust_vatid TEXT,
      curdate TIMESTAMPTZ,
      duedate TIMESTAMPTZ,
      details TEXT,
      currency TEXT,
      net_amount NUMERIC(18, 4),
      vat NUMERIC(18, 4),
      total NUMERIC(18, 4),
      discount NUMERIC(18, 4),
      paid NUMERIC(18, 4),
      balance NUMERIC(18, 4),
      statdes TEXT,

      -- Sync metadata
      synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      raw_json JSONB,

      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

      UNIQUE (owner_id, ivnum)
    );

    CREATE INDEX IF NOT EXISTS idx_priority_invoices_owner
      ON accounter_schema.priority_invoices(owner_id);

    CREATE INDEX IF NOT EXISTS idx_priority_invoices_curdate
      ON accounter_schema.priority_invoices(owner_id, curdate DESC);

    CREATE INDEX IF NOT EXISTS idx_priority_invoices_custname
      ON accounter_schema.priority_invoices(owner_id, custname);
  `,
} satisfies MigrationExecutor;
