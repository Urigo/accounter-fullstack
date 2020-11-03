import { readFileSync } from 'fs';
import { pool } from './index';
import moment from 'moment';

const entitiesWithoutInvoice = [
  'Poalim',
  'Isracard'
];

const entitiesWithoutInvoiceNumuber = [
  'Uri Goldshtein',
];

const privateBusinessExpenses = [
  'Google',
  'Uri Goldshtein',
  'Uri Goldshtein Employee Social Security',
  'Hot Mobile',
  'Apple',
  'HOT',
];

const businessesNotToShare = [
  'Dotan Simha',
];

const businessesWithoutTaxCategory = [
  'Uri Goldshtein',
  'Uri Goldshtein Employee Social Security',
  'Uri Goldshtein Employee Tax Withholding',
  'VAT',
  'Tax',
];

const businessesNeedsVAT = [
  'Hot Mobile'
];
function isBusiness(transaction: any) {
  return (transaction.account_number == 61066 ||
    transaction.account_number == 2733) &&
    !entitiesWithoutInvoice.includes(transaction.financial_entity);
}
function shareWithDotan(transaction: any) {
  if (transaction.financial_accounts_to_balance == 'no' ||
      transaction.financial_accounts_to_balance === ' ' ||
      transaction.financial_accounts_to_balance === 'yes' ) {
    return false;
  } else {
    return !(
      !isBusiness(transaction) ||
      privateBusinessExpenses.includes(transaction.financial_entity) ||
      businessesNotToShare.includes(transaction.financial_entity)
    );
  }
}

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

  table.taxes th {
    background-color: #93a191;
  }

  table.taxes th, td {
    border: 0.5px solid gray;
  }
