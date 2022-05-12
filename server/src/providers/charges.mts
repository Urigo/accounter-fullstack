import pgQuery from '@pgtyped/query';
import {
  IGetChargesByFinancialAccountIdsQuery,
  IGetChargesByFinancialEntityIdsQuery,
} from '../__generated__/charges.types.mjs';

const { sql } = pgQuery;

export const getChargesByFinancialAccountIds = sql<IGetChargesByFinancialAccountIdsQuery>`
    SELECT *
    FROM accounter_schema.all_transactions
    WHERE account_number IN $$financialAccountIds
    AND ($fromDate ::TEXT IS NULL OR event_date::TEXT::DATE >= date_trunc('day', $fromDate ::DATE))
    AND ($toDate ::TEXT IS NULL OR event_date::TEXT::DATE <= date_trunc('day', $toDate ::DATE));`;

export const getChargesByFinancialEntityIds = sql<IGetChargesByFinancialEntityIdsQuery>`
    SELECT *
    FROM accounter_schema.all_transactions
    WHERE account_number IN (
      SELECT account_number
      FROM accounter_schema.financial_accounts
      WHERE owner IN $$financialEntityIds
    )
    AND ($fromDate ::TEXT IS NULL OR event_date::TEXT::DATE >= date_trunc('day', $fromDate ::DATE))
    AND ($toDate ::TEXT IS NULL OR event_date::TEXT::DATE <= date_trunc('day', $toDate ::DATE));`;
