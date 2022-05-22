/** Types generated for queries found in "./src/taxMonthlyReport/monthlyReportPage.ts" */

/** 'monthlyTaxesReportSQL' parameters type */
export interface IMonthlyTaxesReportSqlParams {
  monthTaxReportDate: string | null;
}

/** 'monthlyTaxesReportSQL' return type */
export interface IMonthlyTaxesReportSqlResult {
  invoice_date: string;
  debit_account_1: string;
  debit_amount_1: string;
  foreign_debit_amount_1: string;
  currency: string;
  credit_account_1: string;
  credit_amount_1: string;
  foreign_credit_amount_1: string;
  debit_account_2: string;
  debit_amount_2: string;
  foreign_debit_amount_2: string;
  credit_account_2: string;
  credit_amount_2: string;
  foreign_credit_amount_2: string;
  details: string;
  reference_1: number;
  reference_2: string;
  movement_type: string;
  value_date: string;
  date_3: string;
}

/** 'monthlyTaxesReportSQL' query type */
export interface IMonthlyTaxesReportSqlQuery {
  params: IMonthlyTaxesReportSqlParams;
  result: IMonthlyTaxesReportSqlResult;
}
