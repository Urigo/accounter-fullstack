import pgQuery from '@pgtyped/query';
import { IGetFinancialAccountsByFeIdsQuery } from '../__generated__/financialAccounts.types.mjs';

const { sql } = pgQuery;

export const getFinancialAccountsByFeIds = sql<IGetFinancialAccountsByFeIdsQuery>`
    SELECT *
    FROM accounter_schema.financial_accounts
    WHERE owner IN $$financialEntityIds;`;
