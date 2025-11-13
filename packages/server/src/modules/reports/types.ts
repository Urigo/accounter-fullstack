import type { Shaam6111Data } from '@shared/gql-types';

export type { DateOrString, currency } from './__generated__/balance-report.types.js';
export * from './__generated__/types.js';
export * from './__generated__/dynamic-report.types.js';
export * from './__generated__/balance-report.types.js';
export * from './__generated__/vat-report.types.js';
export * from './__generated__/annual-revenue-report.types.js';

export type CommentaryProto = {
  amount: number;
  records: CommentaryRecordProto[];
};

export type CommentaryRecordProto = {
  sortCode: number;
  amount: number;
  records: CommentarySubRecordProto[];
};

export type CommentarySubRecordProto = {
  financialEntityId: string;
  amount: number;
};

export type ProfitAndLossReportYearProto = {
  year: number;
  revenue: CommentaryProto;
  costOfSales: CommentaryProto;
  grossProfit: number;

  researchAndDevelopmentExpenses: CommentaryProto;
  marketingExpenses: CommentaryProto;
  managementAndGeneralExpenses: CommentaryProto;
  operatingProfit: number;

  financialExpenses: CommentaryProto;
  otherIncome: CommentaryProto;

  profitBeforeTax: number;
  tax: number;
  netProfit: number;
};

export type TaxReportYearProto = {
  year: number;
  profitBeforeTax: CommentaryProto;
  researchAndDevelopmentExpensesByRecords: CommentaryProto;
  researchAndDevelopmentExpensesForTax: number;
  fines: CommentaryProto;
  untaxableGifts: CommentaryProto;
  businessTripsExcessExpensesAmount: number;
  salaryExcessExpensesAmount: number;
  reserves: CommentaryProto;
  nontaxableLinkage: CommentaryProto;

  taxableIncome: number;
  taxRate: number;
  specialTaxableIncome: CommentaryProto;
  specialTaxRate: number;
  annualTaxExpense: number;
};

export type Shaam6111ReportProto = {
  reportData: Shaam6111Data;
  businessId: string;
};
