import type { IGetTableColumnsResult } from '../__generated__/sql.types.js';

export type * from '../__generated__/sql.types.js';
export type {
  financial_account_type,
  IGetAllFinancialAccountsParams,
  IGetAllFinancialAccountsResult,
  IGetAllFinancialAccountsQuery,
} from '../__generated__/accounts.types.js';
export type * from '../__generated__/currency-rates.types.js';
export type {
  DateOrString,
  NumberOrString,
  IGetPoalimIlsTransactionsParams,
  IGetPoalimIlsTransactionsResult,
  IGetPoalimIlsTransactionsQuery,
  IInsertPoalimIlsTransactionsParams,
  IInsertPoalimIlsTransactionsResult,
  IInsertPoalimIlsTransactionsQuery,
} from '../__generated__/ils-transactions.types.js';
export * from '../__generated__/foreign-transactions.types.js';
export * from '../__generated__/swift-transactions.types.js';
export * from '../__generated__/isracard-amex-month.types.js';
export * from '../__generated__/discount-month.types.js';
export * from '../__generated__/cal-month.types.js';
export * from '../__generated__/max.types.js';

export type FilteredColumns = (Omit<IGetTableColumnsResult, 'column_name' | 'data_type'> & {
  column_name: string;
  data_type: string;
})[];
