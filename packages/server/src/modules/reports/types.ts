import { IGetLedgerRecordsByChargesIdsResult } from '@modules/ledger/types.js';

export * from './__generated__/types.js';

type CommentaryProto = {
  amount: number;
  records: IGetLedgerRecordsByChargesIdsResult[];
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
  taxableIncome: number;
  taxRate: number;
  annualTaxExpense: number;
};
