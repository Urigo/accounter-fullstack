export * from './__generated__/types.js';

type CommentaryProto = {
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
  taxableIncome: number;
  taxRate: number;
  annualTaxExpense: number;
};
