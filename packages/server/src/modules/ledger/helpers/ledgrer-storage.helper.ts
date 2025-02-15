import { startOfDay } from 'date-fns';
import { IGetChargesByIdsResult } from '@modules/charges/types.js';
import { EMPTY_UUID } from '@shared/constants';
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

  return {
    toUpdate: [
      ...diffs,
      ...unmatchedNewRecords.map(record => ({
        ...record,
        id: EMPTY_UUID,
      })),
    ],
    toRemove: storageRecords.filter(record => !diffs.find(diff => diff.id === record.id)),
  };
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
      const newDate = newRecord[key] ? startOfDay(new Date(newRecord[key] as Date)) : undefined;
      return (storageRecord[key] as Date)?.getTime() === newDate?.getTime();
    }

    if (typeof storageRecord[key] === 'string' && !Number.isNaN(Number(storageRecord[key]))) {
      return Math.abs(Number(storageRecord[key]) - Number(newRecord[key])) < 0.005;
    }

    return storageRecord[key] === newRecord[key];
  }, true as boolean);
}

export function convertToStorageInputRecord(
  record: LedgerProto,
  context: GraphQLModules.Context,
): LedgerRecordInput {
  return {
    chargeId: record.chargeId,
    ownerId: record.ownerId ?? context.adminContext.defaultAdminBusinessId,
    creditEntity1: record.creditAccountID1,
    creditEntity2: record.creditAccountID2,
    creditForeignAmount1: record.creditAmount1,
    creditForeignAmount2: record.creditAmount2,
    creditLocalAmount1: record.localCurrencyCreditAmount1,
    creditLocalAmount2: record.localCurrencyCreditAmount2,
    currency: record.currency,
    debitEntity1: record.debitAccountID1,
    debitEntity2: record.debitAccountID2,
    debitForeignAmount1: record.debitAmount1,
    debitForeignAmount2: record.debitAmount2,
    debitLocalAmount1: record.localCurrencyDebitAmount1,
    debitLocalAmount2: record.localCurrencyDebitAmount2,
    description: record.description,
    invoiceDate: record.invoiceDate,
    reference: record.reference,
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
  context: GraphQLModules.Context,
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
    reference: record.reference1 ?? undefined,
    valueDate: record.value_date,
    currency: formatCurrency(record.currency),
    isCreditorCounterparty: false, // redundant value
    ownerId: record.owner_id ?? context.adminContext.defaultAdminBusinessId,
    currencyRate: undefined,
    chargeId: record.charge_id,
  };
}

export function convertLedgerRecordToInput(
  record: IGetLedgerRecordsByChargesIdsResult,
  context: GraphQLModules.Context,
): LedgerRecordInput | IUpdateLedgerRecordParams {
  return {
    chargeId: record.charge_id ?? undefined,
    ownerId: record.owner_id ?? context.adminContext.defaultAdminBusinessId,
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
    reference: record.reference1 ?? undefined,
    valueDate: record.value_date,
    currency: formatCurrency(record.currency),
    ledgerId: record.id,
  };
}

export async function storeInitialGeneratedRecords(
  charge: IGetChargesByIdsResult,
  records: LedgerProto[],
  context: GraphQLModules.Context,
) {
  if (!charge.ledger_count || Number(charge.ledger_count) === 0) {
    const ledgerRecords: IInsertLedgerRecordsParams['ledgerRecords'] = records.map(record =>
      convertToStorageInputRecord(record, context),
    );
    if (ledgerRecords.length) {
      return context.injector.get(LedgerProvider).insertLedgerRecords({ ledgerRecords });
    }
  }
  return void 0;
}
