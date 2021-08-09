import { pool } from '../index';
import moment from 'moment';
import {
  addTrueVATtoTransaction,
  hashDateFormat,
  hashAccounts,
  hashNumber,
  insertMovementQuery,
  getVATIndexes,
  getILSForDate,
  getTransactionExchangeRates,
  getHashBusinessIndexes,
  hashNumberRounded,
} from './taxesForTransaction';
import { v4 as uuidv4 } from 'uuid';

enum TransactionType {
  Income = '>',
  Expenses = '<',
}

function getVATTransaction(
  month: Date,
  transactionType: TransactionType,
  businessName: String
): string {
  const getCurrentBusinessAccountsQuery = `
    (select account_number
      from accounter_schema.financial_accounts
      where owner = (
          select id
          from accounter_schema.businesses
          where name = $$${businessName}$$
    ))
  `;

  return `
		SELECT *
		FROM accounter_schema.all_transactions
		WHERE
			account_number in (${getCurrentBusinessAccountsQuery}) AND
			event_date >= date_trunc('month', to_date('${moment(month).format(
    'YYYY-MM-DD'
  )}', 'YYYY-MM-DD')) AND
			event_date <= date_trunc('month', to_date('${moment(month).format(
    'YYYY-MM-DD'
  )}', 'YYYY-MM-DD')) + interval '1 month' - interval '1 day' AND
			vat ${transactionType} 0;	
	`;
}

