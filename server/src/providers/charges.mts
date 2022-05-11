import pgQuery from '@pgtyped/query';
import {
  IGetChargesByFinancialAccountIdsQuery,
  IGetChargesByFinancialEntityIdsQuery,
} from '../__generated__/charges.types.mjs';

const { sql } = pgQuery;

export const getChargesByFinancialAccountIds = sql<IGetChargesByFinancialAccountIdsQuery>`
    SELECT *
    FROM accounter_schema.all_transactions
    WHERE account_number IN $$financialAccountIds;`;

export const getChargesByFinancialEntityIds = sql<IGetChargesByFinancialEntityIdsQuery>`
    SELECT *
    FROM accounter_schema.all_transactions
    WHERE account_number IN (
      SELECT account_number
      FROM accounter_schema.financial_accounts
      WHERE owner IN $$financialEntityIds
    );`;
