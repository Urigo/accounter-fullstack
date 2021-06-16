import { pool } from '../index';
import moment from 'moment';
import {
  addTrueVATtoTransaction,
  hashDateFormat,
  hashAccounts,
  hashNumber,
  insertMovementQuery,
} from './taxesForTransaction';
import { v4 as uuidv4 } from 'uuid';

enum TransactionType {
  Income = '>',
  Expenses = '<',
}

function getVATTransaction(
  month: Date,
  transactionType: TransactionType
): string {
  return `
		SELECT *
		FROM accounter_schema.all_transactions
		WHERE
			account_number in ('2733', '61066') AND
			event_date >= date_trunc('month', to_date('${moment(month).format(
        'YYYY-MM-DD'
      )}', 'YYYY-MM-DD')) AND
			event_date <= date_trunc('month', to_date('${moment(month).format(
        'YYYY-MM-DD'
      )}', 'YYYY-MM-DD')) + interval '1 month' - interval '1 day' AND
			vat ${transactionType} 0;	
	`;
}

export async function createTaxEntriesForMonth(month: Date) {
  for (const transactionType of Object.values(TransactionType)) {
    console.log(transactionType);

    let monthIncomeVATTransactions: any = await pool.query(
      getVATTransaction(month, transactionType)
    );
    let expensesVATSum = 0;
    for (const monthIncomeVATTransaction of monthIncomeVATTransactions?.rows) {
      addTrueVATtoTransaction(monthIncomeVATTransaction);
      expensesVATSum += parseFloat(monthIncomeVATTransaction.vatAfterDiduction);
    }

    console.log(expensesVATSum);
    if (expensesVATSum != 0) {
      let entryForMonthlyVAT = [
        hashDateFormat(moment(month).endOf('month').toDate()),
        transactionType == TransactionType.Expenses
          ? hashAccounts('VAT', null, null, null, null, null, null)
          : 'עסק',
        hashNumber(expensesVATSum),
        null,
        null,
        transactionType == TransactionType.Expenses
          ? 'תשו'
          : hashAccounts('VAT', null, null, null, null, null, null),
        hashNumber(expensesVATSum),
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
      ];

      console.log(entryForMonthlyVAT);

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

await createTaxEntriesForMonth(moment('2021-04-01', 'YYYY-MM-DD').toDate());
