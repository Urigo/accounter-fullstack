import type { SingleSidedLedgerRecord } from '../../../__generated__/types.js';
import { compareTimelessDates } from '../../../shared/helpers/index.js';
import type { IGetAllFinancialEntitiesResult } from '../../financial-entities/types.js';

export function sortEntityRecordsAndAddBalance(
  openingBalance: number,
  records: (Omit<SingleSidedLedgerRecord, 'balance' | 'counterParty'> & {
    counterParty?: IGetAllFinancialEntitiesResult;
  })[],
): (Omit<SingleSidedLedgerRecord, 'counterParty'> & {
  counterParty?: IGetAllFinancialEntitiesResult;
})[] {
  const sortedRecords = records.sort((a, b) => {
    const diff = compareTimelessDates(a.invoiceDate, b.invoiceDate);
    if (diff === 0) {
      return a.id.localeCompare(b.id);
    }
    return diff;
  });

  let balance = openingBalance;
  const recordsWithBalance: (Omit<SingleSidedLedgerRecord, 'counterParty'> & {
    counterParty?: IGetAllFinancialEntitiesResult;
  })[] = sortedRecords.map(record => {
    balance += record.amount.raw;
    return {
      ...record,
      balance,
    };
  });

  return recordsWithBalance;
}
