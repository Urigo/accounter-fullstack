import DataLoader from 'dataloader';
import { CONTEXT, Inject, Injectable, Scope } from 'graphql-modules';
import { DBProvider } from '@modules/app-providers/db.provider.js';
import { sql } from '@pgtyped/runtime';
import type { Currency } from '@shared/enums';
import { getCacheInstance } from '@shared/helpers';
import { TimelessDateString } from '@shared/types';
import { validateLedgerRecordParams } from '../helpers/ledger-validation.helper.js';
import type {
  IDeleteLedgerRecordsByChargeIdsQuery,
  IDeleteLedgerRecordsQuery,
  IGetLedgerBalanceToDateQuery,
  IGetLedgerRecordsByChargesIdsQuery,
  IGetLedgerRecordsByDatesParams,
  IGetLedgerRecordsByDatesQuery,
  IGetLedgerRecordsByFinancialEntityIdsQuery,
  IGetLedgerRecordsByIdsQuery,
  IInsertLedgerRecordsParams,
  IInsertLedgerRecordsQuery,
  ILockLedgerRecordsQuery,
  IReplaceLedgerRecordsChargeIdParams,
  IReplaceLedgerRecordsChargeIdQuery,
  IUpdateLedgerRecordParams,
  IUpdateLedgerRecordQuery,
} from '../types.js';

const getLedgerRecordsByIds = sql<IGetLedgerRecordsByIdsQuery>`
SELECT *
FROM accounter_schema.ledger_records
WHERE id IN $$ids
AND owner_id = $ownerId;`;

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

const getLedgerBalanceToDate = sql<IGetLedgerBalanceToDateQuery>`
    WITH grouped_entities AS (SELECT credit_entity1 AS entity_id, credit_local_amount1 AS amount, invoice_date
                              FROM accounter_schema.ledger_records
                              UNION
                              SELECT credit_entity1, credit_local_amount1, invoice_date
                              FROM accounter_schema.ledger_records
                              UNION
                              SELECT debit_entity1, debit_local_amount1 * -1, invoice_date
                              FROM accounter_schema.ledger_records
                              UNION
                              SELECT debit_entity2, debit_local_amount2 * -1, invoice_date
                              FROM accounter_schema.ledger_records)
    SELECT entity_id, sum(amount)
    FROM grouped_entities
    WHERE invoice_date < $date
      AND entity_id IS NOT NULL
    GROUP BY entity_id;`;

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
    $reference,
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
    reference,
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

const replaceLedgerRecordsChargeId = sql<IReplaceLedgerRecordsChargeIdQuery>`
  UPDATE accounter_schema.ledger_records
    SET
    charge_id = $assertChargeID
  WHERE
    charge_id = $replaceChargeID
  RETURNING *
`;

const lockLedgerRecords = sql<ILockLedgerRecordsQuery>`
  UPDATE accounter_schema.ledger_records
    SET
    locked = TRUE
  WHERE
    invoice_date <= $date
    OR value_date <= $date
  RETURNING *
`;

@Injectable({
  scope: Scope.Operation,
  global: true,
})
export class LedgerProvider {
  cache = getCacheInstance({
    stdTTL: 60 * 5,
  });
  adminBusinessId: string;
  localCurrency: Currency;

  constructor(
    @Inject(CONTEXT) private context: GraphQLModules.Context,
    private dbProvider: DBProvider,
  ) {
    this.adminBusinessId = this.context.adminContext.defaultAdminBusinessId;
    this.localCurrency = this.context.adminContext.defaultLocalCurrency;
  }

  private async batchLedgerRecordsByIds(ids: readonly string[]) {
    const ledgerRecords = await getLedgerRecordsByIds.run(
      {
        ids,
        ownerId: this.adminBusinessId,
      },
      this.dbProvider,
    );
    return ids.map(id => ledgerRecords.find(record => record.id === id));
  }

  public getLedgerRecordsByIdLoader = new DataLoader(
    (ledgerIds: readonly string[]) => this.batchLedgerRecordsByIds(ledgerIds),
    {
      cacheKeyFn: key => `ledger-${key}`,
      cacheMap: this.cache,
    },
  );

