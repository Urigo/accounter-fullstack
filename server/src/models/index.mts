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
