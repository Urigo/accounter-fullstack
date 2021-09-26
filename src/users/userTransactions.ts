import { tableStyles } from '../firstPage';
import { pool } from '../index';

type Transaction = {
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

const enum Direction {
  Debit = -1,
  Credit = 1,
}

export const userTransactions = async (query: {
  id?: string;
  name?: string;
}): Promise<string> => {
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

  const currrentCompany = 'Uri Goldshtein LTD';
  const results: any = await pool.query(
    `
      select *
      from get_unified_tax_report_of_month($$${currrentCompany}$$, '2020-01-01', '2021-08-01')
      where חשבון_חובה_1 = '${userName}' or חשבון_חובה_2 = '${userName}' or חשבון_זכות_1 = '${userName}' or חשבון_זכות_2 = '${userName}'
      order by to_date(תאריך_3, 'DD/MM/YYYY') desc, original_id, פרטים, חשבון_חובה_1, id;
      `
  );

  if (results.rows?.length) {
    const transactions = results.rows as Transaction[];

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
        amountNis = transaction.סכום_זכות_1
          ? (amountNis = Number(transaction.סכום_זכות_1))
          : 0;
        amountForeign = transaction.מטח_סכום_זכות_1
          ? Number(transaction.מטח_סכום_זכות_1)
          : 0;
      } else if (transaction.חשבון_זכות_2 === userName) {
        direction = 1;
        amountNis = transaction.סכום_זכות_2
          ? (amountNis = Number(transaction.סכום_זכות_2))
          : 0;
        amountForeign = transaction.מטח_סכום_זכות_2
          ? Number(transaction.מטח_סכום_זכות_2)
          : 0;
      } else if (transaction.חשבון_חובה_1 === userName) {
        direction = -1;
        amountNis = transaction.סכום_חובה_1
          ? (amountNis = Number(transaction.סכום_חובה_1))
          : 0;
        amountForeign = transaction.מטח_סכום_חובה_1
          ? Number(transaction.מטח_סכום_חובה_1)
          : 0;
      } else if (transaction.חשבון_חובה_2 === userName) {
        direction = -1;
        amountNis = transaction.סכום_חובה_2
          ? (amountNis = Number(transaction.סכום_חובה_2))
          : 0;
        amountForeign = transaction.מטח_סכום_חובה_2
          ? Number(transaction.מטח_סכום_חובה_2)
          : 0;
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
          <td>${
            transaction.hashavshevet_id ? transaction.hashavshevet_id : ''
          }</td>
          <td>${transaction.תאריך_3 ? transaction.תאריך_3 : ''}</td>
          <td>${transaction.תאריך_ערך ? transaction.תאריך_ערך : ''}</td>
          <td>${transaction.תאריך_חשבונית ? transaction.תאריך_חשבונית : ''}</td>
          <td>${transaction.אסמכתא_1 ? transaction.אסמכתא_1 : ''}</td>
          <td>${transaction.אסמכתא_2 ? transaction.אסמכתא_2 : ''}</td>
          <td>${transaction.פרטים === '0' ? '' : transaction.פרטים}</td>
          <td>${transaction.סוג_תנועה ? transaction.סוג_תנועה : ''}</td>
          <td>${transaction.מטבע ? transaction.מטבע : ''}</td>
          <td>${direction === -1 ? amountForeign : ''}</td>
          <td>${direction === 1 ? amountForeign : ''}</td>
          <td>${balanceForeign}</td>
          <td>${direction === -1 ? amountNis : ''}</td>
          <td>${direction === 1 ? amountNis : ''}</td>
          <td>${balanceNis}</td>
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
                <th>תאריך_חשבונית</th>
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
              ${tableBody}
          </tbody>
        </table>
      `;

    return `
        ${tableStyles}

        <h1>User [${userName}] Transactions Card</h1>
  
        ${transactionsTable}
      `;
  }

  return `No data found for user name="${userName}"`;
};