  private async batchLedgerRecordsByChargesIds(ids: readonly string[]) {
    const ledgerRecords = await getLedgerRecordsByChargesIds.run(
      {
        chargeIds: ids,
        ownerId: this.adminBusinessId,
      },
      this.dbProvider,
    );
    return ids.map(id => ledgerRecords.filter(record => record.charge_id === id));
  }

  public getLedgerRecordsByChargesIdLoader = new DataLoader(
    (keys: readonly string[]) => this.batchLedgerRecordsByChargesIds(keys),
    {
      cacheKeyFn: key => `ledger-by-charge-id-${key}`,
      cacheMap: this.cache,
    },
  );

  private async batchLedgerRecordsByFinancialEntityIds(ids: readonly string[]) {
    const ledgerRecords = await getLedgerRecordsByFinancialEntityIds.run(
      {
        financialEntityIds: ids,
        ownerId: this.adminBusinessId,
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
    {
      cacheKeyFn: key => `ledger-by-financial-entity-id-${key}`,
      cacheMap: this.cache,
    },
  );

  public getLedgerRecordsByDates(params: IGetLedgerRecordsByDatesParams) {
    return getLedgerRecordsByDates.run(
      { ...params, ownerId: params.ownerId ?? this.adminBusinessId },
      this.dbProvider,
    );
  }

  public getLedgerBalanceToDate(date: TimelessDateString) {
    return getLedgerBalanceToDate.run({ date }, this.dbProvider);
  }

  public async updateLedgerRecord(params: IUpdateLedgerRecordParams) {
    // validate non are locked
    if (params.ledgerId) {
      const record = await this.getLedgerRecordsByIdLoader.load(params.ledgerId);
      if (record?.locked) {
        throw new Error('Cannot update locked ledger record');
      }
    }

    this.clearCache();
    return updateLedgerRecord.run(
      { ...params, ownerId: params.ownerId ?? this.adminBusinessId },
      this.dbProvider,
    );
  }

  public async insertLedgerRecords(params: IInsertLedgerRecordsParams) {
    if (params.ledgerRecords.length === 0) return [];

    this.clearCache();
    params.ledgerRecords.map(record => validateLedgerRecordParams(record, this.localCurrency));
    return insertLedgerRecords.run(params, this.dbProvider);
  }

  private async deleteLedgerRecordsByIds(ids: readonly string[]) {
    // validate non are locked
    const records = await this.getLedgerRecordsByIdLoader.loadMany(ids);
    records.map(record => {
      if (record instanceof Error) {
        throw record;
      }
      if (record?.locked) {
        throw new Error('Cannot delete locked ledger record');
      }
    });

    await this.clearCache();
    await deleteLedgerRecords.run(
      {
        ledgerRecordIds: ids,
        ownerId: this.adminBusinessId,
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
    // validate non are locked
    const records = await this.getLedgerRecordsByChargesIdLoader.loadMany(chargeIds);
    records.map(record => {
      if (record instanceof Error) {
        throw record;
      }
      if (record.some(r => r.locked)) {
        throw new Error('Cannot delete locked ledger record');
      }
    });

    this.clearCache();
    await deleteLedgerRecordsByChargeIds.run(
      {
        chargeIds,
        ownerId: this.adminBusinessId,
      },
      this.dbProvider,
    );
    return chargeIds.map(_id => void 0);
  }

  public deleteLedgerRecordsByChargeIdLoader = new DataLoader(
    (chargeIds: readonly string[]) => this.deleteLedgerRecordsByChargeIds(chargeIds),
    { cache: false },
  );

  public replaceLedgerRecordsChargeId(params: IReplaceLedgerRecordsChargeIdParams) {
    this.clearCache();
    return replaceLedgerRecordsChargeId.run(params, this.dbProvider);
  }

  public lockLedgerRecords(date: TimelessDateString) {
    this.clearCache();
    return lockLedgerRecords.run({ date }, this.dbProvider);
  }

  public clearCache() {
    this.cache.clear();
  }
}
