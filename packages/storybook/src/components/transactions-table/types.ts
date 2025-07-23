// Standalone types for Transactions Table - recreated without GraphQL dependencies

export const Currency = {
  Ils: 'ILS',
  Usd: 'USD',
  Eur: 'EUR',
  Gbp: 'GBP',
  Jpy: 'JPY',
  Btc: 'BTC',
  Eth: 'ETH',
} as const;

export type Currency = typeof Currency[keyof typeof Currency];

export const AccountType = {
  BankAccount: 'BankAccount',
  CreditCard: 'CreditCard',
  Cash: 'Cash',
  CryptoWallet: 'CryptoWallet',
  Investment: 'Investment',
  Loan: 'Loan',
  Other: 'Other',
} as const;

export type AccountType = typeof AccountType[keyof typeof AccountType];

export interface Amount {
  raw: number;
  formatted: string;
}

export interface Account {
  id: string;
  __typename: string;
  name: string;
  type: AccountType;
}

export interface Business {
  id: string;
  name: string;
}

export interface CryptoExchangeRate {
  rate: number;
}

export interface MissingInfoSuggestions {
  business?: Business;
}

// Base transaction interface
export interface Transaction {
  id: string;
  chargeId?: string | null;
  eventDate?: string | Date | null;
  effectiveDate?: string | Date | null;
  sourceEffectiveDate?: string | Date | null;
  amount?: Amount | null;
  cryptoExchangeRate?: CryptoExchangeRate | null;
  account: Account;
  sourceDescription?: string | null;
  referenceKey?: string | null;
  counterparty?: Business | null;
  missingInfoSuggestions?: MissingInfoSuggestions | null;
  onUpdate: () => void;
  editTransaction: () => void;
  enableEdit?: boolean;
  enableChargeLink?: boolean;
}

export type TransactionsTableRowType = Transaction;

export interface TransactionsTableProps {
  data: TransactionsTableRowType[];
  enableEdit?: boolean;
  enableChargeLink?: boolean;
  onChange?: () => void;
}

// Props for individual cell components
export interface CounterpartyCellProps {
  transaction: TransactionsTableRowType;
  onChange?: () => void;
}

export interface EventDateCellProps {
  transaction: TransactionsTableRowType;
}

export interface DebitDateCellProps {
  transaction: TransactionsTableRowType;
}

export interface AmountCellProps {
  transaction: TransactionsTableRowType;
}

export interface AccountCellProps {
  transaction: TransactionsTableRowType;
}

export interface DescriptionCellProps {
  transaction: TransactionsTableRowType;
}

export interface SourceIdCellProps {
  transaction: TransactionsTableRowType;
}