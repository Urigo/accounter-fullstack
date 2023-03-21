import DataLoader from 'dataloader';
import { Injectable, Scope } from 'graphql-modules';
import { DBProvider } from '@modules/app-providers/db.provider.js';
import { sql } from '@pgtyped/runtime';
import type {
  IDeleteLedgerRecordParams,
  IDeleteLedgerRecordQuery,
  IGetLedgerRecordsByChargeIdsQuery,
  IGetLedgerRecordsByFinancialEntityIdsParams,
  IGetLedgerRecordsByFinancialEntityIdsQuery,
  IInsertLedgerRecordsParams,
  IInsertLedgerRecordsQuery,
  IUpdateLedgerRecordParams,
  IUpdateLedgerRecordQuery,
} from '../types.js';

const getLedgerRecordsByChargeIds = sql<IGetLedgerRecordsByChargeIdsQuery>`
    SELECT *
    FROM accounter_schema.ledger
    WHERE original_id IN $$chargeIds;`;

const getLedgerRecordsByFinancialEntityIds = sql<IGetLedgerRecordsByFinancialEntityIdsQuery>`
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

const insertLedgerRecords = sql<IInsertLedgerRecordsQuery>`
    INSERT INTO accounter_schema.ledger (
      business,
      credit_account_id_1,
      credit_account_id_2,
      credit_amount_1,
      credit_amount_2,
      currency,
      date_3,
      debit_account_id_1,
      debit_account_id_2,
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
      creditAccountID1,
      creditAccountID2,
      creditAmount1,
      creditAmount2,
      currency,
      date3,
      debitAccountID1,
      debitAccountID2,
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

const updateLedgerRecord = sql<IUpdateLedgerRecordQuery>`
  UPDATE accounter_schema.ledger
  SET
  business = COALESCE(
    $business,
    business
  ),
  credit_account_id_1 = COALESCE(
    $creditAccountID1,
    credit_account_id_1
  ),
  credit_account_id_2 = COALESCE(
    $creditAccountID2,
    credit_account_id_2
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
  debit_account_id_1 = COALESCE(
    $debitAccountID1,
    debit_account_id_1
  ),
  debit_account_id_2 = COALESCE(
    $debitAccountID2,
    debit_account_id_2
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

const deleteLedgerRecord = sql<IDeleteLedgerRecordQuery>`
  DELETE FROM accounter_schema.ledger
  WHERE id = $ledgerRecordId
  RETURNING id;
`;

@Injectable({
  scope: Scope.Singleton,
  global: true,
})
export class LedgerProvider {
  constructor(private dbProvider: DBProvider) {}

  private async batchLedgerRecordsByChargeIds(chargeIds: readonly string[]) {
    const ledgerRecords = await getLedgerRecordsByChargeIds.run(
      {
        chargeIds,
      },
      this.dbProvider,
    );
    return chargeIds.map(id => ledgerRecords.filter(record => record.original_id === id));
  }

  public getLedgerRecordsByChargeIdLoader = new DataLoader(
    (keys: readonly string[]) => this.batchLedgerRecordsByChargeIds(keys),
    {
      cache: false,
    },
  );

  public getLedgerRecordsByFinancialEntityIds(params: IGetLedgerRecordsByFinancialEntityIdsParams) {
    return getLedgerRecordsByFinancialEntityIds.run(params, this.dbProvider);
  }

  public insertLedgerRecords(params: IInsertLedgerRecordsParams) {
    return insertLedgerRecords.run(params, this.dbProvider);
  }

  public updateLedgerRecord(params: IUpdateLedgerRecordParams) {
    return updateLedgerRecord.run(params, this.dbProvider);
  }

  public deleteLedgerRecord(params: IDeleteLedgerRecordParams) {
    return deleteLedgerRecord.run(params, this.dbProvider);
  }
}
