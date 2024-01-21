import type { LedgerProto } from '@shared/types';
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
      (newRecord.invoiceDate ? new Date(newRecord.invoiceDate).getTime() : undefined) &&
    storageRecord.reference1 === (newRecord.reference1 ?? null) &&
    storageRecord.value_date?.getTime() ===
      (newRecord.valueDate ? new Date(newRecord.valueDate).getTime() : undefined)
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
