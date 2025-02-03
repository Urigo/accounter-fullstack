import type { IGetAllFinancialEntitiesResult } from '@modules/financial-entities/types';
import type { SingleSidedLedgerRecord } from '@shared/gql-types';

export function sortEntityRecordsAndAddBalance(
  openingBalance: number,
  records: (Omit<SingleSidedLedgerRecord, 'balance' | 'counterParty'> & {
    counterParty?: IGetAllFinancialEntitiesResult;
  })[],
): (Omit<SingleSidedLedgerRecord, 'counterParty'> & {
  counterParty?: IGetAllFinancialEntitiesResult;
})[] {
  const sortedRecords = records.sort((a, b) => {
    const diff = a.invoiceDate.getTime() - b.invoiceDate.getTime();
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
