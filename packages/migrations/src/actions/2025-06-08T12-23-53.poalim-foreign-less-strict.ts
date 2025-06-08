import { type MigrationExecutor } from '../pg-migrator.js';

export default {
  name: '2025-06-08T12-23-53.poalim-foreign-less-strict.sql',
  run: ({ sql }) => sql`
alter table accounter_schema.poalim_eur_account_transactions
    alter column url_address type varchar(80) using url_address::varchar(80);

alter table accounter_schema.poalim_eur_account_transactions
    alter column event_amount type numeric(10, 2) using event_amount::numeric(10, 2);

alter table accounter_schema.poalim_eur_account_transactions
    alter column current_balance type numeric(10, 2) using current_balance::numeric(10, 2);

alter table accounter_schema.poalim_eur_account_transactions
    alter column currency_rate type numeric(10, 7) using currency_rate::numeric(10, 7);

alter table accounter_schema.poalim_gbp_account_transactions
    alter column url_address type varchar(80) using url_address::varchar(80);

alter table accounter_schema.poalim_gbp_account_transactions
    alter column event_amount type numeric(10, 2) using event_amount::numeric(10, 2);

alter table accounter_schema.poalim_gbp_account_transactions
    alter column current_balance type numeric(10, 2) using current_balance::numeric(10, 2);

alter table accounter_schema.poalim_gbp_account_transactions
    alter column currency_rate type numeric(10, 7) using currency_rate::numeric(10, 7);

alter table accounter_schema.poalim_cad_account_transactions
    alter column currency_rate type numeric(10, 7) using currency_rate::numeric(10, 7);

alter table accounter_schema.poalim_usd_account_transactions
    alter column currency_rate type numeric(10, 7) using currency_rate::numeric(10, 7);
`,
} satisfies MigrationExecutor;
