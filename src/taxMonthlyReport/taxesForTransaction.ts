import { pool } from '../index';
import moment from 'moment';

const entitiesWithoutInvoiceDate = ['Uri Goldshtein', 'Poalim', 'Isracard'];

const taxCategoriesWithNotFullVAT = ['פלאפון', 'ציוד', 'מידע'];

export async function createTaxEntriesForTransaction(transactionId: string) {
  let transaction: any = await pool.query(`
    SELECT *
    FROM accounter_schema.all_transactions
    WHERE
        id = $$${transactionId}$$
  `);
  transaction = transaction.rows[0];

  let entryForFinancialAccount: any = {};
  let entryForAccounting: any = {};

  // credit זכות
  // debit חובה
  let invoiceDate = !entitiesWithoutInvoiceDate.includes(
    transaction.financial_entity
  )
    ? transaction.tax_invoice_date
    : transaction.event_date;

  let vatAfterDiduction = !taxCategoriesWithNotFullVAT.includes(
    transaction.tax_category
  )
    ? transaction.vat
    : (transaction.vat / 3) * 2;

  let amountBeforeVAT = transaction.event_amount - vatAfterDiduction;

  let exchangeRates;
  if (transaction.currency_code != 'ILS') {
    const exchangeQuery = `
      select usd, eur
      from accounter_schema.exchange_rates
      where exchange_date = to_date('${moment(transaction.debit_date).format(
        'YYYY-MM-DD'
      )}', 'YYYY-MM-DD');
    `;

    try {
      exchangeRates = await pool.query(exchangeQuery);
    } catch (error) {
      console.log('error in DB - ', error);
    }
  }

  let amountInShekels;
  let amountInForeign;

  switch (transaction.currency_code) {
    case 'ILS':
      amountInShekels = transaction.event_amount;
      amountInForeign = undefined;
      break;
    case 'USD':
      amountInShekels = transaction.event_amount * exchangeRates?.rows[0].usd;
      amountInForeign = transaction.event_amount;
      break;
    case 'EUR':
      amountInShekels = transaction.event_amount * exchangeRates?.rows[0].eur;
      amountInForeign = transaction.event_amount;
      break;
    default:
      // TODO: Log important checks
      console.log('New account currency - ', transaction.currency_code);
      break;
  }
  let sideOne = {
    account: transaction.financial_entity,
    amountInShekels,
    amountInForeign,
  };

  entryForAccounting.invoiceDate = invoiceDate;
  entryForFinancialAccount.invoiceDate = transaction.event_date;
  // TODO: Use swap to simplify code: https://stackoverflow.com/questions/12224987/swap-value-of-two-properties-on-objects
  if (transaction.event_amount > 0) {
    entryForAccounting.creditAccount = transaction.tax_category;
    entryForAccounting.debitAccount = transaction.financial_entity;
    entryForFinancialAccount.creditAccount = transaction.financial_entity;
    entryForFinancialAccount.debitAccount = transaction.account_type;
    entryForAccounting.reference2 = transaction.bank_reference;
    entryForAccounting.reference1 = transaction.tax_invoice_number;
  } else {
    entryForAccounting.creditAccount = transaction.financial_entity;
    entryForAccounting.debitAccount = transaction.tax_category;
    entryForFinancialAccount.creditAccount = transaction.account_type;
    entryForFinancialAccount.debitAccount = transaction.financial_entity;
    entryForAccounting.reference1 = transaction.bank_reference;
    entryForAccounting.reference2 = transaction.tax_invoice_number;
  }

  if (vatAfterDiduction && vatAfterDiduction != 0) {
    let secondEntry;
  }

  return 'done';
}
