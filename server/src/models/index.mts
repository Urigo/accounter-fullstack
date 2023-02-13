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
