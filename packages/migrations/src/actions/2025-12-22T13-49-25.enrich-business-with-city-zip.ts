import { type MigrationExecutor } from '../pg-migrator.js';

export default {
  name: '2025-12-22T13-49-25.enrich-business-with-city-zip.sql',
  run: ({ sql }) => sql`
    ALTER TABLE
      "accounter_schema"."businesses"
    ADD COLUMN
      "city" VARCHAR(50) NULL,
    ADD COLUMN
      "zip_code" VARCHAR(15) NULL;
  `,
} satisfies MigrationExecutor;
