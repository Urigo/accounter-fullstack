import pgQuery from '@pgtyped/query';
import DataLoader from 'dataloader';
import { pool } from '../providers/db.mjs';
import { IGetLedgerRecordsByChargeIdsQuery, IGetLedgerRecordsByFinancialEntityIdsQuery } from '../__generated__/ledgerRecords.types.mjs';

const { sql } = pgQuery;

const getLedgerRecordsByChargeIds = sql<IGetLedgerRecordsByChargeIdsQuery>`
    SELECT *
    FROM accounter_schema.ledger
    WHERE original_id IN $$chargeIds;`;

async function batchLedgerRecordsByChargeIds(chargeIds: readonly string[]) {
  const ledgerRecords = await getLedgerRecordsByChargeIds.run(
    {
      chargeIds,
    },
    pool
  );
  return chargeIds.map(id => ledgerRecords.filter(record => record.original_id === id));
}

export const getLedgerRecordsByChargeIdLoader = new DataLoader(batchLedgerRecordsByChargeIds, { cache: false });

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

export const insertLedgerRecord = sql<IInsertLedgerRecordQuery>`
    INSERT INTO accounter_schema.ledger (
        invoice_date,
        debit_account_1,
        debit_amount_1,
        foreign_debit_amount_1,
        currency,
        credit_account_1,
        credit_amount_1,
        foreign_credit_amount_1,
        debit_account_2 ,
        debit_amount_2 ,
        foreign_debit_amount_2 ,
        credit_account_2,
        credit_amount_2,
        foreign_credit_amount_2,
        details,
        reference_1,
        reference_2,
        movement_type,
        value_date,
        date_3,
        original_id,
        origin,
        proforma_invoice_file,
        id,
        business)
    VALUES $ledgerRecord
    RETURNING *;`;