export async function createTaxEntriesForMonth(
  month: Date,
  businessName: String
) {
  let ownerResult: any = await pool.query(`
    select owner
    from accounter_schema.financial_accounts
    where owner = (
      select id
      from accounter_schema.businesses
      where name = $$${businessName}$$
)
  `);
  let owner = ownerResult.rows[0].owner;
  let hashVATIndexes = await getVATIndexes(owner);

  const getCurrentBusinessAccountsQuery = `
    (select account_number
      from accounter_schema.financial_accounts
      where owner = (
          select id
          from accounter_schema.businesses
          where name = $$${businessName}$$
    ))
  `;

  let getAllIncomeTransactionsQuery = `
      SELECT *
      FROM accounter_schema.all_transactions
      WHERE
        account_number in (${getCurrentBusinessAccountsQuery}) AND
        event_date >= date_trunc('month', to_date('${moment(month).format(
    'YYYY-MM-DD'
  )}', 'YYYY-MM-DD')) AND
        event_date <= date_trunc('month', to_date('${moment(month).format(
    'YYYY-MM-DD'
  )}', 'YYYY-MM-DD')) + interval '1 month' - interval '1 day' AND
        event_amount > 0 and is_conversion is false;	
    `;

  let monthIncomeTransactions: any = await pool.query(
    getAllIncomeTransactionsQuery
  );

  let incomeSum = 0;
  let VATFreeIncomeSum = 0;
  let VATIncomeSum = 0;
  for (const monthIncomeTransaction of monthIncomeTransactions?.rows) {
    let transactionsExchnageRates = await getTransactionExchangeRates(
      monthIncomeTransaction
    );
    addTrueVATtoTransaction(monthIncomeTransaction);
    let debitExchangeRates = transactionsExchnageRates.debitExchangeRates;
    let invoiceExchangeRates = transactionsExchnageRates.invoiceExchangeRates;
    console.log('Income Tax Transaction: ', {
      name: monthIncomeTransaction.financial_entity,
      invoiceDate: hashDateFormat(monthIncomeTransaction.tax_invoice_date),
      amount: monthIncomeTransaction.event_amount,
      currency: monthIncomeTransaction.currency_code,
      ILSAmountInvoiceExchangeRates: getILSForDate(
        monthIncomeTransaction,
        invoiceExchangeRates
      ).eventAmountILS,
      ILSAmountDebitExchangeRates: getILSForDate(
        monthIncomeTransaction,
        debitExchangeRates
      ).eventAmountILS,
      invoiceImage: monthIncomeTransaction.proforma_invoice_file,
      vat: monthIncomeTransaction.vat,
    });
    incomeSum +=
      parseFloat(
        getILSForDate(monthIncomeTransaction, invoiceExchangeRates)
          .eventAmountILS
      ) - monthIncomeTransaction.vat;
    if (monthIncomeTransaction.vat) {
      console.log('vat income', parseFloat(
        getILSForDate(monthIncomeTransaction, invoiceExchangeRates)
          .eventAmountILS
      ) - monthIncomeTransaction.vat);
      VATIncomeSum += parseFloat(
        getILSForDate(monthIncomeTransaction, invoiceExchangeRates)
          .eventAmountILS
      ) - monthIncomeTransaction.vat;
    } else {
      console.log('not vat income', parseFloat(
        getILSForDate(monthIncomeTransaction, invoiceExchangeRates)
          .eventAmountILS
      ));
      VATFreeIncomeSum += parseFloat(
        getILSForDate(monthIncomeTransaction, invoiceExchangeRates)
          .eventAmountILS
      );
    }
    console.log('SUM till now - ', incomeSum);
    console.log('VAT free income SUM till now - ', VATFreeIncomeSum);
    console.log('VAT income SUM till now - ', VATIncomeSum);
  }
  console.log('SUM to tax ------ ', incomeSum);
  console.log('Advance sum ------ ', (incomeSum / 100) * 8.2); // TODO: Move 8.2 to read from table
  console.log('VAT free SUM ------ ', VATFreeIncomeSum);
  console.log('VAT income SUM ------ ', VATIncomeSum);

  for (const transactionType of Object.values(TransactionType)) {
    console.log(`VAT transactions - ${transactionType}`);
    let monthIncomeVATTransactions: any = await pool.query(
      getVATTransaction(month, transactionType, businessName)
    );
    let expensesVATSum = 0;
    for (const monthIncomeVATTransaction of monthIncomeVATTransactions?.rows) {
      addTrueVATtoTransaction(monthIncomeVATTransaction);
      console.log('vat transaction: ', {
        name: monthIncomeVATTransaction.financial_entity,
        invoiceDate: hashDateFormat(monthIncomeVATTransaction.tax_invoice_date),
        amount: monthIncomeVATTransaction.event_amount,
        currency: monthIncomeVATTransaction.currency_code,
        vat: monthIncomeVATTransaction.vat,
        actualVat: monthIncomeVATTransaction.vatAfterDiduction,
      });
      expensesVATSum += parseFloat(monthIncomeVATTransaction.vatAfterDiduction);
    }

    console.log(`expensesVATSum - ${transactionType}`, expensesVATSum);
    if (expensesVATSum != 0) {
      let hashBusinessIndexes = await getHashBusinessIndexes({ financial_entity: 'VAT' }, owner);

      let entryForMonthlyVAT = [
        hashDateFormat(moment(month).endOf('month').toDate()),
        transactionType == TransactionType.Expenses
          ? hashAccounts('VAT', null, hashBusinessIndexes, hashVATIndexes, null, null, null)
          : hashVATIndexes.vatOutputsIndex,
        hashNumberRounded(expensesVATSum),
        null,
        null,
        transactionType == TransactionType.Expenses
          ? hashVATIndexes.vatInputsIndex
          : hashAccounts('VAT', null, hashBusinessIndexes, hashVATIndexes, null, null, null),
        hashNumberRounded(expensesVATSum),
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        `פקודת מעמ ${moment(month).format('MM/YYYY')}`,
        null,
        null,
        null,
        hashDateFormat(moment(month).endOf('month').toDate()),
        hashDateFormat(moment(month).endOf('month').toDate()),
        null,
        transactionType == TransactionType.Expenses
          ? 'all_vat_to_pay_for_previous_month'
          : 'all_vat_to_recieve_for_previous_month',
        null,
        uuidv4(),
        owner,
      ];

      console.log('entryForMonthlyVAT', entryForMonthlyVAT);

      let queryConfig = {
        text: insertMovementQuery,
        values: entryForMonthlyVAT,
      };

      try {
        let updateResult = await pool.query(queryConfig);
        console.log(JSON.stringify(updateResult.rows[0]));
      } catch (error) {
        // TODO: Log important checks
        console.log(`error in insert monthly VAT ${transactionType} - `, error);
      }
    }
  }
}

let currrentCompany = 'Software Products Guilda Ltd.';
currrentCompany = 'Uri Goldshtein LTD';
await createTaxEntriesForMonth(
  moment('2021-05-01', 'YYYY-MM-DD').toDate(),
  currrentCompany
);
