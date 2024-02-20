import { readFileSync } from 'fs';
import moment from 'moment';
import { suggestedTransaction } from './helpers/index.js';
import { pool } from './index.js';

// TODO: Check this article for joins https://www.cybertec-postgresql.com/en/understanding-lateral-joins-in-postgresql/

export const businessesNotToShare = [
  '76637409-d617-4835-880d-a29f86810d73', // Dotan Simha
];

export const businessesWithoutTaxCategory = [
  '147d3415-55e3-497f-acba-352dcc37cb8d', // Uri Goldshtein
  '6d4b01dd-5a5e-4a43-8e40-e9dadfcc10fa', // Social Security Deductions
  'f1ade516-4999-4919-9d94-6b013221536d', // Tax Deductions
  'c7fdf6f6-e075-44ee-b251-cbefea366826', // VAT
  '9d3a8a88-6958-4119-b509-d50a7cdc0744', // Tax
];

export const entitiesWithoutInvoice = [
  'f4b591f3-d817-4e3d-9ecb-35b38d2df7ef', // Gil Employee
  '96dba127-90f4-4407-ae89-5a53afa42ca3', // Isracard
  '6d4b01dd-5a5e-4a43-8e40-e9dadfcc10fa', // Social Security Deductions
  'c7fdf6f6-e075-44ee-b251-cbefea366826', // VAT
  '9d3a8a88-6958-4119-b509-d50a7cdc0744', // Tax
  'f1ade516-4999-4919-9d94-6b013221536d', // Tax Deductions
  '8fa16264-de32-4592-bffb-64a1914318ad', // Poalim
  '8f347f1f-293d-4a88-889a-8043b91f34d5', // Dividend Tax Deduction Origin
  'ca9d301f-f6db-40a8-a02e-7cf4b63fa2df', // Dotan Employee
  '2697dae8-cbd5-4669-8e80-d0964e5c077e', // מגדל השתלמות
  '855fd0ef-5fd1-4287-b391-db00b9f87ede', // Gilad Employee
  '4bcca705-5b47-41c5-ba26-1e42c69cbf0d', // Uri Dividend
  '7843b805-3bb7-4d1c-9219-ff783100334b', // Uri Employee
  '42573221-eaeb-4bed-9886-b5cb5c937b85', // הלמן השתלמות
  '1453f8d1-adae-4761-851b-83799290b8d1', // פניקס השתלמות
  'af386033-a577-4c9a-880a-d49acd15141d', // מנורה פנסיה
  '4420accf-da13-43b0-9aaa-3b94758598e4', // Tuval Employee
  '340c3552-0a15-4e22-ba03-19ae9322859c', // איילון פנסיה
  '909fbe3c-0419-44ed-817d-ab774e93748a', // Dotan Dividend
  'fc2ea992-a2be-4f8a-a639-542a81276beb', // מגדל פנסיה
  '6606735b-49ce-4f6f-8d8e-3416fe27528f', // הלמן פנסיה
  'd60321ef-9b91-4907-8bd2-9cfd87c83c0a', // Batched Employees
  '95815c30-0ed1-4ac1-8367-e63829345070', // Pension Group
];

export const entitiesWithoutInvoiceNumber = [
  '147d3415-55e3-497f-acba-352dcc37cb8d', // Uri Goldshtein
];

export const privateBusinessExpenses = [
  '6346872a-708d-4910-9428-72019b053ea5', // Apple
  '5f1b96f7-bb4d-4e8c-91ed-7c488fef9efe', // HOT
  '7ada0a12-39e1-4096-99d2-34c8b3fa0469', // Partner
  'a31f1dea-270f-4d32-b47a-68bc55b22ecc', // Yaacov Matri
  'a3cd6995-b487-49f7-be5d-bab32923037a', // Hot Mobile
  '147d3415-55e3-497f-acba-352dcc37cb8d', // Uri Goldshtein
  '31b1f759-9f1e-47b6-bc2f-d3883ad9bca4', // Google
  '6d4b01dd-5a5e-4a43-8e40-e9dadfcc10fa', // Social Security Deductions
];

