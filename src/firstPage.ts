import { readFileSync } from 'fs';
import { pool } from './index';

export function currencyCodeToSymbol(currency_code: string): string {
  let currencySymbol = '₪';
  if (currency_code == 'USD') {
    currencySymbol = '$';
  } else if (currency_code == 'EUR') {
    currencySymbol = '€';
  }
  return currencySymbol;
}

export const tableStyles = `
<style>
  table {
    border-collapse: collapse;
    background-color: #EEEEEE;
  }
  th, td {
    border: 1px solid black;
  }
  th {
    font-size: 10px;
    background-color: #4F7849;
    color: white;
    position: sticky;
    top: 0;
  }
  td {
    text-align: center;
    font-size: 14px;
  }
  tr:hover {background-color: #f5f5f5;}
  tr:nth-child(even) {background-color: #CEE0CC;}
</style>
`;

export const financialStatus = async (query: any): Promise<string> => {
  let monthTaxReport;
  if (query.month) {
    // TODO: Fix this stupid month calculation
    monthTaxReport = `2020-0${query.month}-01`;
  } else {
    monthTaxReport = '2020-03-01';
  }
  console.log('monthTaxReport', monthTaxReport);

  const lastInvoiceNumbersQuery = readFileSync(
    'src/sql/lastInvoiceNumbers.sql'
  ).toString();
  // const currentVATStatusQuery = readFileSync(
  //   'src/sql/currentVATStatus.sql'
  // ).toString();
  const allTransactionsQuery = readFileSync(
    'src/sql/allTransactions.sql'
  ).toString();
  const results: any = await Promise.allSettled([
    pool.query(
      `
        select *
        from missing_invoice_dates($1)
        order by event_date;
      `,
      [`$$${monthTaxReport}$$`]
    ),
    pool.query(
      `
        select *
        from missing_invoice_numbers($1)
        order by event_date;
      `,
      [`$$${monthTaxReport}$$`]
    ),
    pool.query(lastInvoiceNumbersQuery),
    // pool.query(currentVATStatusQuery),
    pool.query(
      `
        select *
        from get_vat_for_month($1);
      `,
      [`$$${monthTaxReport}$$`]
    ),
    pool.query(allTransactionsQuery),
  ]);

  let missingInvoiceDates: any = results[0].value;
  let missingInvoiceNumbers: any = results[1].value;
  let lastInvoiceNumbers: any = results[2].value;
  // let currentVATStatus: any = results[3].value;
  let VATTransactions: any = results[3].value;
  let allTransactions: any = results[4].value;

  let missingInvoiceDatesHTMLTemplate = '';
  if (missingInvoiceDates?.rows) {
    for (const transaction of missingInvoiceDates?.rows) {
      missingInvoiceDatesHTMLTemplate = missingInvoiceDatesHTMLTemplate.concat(`
        <tr>
          <td>${transaction.event_date
            .toISOString()
            .replace(/T/, ' ')
            .replace(/\..+/, '')}</td>
          <td>${transaction.event_amount}${currencyCodeToSymbol(
        transaction.currency_code
      )}</td>
          <td>${transaction.financial_entity}</td>
          <td>${transaction.user_description}</td>
          <td>${transaction.tax_invoice_number}</td>
        </tr>
        `);
    }
  }
  missingInvoiceDatesHTMLTemplate = `
      <table>
        <thead>
            <tr>
                <th>Date</th>
                <th>Amount</th>
                <th>Entity</th>
                <th>Description</th>
                <th>Invoice Number</th>
            </tr>
        </thead>
        <tbody>
            ${missingInvoiceDatesHTMLTemplate}
        </tbody>
      </table>  
    `;

  let missingInvoiceNumbersHTMLTemplate = '';
  if (missingInvoiceNumbers?.rows){
    for (const transaction of missingInvoiceNumbers?.rows) {
      missingInvoiceNumbersHTMLTemplate = missingInvoiceNumbersHTMLTemplate.concat(`
        <tr>
          <td>${transaction.event_date
            .toISOString()
            .replace(/T/, ' ')
            .replace(/\..+/, '')}</td>
          <td>${transaction.event_amount}${currencyCodeToSymbol(
        transaction.currency_code
      )}</td>
          <td>${transaction.financial_entity}</td>
          <td>${transaction.user_description}</td>
          <td>${transaction.tax_invoice_number}</td>
        </tr>
        `);
    }
  }
  missingInvoiceNumbersHTMLTemplate = `
      <table>
        <thead>
            <tr>
                <th>Date</th>
                <th>Amount</th>
                <th>Entity</th>
                <th>Description</th>
                <th>Invoice Number</th>
            </tr>
        </thead>
        <tbody>
            ${missingInvoiceNumbersHTMLTemplate}
        </tbody>
      </table>  
    `;

  let lastInvoiceNumbersHTMLTemplate = '';
  if (lastInvoiceNumbers?.rows){
    for (const transaction of lastInvoiceNumbers?.rows) {
      lastInvoiceNumbersHTMLTemplate = lastInvoiceNumbersHTMLTemplate.concat(`
        <tr>
          <td>${transaction.tax_invoice_number}</td>
          <td>${transaction.event_date
            .toISOString()
            .replace(/T/, ' ')
            .replace(/\..+/, '')}</td>
          <td>${transaction.financial_entity}</td>
          <td>${transaction.user_description}</td>
          <td>${transaction.event_amount}</td>
        </tr>
        `);
    }
  }
  lastInvoiceNumbersHTMLTemplate = `
      <table>
        <thead>
            <tr>
              <th>Invoice Number</th>
              <th>Date</th>
              <th>Entity</th>
              <th>Description</th>
              <th>Amount</th>
            </tr>
        </thead>
        <tbody>
            ${lastInvoiceNumbersHTMLTemplate}
        </tbody>
      </table>  
    `;

  let VATTransactionsString = '';
  if (VATTransactions?.rows){
    for (const transaction of VATTransactions?.rows) {
      VATTransactionsString = VATTransactionsString.concat(`
        <tr>
          <td>${transaction.overall_vat_status}</td>
          <td>${transaction.vat}</td>
          <td>${transaction.event_date
            .toISOString()
            .replace(/T/, ' ')
            .replace(/\..+/, '')}</td>
          <td>${transaction.event_amount}</td>
          <td>${transaction.financial_entity}</td>
          <td>${transaction.user_description}</td>
        </tr>
        `);
    }
  }
  VATTransactionsString = `
      <table>
        <thead>
            <tr>
                <th>Overall VAT Status</th>
                <th>VAT</th>
                <th>Date</th>
                <th>Amount</th>
                <th>Entity</th>
                <th>Description</th>
            </tr>
        </thead>
        <tbody>
            ${VATTransactionsString}
        </tbody>
      </table>  
    `;

  let allTransactionsString = '';
  if (allTransactions?.rows) {
    for (const transaction of allTransactions?.rows) {
      allTransactionsString = allTransactionsString.concat(`
        <tr bank_reference=${transaction.bank_reference}
            account_number=${transaction.account_number}
            account_type=${transaction.account_type}
            currency_code=${transaction.currency_code}
            event_date=${transaction.event_date
              .toISOString()
              .replace(/T/, ' ')
              .replace(/\..+/, '')}
            event_amount=${transaction.event_amount}
            event_number=${transaction.event_number}>
          <td>${transaction.formatted_event_date}</td>
          <td>${transaction.event_amount}${currencyCodeToSymbol(
        transaction.currency_code
      )}</td>
          <td class="financial_entity" onClick='printElement(this, prompt("New financial entity:"));'>${
            transaction.financial_entity
          }</td>
          <td class="user_description" onClick='printElement(this, prompt("New user description:"));'>${
            transaction.user_description
          }</td>
          <td class="personal_category" onClick='printElement(this, prompt("New personal category:"));'>${
            transaction.personal_category
          }</td>
          <td>${transaction.vat}</td>
          <td>${transaction.account_number}${transaction.account_type}</td>
          <td>${transaction.tax_category}</td>
          <td>${transaction.tax_invoice_number}</td>
          <td>${transaction.bank_description}</td>
        </tr>
        `);
    }
  }
  allTransactionsString = `
      <table>
        <thead>
            <tr>
                <th>Date</th>
                <th>Amount</th>
                <th>Entity</th>
                <th>Description</th>
                <th>Category</th>
                <th>VAT</th>
                <th>Account</th>
                <th>Tax category</th>
                <th>Invoice Number</th>
                <th>Bank Description</th>
            </tr>
        </thead>
        <tbody>
            ${allTransactionsString}
        </tbody>
      </table>  
    `;

  return `

      ${tableStyles}

      <h1>Accounter</h1>

      <a href="/reports-to-review">Monthly report to review</a>

      <a href="/private-charts">Private Charts</a>
  
      <h3>Missing invoice numbers for a month</h3>
  
      ${missingInvoiceNumbersHTMLTemplate}
  
      <h3>Missing invoice dates for a month</h3>
  
      ${missingInvoiceDatesHTMLTemplate}
  
      <h3>Last invoice numbers</h3>
  
      ${lastInvoiceNumbersHTMLTemplate}
  
      <h3>VAT Transactions for this month:</h3>
  
      ${VATTransactionsString}
  
      <h3>All Transactions</h3>
  
      ${allTransactionsString}
  
      <script type="module" src="/browser.js"></script>
      <script type="module">
        import { printElement } from '/browser.js';
  
        window.printElement = printElement;
      </script>
    `;
};
