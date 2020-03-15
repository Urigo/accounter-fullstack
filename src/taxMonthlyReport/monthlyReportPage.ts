// Node says that when importing from commonjs you only can bring
// const pg = require('pg'); // That works is we change Typescript and Node to use regular commonjs
// import * as pg from 'pg'; // Won't work as this does equal this that:
import pg from 'pg';
const { Pool } = pg;

import query from '@pgtyped/query';
const { sql } = query;
import {
  IMonthlyTaxesReportQueryResult,
  IMonthlyTaxesReportQueryParams,
} from './monthlyReportPage.types';

const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'accounter',
  password: 'accounter123',
  port: 5432,
});

export const monthlyReport = async (): Promise<string> => {
  const monthTaxReportDate = '2020-03-01';

  const monthlyTaxesReportQuery = sql<
    IMonthlyTaxesReportQueryResult,
    IMonthlyTaxesReportQueryParams
  >`
    select *
    from get_tax_report_of_month($monthTaxReportDate);
`;

  const monthlyTaxesReport = await monthlyTaxesReportQuery.run(
    {
      monthTaxReportDate: monthTaxReportDate,
    },
    pool
  );

  let monthlyReportsHTMLTemplate = '';
  for (const transaction of monthlyTaxesReport) {
    monthlyReportsHTMLTemplate = monthlyReportsHTMLTemplate.concat(`
      <tr>
        <td>${transaction.תאריך_חשבונית}</td>
        <td>${transaction.חשבון_חובה_1}</td>
        <td>${transaction.סכום_חובה_1}</td>
        <td>${transaction.מטח_סכום_חובה_1}</td>
        <td>${transaction.מטבע}</td>
        <td>${transaction.חשבון_זכות_1}</td>
        <td>${transaction.סכום_זכות_1}</td>
        <td>${transaction.מטח_סכום_זכות_1}</td>
        <td>${transaction.חשבון_חובה_2}</td>
        <td>${transaction.סכום_חובה_2}</td>
        <td>${transaction.מטח_סכום_חובה_2}</td>
        <td>${transaction.חשבון_זכות_2}</td>
        <td>${transaction.סכום_זכות_2}</td>
        <td>${transaction.מטח_סכום_זכות_2}</td>
        <td>${transaction.פרטים}</td>
        <td>${transaction.אסמכתא_1}</td>
        <td>${transaction.אסמכתא_2}</td>
        <td>${transaction.סוג_תנועה}</td>
        <td>${transaction.תאריך_ערך}</td>
        <td>${transaction.תאריך_3}</td>
      </tr>
      `);
  }
  monthlyReportsHTMLTemplate = `
      <table>
        <thead>
            <tr>
                <th>תאריך_חשבונית</th>
                <th>חשבון_חובה_1</th>
                <th>סכום_חובה_1</th>
                <th>מטח_סכום_חובה_1</th>
                <th>מטבע</th>
                <th>חשבון_זכות_1</th>
                <th>סכום_זכות_1</th>
                <th>מטח_סכום_זכות_1</th>
                <th>חשבון_חובה_2</th>
                <th>סכום_חובה_2</th>
                <th>מטח_סכום_חובה_2</th>
                <th>חשבון_זכות_2</th>
                <th>סכום_זכות_2</th>
                <th>מטח_סכום_זכות_2</th>
                <th>פרטים</th>
                <th>אסמכתא_1</th>
                <th>אסמכתא_2</th>
                <th>סוג_תנועה</th>
                <th>תאריך_ערך</th>
                <th>תאריך_3</th>
            </tr>
        </thead>
        <tbody>
            ${monthlyReportsHTMLTemplate}
        </tbody>
      </table>  
    `;

  return `
      <h1>Monthly Report</h1>

      ${monthlyReportsHTMLTemplate}
    `;
};
