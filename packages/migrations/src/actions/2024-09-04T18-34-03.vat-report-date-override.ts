import { type MigrationExecutor } from '../pg-migrator.js';

export default {
  name: '2024-09-04T18-34-03.vat-report-date-override.sql',
  run: ({ sql }) => sql`
        alter table accounter_schema.documents
                add vat_report_date_override date;
`,
} satisfies MigrationExecutor;
