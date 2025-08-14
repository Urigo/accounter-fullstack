import { type MigrationExecutor } from '../pg-migrator.js';

export default {
  name: '2025-08-13T20-05-23.foreign-securities-support.sql',
  run: ({ sql }) => sql`
alter table accounter_schema.user_context
    add foreign_securities_business_id uuid;

alter table accounter_schema.user_context
    add foreign_securities_fees_category_id uuid;

alter table accounter_schema.user_context
    add constraint user_context_businesses_id_fk_19
        foreign key (foreign_securities_business_id) references accounter_schema.businesses;

alter table accounter_schema.user_context
    add constraint user_context_tax_categories_id_fk_38
        foreign key (foreign_securities_fees_category_id) references accounter_schema.tax_categories;

ALTER TYPE accounter_schema.financial_account_type ADD VALUE 'FOREIGN_SECURITIES';
`,
} satisfies MigrationExecutor;