function isBusiness(transaction: any) {
  return (
    (transaction.account_number == '61066' ||
      transaction.account_number == '2733' ||
      transaction.account_number == '466803' ||
      transaction.account_number == '1082' ||
      transaction.account_number == '5972' ||
      transaction.account_number == '1074') &&
    !entitiesWithoutInvoice.includes(transaction.financial_entity_id)
  );
}
function shareWithDotan(transaction: any) {
  if (
    transaction.financial_accounts_to_balance == 'no' ||
    transaction.financial_accounts_to_balance === ' ' ||
    transaction.financial_accounts_to_balance === 'yes' ||
    transaction.financial_accounts_to_balance === 'pension' ||
    transaction.financial_accounts_to_balance === 'training_fund'
  ) {
    return false;
  }
  return !(
    !isBusiness(transaction) ||
    privateBusinessExpenses.includes(transaction.financial_entity_id) ||
    businessesNotToShare.includes(transaction.financial_entity_id) ||
    businessesWithoutTaxCategory.includes(transaction.financial_entity_id)
  );
}

export function currencyCodeToSymbol(currency_code: string): string {
  let currencySymbol = '₪';
  if (currency_code == 'USD') {
    currencySymbol = '$';
  } else if (currency_code == 'EUR') {
    currencySymbol = '€';
  } else if (currency_code == 'GBP') {
    currencySymbol = '£';
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

export const lastInvoiceNumbersQuery = `
  SELECT tax_invoice_number,
    user_description,
    financial_entity,
    event_amount,
    event_date
  FROM accounter_schema.all_transactions
  WHERE
    (account_number in ('466803', '1074', '1082', '5972')) AND
    event_amount > 0 AND
    (financial_entity not in ('Poalim', 'VAT') OR financial_entity IS NULL)
  ORDER BY event_date DESC;
`;

export function getLastInvoiceNumbers(lastInvoiceNumbers: any) {
  let lastInvoiceNumbersHTMLTemplate = '';
  if (lastInvoiceNumbers?.rows) {
    for (const transaction of lastInvoiceNumbers?.rows ?? []) {
      lastInvoiceNumbersHTMLTemplate = lastInvoiceNumbersHTMLTemplate.concat(`
        <tr>
          <td>${transaction.tax_invoice_number}</td>
          <td>${transaction.event_date.toISOString().replace(/T/, ' ').replace(/\..+/, '')}</td>
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
  return lastInvoiceNumbersHTMLTemplate;
}

export const financialStatus = async (query: any): Promise<string> => {
  let monthTaxReport;
  if (query.month) {
    // TODO: Fix this stupid month calculation
    monthTaxReport = `2020-0${query.month}-01`;
  } else {
    monthTaxReport = '2021-08-01';
  }
  console.log('monthTaxReport', monthTaxReport);
  // const currentVATStatusQuery = readFileSync(
  //   'src/sql/currentVATStatus.sql'
  // ).toString();

  console.time('callingDB');

  const results: any = await Promise.allSettled([
    pool.query(
      `
        select *
        from missing_invoice_dates($1)
        order by event_date;
      `,
      [`$$${monthTaxReport}$$`],
    ),
    pool.query(
      `
        select *
        from missing_invoice_numbers($1)
        order by event_date;
      `,
      [`$$${monthTaxReport}$$`],
    ),
    pool.query(lastInvoiceNumbersQuery),
    // pool.query(currentVATStatusQuery),
    pool.query(
      `
        select *
        from get_vat_for_month($1);
      `,
      [`$$${monthTaxReport}$$`],
    ),
    pool.query(`
      select *
      from accounter_schema.all_transactions
      -- where account_number in ('466803', '1074', '1082', '5972')
      order by event_date desc
      limit 2550;
    `),
    pool.query(
      `
        select *
        from missing_invoice_images($1)
        order by event_date;
      `,
      [`$$${monthTaxReport}$$`],
    ),
    pool.query(readFileSync('src/monthlyCharts.sql', 'utf8')),
    pool.query(`
    with transactions_exclude as (
      select *
      from formatted_merged_tables
      where
          personal_category <> 'conversion' and
          personal_category <> 'investments' and
          financial_entity <> 'Isracard' and
          financial_entity <> 'Tax' and
          financial_entity <> 'VAT' and
          financial_entity <> 'Tax Shuma' and
          financial_entity <> 'Tax Corona Grant' and
          financial_entity <> 'Uri Goldshtein' and
          financial_entity <> 'Uri Goldshtein Hoz' and
          financial_entity <> 'Social Security Deductions' and
          financial_entity <> 'Tax Deductions' and
          financial_entity <> 'Dotan Simha' and
          personal_category <> 'business'
  )
  select
      personal_category,
      sum(event_amount_in_usd_with_vat_if_exists)::float4 as overall_sum
  from transactions_exclude
  where
    event_date::text::date >= '2021-08-01'::text::date and
    event_date::text::date <= '2021-08-31'::text::date
  --   and personal_category = 'family'
  group by personal_category
  order by sum(event_amount_in_usd_with_vat_if_exists);    
    `),
  ]);

  const missingInvoiceDates: any = results[0].value;
  const missingInvoiceNumbers: any = results[1].value;
  const lastInvoiceNumbers: any = results[2].value;
  // let currentVATStatus: any = results[3].value;
  const VATTransactions: any = results[3].value;
  const allTransactions: any = results[4].value;
  const missingInvoiceImages: any = results[5].value;
  const profitTable: any = results[6].value;
  const thisMonthPrivateExpensesTable: any = results[7].value;

  console.timeEnd('callingDB');

  const formatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  });

  let profitTableHTMLTemplate = '';
  if (profitTable?.rows) {
    for (const profitMonth of profitTable?.rows ?? []) {
      profitTableHTMLTemplate = profitTableHTMLTemplate.concat(`
        <tr>
            <td>${profitMonth.date}</td>
            <td>${formatter.format(profitMonth.business_income)}</td>
            <td>${formatter.format(profitMonth.business_expenses)}</td>
          <td>${formatter.format(profitMonth.overall_business_profit)}</td>
          <td>${formatter.format(profitMonth.business_profit_share)}</td>
          <td>${formatter.format(profitMonth.private_expenses)}</td>
          <td>${formatter.format(profitMonth.overall_private)}</td>
        </tr>
        `);
    }
    profitTableHTMLTemplate = `
    <table>
      <thead>
          <tr>
              <th>Date</th>
              <th>Business Income</th>
              <th>Business Expenses</th>
              <th>overall_business_profit</th>
              <th>business_profit_share</th>
              <th>private_expenses</th>
              <th>overall_private</th>
              </tr>
      </thead>
      <tbody>
          ${profitTableHTMLTemplate}
      </tbody>
    </table>  
  `;
  }

  let thisMonthPrivateExpensesTableHTMLTemplate = '';
  if (thisMonthPrivateExpensesTable?.rows) {
    for (const expenseCategory of thisMonthPrivateExpensesTable?.rows ?? []) {
      thisMonthPrivateExpensesTableHTMLTemplate = thisMonthPrivateExpensesTableHTMLTemplate.concat(`
        <tr>
            <td>${expenseCategory.personal_category}</td>
            <td>${formatter.format(expenseCategory.overall_sum)}</td>
        </tr>
        `);
    }
    thisMonthPrivateExpensesTableHTMLTemplate = `
    <table>
      <thead>
          <tr>
              <th>Personal Category</th>
              <th>Amount</th>
              </tr>
      </thead>
      <tbody>
          ${thisMonthPrivateExpensesTableHTMLTemplate}
      </tbody>
    </table>  
  `;
  }

  let missingInvoiceDatesHTMLTemplate = '';
  if (missingInvoiceDates?.rows) {
    for (const transaction of missingInvoiceDates?.rows ?? []) {
      missingInvoiceDatesHTMLTemplate = missingInvoiceDatesHTMLTemplate.concat(`
        <tr>
          <td>${transaction.event_date.toISOString().replace(/T/, ' ').replace(/\..+/, '')}</td>
          <td>${transaction.event_amount}${currencyCodeToSymbol(transaction.currency_code)}</td>
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
    for (const transaction of missingInvoiceNumbers?.rows ?? []) {
      missingInvoiceNumbersHTMLTemplate = missingInvoiceNumbersHTMLTemplate.concat(`
        <tr>
          <td>${transaction.event_date.toISOString().replace(/T/, ' ').replace(/\..+/, '')}</td>
          <td>${transaction.event_amount}${currencyCodeToSymbol(transaction.currency_code)}</td>
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
    for (const transaction of missingInvoiceImages?.rows ?? []) {
      missingInvoiceImagesHTMLTemplate = missingInvoiceImagesHTMLTemplate.concat(`
          <tr>
            <td>${transaction.event_date.toISOString().replace(/T/, ' ').replace(/\..+/, '')}</td>
            <td>${transaction.event_amount}${currencyCodeToSymbol(transaction.currency_code)}</td>
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

  let VATTransactionsString = '';
  if (VATTransactions?.rows) {
    for (const transaction of VATTransactions?.rows ?? []) {
      VATTransactionsString = VATTransactionsString.concat(`
        <tr>
          <td>${transaction.overall_vat_status}</td>
          <td>${transaction.vat}</td>
          <td>${transaction.event_date.toISOString().replace(/T/, ' ').replace(/\..+/, '')}</td>
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
    for (const transaction of allTransactions?.rows ?? []) {
      allTransactionsString = allTransactionsString.concat(`
        <tr bank_reference=${transaction.bank_reference}
            account_number=${transaction.account_number}
            account_type=${transaction.account_type}
            currency_code=${transaction.currency_code}
            event_date=${transaction.event_date.toISOString().replace(/T/, ' ').replace(/\..+/, '')}
            event_amount=${transaction.event_amount}
            event_number=${transaction.event_number}
            transaction_id=${transaction.id}>
          <td>
            ${moment(transaction.event_date).format('DD/MM/YY')}
            ${
              transaction.debit_date
                ? `<div style="font-size: 12px; color: gray;">` +
                  moment(transaction.debit_date).format('DD/MM/YY') +
                  `</div>`
                : ''
            }
          </td>
          <td>${transaction.event_amount}${currencyCodeToSymbol(transaction.currency_code)}</td>
          <td class="financial_entity" ${
            transaction.financial_entity ? '' : 'style="background-color: rgb(236, 207, 57);"'
          }>${
            transaction.financial_entity
              ? transaction.financial_entity
              : `${
                  suggestedTransaction(transaction)?.financialEntity
                } <button type="button" onClick='printElement(this, "${
                  suggestedTransaction(transaction)?.financialEntity
                }");'>V</button>`
          }
            <button type="button" onClick='printElement(this, prompt("New financial entity:"));'>&#x270f;</button>
          </td>
          <td class="user_description" ${
            transaction.user_description ? '' : 'style="background-color: rgb(236, 207, 57);"'
          }>${
            transaction.user_description
              ? transaction.user_description
              : `${
                  suggestedTransaction(transaction)?.userDescription
                } <button type="button" onClick='printElement(this, "${
                  suggestedTransaction(transaction)?.userDescription
                }");'>V</button>`
          }
            <button type="button" onClick='printElement(this, prompt("New user description:"));'>&#x270f;</button>
          </td>
          <td class="personal_category" ${
            transaction.personal_category ? '' : 'style="background-color: rgb(236, 207, 57);"'
          }>${
            transaction.personal_category
              ? transaction.personal_category
              : `${
                  suggestedTransaction(transaction)?.personalCategory
                } <button type="button" onClick='printElement(this, "${
                  suggestedTransaction(transaction)?.personalCategory
                }");'>V</button>`
          }
            <button type="button" onClick='printElement(this, prompt("New personal category:"));'>&#x270f;</button>
          </td>
          <td class="vat"  ${
            (!transaction.vat &&
              isBusiness(transaction) &&
              !entitiesWithoutInvoice.includes(transaction.financial_entity_id) &&
              !businessesWithoutTaxCategory.includes(transaction.financial_entity_id) &&
              transaction.currency_code == 'ILS') ||
            (transaction.vat > 0 && transaction.event_amount < 0) ||
            (transaction.vat < 0 && transaction.event_amount > 0)
              ? 'style="background-color: rgb(236, 207, 57);"'
              : ''
          }>
          ${
            transaction.vat || transaction.vat == 0
              ? transaction.vat
              : `${
                  suggestedTransaction(transaction)?.vat
                } <button type="button" onClick='printElement(this, "${
                  suggestedTransaction(transaction)?.vat
                }");'>V</button>`
          }
            <button type="button" onClick='printElement(this, prompt("New VAT:"));'>&#x270f;</button>
          </td>
          <td>${transaction.account_number}${transaction.account_type}</td>
          <td class="financial_accounts_to_balance" ${
            shareWithDotan(transaction) ? 'style="background-color: rgb(236, 207, 57);"' : ''
          }>${
            transaction.financial_accounts_to_balance
              ? transaction.financial_accounts_to_balance
              : `${
                  suggestedTransaction(transaction)?.financialAccountsToBalance
                } <button type="button" onClick='printElement(this, "${
                  suggestedTransaction(transaction)?.financialAccountsToBalance
                }");'>V</button>`
          }
            <button type="button" onClick='printElement(this, prompt("New Account to share:"));'>&#x270f;</button>
          </td>
          <td class="tax_category">${transaction.tax_category}
            <button type="button" onClick='printElement(this, prompt("New Tax category:"));'>&#x270f;</button>
          </td>
          <td>${transaction.detailed_bank_description}</td>
          <td class="proforma_invoice_file" ${
            isBusiness(transaction) && !transaction.proforma_invoice_file
              ? 'style="background-color: rgb(236, 207, 57);"'
              : ''
          }>
            ${
              transaction.proforma_invoice_file
                ? `<a href="${transaction.proforma_invoice_file}" target="_blank">yes</a>`
                : ''
            }
            <button type="button" onClick='printElement(this, prompt("New Invoice Photo:"));'>&#x270f;</button>
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
            <button type="button" onClick='printElement(this, prompt("New Invoice Date:"));'>&#x270f;</button>
          </td>
          <td class="tax_invoice_number" ${
            isBusiness(transaction) &&
            !entitiesWithoutInvoiceNumber.includes(transaction.financial_entity_id) &&
            !transaction.tax_invoice_number
              ? 'style="background-color: rgb(236, 207, 57);"'
              : ''
          }>
            ${transaction.tax_invoice_number}
            <button type="button" onClick='printElement(this, prompt("New Invoice Number:"));'>&#x270f;</button>
          </td>
          <td class="tax_invoice_file" ${
            isBusiness(transaction) && !transaction.tax_invoice_file
              ? 'style="background-color: rgb(236, 207, 57);"'
              : ''
          }>
            ${
              transaction.tax_invoice_file
                ? `<a href="${transaction.tax_invoice_file}" target="_blank">yes</a>`
                : ''
            }
            <button type="button" onClick='printElement(this, prompt("New Invoice path:"));'>&#x270f;</button>
          </td>

          <td class="receipt_image" ${
            isBusiness(transaction) &&
            !transaction.receipt_image &&
            !transaction.proforma_invoice_file
              ? 'style="background-color: rgb(236, 207, 57);"'
              : ''
          }>
            ${
              transaction.receipt_image
                ? `<a href="${transaction.receipt_image}" target="_blank">yes</a>`
                : ''
            }
            <button type="button" onClick='printElement(this, prompt("New Invoice Photo:"));'>&#x270f;</button>
          </td>
          <td class="receipt_date" ${
            isBusiness(transaction) && !transaction.receipt_date && !transaction.tax_invoice_date
              ? 'style="background-color: rgb(236, 207, 57);"'
              : ''
          }>${transaction.receipt_date ? moment(transaction.receipt_date).format('DD/MM/YY') : ''}
            <button type="button" onClick='printElement(this, prompt("New Invoice Date:"));'>&#x270f;</button>
          </td>
          <td class="receipt_number" ${
            isBusiness(transaction) &&
            !entitiesWithoutInvoiceNumber.includes(transaction.financial_entity_id) &&
            !transaction.receipt_number &&
            !transaction.tax_invoice_number
              ? 'style="background-color: rgb(236, 207, 57);"'
              : ''
          }>
            ${transaction.receipt_number}
            <button type="button" onClick='printElement(this, prompt("New Invoice Number:"));'>&#x270f;</button>
          </td>
          <td class="receipt_url" ${
            isBusiness(transaction) && !transaction.receipt_url && !transaction.tax_invoice_file
              ? 'style="background-color: rgb(236, 207, 57);"'
              : ''
          }>
            ${
              transaction.receipt_url
                ? `<a href="${transaction.receipt_url}" target="_blank">yes</a>`
                : ''
            }
            <button type="button" onClick='printElement(this, prompt("New Invoice path:"));'>&#x270f;</button>
          </td>
          
          
          <td class="links">
            ${transaction.links ? 'yes' : ''}
            <button type="button" onClick='printElement(this, prompt("New links:"));'>&#x270f;</button>
            <button type="button" onClick='updateClipboard("${
              transaction.links
            }");'>&#9986;</button>
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
                  <th>invoice_date</th>
                  <th>debit_account_1</th>
                  <th>debit_amount_1</th>
                  <th>foreign_debit_amount_1</th>
                  <th>currency</th>
                  <th>credit_account_1</th>
                  <th>credit_amount_1</th>
                  <th>foreign_credit_amount_1</th>
                  <th>debit_account_2</th>
                  <th>debit_amount_2</th>
                  <th>foreign_debit_amount_2</th>
                  <th>credit_account_2</th>
                  <th>credit_amount_2</th>
                  <th>foreign_credit_amount_2</th>
                  <th>details</th>
                  <th>reference_1</th>
                  <th>reference_2</th>
                  <th>movement_type</th>
                  <th>value_date</th>
                  <th>date_3</th>
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
                <th>Receipt Image</th>
                <th>Receipt Date</th>
                <th>Receipt Number</th>
                <th>Receipt URL</th>
                <th>Links</th>
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
  
      ${profitTableHTMLTemplate}

      <br> 

      ${thisMonthPrivateExpensesTableHTMLTemplate}

      <h3>Missing invoice numbers for a month</h3>
  
      ${missingInvoiceNumbersHTMLTemplate}
  
      <h3>Missing invoice dates for a month</h3>
  
      ${missingInvoiceDatesHTMLTemplate}

      <h3>Missing invoice images</h3>

      ${missingInvoiceImagesHTMLTemplate}
  
      <h3>Last invoice numbers</h3>
  
      ${getLastInvoiceNumbers(lastInvoiceNumbers)}
  
      <h3>VAT Transactions for this month:</h3>
  
      ${VATTransactionsString}
  
      <h3>All Transactions</h3>
  
      ${allTransactionsString}
  
      <script type="module" src="/browser.js"></script>
      <script type="module">
        import { printElement, updateClipboard } from '/browser.js';
  
        window.printElement = printElement;
        window.updateClipboard = updateClipboard;
      </script>
    `;
};
