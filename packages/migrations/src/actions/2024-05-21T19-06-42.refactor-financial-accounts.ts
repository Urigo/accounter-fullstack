import { type MigrationExecutor } from '../pg-migrator.js';

export default {
  name: '2024-05-21T19-06-42.refactor-financial-accounts.sql',
  run: ({ sql }) => sql`
    create table accounter_schema.financial_accounts_tax_categories
    (
        financial_account_id uuid                      not null
            constraint financial_accounts_tax_categories_financial_accounts_id_fk
                references accounter_schema.financial_accounts,
        currency             accounter_schema.currency not null,
        tax_category_id      uuid                      not null
            constraint financial_accounts_tax_categories_tax_categories_id_fk
                references accounter_schema.tax_categories,
        constraint financial_accounts_tax_categories_pk
            primary key (financial_account_id, currency)
    );

    alter table accounter_schema.financial_accounts
        drop column hashavshevet_account_ils;

    alter table accounter_schema.financial_accounts
        drop column hashavshevet_account_usd;

    alter table accounter_schema.financial_accounts
        drop column hashavshevet_account_eur;

    alter table accounter_schema.financial_accounts
        drop column hashavshevet_account_gbp;
`,
} satisfies MigrationExecutor;
