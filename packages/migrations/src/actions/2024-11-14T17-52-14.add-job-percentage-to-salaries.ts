import { type MigrationExecutor } from '../pg-migrator.js';

export default {
  name: '2024-11-14T17-52-14.add-job-percentage-to-salaries.sql',
  run: ({ sql }) => sql`
    alter table accounter_schema.salaries
        add job_percentage decimal(5, 2) default 100 not null;
`,
} satisfies MigrationExecutor;
