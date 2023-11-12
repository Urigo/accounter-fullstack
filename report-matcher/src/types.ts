import { LedgerForKovetzAchidQuery } from 'gql/graphql';

export type LedgerRecord = Extract<
  LedgerForKovetzAchidQuery['allCharges']['nodes'][number]['ledgerRecords'],
  { records: Array<unknown> }
>['records'][number];

export type SubLedger = Omit<
  LedgerRecord,
  | 'creditAccount1'
  | 'creditAmount1'
  | 'localCurrencyCreditAmount1'
  | 'debitAccount1'
  | 'debitAmount1'
  | 'localCurrencyDebitAmount1'
  | 'creditAccount2'
  | 'creditAmount2'
  | 'localCurrencyCreditAmount2'
  | 'debitAccount2'
  | 'debitAmount2'
  | 'localCurrencyDebitAmount2'
> & {
  account: LedgerRecord['creditAccount1'];
  amount: NonNullable<LedgerRecord['creditAmount1']>['raw'] | null;
  currency: NonNullable<LedgerRecord['creditAmount1']>['currency'] | null;
  localCurrencyAmount: LedgerRecord['localCurrencyCreditAmount1']['raw'] | null;
  isCredit: boolean;
};
