export type {
  DrillDownData,
  DrillDown523Data,
  DrillDown526Data,
  IlsTransaction,
  IlsTransactionsResponse,
  UserData,
  Account,
  CreditCardsResponse,
  CreditCardBillingPeriod,
  CreditCard,
} from './schemas.js';

export type IlsTransactionsRequest = {
  initialRequest: {
    accountNumber: number;
    accountType: number;
    branch: string;
    endDate: string;
    startDate: string;
    order: number;
    language: string;
  };
};

export type CreditCardTransactionsRequest = {
  resourceId: string;
  cardType: number;
  debitDay: number;
  date: TimelessDateString;
};

type addZero<T> = T | 0;
type oneToFour = 1 | 2 | 3 | 4;
type oneToNine = oneToFour | 5 | 6 | 7 | 8 | 9;
type d = addZero<oneToNine>;
type YYYY = `20${addZero<oneToFour>}${d}`;
type MM = `0${oneToNine}` | `1${0 | 1 | 2}`;
type DD = `${0}${oneToNine}` | `${1 | 2}${d}` | `3${0 | 1}`;

export type TimelessDateString = `${YYYY}-${MM}-${DD}`;

export enum Currency {
  Aud = 'AUD',
  Cad = 'CAD',
  Eth = 'ETH',
  Eur = 'EUR',
  Gbp = 'GBP',
  Grt = 'GRT',
  Ils = 'ILS',
  Jpy = 'JPY',
  Sek = 'SEK',
  Usd = 'USD',
  Usdc = 'USDC',
}

export type ForeignAccountMetadata = {
  account: number;
  accountType: string;
  branch: number;
  currency: Currency;
  openingBalance: number;
  subAccount: string;
};

export type ForeignTransaction = {
  balance: number | null;
  valueDate: TimelessDateString;
  credit: number;
  debit: number;
  description: string;
  sp: number | null;
  reference: string;
  depositKey: string | null;
  date: TimelessDateString;
};

export type GroupedForeignTransaction = {
  balance: number | null;
  valueDate: TimelessDateString;
  credit: number;
  debit: number;
  description: string;
  sp: number | null;
  reference: string;
  depositKey: string | null;
  date: TimelessDateString;
  subTransactions: {
    credit: number;
    debit: number;
  }[];
};

export type ForeignAccountData = {
  metadata: ForeignAccountMetadata;
  transactions: GroupedForeignTransaction[];
};
