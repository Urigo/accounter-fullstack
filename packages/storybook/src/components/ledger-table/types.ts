// Standalone types for Ledger Table - recreated without GraphQL dependencies

export const Currency = {
  Ils: 'ILS',
  Usd: 'USD',
  Eur: 'EUR',
  Gbp: 'GBP',
  Jpy: 'JPY',
} as const;

export type Currency = typeof Currency[keyof typeof Currency];

export interface Account {
  __typename: string;
  id: string;
  name: string;
}

export interface Amount {
  formatted: string;
  currency?: Currency;
  raw?: number;
}

export interface LedgerRecord {
  id: string;
  creditAccount1?: Account | null;
  creditAccount2?: Account | null;
  debitAccount1?: Account | null;
  debitAccount2?: Account | null;
  creditAmount1?: Amount | null;
  creditAmount2?: Amount | null;
  debitAmount1?: Amount | null;
  debitAmount2?: Amount | null;
  localCurrencyCreditAmount1?: Amount | null;
  localCurrencyCreditAmount2?: Amount | null;
  localCurrencyDebitAmount1?: Amount | null;
  localCurrencyDebitAmount2?: Amount | null;
  invoiceDate?: Date | string | null;
  valueDate?: Date | string | null;
  description?: string | null;
  reference?: string | null;
}

export type MatchingStatus = 'New' | 'Diff' | 'Deleted';

export interface LedgerRecordRow extends LedgerRecord {
  matchingStatus?: MatchingStatus;
  diff?: LedgerRecord;
}

export interface LedgerValidation {
  matches?: string[] | null;
  differences?: LedgerRecord[] | null;
}

export interface Ledger {
  __typename: string;
  records: LedgerRecord[];
  validate?: LedgerValidation | null;
}

export interface LedgerTableData {
  id: string;
  ledger: Ledger;
}

// Props for individual cell components
export interface AmountCellProps {
  foreignAmount?: {
    formatted: string;
    currency?: string;
  } | null;
  localAmount?: {
    formatted: string;
    raw?: number;
  } | null;
  diff?: {
    foreignAmount?: {
      formatted: string;
      currency?: string;
    } | null;
    localAmount?: {
      formatted: string;
      raw?: number;
    } | null;
  };
}

export interface CounterpartyCellProps {
  account?: {
    name: string;
    id: string;
  } | null;
  diffAccount?: {
    name: string;
    id: string;
  } | null;
}

export interface DateCellProps {
  date?: Date | string | null;
  diff?: Date | string | null;
}

export interface LedgerTableProps {
  data: LedgerRecordRow[];
  onAccountClick?: (accountId: string, accountName: string) => void;
}