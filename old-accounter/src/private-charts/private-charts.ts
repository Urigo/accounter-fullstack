import { pool } from '../index';
import { currencyCodeToSymbol } from '../first-page';

export const topPrivateNotCategorized = async (): Promise<string> => {
  const startingDate = '2020-01-01';

  const topPrivateExpensesNotCategorizedSQL = `
    select *
    from top_expenses_not_categorized($1);
  `;

  const topPrivateNotCategorizedExpenses: any = await pool.query(topPrivateExpensesNotCategorizedSQL, [
    `$$${startingDate}$$`,
  ]);

  if (!topPrivateNotCategorizedExpenses) {
    return '';
  }
  let topPrivateExpensesNotCategorizedHTMLTemplate = '';
  for (const transaction of topPrivateNotCategorizedExpenses) {
    topPrivateExpensesNotCategorizedHTMLTemplate = topPrivateExpensesNotCategorizedHTMLTemplate.concat(`
      <tr>
        <td>${transaction.amount}${currencyCodeToSymbol(transaction.currency_code)}</td>
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
