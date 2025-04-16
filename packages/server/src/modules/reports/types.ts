export * from './__generated__/types.js';
export * from './__generated__/dynamic-report.types.js';
export * from './__generated__/balance-report.types.js';

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
  annualTaxExpense: number;
};
