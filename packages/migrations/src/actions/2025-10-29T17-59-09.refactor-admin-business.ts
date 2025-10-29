import { type MigrationExecutor } from '../pg-migrator.js';

export default {
  name: '2025-10-29T17-59-09.refactor-admin-business.sql',
  run: ({ sql }) => sql`
ALTER TABLE
  "accounter_schema"."businesses_admin"
ADD COLUMN
  "business_registration_start_date" DATE NULL,
ADD COLUMN
  "company_tax_id" VARCHAR(9) NULL,
ADD COLUMN
  "advance_tax_rates" JSONB[] DEFAULT '{}'::JSONB[] NOT NULL,
ADD COLUMN
  "tax_advances_ids" JSONB[] DEFAULT '{}'::JSONB[] NOT NULL,
ADD COLUMN
  "social_security_employer_ids" JSONB[] DEFAULT '{}'::JSONB[] NOT NULL,
ADD COLUMN
  "withholding_tax_annual_ids" JSONB[] DEFAULT '{}'::JSONB[] NOT NULL;
`,
} satisfies MigrationExecutor;
