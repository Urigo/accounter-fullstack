import type { env } from 'environment.js';
import type { IGetChargesByIdsResult } from '@modules/charges/types.js';
import type { IGetAllTaxCategoriesResult } from '@modules/financial-entities/types.js';
import type { Currency } from '@shared/gql-types';

export type Environment = typeof env;

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
  business: CounterAccountProto;
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

export interface DocumentSuggestionsProto {
  ownerId?: string;
  counterpartyId?: string;
  amount?: {
    amount: string;
    currency: Currency;
  };
  isIncome?: boolean;
}

export type BusinessTransactionProto = {
  amount: number;
  businessID: CounterAccountProto;
  counterAccount?: CounterAccountProto;
  currency: Currency;
  details?: string;
  isCredit: boolean;
  ownerID: string;
  foreignAmount: number;
  date: Date;
  reference1?: string;
  chargeId: string;
};

export type CounterAccountProto = string | IGetAllTaxCategoriesResult;

export * from './ledger.js';
export * from './utils.js';
