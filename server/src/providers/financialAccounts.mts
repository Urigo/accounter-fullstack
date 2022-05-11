import pgQuery from '@pgtyped/query';
import { IGetAccountsByFeIdsQuery } from '../__generated__/financialAccounts.types.mjs';

const { sql } = pgQuery;

export const getAccountsByFeIds = sql<IGetAccountsByFeIdsQuery>`
    SELECT *
    FROM accounter_schema.financial_accounts
    WHERE owner IN $$financialEntityIds;`;
