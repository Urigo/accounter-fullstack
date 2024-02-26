import { type MigrationExecutor } from '../pg-migrator.js';

export default {
  name: '2024-02-26T11-01-45.centralize-financial-entities-shared-columns.sql',
  run: ({ sql }) => sql`
    alter table accounter_schema.businesses
      drop column name,
      drop column sort_code;
    
    alter table accounter_schema.tax_categories
      drop column name,
      drop column sort_code;
`,
} satisfies MigrationExecutor;
