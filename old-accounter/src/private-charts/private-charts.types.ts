/** Types generated for queries found in "./src/privateCharts/privateCharts.ts" */

/** 'topPrivateExpensesNotCategorizedSQL' parameters type */
export interface ITopPrivateExpensesNotCategorizedSqlParams {
  startingDate: string | null;
}

/** 'topPrivateExpensesNotCategorizedSQL' return type */
export interface ITopPrivateExpensesNotCategorizedSqlResult {
  amount: number;
  date: Date;
  description: string;
  bank_description: string;
  currency_code: string;
}

/** 'topPrivateExpensesNotCategorizedSQL' query type */
export interface ITopPrivateExpensesNotCategorizedSqlQuery {
  params: ITopPrivateExpensesNotCategorizedSqlParams;
  result: ITopPrivateExpensesNotCategorizedSqlResult;
}
