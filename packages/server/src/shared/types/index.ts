import type { YogaInitialContext } from 'graphql-yoga';
import type { IGetChargesByIdsResult } from '@modules/charges/types.js';
import type { Currency, Role } from '@shared/gql-types';
import type { env } from '../../environment.js';

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
  businessId: string;
};

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
  businessId: string;
  counterAccountId?: string;
  currency: Currency;
  details?: string;
  isCredit: boolean;
  ownerID: string;
  foreignAmount: number;
  date: Date;
  reference1?: string;
  chargeId: string;
};

export type AccounterContext = YogaInitialContext & {
  env: Environment;
  session?: {
    role?: Role;
  };
};

type addZero<T> = T | 0;
type oneToFour = 1 | 2 | 3 | 4;
type oneToNine = oneToFour | 5 | 6 | 7 | 8 | 9;
type d = addZero<oneToNine>;
type YYYY = `20${addZero<oneToFour>}${d}`;
type MM = `0${oneToNine}` | `1${0 | 1 | 2}`;
type DD = `${0}${oneToNine}` | `${1 | 2}${d}` | `3${0 | 1}`;

export declare type TimelessDateString = `${YYYY}-${MM}-${DD}`;

export type * from './ledger.js';
export type * from './utils.js';
