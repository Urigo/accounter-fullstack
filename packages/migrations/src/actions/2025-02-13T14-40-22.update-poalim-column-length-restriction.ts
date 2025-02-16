import { type MigrationExecutor } from '../pg-migrator.js';

export default {
  name: '2025-02-13T14-40-22.update-poalim-column-length-restriction.sql',
  run: ({ sql }) => sql`
alter table accounter_schema.poalim_cad_account_transactions
    alter column activity_description type varchar(30) using activity_description::varchar(30);

alter table accounter_schema.poalim_eur_account_transactions
    alter column activity_description type varchar(30) using activity_description::varchar(30);

alter table accounter_schema.poalim_gbp_account_transactions
    alter column activity_description type varchar(30) using activity_description::varchar(30);

alter table accounter_schema.poalim_usd_account_transactions
    alter column activity_description type varchar(30) using activity_description::varchar(30);
`,
} satisfies MigrationExecutor;
