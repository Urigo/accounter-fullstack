import { Injector } from 'graphql-modules';
import { IGetChargesByIdsResult } from '@modules/charges/types.js';
import { DEFAULT_FINANCIAL_ENTITY_ID } from '@shared/constants';
import { formatCurrency } from '@shared/helpers';
import type { LedgerProto } from '@shared/types';
import { LedgerProvider } from '../providers/ledger.provider.js';
import type { IGetLedgerRecordsByChargesIdsResult, IInsertLedgerRecordsParams } from '../types.js';

type LedgerRecordInput = IInsertLedgerRecordsParams['ledgerRecords'][number];

export function ledgerRecordsGenerationFullMatchComparison(
  storageRecords: IGetLedgerRecordsByChargesIdsResult[],
  newRecords: readonly LedgerProto[],
) {
  const adjustedNewRecords = newRecords.map(convertToStorageInputRecord);

  // compare existing records with new records
  const unmatchedStorageRecords = [...storageRecords];
  const unmatchedNewRecords: LedgerRecordInput[] = [];
  const fullMatches = new Map<number, string | undefined>();
  adjustedNewRecords.map((newRecord, index) => {
    const matchIndex = unmatchedStorageRecords.findIndex(storageRecord => {
      return isExactMatch(storageRecord, newRecord);
    });
    if (matchIndex !== -1) {
      fullMatches.set(index, unmatchedStorageRecords[matchIndex].id);
      unmatchedStorageRecords.splice(matchIndex, 1);
      return;
    }
    unmatchedNewRecords.push(newRecord);
  });

  return {
    unmatchedStorageRecords,
    unmatchedNewRecords,
    fullMatches,
    isFullyMatched:
      storageRecords.length === newRecords.length && newRecords.length === fullMatches.size,
  };
}

export function ledgerRecordsGenerationPartialMatchComparison(
  storageRecords: IGetLedgerRecordsByChargesIdsResult[],
  newRecords: LedgerRecordInput[],
) {
  const matches = new Map<string, LedgerRecordInput>();
  const unmatchedNewRecords = [...newRecords];
  storageRecords.map(storageRecord => {
    let maxScore = 0;
    let bestMatch: LedgerRecordInput | undefined = undefined;
    unmatchedNewRecords.map(newRecord => {
      const score = getMatchScore(storageRecord, newRecord);
      if (score < 0) {
        return;
      }
      if (score > maxScore) {
        maxScore = score;
        bestMatch = newRecord;
      }
    });

    if (bestMatch) {
      matches.set(storageRecord.id, bestMatch);
      unmatchedNewRecords.splice(unmatchedNewRecords.indexOf(bestMatch), 1);
    }
  });

  return {
    matches,
    unmatchedNewRecords,
  };
}

function getTimelessDate(date: Date | string): Date {
  const timelessDate = new Date(date);
  timelessDate.setHours(0, 0, 0, 0);
  return timelessDate;
}

function isExactMatch(
  storageRecord: IGetLedgerRecordsByChargesIdsResult,
  newRecord: LedgerRecordInput,
): boolean {
  return (
    storageRecord.credit_entity1 === (newRecord.creditEntity1 ?? null) &&
    storageRecord.credit_entity2 === (newRecord.creditEntity2 ?? null) &&
    storageRecord.credit_foreign_amount1 === (newRecord.creditForeignAmount1?.toString() ?? null) &&
    storageRecord.credit_foreign_amount2 === (newRecord.creditForeignAmount2?.toString() ?? null) &&
    storageRecord.credit_local_amount1 === (newRecord.creditLocalAmount1?.toString() ?? null) &&
    storageRecord.credit_local_amount2 === (newRecord.creditLocalAmount2?.toString() ?? null) &&
    storageRecord.currency === (newRecord.currency ?? null) &&
    storageRecord.debit_entity1 === (newRecord.debitEntity1 ?? null) &&
    storageRecord.debit_entity2 === (newRecord.debitEntity2 ?? null) &&
    storageRecord.debit_foreign_amount1 === (newRecord.debitForeignAmount1?.toString() ?? null) &&
    storageRecord.debit_foreign_amount2 === (newRecord.debitForeignAmount2?.toString() ?? null) &&
    storageRecord.debit_local_amount1 === (newRecord.debitLocalAmount1?.toString() ?? null) &&
    storageRecord.debit_local_amount2 === (newRecord.debitLocalAmount2?.toString() ?? null) &&
    storageRecord.description === (newRecord.description ?? null) &&
    storageRecord.invoice_date?.getTime() ===
      (newRecord.invoiceDate ? getTimelessDate(newRecord.invoiceDate).getTime() : undefined) &&
    storageRecord.reference1 === (newRecord.reference1 ?? null) &&
    storageRecord.value_date?.getTime() ===
      (newRecord.valueDate ? getTimelessDate(newRecord.valueDate).getTime() : undefined)
  );
}

