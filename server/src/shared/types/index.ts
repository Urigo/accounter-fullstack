import { IGetChargesByIdsResult } from '@modules/charges/types.js';

export type BeneficiaryCounterpartyProto = { counterpartyID: string; percentage: number };
export type CounterpartyProto = string | null;

type CurrencySum = {
  credit: number;
  debit: number;
  total: number;
};

export type RawBusinessTransactionsSum = {
  ils: CurrencySum;
  eur: CurrencySum;
  gbp: CurrencySum;
  usd: CurrencySum;
  businessName: string;
};

type addZero<T> = T | 0;
type oneToFour = 1 | 2 | 3 | 4;
type oneToNine = oneToFour | 5 | 6 | 7 | 8 | 9;
type d = addZero<oneToNine>;
type YYYY = `20${addZero<oneToFour>}${d}`;
type MM = `0${oneToNine}` | `1${0 | 1 | 2}`;
type DD = `${0}${oneToNine}` | `${1 | 2}${d}` | `3${0 | 1}`;

export type TimelessDateString = `${YYYY}-${MM}-${DD}`;

export type OptionalToNullable<O> = {
  [K in keyof O]: undefined extends O[K] ? O[K] | null : O[K];
};
export type Optional<T, Keys extends keyof T> = Omit<T, Keys> &
  OptionalToNullable<Partial<Pick<T, Keys>>>;

export type VatExtendedCharge = IGetChargesByIdsResult & {
  vatAfterDeduction: number;
  amountBeforeVAT: number;
  amountBeforeFullVAT: number;
};

export * from './ledger.js';
