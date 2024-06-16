import { type MigrationExecutor } from '../pg-migrator.js';

export default {
  name: '2024-06-14T10-42-35.onboarding-new-user-adjustments.sql',
  run: ({ sql }) => sql`
    alter table accounter_schema.isracard_creditcard_transactions
      alter column deal_sum type varchar(12) using deal_sum::varchar(12);

    alter table accounter_schema.poalim_ils_account_transactions
      alter column pfm_details type text using pfm_details::text;

    alter table accounter_schema.poalim_ils_account_transactions
      alter column activity_description_include_value_date type varchar(33) using activity_description_include_value_date::varchar(33);

    alter table accounter_schema.poalim_ils_account_transactions
      alter column event_id type bigint using event_id::bigint;

    alter table accounter_schema.poalim_usd_account_transactions
      alter column activity_description type varchar(13) using activity_description::varchar(13);

    alter table accounter_schema.poalim_usd_account_transactions
      alter column url_address type varchar(80) using url_address::varchar(80);

    alter table accounter_schema.financial_accounts
      add product_label text;
`,
} satisfies MigrationExecutor;
