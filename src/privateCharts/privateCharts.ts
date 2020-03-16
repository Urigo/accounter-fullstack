// Node says that when importing from commonjs you only can bring
// const pg = require('pg'); // That works is we change Typescript and Node to use regular commonjs
// import * as pg from 'pg'; // Won't work as this does equal this that:
import pg from 'pg';
const { Pool } = pg;

import query from '@pgtyped/query';
const { sql } = query;
import { ITopPrivateExpensesNotCategorizedSqlQuery } from './privateCharts.types';

import { currencyCodeToSymbol } from '../firstPage';

const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'accounter',
  password: 'accounter123',
  port: 5432,
});

export const topPrivateNotCategorized = async (): Promise<string> => {
  const startingDate = '2020-01-01';

  const topPrivateExpensesNotCategorizedSQL = sql<
    ITopPrivateExpensesNotCategorizedSqlQuery
  >`
    select *
    from top_private_expenses_not_categorized($startingDate);
`;

  const topPrivateNotCategorizedExpenses = await topPrivateExpensesNotCategorizedSQL.run(
    { startingDate: startingDate },
    pool
  );

  let topPrivateExpensesNotCategorizedHTMLTemplate = '';
  for (const transaction of topPrivateNotCategorizedExpenses) {
    topPrivateExpensesNotCategorizedHTMLTemplate = topPrivateExpensesNotCategorizedHTMLTemplate.concat(`
      <tr>
        <td>${transaction.amount}${currencyCodeToSymbol(
      transaction.currency_code
    )}</td>
        <td>${transaction.bank_description}</td>
        <td>${new Intl.DateTimeFormat('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        }).format(new Date(transaction.date))}</td>
        <td>${transaction.description}</td>
      </tr>
      `);
  }
  topPrivateExpensesNotCategorizedHTMLTemplate = `
      <table>
        <thead>
            <tr>
                <th>amount</th>
                <th>description</th>
                <th>date</th>
            </tr>
        </thead>
        <tbody>
            ${topPrivateExpensesNotCategorizedHTMLTemplate}
        </tbody>
      </table>
    `;

  return `
      <h1>Top uncategorized private expenses</h1>

      ${topPrivateExpensesNotCategorizedHTMLTemplate}
    `;
};