export function convertToStorageInputRecord(record: LedgerProto): LedgerRecordInput {
  return {
    chargeId: record.chargeId,
    creditEntity1: record.creditAccountID1
      ? typeof record.creditAccountID1 === 'string'
        ? record.creditAccountID1
        : record.creditAccountID1.id
      : undefined,
    creditEntity2: record.creditAccountID2
      ? typeof record.creditAccountID2 === 'string'
        ? record.creditAccountID2
        : record.creditAccountID2.id
      : undefined,
    creditForeignAmount1: record.creditAmount1,
    creditForeignAmount2: record.creditAmount2,
    creditLocalAmount1: record.localCurrencyCreditAmount1,
    creditLocalAmount2: record.localCurrencyCreditAmount2,
    currency: record.currency,
    debitEntity1: record.debitAccountID1
      ? typeof record.debitAccountID1 === 'string'
        ? record.debitAccountID1
        : record.debitAccountID1.id
      : undefined,
    debitEntity2: record.debitAccountID2
      ? typeof record.debitAccountID2 === 'string'
        ? record.debitAccountID2
        : record.debitAccountID2.id
      : undefined,
    debitForeignAmount1: record.debitAmount1,
    debitForeignAmount2: record.debitAmount2,
    debitLocalAmount1: record.localCurrencyDebitAmount1,
    debitLocalAmount2: record.localCurrencyDebitAmount2,
    description: record.description,
    invoiceDate: record.invoiceDate,
    reference1: record.reference1,
    valueDate: record.valueDate,
  };
}

