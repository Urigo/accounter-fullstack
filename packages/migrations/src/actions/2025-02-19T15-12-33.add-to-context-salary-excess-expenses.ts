import { type MigrationExecutor } from '../pg-migrator.js';

export default {
  name: '2025-02-19T15-12-33.add-to-context-salary-excess-expenses.sql',
  run: ({ sql }) => sql`
alter table accounter_schema.user_context
    add salary_excess_expenses_tax_category_id uuid;

alter table accounter_schema.user_context
    add constraint user_context_tax_categories_id_fk_37
        foreign key (salary_excess_expenses_tax_category_id) references accounter_schema.tax_categories;

alter table accounter_schema.user_context
    alter column salary_excess_expenses_tax_category_id set not null;
`,
} satisfies MigrationExecutor;
