/** Types generated for queries found in "./src/taxMonthlyReport/monthlyReportPage.ts" */

/** 'monthlyTaxesReportSQL' parameters type */
export interface IMonthlyTaxesReportSqlParams {
  monthTaxReportDate: string | null;
}

/** 'monthlyTaxesReportSQL' return type */
export interface IMonthlyTaxesReportSqlResult {
  תאריך_חשבונית: string;
  חשבון_חובה_1: string;
  סכום_חובה_1: string;
  מטח_סכום_חובה_1: string;
  מטבע: string;
  חשבון_זכות_1: string;
  סכום_זכות_1: string;
  מטח_סכום_זכות_1: string;
  חשבון_חובה_2: string;
  סכום_חובה_2: string;
  מטח_סכום_חובה_2: string;
  חשבון_זכות_2: string;
  סכום_זכות_2: string;
  מטח_סכום_זכות_2: string;
  פרטים: string;
  אסמכתא_1: number;
  אסמכתא_2: string;
  סוג_תנועה: string;
  תאריך_ערך: string;
  תאריך_3: string;
}

/** 'monthlyTaxesReportSQL' query type */
export interface IMonthlyTaxesReportSqlQuery {
  params: IMonthlyTaxesReportSqlParams;
  result: IMonthlyTaxesReportSqlResult;
}


