import { tableStyles } from '../firstPage';
import { pool } from '../index';

export const businesses = {
  'Software Products Guilda Ltd.': '6a20aa69-57ff-446e-8d6a-1e96d095e988',
  'Uri Goldshtein LTD': 'a1f66c23-cea3-48a8-9a4b-0b4a0422851a',
};

export type LedgerEntity = {
  invoice_date: string;
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
  אסמכתא_1: string;
  אסמכתא_2: string;
  סוג_תנועה: string;
  תאריך_ערך: string;
  תאריך_3: string;
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
      where business = '${currrentCompany}' and '${userName}' in (חשבון_חובה_1, חשבון_חובה_2, חשבון_זכות_1, חשבון_זכות_2)
      order by to_date(תאריך_3, 'DD/MM/YYYY') asc, original_id, פרטים, חשבון_חובה_1, id;
      `
  );

  if (results.rows?.length) {
    const transactions = results.rows as LedgerEntity[];

    let tableBody = '';
    let balanceForeign: number = 0;
    let sumForeignDebit: number = 0;
    let sumForeignCredit: number = 0;
    let balanceNis: number = 0;
    let sumNisDebit: number = 0;
    let sumNisCredit: number = 0;
    for (const transaction of transactions) {
      let direction: 1 | -1 = 1;
      let amountNis: number = 0;
      let amountForeign: number = 0;
      let counterAccount: string = '';
      if (transaction.חשבון_זכות_1 === userName) {
        direction = 1;
        amountNis = transaction.סכום_זכות_1 ? (amountNis = Number(transaction.סכום_זכות_1)) : 0;
        amountForeign = transaction.מטח_סכום_זכות_1 ? Number(transaction.מטח_סכום_זכות_1) : 0;
      } else if (transaction.חשבון_זכות_2 === userName) {
        direction = 1;
        amountNis = transaction.סכום_זכות_2 ? (amountNis = Number(transaction.סכום_זכות_2)) : 0;
        amountForeign = transaction.מטח_סכום_זכות_2 ? Number(transaction.מטח_סכום_זכות_2) : 0;
      } else if (transaction.חשבון_חובה_1 === userName) {
        direction = -1;
        amountNis = transaction.סכום_חובה_1 ? (amountNis = Number(transaction.סכום_חובה_1)) : 0;
        amountForeign = transaction.מטח_סכום_חובה_1 ? Number(transaction.מטח_סכום_חובה_1) : 0;
      } else if (transaction.חשבון_חובה_2 === userName) {
        direction = -1;
        amountNis = transaction.סכום_חובה_2 ? (amountNis = Number(transaction.סכום_חובה_2)) : 0;
        amountForeign = transaction.מטח_סכום_חובה_2 ? Number(transaction.מטח_סכום_חובה_2) : 0;
      } else {
        continue;
      }

      if (direction === 1) {
        counterAccount = transaction.חשבון_חובה_1;
        sumForeignCredit += amountForeign;
        sumNisCredit += amountNis;
      } else if (direction === -1) {
        counterAccount = transaction.חשבון_זכות_1;
        sumForeignDebit += amountForeign;
        sumNisDebit += amountNis;
      }

      balanceForeign += amountForeign * direction;
      balanceNis += amountNis * direction;

      tableBody = tableBody.concat(`
        <tr>
          <td>${counterAccount}</td>
          <td>${transaction.hashavshevet_id ? transaction.hashavshevet_id : ''}</td>
          <td>${transaction.תאריך_3 ? transaction.תאריך_3 : ''}</td>
          <td>${transaction.תאריך_ערך ? transaction.תאריך_ערך : ''}</td>
          <td>${transaction.invoice_date ? transaction.invoice_date : ''}</td>
          <td>${transaction.אסמכתא_1 ? transaction.אסמכתא_1 : ''}</td>
          <td>${transaction.אסמכתא_2 ? transaction.אסמכתא_2 : ''}</td>
          <td>${transaction.פרטים === '0' ? '' : transaction.פרטים}</td>
          <td>${transaction.סוג_תנועה ? transaction.סוג_תנועה : ''}</td>
          <td>${transaction.מטבע ? transaction.מטבע : ''}</td>
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
                <th>תאריך_3</th>
                <th>תאריך_ ערך</th>
                <th>invoice_date</th>
                <th>אסמכתא_1</th>
                <th>אסמכתא_2</th>
                <th>פרטים</th>
                <th>סוג_תנועה</th>
                <th>מטבע</th>
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
