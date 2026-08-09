import DataLoader from 'dataloader';
import { Injectable, Scope } from 'graphql-modules';
import { sql } from '@pgtyped/runtime';
import { LedgerLockError } from '../../../shared/errors.js';
import { reassureOwnerIdExists } from '../../../shared/helpers/index.js';
import { TimelessDateString } from '../../../shared/types/index.js';
import { AdminContextProvider } from '../../admin-context/providers/admin-context.provider.js';
import { TenantAwareDBClient } from '../../app-providers/tenant-db-client.js';
import { validateLedgerRecordParams } from '../helpers/ledger-validation.helper.js';
import type {
  IDeleteLedgerRecordsByChargeIdsQuery,
  IDeleteLedgerRecordsQuery,
  IGetLedgerBalanceToDateQuery,
  IGetLedgerRecordsByChargesIdsQuery,
  IGetLedgerRecordsByDatesParams,
  IGetLedgerRecordsByDatesQuery,
  IGetLedgerRecordsByFiltersParams,
  IGetLedgerRecordsByFiltersQuery,
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

const getLedgerRecordsByFilters = sql<IGetLedgerRecordsByFiltersQuery>`
    SELECT *
    FROM accounter_schema.ledger_records
    WHERE ($isChargeIds = 0 OR charge_id IN $$chargeIds)
      AND ($isOwnerIds = 0 OR owner_id IN $$ownerIds)
      AND ($isFinancialEntityIds = 0 OR (
            ($matchDebit1 = 1 AND debit_entity1 IN $$financialEntityIds)
         OR ($matchDebit2 = 1 AND debit_entity2 IN $$financialEntityIds)
         OR ($matchCredit1 = 1 AND credit_entity1 IN $$financialEntityIds)
         OR ($matchCredit2 = 1 AND credit_entity2 IN $$financialEntityIds)
      ))
      AND ($fromInvoiceDate::DATE IS NULL OR invoice_date >= $fromInvoiceDate)
      AND ($toInvoiceDate::DATE IS NULL OR invoice_date <= $toInvoiceDate)
      AND ($fromValueDate::DATE IS NULL OR value_date >= $fromValueDate)
      AND ($toValueDate::DATE IS NULL OR value_date <= $toValueDate)
      -- "any date" matches when *either* date falls inside the requested window,
      -- so the two bounds must be applied to the same column rather than mixed
      -- across columns (which would match a record whose invoice date is after
      -- the window and whose value date is before it).
      AND (
        ($fromAnyDate::DATE IS NULL AND $toAnyDate::DATE IS NULL)
        OR (($fromAnyDate::DATE IS NULL OR invoice_date >= $fromAnyDate)
            AND ($toAnyDate::DATE IS NULL OR invoice_date <= $toAnyDate))
        OR (($fromAnyDate::DATE IS NULL OR value_date >= $fromAnyDate)
            AND ($toAnyDate::DATE IS NULL OR value_date <= $toAnyDate))
      )
    ORDER BY invoice_date, value_date, id
    LIMIT $limit;`;

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

/**
 * Fallback cap for a filtered ledger search that names no `limit`. The table is
 * the largest in the schema, so an unbounded read is a foot-gun — a caller that
 * genuinely wants more rows asks for them explicitly.
 */
export const DEFAULT_LEDGER_RECORDS_LIMIT = 10_000;

/** The account slots a ledger record can reference a financial entity in. */
export const LEDGER_RECORD_ACCOUNTS = [
  'DEBIT_ACCOUNT_1',
  'DEBIT_ACCOUNT_2',
  'CREDIT_ACCOUNT_1',
  'CREDIT_ACCOUNT_2',
] as const;

export type LedgerRecordAccount = (typeof LEDGER_RECORD_ACCOUNTS)[number];

/** Caller-facing filters for {@link LedgerProvider.getLedgerRecordsByFilters}. */
export type LedgerRecordsFiltersParams = {
  fromInvoiceDate?: TimelessDateString | null;
  toInvoiceDate?: TimelessDateString | null;
  fromValueDate?: TimelessDateString | null;
  toValueDate?: TimelessDateString | null;
  fromAnyDate?: TimelessDateString | null;
  toAnyDate?: TimelessDateString | null;
  financialEntityIds?: readonly string[] | null;
  financialEntityAccounts?: readonly LedgerRecordAccount[] | null;
  ownerIds?: readonly string[] | null;
  chargeIds?: readonly string[] | null;
  limit?: number | null;
};

@Injectable({
  scope: Scope.Operation,
  global: true,
})
export class LedgerProvider {
  constructor(
    private db: TenantAwareDBClient,
    private adminContextProvider: AdminContextProvider,
  ) {}

  private async batchLedgerRecordsByIds(ids: readonly string[]) {
    const { ownerId } = await this.adminContextProvider.getVerifiedAdminContext();
    const ledgerRecords = await getLedgerRecordsByIds.run(
      {
        ids,
        ownerId,
      },
      this.db,
    );
    return ids.map(id => ledgerRecords.find(record => record.id === id));
  }

  public getLedgerRecordsByIdLoader = new DataLoader((ledgerIds: readonly string[]) =>
    this.batchLedgerRecordsByIds(ledgerIds),
  );

  private async batchLedgerRecordsByChargesIds(ids: readonly string[]) {
    const { ownerId } = await this.adminContextProvider.getVerifiedAdminContext();
    const ledgerRecords = await getLedgerRecordsByChargesIds.run(
      {
        chargeIds: ids,
        ownerId,
      },
      this.db,
    );
    return ids.map(id => ledgerRecords.filter(record => record.charge_id === id));
  }

  public getLedgerRecordsByChargesIdLoader = new DataLoader((keys: readonly string[]) =>
    this.batchLedgerRecordsByChargesIds(keys),
  );

  private async batchLedgerRecordsByFinancialEntityIds(ids: readonly string[]) {
    const { ownerId } = await this.adminContextProvider.getVerifiedAdminContext();
    const ledgerRecords = await getLedgerRecordsByFinancialEntityIds.run(
      {
        financialEntityIds: ids,
        ownerId,
      },
      this.db,
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

  public getLedgerRecordsByFinancialEntityIdLoader = new DataLoader((keys: readonly string[]) =>
    this.batchLedgerRecordsByFinancialEntityIds(keys),
  );
  public async getLedgerRecordsByDates(params: IGetLedgerRecordsByDatesParams) {
    const { ownerId } = await this.adminContextProvider.getVerifiedAdminContext();
    return getLedgerRecordsByDates.run(reassureOwnerIdExists(params, ownerId), this.db);
  }

  public getLedgerRecordsByFilters(params: LedgerRecordsFiltersParams) {
    const isChargeIds = !!params.chargeIds?.filter(Boolean).length;
    const isOwnerIds = !!params.ownerIds?.filter(Boolean).length;
    const isFinancialEntityIds = !!params.financialEntityIds?.filter(Boolean).length;

    // An empty/omitted account list means "any account slot" — narrowing to a
    // subset is opt-in, so an unspecified filter must not silently match nothing.
    const accounts = params.financialEntityAccounts?.length
      ? params.financialEntityAccounts
      : LEDGER_RECORD_ACCOUNTS;

    const fullParams: IGetLedgerRecordsByFiltersParams = {
      isChargeIds: isChargeIds ? 1 : 0,
      isOwnerIds: isOwnerIds ? 1 : 0,
      isFinancialEntityIds: isFinancialEntityIds ? 1 : 0,
      // pgtyped requires a non-empty array for `IN $$list`; the matching `is*`
      // flag short-circuits the predicate, so the placeholder is never compared.
      // Spread rather than pass the caller's readonly arrays straight through:
      // the generated params take mutable arrays.
      chargeIds: isChargeIds ? [...params.chargeIds!] : [null],
      ownerIds: isOwnerIds ? [...params.ownerIds!] : [null],
      financialEntityIds: isFinancialEntityIds ? [...params.financialEntityIds!] : [null],
      matchDebit1: accounts.includes('DEBIT_ACCOUNT_1') ? 1 : 0,
      matchDebit2: accounts.includes('DEBIT_ACCOUNT_2') ? 1 : 0,
      matchCredit1: accounts.includes('CREDIT_ACCOUNT_1') ? 1 : 0,
      matchCredit2: accounts.includes('CREDIT_ACCOUNT_2') ? 1 : 0,
      fromInvoiceDate: params.fromInvoiceDate ?? null,
      toInvoiceDate: params.toInvoiceDate ?? null,
      fromValueDate: params.fromValueDate ?? null,
      toValueDate: params.toValueDate ?? null,
      fromAnyDate: params.fromAnyDate ?? null,
      toAnyDate: params.toAnyDate ?? null,
      limit: params.limit ?? DEFAULT_LEDGER_RECORDS_LIMIT,
    };

    return getLedgerRecordsByFilters.run(fullParams, this.db).then(records => {
      records.map(record => this.getLedgerRecordsByIdLoader.prime(record.id, record));
      return records;
    });
  }

  public getLedgerBalanceToDate(date: TimelessDateString) {
    return getLedgerBalanceToDate.run({ date }, this.db);
  }

  public async updateLedgerRecord(params: IUpdateLedgerRecordParams) {
    // validate non are locked
    if (params.ledgerId) {
      const record = await this.getLedgerRecordsByIdLoader.load(params.ledgerId);
      if (record?.locked) {
        throw new LedgerLockError();
      }
    }

    this.clearCache();
    const { ownerId } = await this.adminContextProvider.getVerifiedAdminContext();
    return updateLedgerRecord.run(reassureOwnerIdExists(params, ownerId), this.db);
  }

  public async insertLedgerRecords(params: IInsertLedgerRecordsParams) {
    if (params.ledgerRecords.length === 0) return [];

    this.clearCache();
    const { defaultLocalCurrency } = await this.adminContextProvider.getVerifiedAdminContext();
    params.ledgerRecords.map(record => validateLedgerRecordParams(record, defaultLocalCurrency));
    return insertLedgerRecords.run(params, this.db);
  }

  private async deleteLedgerRecordsByIds(ids: readonly string[]) {
    // validate non are locked
    const records = await this.getLedgerRecordsByIdLoader.loadMany(ids);
    records.map(record => {
      if (record instanceof Error) {
        throw record;
      }
      if (record?.locked) {
        throw new LedgerLockError();
      }
    });

    this.clearCache();
    const { ownerId } = await this.adminContextProvider.getVerifiedAdminContext();
    await deleteLedgerRecords.run(
      {
        ledgerRecordIds: ids,
        ownerId,
      },
      this.db,
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
        throw new LedgerLockError();
      }
    });

    this.clearCache();
    const { ownerId } = await this.adminContextProvider.getVerifiedAdminContext();
    await deleteLedgerRecordsByChargeIds.run(
      {
        chargeIds,
        ownerId,
      },
      this.db,
    );
    return chargeIds.map(_id => void 0);
  }

  public deleteLedgerRecordsByChargeIdLoader = new DataLoader(
    (chargeIds: readonly string[]) => this.deleteLedgerRecordsByChargeIds(chargeIds),
    { cache: false },
  );

  public replaceLedgerRecordsChargeId(params: IReplaceLedgerRecordsChargeIdParams) {
    this.clearCache();
    return replaceLedgerRecordsChargeId.run(params, this.db);
  }

  public lockLedgerRecords(date: TimelessDateString) {
    this.clearCache();
    return lockLedgerRecords.run({ date }, this.db);
  }

  public clearCache() {
    this.getLedgerRecordsByIdLoader.clearAll();
    this.getLedgerRecordsByChargesIdLoader.clearAll();
    this.getLedgerRecordsByFinancialEntityIdLoader.clearAll();
  }
}
