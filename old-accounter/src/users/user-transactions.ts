import { tableStyles } from '../first-page';
import { pool } from '../index';

export const businesses = {
  'Software Products Guilda Ltd.': '6a20aa69-57ff-446e-8d6a-1e96d095e988',
  'Uri Goldshtein LTD': 'a1f66c23-cea3-48a8-9a4b-0b4a0422851a',
};

export type LedgerEntity = {
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
  reference_1: string;
  reference_2: string;
  movement_type: string;
  value_date: string;
  date_3: string;
  original_id: string;
  origin: string;
  proforma_invoice_file: string;
  id: string;
  reviewed: string;
  hashavshevet_id: string;
};

export const userTransactions = async (query: { id?: string; name?: string }): Promise<string> => {
  let userName: string;
  if (query.id) {
    // TODO: handle ID input
    userName = 'temp_value';
  } else if (query.name) {
    userName = query.name;
  } else {
    return `<h1>Invalid user name or id</h1>`;
  }
  console.log('userTransactions', userName);

  const currrentCompany = businesses['Software Products Guilda Ltd.'];
  const results: any = await pool.query(
    `
      select *
      from accounter_schema.ledger
      where business = '${currrentCompany}' and '${userName}' in (debit_account_1, debit_account_2, credit_account_1, credit_account_2)
      order by to_date(date_3, 'DD/MM/YYYY') asc, original_id, details, debit_account_1, id;
      `
  );

  if (results.rows?.length) {
    const transactions = results.rows as LedgerEntity[];

    let tableBody = '';
    let balanceForeign = 0;
    let sumForeignDebit = 0;
    let sumForeignCredit = 0;
    let balanceNis = 0;
    let sumNisDebit = 0;
    let sumNisCredit = 0;
    for (const transaction of transactions) {
      let direction: 1 | -1 = 1;
      let amountNis = 0;
      let amountForeign = 0;
      let counterAccount = '';
      if (transaction.credit_account_1 === userName) {
        direction = 1;
        amountNis = transaction.credit_amount_1 ? (amountNis = Number(transaction.credit_amount_1)) : 0;
        amountForeign = transaction.foreign_credit_amount_1 ? Number(transaction.foreign_credit_amount_1) : 0;
      } else if (transaction.credit_account_2 === userName) {
        direction = 1;
        amountNis = transaction.credit_amount_2 ? (amountNis = Number(transaction.credit_amount_2)) : 0;
        amountForeign = transaction.foreign_credit_amount_2 ? Number(transaction.foreign_credit_amount_2) : 0;
      } else if (transaction.debit_account_1 === userName) {
        direction = -1;
        amountNis = transaction.debit_amount_1 ? (amountNis = Number(transaction.debit_amount_1)) : 0;
        amountForeign = transaction.foreign_debit_amount_1 ? Number(transaction.foreign_debit_amount_1) : 0;
      } else if (transaction.debit_account_2 === userName) {
        direction = -1;
        amountNis = transaction.debit_amount_2 ? (amountNis = Number(transaction.debit_amount_2)) : 0;
        amountForeign = transaction.foreign_debit_amount_2 ? Number(transaction.foreign_debit_amount_2) : 0;
      } else {
        continue;
      }

      if (direction === 1) {
        counterAccount = transaction.debit_account_1;
        sumForeignCredit += amountForeign;
        sumNisCredit += amountNis;
      } else if (direction === -1) {
        counterAccount = transaction.credit_account_1;
        sumForeignDebit += amountForeign;
        sumNisDebit += amountNis;
      }

      balanceForeign += amountForeign * direction;
      balanceNis += amountNis * direction;

      tableBody = tableBody.concat(`
        <tr>
          <td>${counterAccount}</td>
          <td>${transaction.hashavshevet_id ? transaction.hashavshevet_id : ''}</td>
          <td>${transaction.date_3 ? transaction.date_3 : ''}</td>
          <td>${transaction.value_date ? transaction.value_date : ''}</td>
          <td>${transaction.invoice_date ? transaction.invoice_date : ''}</td>
          <td>${transaction.reference_1 ? transaction.reference_1 : ''}</td>
          <td>${transaction.reference_2 ? transaction.reference_2 : ''}</td>
          <td>${transaction.details === '0' ? '' : transaction.details}</td>
          <td>${transaction.movement_type ? transaction.movement_type : ''}</td>
          <td>${transaction.currency ? transaction.currency : ''}</td>
          <td>${direction === -1 ? amountForeign : ''}</td>
          <td>${direction === 1 ? amountForeign : ''}</td>
          <td>${balanceForeign.toFixed(2)}</td>
          <td>${direction === -1 ? amountNis : ''}</td>
          <td>${direction === 1 ? amountNis : ''}</td>
          <td>${balanceNis.toFixed(2)}</td>
        </tr>
        `);
    }

    const transactionsTable = `
        <table>
          <thead>
              <tr>
                <th>ח"ן</th>
                <th>חשבשבת#</th>
                <th>date_3</th>
                <th>תאריך_ערך</th>
                <th>invoice_date</th>
                <th>reference_1</th>
                <th>reference_2</th>
                <th>details</th>
                <th>movement_type</th>
                <th>currency</th>
                <th colspan="2">חובה/זכות (מט"ח)</th>
                <th>יתרה (מט"ח)</th>
                <th colspan="2">חובה/זכות (שקל)</th>
                <th>יתרה (שקל)</th>
              </tr>
          </thead>
          <tbody>
            <tr>
              <td></td>
              <td></td>
              <td></td>
              <td></td>
              <td></td>
              <td></td>
              <td></td>
              <td></td>
              <td></td>
              <td></td>
              <td></td>
              <td></td>
              <td>0.00</td>
              <td></td>
              <td></td>
              <td>0.00</td>
            </tr>
              ${tableBody}
          </tbody>
        </table>
      `;

    const sumTable = `
      <table>
        <thead>
          <tr>
            <th colspan="2">מט"ח</th>
            <th colspan="2">שקל</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>${sumForeignDebit.toFixed(2)}</td>
            <td>חובה</td>
            <td>${sumNisDebit.toFixed(2)}</td>
            <td>חובה</td>
          </tr>
          <tr>
            <td>${sumForeignCredit.toFixed(2)}</td>
            <td>זכות</td>
            <td>${sumNisCredit.toFixed(2)}</td>
            <td>זכות</td>
          </tr>
          <tr>
            <td>${balanceForeign.toFixed(2)}</td>
            <td>הפרש</td>
            <td>${balanceNis.toFixed(2)}</td>
            <td>הפרש</td>
          </tr>
        </tbody>
      </table>
    `;

    return `
        ${tableStyles}

        <h1>User [${userName}] Transactions Card</h1>
  
        ${transactionsTable}
        <br>
        <h2>User Card Totals</h2>
        ${sumTable}
        `;
  }

  return `No data found for user name="${userName}"`;
};
