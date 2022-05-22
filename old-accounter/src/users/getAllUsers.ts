import { tableStyles } from '../firstPage';
import { pool } from '../index';

export const businesses = {
  'Software Products Guilda Ltd.': '6a20aa69-57ff-446e-8d6a-1e96d095e988',
  'Uri Goldshtein LTD': 'a1f66c23-cea3-48a8-9a4b-0b4a0422851a',
};

export const getAllUsers = async (): Promise<string> => {
  console.log('getAllUsers');
  // TODO: get ALL users, or from current company? NULL will fetch all of them.
  const currrentCompany = businesses['Uri Goldshtein LTD'];
  const query =
    ['debit_account_1', 'debit_account_2', 'credit_account_1', 'credit_account_2']
      .map(
        column =>
          `select ${column} as userName from accounter_schema.ledger${
            currrentCompany ? ` where business = '${currrentCompany}'` : ''
          }`
      )
      .join(' union ') + ' order by userName';
  const results: any = await pool.query(query);

  if (results.rows?.length) {
    const users = results.rows as { username: string }[];
    let tableBody = '';

    for (const user of users) {
      tableBody = tableBody.concat(`
          <tr>
            <td>${user.username}</td>
          </tr>
        `);
    }

    const transactionsTable = `
        <table>
          <thead>
              <tr>
                <th>שם חשבון</th>
              </tr>
          </thead>
          <tbody>
              ${tableBody}
          </tbody>
        </table>
      `;

    return `
        ${tableStyles}

        <h1>User Accounts List</h1>

        ${transactionsTable}
      `;
  }

  return `No user accounts found`;
};