function getMatchScore(
  storageRecord: IGetLedgerRecordsByChargesIdsResult,
  newRecord: LedgerRecordInput,
): number {
  const scoreParts = [
    (storageRecord.credit_entity1 ? 1 : 0.5) *
      (storageRecord.credit_entity1 === (newRecord.creditEntity1 ?? null) ? 1 : -1),
    (storageRecord.credit_entity2 ? 1 : 0.5) *
      (storageRecord.credit_entity2 === (newRecord.creditEntity2 ?? null) ? 1 : -1),
    (storageRecord.credit_foreign_amount1 ? 1 : 0.5) *
      (storageRecord.credit_foreign_amount1 === (newRecord.creditForeignAmount1?.toString() ?? null)
        ? 1
        : -1),
    (storageRecord.credit_foreign_amount2 ? 1 : 0.5) *
      (storageRecord.credit_foreign_amount2 === (newRecord.creditForeignAmount2?.toString() ?? null)
        ? 1
        : -1),
    (storageRecord.credit_local_amount1 ? 1 : 0.5) *
      (storageRecord.credit_local_amount1 === (newRecord.creditLocalAmount1?.toString() ?? null)
        ? 1
        : -1),
    (storageRecord.credit_local_amount2 ? 1 : 0.5) *
      (storageRecord.credit_local_amount2 === (newRecord.creditLocalAmount2?.toString() ?? null)
        ? 1
        : -1),
    (storageRecord.currency ? 1 : 0.5) *
      (storageRecord.currency === (newRecord.currency ?? null) ? 1 : -1),
    (storageRecord.debit_entity1 ? 1 : 0.5) *
      (storageRecord.debit_entity1 === (newRecord.debitEntity1 ?? null) ? 1 : -1),
    (storageRecord.debit_entity2 ? 1 : 0.5) *
      (storageRecord.debit_entity2 === (newRecord.debitEntity2 ?? null) ? 1 : -1),
    (storageRecord.debit_foreign_amount1 ? 1 : 0.5) *
      (storageRecord.debit_foreign_amount1 === (newRecord.debitForeignAmount1?.toString() ?? null)
        ? 1
        : -1),
    (storageRecord.debit_foreign_amount2 ? 1 : 0.5) *
      (storageRecord.debit_foreign_amount2 === (newRecord.debitForeignAmount2?.toString() ?? null)
        ? 1
        : -1),
    (storageRecord.debit_local_amount1 ? 1 : 0.5) *
      (storageRecord.debit_local_amount1 === (newRecord.debitLocalAmount1?.toString() ?? null)
        ? 1
        : -1),
    (storageRecord.debit_local_amount2 ? 1 : 0.5) *
      (storageRecord.debit_local_amount2 === (newRecord.debitLocalAmount2?.toString() ?? null)
        ? 1
        : -1),
    (storageRecord.description ? 1 : 0.5) *
      (storageRecord.description === (newRecord.description ?? null) ? 1 : -1),
    (storageRecord.invoice_date ? 1 : 0.5) *
      (storageRecord.invoice_date?.getTime() ===
      (newRecord.invoiceDate ? new Date(newRecord.invoiceDate).getTime() : undefined)
        ? 1
        : -1),
    (storageRecord.reference1 ? 1 : 0.5) *
      (storageRecord.reference1 === (newRecord.reference1 ?? null) ? 1 : -1),
    (storageRecord.value_date ? 1 : 0.5) *
      (storageRecord.value_date?.getTime() ===
      (newRecord.valueDate ? new Date(newRecord.valueDate).getTime() : undefined)
        ? 1
        : -1),
  ];
  return scoreParts.reduce((a, b) => a + b, 0);
}

export function convertLedgerRecordToProto(
  record: IGetLedgerRecordsByChargesIdsResult,
): LedgerProto {
  return {
    id: record.id,
    creditAccountID1: record.credit_entity1 ?? undefined,
    creditAccountID2: record.credit_entity2 ?? undefined,
    debitAccountID1: record.debit_entity1 ?? undefined,
    debitAccountID2: record.debit_entity2 ?? undefined,
    creditAmount1: record.credit_foreign_amount1
      ? Number(record.credit_foreign_amount1)
      : undefined,
    creditAmount2: record.credit_foreign_amount2
      ? Number(record.credit_foreign_amount2)
      : undefined,
    debitAmount1: record.debit_foreign_amount1 ? Number(record.debit_foreign_amount1) : undefined,
    debitAmount2: record.debit_foreign_amount2 ? Number(record.debit_foreign_amount2) : undefined,
    localCurrencyCreditAmount1: Number(record.credit_local_amount1),
    localCurrencyCreditAmount2: record.credit_local_amount2
      ? Number(record.credit_local_amount2)
      : undefined,
    localCurrencyDebitAmount1: Number(record.debit_local_amount1),
    localCurrencyDebitAmount2: record.debit_local_amount2
      ? Number(record.debit_local_amount2)
      : undefined,
    description: record.description ?? undefined,
    invoiceDate: record.invoice_date,
    reference1: record.reference1 ?? undefined,
    valueDate: record.value_date,
    currency: formatCurrency(record.currency),
    isCreditorCounterparty: false, // redundant value
    ownerId: record.owner_id ?? DEFAULT_FINANCIAL_ENTITY_ID,
    currencyRate: undefined,
    chargeId: record.charge_id,
  };
}

export async function storeInitialGeneratedRecords(
  charge: IGetChargesByIdsResult,
  records: LedgerProto[],
  injector: Injector,
) {
  if (!charge.ledger_count || Number(charge.ledger_count) === 0) {
    const ledgerRecords: IInsertLedgerRecordsParams['ledgerRecords'] = records.map(
      convertToStorageInputRecord,
    );
    await injector.get(LedgerProvider).insertLedgerRecords({ ledgerRecords });
  }
}
