import { startOfDay } from 'date-fns';
import { Injector } from 'graphql-modules';
import { IGetChargesByIdsResult } from '@modules/charges/types.js';
import { DEFAULT_FINANCIAL_ENTITY_ID, EMPTY_UUID } from '@shared/constants';
import { formatCurrency } from '@shared/helpers';
import type { LedgerProto } from '@shared/types';
import { LedgerProvider } from '../providers/ledger.provider.js';
import type {
  IGetLedgerRecordsByChargesIdsResult,
  IInsertLedgerRecordsParams,
  IUpdateLedgerRecordParams,
} from '../types.js';

type LedgerRecordInput = IInsertLedgerRecordsParams['ledgerRecords'][number];

const comparisonKeys: Array<keyof IGetLedgerRecordsByChargesIdsResult> = [
  'credit_entity1',
  'credit_entity2',
  'credit_foreign_amount1',
  'credit_foreign_amount2',
  'credit_local_amount1',
  'credit_local_amount2',
  'currency',
  'debit_entity1',
  'debit_entity2',
  'debit_foreign_amount1',
  'debit_foreign_amount2',
  'debit_local_amount1',
  'debit_local_amount2',
  'description',
  'invoice_date',
  'reference1',
  'value_date',
];

const dateKeys: Array<keyof IGetLedgerRecordsByChargesIdsResult> = ['value_date', 'invoice_date'];

export function ledgerRecordsGenerationFullMatchComparison(
  storageRecords: IGetLedgerRecordsByChargesIdsResult[],
  newRecords: readonly IGetLedgerRecordsByChargesIdsResult[],
) {
  // compare existing records with new records
  const unmatchedStorageRecords = [...storageRecords];
  const unmatchedNewRecords: IGetLedgerRecordsByChargesIdsResult[] = [];
  const fullMatches = new Map<number, string | undefined>();
  newRecords.map((newRecord, index) => {
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
  newRecords: IGetLedgerRecordsByChargesIdsResult[],
) {
  const matches = new Map<string, IGetLedgerRecordsByChargesIdsResult>();
  const unmatchedNewRecords = [...newRecords];
  storageRecords.map(storageRecord => {
    let maxScore = 0;
    let bestMatch: IGetLedgerRecordsByChargesIdsResult | undefined = undefined;
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

  const diffs = Array.from(matches.entries()).map(([storageId, newRecord]) => {
    const storageRecord = storageRecords.find(record => record.id === storageId);
    if (!storageRecord) {
      throw new Error('Storage record not found');
    }

    const recordDiffs: IGetLedgerRecordsByChargesIdsResult = {
      ...newRecord,
      id: storageRecord.id,
    };

    return recordDiffs;
  });

  return [
    ...diffs,
    ...unmatchedNewRecords.map(record => ({
      ...record,
      id: EMPTY_UUID,
    })),
  ];
}

function isExactMatch(
  storageRecord: IGetLedgerRecordsByChargesIdsResult,
  newRecord: IGetLedgerRecordsByChargesIdsResult,
): boolean {
  return comparisonKeys.reduce((isMatch, key) => {
    if (!isMatch) {
      return false;
    }

    if (dateKeys.includes(key)) {
      const newDate = newRecord[key] ? startOfDay(new Date(storageRecord[key] as Date)) : undefined;
      return (storageRecord[key] as Date)?.getTime() === newDate?.getTime();
    }

    return storageRecord[key] === newRecord[key];
  }, true as boolean);
}

export function convertToStorageInputRecord(record: LedgerProto): LedgerRecordInput {
  return {
    chargeId: record.chargeId,
    ownerId: record.ownerId ?? DEFAULT_FINANCIAL_ENTITY_ID,
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
  newRecord: IGetLedgerRecordsByChargesIdsResult,
): number {
  return comparisonKeys.reduce((cumulativeScore, key) => {
    const factor = storageRecord[key] ? 1 : 0.5;

    let scoreDirection: number;
    if (dateKeys.includes(key)) {
      scoreDirection =
        (storageRecord[key] as Date)?.getTime() === (newRecord[key] as Date)?.getTime() ? 1 : -1;
    } else {
      scoreDirection = storageRecord[key] === newRecord[key] ? 1 : -1;
    }

    const addedScore = factor * scoreDirection;
    return cumulativeScore + addedScore;
  }, 0);
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

export function convertLedgerRecordToInput(
  record: IGetLedgerRecordsByChargesIdsResult,
): LedgerRecordInput | IUpdateLedgerRecordParams {
  return {
    chargeId: record.charge_id ?? undefined,
    ownerId: record.owner_id ?? DEFAULT_FINANCIAL_ENTITY_ID,
    creditEntity1: record.credit_entity1 ?? undefined,
    creditEntity2: record.credit_entity2 ?? undefined,
    debitEntity1: record.debit_entity1 ?? undefined,
    debitEntity2: record.debit_entity2 ?? undefined,
    creditForeignAmount1: record.credit_foreign_amount1
      ? Number(record.credit_foreign_amount1)
      : undefined,
    creditForeignAmount2: record.credit_foreign_amount2
      ? Number(record.credit_foreign_amount2)
      : undefined,
    debitForeignAmount1: record.debit_foreign_amount1
      ? Number(record.debit_foreign_amount1)
      : undefined,
    debitForeignAmount2: record.debit_foreign_amount2
      ? Number(record.debit_foreign_amount2)
      : undefined,
    creditLocalAmount1: Number(record.credit_local_amount1),
    creditLocalAmount2: record.credit_local_amount2
      ? Number(record.credit_local_amount2)
      : undefined,
    debitLocalAmount1: Number(record.debit_local_amount1),
    debitLocalAmount2: record.debit_local_amount2 ? Number(record.debit_local_amount2) : undefined,
    description: record.description ?? undefined,
    invoiceDate: record.invoice_date,
    reference1: record.reference1 ?? undefined,
    valueDate: record.value_date,
    currency: formatCurrency(record.currency),
    ledgerId: record.id,
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
