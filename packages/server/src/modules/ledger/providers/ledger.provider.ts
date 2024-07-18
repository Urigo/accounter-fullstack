import DataLoader from 'dataloader';
import { CONTEXT, Inject, Injectable, Scope } from 'graphql-modules';
import { DBProvider } from '@modules/app-providers/db.provider.js';
import { sql } from '@pgtyped/runtime';
import { DEFAULT_FINANCIAL_ENTITY_ID } from '@shared/constants';
import { validateLedgerRecordParams } from '../helpers/ledger-validation.helper.js';
import type {
  IDeleteLedgerRecordsByChargeIdsQuery,
  IDeleteLedgerRecordsQuery,
  IGetLedgerRecordsByChargesIdsQuery,
  IGetLedgerRecordsByDatesParams,
  IGetLedgerRecordsByDatesQuery,
  IGetLedgerRecordsByFinancialEntityIdsQuery,
  IInsertLedgerRecordsParams,
  IInsertLedgerRecordsQuery,
  IUpdateLedgerRecordParams,
  IUpdateLedgerRecordQuery,
} from '../types.js';

const getLedgerRecordsByChargesIds = sql<IGetLedgerRecordsByChargesIdsQuery>`
    SELECT *
    FROM accounter_schema.ledger_records
    WHERE charge_id IN $$chargeIds
    AND owner_id = $ownerId;`;

const getLedgerRecordsByFinancialEntityIds = sql<IGetLedgerRecordsByFinancialEntityIdsQuery>`
    SELECT *
    FROM accounter_schema.ledger_records
    WHERE debit_entity1 IN $$financialEntityIds
      OR debit_entity2 IN $$financialEntityIds
      OR credit_entity1 IN $$financialEntityIds
      OR credit_entity1 IN $$financialEntityIds
      AND owner_id = $ownerId;`;

const getLedgerRecordsByDates = sql<IGetLedgerRecordsByDatesQuery>`
    SELECT *
    FROM accounter_schema.ledger_records
    WHERE invoice_date BETWEEN $fromDate AND $toDate
    AND owner_id = $ownerId;`;

const updateLedgerRecord = sql<IUpdateLedgerRecordQuery>`
  UPDATE accounter_schema.ledger_records
  SET
  charge_id = COALESCE(
    $chargeId,
    charge_id
  ),
  owner_id = COALESCE(
    $ownerId,
    owner_id
  ),
  credit_entity1 = COALESCE(
    $creditEntity1,
    credit_entity1
  ),
  credit_entity2 = COALESCE(
    $creditEntity2,
    credit_entity2
  ),
  credit_foreign_amount1 = COALESCE(
    $creditForeignAmount1,
    credit_foreign_amount1
  ),
  credit_foreign_amount2 = COALESCE(
    $creditForeignAmount2,
    credit_foreign_amount2
  ),
  credit_local_amount1 = COALESCE(
    $creditLocalAmount1,
    credit_local_amount1
  ),
  credit_local_amount2 = COALESCE(
    $creditLocalAmount2,
    credit_local_amount2
  ),
  currency = COALESCE(
    $currency,
    currency
  ),
  debit_entity1 = COALESCE(
    $debitEntity1,
    debit_entity1
  ),
  debit_entity2 = COALESCE(
    $debitEntity2,
    debit_entity2
  ),
  debit_foreign_amount1 = COALESCE(
    $debitForeignAmount1,
    debit_foreign_amount1
  ),
  debit_foreign_amount2 = COALESCE(
    $debitForeignAmount2,
    debit_foreign_amount2
  ),
  debit_local_amount1 = COALESCE(
    $debitLocalAmount1,
    debit_local_amount1
  ),
  debit_local_amount2 = COALESCE(
    $debitLocalAmount2,
    debit_local_amount2
  ),
  description = COALESCE(
    $description,
    description
  ),
  invoice_date = COALESCE(
    $invoiceDate,
    invoice_date
  ),
  reference1 = COALESCE(
    $reference1,
    reference1
  ),
  value_date = COALESCE(
    $valueDate,
    value_date
  )
  WHERE
    id = $ledgerId
    AND owner_id = $ownerId
  RETURNING *;
`;

