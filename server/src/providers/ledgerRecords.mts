import pgQuery from '@pgtyped/query';
import {
  IGetLedgerRecordsByChargeIdsQuery,
  IGetLedgerRecordsByFinancialAccountIdsQuery,
  IGetLedgerRecordsByFinancialEntityIdsQuery,
} from '../__generated__/ledgerRecords.types.mjs';

const { sql } = pgQuery;

export const getLedgerRecordsByChargeIds = sql<IGetLedgerRecordsByChargeIdsQuery>`
    SELECT *
    FROM accounter_schema.ledger
    WHERE original_id IN $$chargeIds;`;

export const getLedgerRecordsByFinancialAccountIds = sql<IGetLedgerRecordsByFinancialAccountIdsQuery>`
    SELECT *
    FROM accounter_schema.ledger
    WHERE original_id IN (
        SELECT id
        FROM accounter_schema.all_transactions
        WHERE account_number IN $$financialAccountIds
    );`;

export const getLedgerRecordsByFinancialEntityIds = sql<IGetLedgerRecordsByFinancialEntityIdsQuery>`
    SELECT *
    FROM accounter_schema.ledger
    WHERE original_id IN (SELECT id
        FROM accounter_schema.financial_accounts
        WHERE owner IN (
            SELECT id
            FROM accounter_schema.all_transactions
            WHERE account_number IN (
                SELECT account_number
                FROM accounter_schema.financial_accounts
                WHERE owner IN $$financialEntityIds
            )
        )
    );`;
