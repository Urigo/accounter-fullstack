import pgQuery from '@pgtyped/query';
import DataLoader from 'dataloader';
import {
  IDeleteLedgerRecordQuery,
  IGetLedgerRecordsByChargeIdsQuery,
  IGetLedgerRecordsByFinancialEntityIdsQuery,
  IInsertLedgerRecordsQuery,
  IUpdateLedgerRecordQuery,
} from '../__generated__/ledger-records.types.mjs';
import { pool } from './db.mjs';

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
    pool,
  );
  return chargeIds.map(id => ledgerRecords.filter(record => record.original_id === id));
}

export const getLedgerRecordsByChargeIdLoader = new DataLoader(batchLedgerRecordsByChargeIds, {
  cache: false,
});

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

export const insertLedgerRecords = sql<IInsertLedgerRecordsQuery>`
    INSERT INTO accounter_schema.ledger (
      business,
      credit_account_1,
      credit_account_2,
      credit_amount_1,
      credit_amount_2,
      currency,
      date_3,
      debit_account_1,
      debit_account_2,
      debit_amount_1,
      debit_amount_2,
      details,
      foreign_credit_amount_1,
      foreign_credit_amount_2,
      foreign_debit_amount_1,
      foreign_debit_amount_2,
      hashavshevet_id,
      invoice_date,
      movement_type,
      origin,
      original_id,
      proforma_invoice_file,
      reference_1,
      reference_2,
      reviewed,
      value_date
    )
    VALUES $$ledgerRecord(
      business,
      creditAccount1,
      creditAccount2,
      creditAmount1,
      creditAmount2,
      currency,
      date3,
      debitAccount1,
      debitAccount2,
      debitAmount1,
      debitAmount2,
      details,
      foreignCreditAmount1,
      foreignCreditAmount2,
      foreignDebitAmount1,
      foreignDebitAmount2,
      hashavshevetId,
      invoiceDate,
      movementType,
      origin,
      originalId,
      proformaInvoiceFile,
      reference1,
      reference2,
      reviewed,
      valueDate
    )
    RETURNING *;`;

export const updateLedgerRecord = sql<IUpdateLedgerRecordQuery>`
  UPDATE accounter_schema.ledger
  SET
  business = COALESCE(
    $business,
    business
  ),
  credit_account_1 = COALESCE(
    $creditAccount1,
    credit_account_1
  ),
  credit_account_2 = COALESCE(
    $creditAccount2,
    credit_account_2
  ),
  credit_amount_1 = COALESCE(
    $creditAmount1,
    credit_amount_1
  ),
  credit_amount_2 = COALESCE(
    $creditAmount2,
    credit_amount_2
  ),
  currency = COALESCE(
    $currency,
    currency
  ),
  date_3 = COALESCE(
    $date3,
    date_3
  ),
  debit_account_1 = COALESCE(
    $debitAccount1,
    debit_account_1
  ),
  debit_account_2 = COALESCE(
    $debitAccount2,
    debit_account_2
  ),
  debit_amount_1 = COALESCE(
    $debitAmount1,
    debit_amount_1
  ),
  debit_amount_2 = COALESCE(
    $debitAmount2,
    debit_amount_2
  ),
  details = COALESCE(
    $details,
    details
  ),
  foreign_credit_amount_1 = COALESCE(
    $foreignCreditAmount1,
    foreign_credit_amount_1
  ),
  foreign_credit_amount_2 = COALESCE(
    $foreignCreditAmount2,
    foreign_credit_amount_2
  ),
  foreign_debit_amount_1 = COALESCE(
    $foreignDebitAmount1,
    foreign_debit_amount_1
  ),
  foreign_debit_amount_2 = COALESCE(
    $foreignDebitAmount2,
    foreign_debit_amount_2
  ),
  hashavshevet_id = COALESCE(
    $hashavshevetId,
    hashavshevet_id
  ),
  invoice_date = COALESCE(
    $invoiceDate,
    invoice_date
  ),
  movement_type = COALESCE(
    $movementType,
    movement_type
  ),
  origin = COALESCE(
    $origin,
    origin
  ),
  original_id = COALESCE(
    $originalId,
    original_id
  ),
  proforma_invoice_file = COALESCE(
    $proformaInvoiceFile,
    proforma_invoice_file
  ),
  reference_1 = COALESCE(
    $reference1,
    reference_1
  ),
  reference_2 = COALESCE(
    $reference2,
    reference_2
  ),
  reviewed = COALESCE(
    $reviewed,
    reviewed
  ),
  value_date = COALESCE(
    $valueDate,
    value_date
  )
  WHERE
    id = $ledgerRecordId
  RETURNING *;
`;

export const deleteLedgerRecord = sql<IDeleteLedgerRecordQuery>`
  DELETE FROM accounter_schema.ledger
  WHERE id = $ledgerRecordId
  RETURNING id;
`;
