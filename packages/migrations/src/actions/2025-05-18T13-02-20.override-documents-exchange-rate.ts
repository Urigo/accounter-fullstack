import { type MigrationExecutor } from '../pg-migrator.js';

export default {
  name: '2025-05-18T13-02-20.override-documents-exchange-rate.sql',
  run: ({ sql }) => sql`
alter table accounter_schema.documents
    add if not exists exchange_rate_override numeric;
    -- This migration adds an exchange rate override column to the documents table
`,
} satisfies MigrationExecutor;
