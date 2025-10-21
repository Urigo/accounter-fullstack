import { type MigrationExecutor } from '../pg-migrator.js';

export default {
  name: '2025-10-21T12-45-26.add-financial-entity-activity-flag.sql',
  run: ({ sql }) => sql`
ALTER TABLE "accounter_schema"."financial_entities"
ADD COLUMN "is_active" BOOLEAN DEFAULT TRUE NOT NULL;
`,
} satisfies MigrationExecutor;