const insertLedgerRecords = sql<IInsertLedgerRecordsQuery>`
  INSERT INTO accounter_schema.ledger_records (
    charge_id,
    credit_entity1,
    credit_entity2,
    credit_foreign_amount1,
    credit_foreign_amount2,
    credit_local_amount1,
    credit_local_amount2,
    currency,
    debit_entity1,
    debit_entity2,
    debit_foreign_amount1,
    debit_foreign_amount2,
    debit_local_amount1,
    debit_local_amount2,
    description,
    invoice_date,
    owner_id,
    reference1,
    value_date
  )
  VALUES $$ledgerRecords(
    chargeId,
    creditEntity1,
    creditEntity2,
    creditForeignAmount1,
    creditForeignAmount2,
    creditLocalAmount1,
    creditLocalAmount2,
    currency,
    debitEntity1,
    debitEntity2,
    debitForeignAmount1,
    debitForeignAmount2,
    debitLocalAmount1,
    debitLocalAmount2,
    description,
    invoiceDate,
    ownerId,
    reference1,
    valueDate
  )
  RETURNING *;
`;

const deleteLedgerRecords = sql<IDeleteLedgerRecordsQuery>`
  DELETE FROM accounter_schema.ledger_records
  WHERE id IN $$ledgerRecordIds
  AND owner_id = $ownerId;
`;

const deleteLedgerRecordsByChargeIds = sql<IDeleteLedgerRecordsByChargeIdsQuery>`
  DELETE FROM accounter_schema.ledger_records
  WHERE charge_id IN $$chargeIds
  AND owner_id = $ownerId;
`;

@Injectable({
  scope: Scope.Operation,
  global: true,
})
export class LedgerProvider {
  constructor(
    @Inject(CONTEXT) private context: GraphQLModules.GlobalContext,
    private dbProvider: DBProvider,
  ) {}

  private async batchLedgerRecordsByChargesIds(ids: readonly string[]) {
    const ledgerRecords = await getLedgerRecordsByChargesIds.run(
      {
        chargeIds: ids,
        ownerId: DEFAULT_FINANCIAL_ENTITY_ID,
      },
      this.dbProvider,
    );
    return ids.map(id => ledgerRecords.filter(record => record.charge_id === id));
  }

  public getLedgerRecordsByChargesIdLoader = new DataLoader(
    (keys: readonly string[]) => this.batchLedgerRecordsByChargesIds(keys),
    { cache: false },
  );

  private async batchLedgerRecordsByFinancialEntityIds(ids: readonly string[]) {
    const ledgerRecords = await getLedgerRecordsByFinancialEntityIds.run(
      {
        financialEntityIds: ids,
        ownerId: this.context.currentUser.userId,
      },
      this.dbProvider,
    );
    return ids.map(id =>
      ledgerRecords.filter(record =>
        [
          record.debit_entity1,
          record.debit_entity2,
          record.credit_entity1,
          record.credit_entity2,
        ].includes(id),
      ),
    );
  }

  public getLedgerRecordsByFinancialEntityIdLoader = new DataLoader(
    (keys: readonly string[]) => this.batchLedgerRecordsByFinancialEntityIds(keys),
    { cache: false },
  );

  public getLedgerRecordsByDates(params: IGetLedgerRecordsByDatesParams) {
    return getLedgerRecordsByDates.run(
      { ...params, ownerId: params.ownerId ?? this.context.currentUser.userId },
      this.dbProvider,
    );
  }

  public updateLedgerRecord(params: IUpdateLedgerRecordParams) {
    return updateLedgerRecord.run(
      { ...params, ownerId: params.ownerId ?? this.context.currentUser.userId },
      this.dbProvider,
    );
  }

  public async insertLedgerRecords(params: IInsertLedgerRecordsParams) {
    if (params.ledgerRecords.length === 0) return [];

    params.ledgerRecords.map(validateLedgerRecordParams);
    return insertLedgerRecords.run(params, this.dbProvider);
  }

  private async deleteLedgerRecordsByIds(ids: readonly string[]) {
    await deleteLedgerRecords.run(
      {
        ledgerRecordIds: ids,
        ownerId: this.context.currentUser.userId,
      },
      this.dbProvider,
    );
    return ids.map(_id => void 0);
  }

  public deleteLedgerRecordsByIdLoader = new DataLoader(
    (keys: readonly string[]) => this.deleteLedgerRecordsByIds(keys),
    { cache: false },
  );

  private async deleteLedgerRecordsByChargeIds(chargeIds: readonly string[]) {
    await deleteLedgerRecordsByChargeIds.run(
      {
        chargeIds,
        ownerId: this.context.currentUser.userId,
      },
      this.dbProvider,
    );
    return chargeIds.map(_id => void 0);
  }

  public deleteLedgerRecordsByChargeIdLoader = new DataLoader(
    (chargeIds: readonly string[]) => this.deleteLedgerRecordsByChargeIds(chargeIds),
    { cache: false },
  );
}