</style>
`;

export const financialStatus = async (query: any): Promise<string> => {
  let monthTaxReport;
  if (query.month) {
    // TODO: Fix this stupid month calculation
    monthTaxReport = `2020-0${query.month}-01`;
  } else {
    monthTaxReport = '2020-10-01';
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
    pool.query(
      `
        select *
        from missing_invoice_images($1)
        order by event_date;
      `,
      [`$$${monthTaxReport}$$`]
    ),
  ]);

  let missingInvoiceDates: any = results[0].value;
  let missingInvoiceNumbers: any = results[1].value;
  let lastInvoiceNumbers: any = results[2].value;
  // let currentVATStatus: any = results[3].value;
  let VATTransactions: any = results[3].value;
  let allTransactions: any = results[4].value;
  let missingInvoiceImages: any = results[5].value;

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
  if (missingInvoiceNumbers?.rows) {
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

  let missingInvoiceImagesHTMLTemplate = '';
  if (missingInvoiceImages?.rows) {
    for (const transaction of missingInvoiceImages?.rows) {
      missingInvoiceImagesHTMLTemplate = missingInvoiceImagesHTMLTemplate.concat(`
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
  missingInvoiceImagesHTMLTemplate = `
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
              ${missingInvoiceImagesHTMLTemplate}
          </tbody>
        </table>  
      `;

  let lastInvoiceNumbersHTMLTemplate = '';
  if (lastInvoiceNumbers?.rows) {
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
  if (VATTransactions?.rows) {
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
            event_number=${transaction.event_number}
            transaction_id=${transaction.id}>
          <td>${transaction.formatted_event_date}</td>
          <td>${transaction.event_amount}${currencyCodeToSymbol(
        transaction.currency_code
      )}</td>
          <td class="financial_entity" ${
            transaction.financial_entity
              ? ''
              : 'style="background-color: rgb(236, 207, 57);"'
          }>${transaction.financial_entity}
            <button type="button" onClick='printElement(this, prompt("New financial entity:"));'>Edit</button>
          </td>
          <td class="user_description" ${
            transaction.user_description
              ? ''
              : 'style="background-color: rgb(236, 207, 57);"'
          }>${transaction.user_description}
            <button type="button" onClick='printElement(this, prompt("New user description:"));'>Edit</button>
          </td>
          <td class="personal_category" ${
            transaction.personal_category
              ? ''
              : 'style="background-color: rgb(236, 207, 57);"'
          }>${transaction.personal_category}
            <button type="button" onClick='printElement(this, prompt("New personal category:"));'></button>
          </td>
          <td class="vat">
            ${transaction.vat}
            <button type="button" onClick='printElement(this, prompt("New VAT:"));'></button>
          </td>
          <td>${transaction.account_number}${transaction.account_type}</td>
          <td class="even_with_dotan" ${shareWithDotan(transaction) ? 'style="background-color: rgb(236, 207, 57);"' : ''}>${
            transaction.financial_accounts_to_balance
          }
            <button type="button" onClick='printElement(this, prompt("New Account to share:"));'></button>
          </td>
          <td class="tax_category" ${
            isBusiness(transaction) && !businessesWithoutTaxCategory.includes(transaction.financial_entity) && !transaction.tax_category
              ? 'style="background-color: rgb(236, 207, 57);"'
              : ''
          }>
            ${transaction.tax_category}
            <button type="button" onClick='printElement(this, prompt("New Tax category:"));'></button>
          </td>
          <td>${transaction.detailed_bank_description}</td>
          <td class="proforma_invoice_file" ${
            isBusiness(transaction) && !transaction.proforma_invoice_file
              ? 'style="background-color: rgb(236, 207, 57);"'
              : ''
          }>
            ${transaction.proforma_invoice_file ? 'yes' : ''}
            <button type="button" onClick='printElement(this, prompt("New Invoice Photo:"));'></button>
          </td>
          <td class="tax_invoice_date" ${
            isBusiness(transaction) && !transaction.tax_invoice_date
              ? 'style="background-color: rgb(236, 207, 57);"'
              : ''
          }>${
        transaction.tax_invoice_date
          ? moment(transaction.tax_invoice_date).format('DD/MM/YY')
          : ''
      }
            <button type="button" onClick='printElement(this, prompt("New Invoice Date:"));'></button>
          </td>
          <td class="tax_invoice_number" ${
            isBusiness(transaction) && !entitiesWithoutInvoiceNumuber.includes(transaction.financial_entity) && !transaction.tax_invoice_number
              ? 'style="background-color: rgb(236, 207, 57);"'
              : ''
          }>
            ${transaction.tax_invoice_number}
            <button type="button" onClick='printElement(this, prompt("New Invoice Number:"));'></button>
          </td>
          <td class="tax_invoice_file" ${
            isBusiness(transaction) && !transaction.tax_invoice_file
              ? 'style="background-color: rgb(236, 207, 57);"'
              : ''
          }>
            ${transaction.tax_invoice_file ? 'yes' : ''}
            <button type="button" onClick='printElement(this, prompt("New Invoice path:"));'></button>
          </td>
          <td class="receipt_invoice_file">
            ${transaction.receipt_invoice_file ? 'yes' : ''}
            <button type="button" onClick='printElement(this, prompt("New receipt file:"));'></button>
          </td>          
        </tr>
        <!--
        <tr>
          <td colspan="15">
            <table class="taxes">
              <thead>
                <tr>
                  <th>מספר</th>
                  <th>תקין</th>
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
                  <th>חשבשבת</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>סתם</td>
                  <td>סתם</td>
                  <td>סתם</td>
                  <td>סתם</td>
                  <td>סתם</td>
                  <td>סתם</td>
                  <td>סתם</td>
                  <td>סתם</td>
                  <td>סתם</td>
                  <td>סתם</td>
                  <td>סתם</td>
                  <td>סתם</td>
                  <td>סתם</td>
                  <td>סתם</td>
                  <td>סתם</td>
                  <td>סתם</td>
                  <td>סתם</td>
                  <td>סתם</td>
                  <td>סתם</td>
                  <td>סתם</td>
                  <td>סתם</td>
                  <td>סתם</td>
                  <td>סתם</td>
                </tr>
              </tbody>
            </table>   
          </td>
        </tr>
        -->
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
                <th>Share with</th>
                <th>Tax category</th>
                <th>Bank Description</th>
                <th>Invoice Img</th>
                <th>Invoice Date</th>
                <th>Invoice Number</th>
                <th>Invoice File</th>
                <th>Receipt File</th>
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

      <h3>Missing invoice images</h3>

      ${missingInvoiceImagesHTMLTemplate}
  
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
