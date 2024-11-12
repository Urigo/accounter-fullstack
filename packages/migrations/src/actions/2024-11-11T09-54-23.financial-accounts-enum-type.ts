import { type MigrationExecutor } from '../pg-migrator.js';

export default {
  name: '2024-11-11T09-54-23.financial-accounts-enum-type.sql',
  run: ({ sql }) => sql`
    UPDATE accounter_schema.financial_accounts
    SET type = 'BANK_ACCOUNT'
    WHERE type = 'bank';

    UPDATE accounter_schema.financial_accounts
    SET type = 'CREDIT_CARD'
    WHERE type = 'creditcard';

    UPDATE accounter_schema.financial_accounts
    SET type = 'CRYPTO_WALLET'
    WHERE type = 'crypto';

    CREATE TYPE accounter_schema.financial_account_type as enum ('BANK_ACCOUNT', 'CREDIT_CARD', 'CRYPTO_WALLET');

    ALTER TABLE accounter_schema.financial_accounts
        ALTER COLUMN type TYPE accounter_schema.financial_account_type USING type::accounter_schema.financial_account_type;
`,
} satisfies MigrationExecutor;
