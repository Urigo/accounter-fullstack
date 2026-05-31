import { type MigrationExecutor } from '../pg-migrator.js';

export default {
  name: '2026-05-28T10-00-00.add-otsar-hahayal-to-user-context.sql',
  run: ({ sql }) => sql`
    alter table accounter_schema.user_context
        add column if not exists otsar_hahayal_business_id uuid
            constraint user_context_businesses_id_fk_20
                references accounter_schema.businesses,
        add column if not exists otsar_hahayal_credit_card_business_id uuid
            constraint user_context_businesses_id_fk_21
                references accounter_schema.businesses;
  `,
} satisfies MigrationExecutor;
