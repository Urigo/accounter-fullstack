import pg from 'pg';
const { Pool } = pg;
import moment from 'moment';
import {
  addTrueVATtoTransaction,
  hashDateFormat,
  hashAccounts,
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

  let symbolToUse: any = transactionType;
  let extraSymbol = '';
  if (transactionType === TransactionType.Income) {
    symbolToUse = '>=';
    extraSymbol = ' and event_amount > 0';
  }

  return `
		SELECT *
		FROM accounter_schema.all_transactions
		WHERE
			account_number in (${getCurrentBusinessAccountsQuery}) AND
			event_date >= date_trunc('month', to_date('${moment(month).subtract(1, 'months').format(
        'YYYY-MM-DD'
      )}', 'YYYY-MM-DD')) AND
			event_date <= date_trunc('month', to_date('${moment(month).format(
        'YYYY-MM-DD'
      )}', 'YYYY-MM-DD')) + interval '1 month' - interval '1 day' AND
			vat ${symbolToUse} 0 ${extraSymbol}
      order by event_date;	
	`;
}

export async function createTaxEntriesForMonth(
  month: Date,
  businessName: String,
  pool: pg.Pool
) {
  let businessIdByNameQuery = `
  (
    select id
    from accounter_schema.businesses
    where name = $$${businessName}$$
  )
  `;
  let ownerResult: any = await pool.query(`
    select owner
    from accounter_schema.financial_accounts
    where owner = ${businessIdByNameQuery}
  `);
  let owner = ownerResult.rows[0].owner;
  let hashVATIndexes = await getVATIndexes(owner);

  const getCurrentBusinessAccountsQuery = `
    (select account_number
      from accounter_schema.financial_accounts
      where owner = ${businessIdByNameQuery})
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
        event_amount > 0 and is_conversion is false
        order by event_date;	
    `;

  let monthIncomeTransactions: any = await pool.query(
    getAllIncomeTransactionsQuery
  );

  let monthTaxHTMLTemplate = '';
  let incomeSum = 0;
  let VATFreeIncomeSum = 0;
  let VATIncomeSum = 0;
  let advancePercentageRate = 8.2;
  for (const monthIncomeTransaction of monthIncomeTransactions?.rows) {
    let isExcludedFromTaxReportQuery = `
      select include_in_tax_report
      from accounter_schema.hash_business_indexes
      where business = (
        select id
        from accounter_schema.businesses
        where name = $$${monthIncomeTransaction.financial_entity}$$
      ) and hash_owner = ${businessIdByNameQuery};    
    `;
    let isExcludedFromTaxReport: any = await pool.query(
      isExcludedFromTaxReportQuery
    );
    if (
      isExcludedFromTaxReport.rowCount == 0 ||
      isExcludedFromTaxReport?.rows[0]?.include_in_tax_report == null ||
      isExcludedFromTaxReport?.rows[0]?.include_in_tax_report == true
    ) {
      let transactionsExchnageRates = await getTransactionExchangeRates(
        monthIncomeTransaction
      );
      let hashBusinessIndexes = await getHashBusinessIndexes(
        { financial_entity: monthIncomeTransaction.financial_entity },
        owner
      );
      monthIncomeTransaction.tax_category =
        hashBusinessIndexes?.auto_tax_category
          ? hashBusinessIndexes?.auto_tax_category
          : monthIncomeTransaction.tax_category;
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
        console.log(
          'vat income',
          parseFloat(
            getILSForDate(monthIncomeTransaction, invoiceExchangeRates)
              .eventAmountILS
          ) - monthIncomeTransaction.vat
        );
        VATIncomeSum +=
          parseFloat(
            getILSForDate(monthIncomeTransaction, invoiceExchangeRates)
              .eventAmountILS
          ) - monthIncomeTransaction.vat;
      } else {
        console.log(
          'not vat income',
          parseFloat(
            getILSForDate(monthIncomeTransaction, invoiceExchangeRates)
              .eventAmountILS
          )
        );
        VATFreeIncomeSum += parseFloat(
          getILSForDate(monthIncomeTransaction, invoiceExchangeRates)
            .eventAmountILS
        );
      }
      console.log('SUM till now - ', incomeSum);
      console.log('VAT free income SUM till now - ', VATFreeIncomeSum);
      console.log('VAT income SUM till now - ', VATIncomeSum);
      monthTaxHTMLTemplate = monthTaxHTMLTemplate.concat(`
      <tr>
        <td>${monthIncomeTransaction.financial_entity}</td>
        <td>${monthIncomeTransaction.tax_invoice_number}</td>
        <td>${hashDateFormat(monthIncomeTransaction.tax_invoice_date)}</td>
        <td>${monthIncomeTransaction.tax_invoice_amount}</td>
        <td>${monthIncomeTransaction.event_amount} ${
        monthIncomeTransaction.currency_code
      }</td>
        <td>${monthIncomeTransaction.vat}</td>
        <td>${monthIncomeTransaction.amountBeforeVAT}</td>
        <td>${
          getILSForDate(monthIncomeTransaction, invoiceExchangeRates)
            .eventAmountILS
        }</td>
        <td>${
          getILSForDate(monthIncomeTransaction, debitExchangeRates)
            .eventAmountILS
        }</td>
        <td><a href="${monthIncomeTransaction.proforma_invoice_file}">P</a></td>
        <td>${incomeSum}</td>
        <td>${VATFreeIncomeSum}</td>
        <td>${VATIncomeSum}</td>
      </tr>
      `);
    }
  }
  monthTaxHTMLTemplate = `
  <table>
    <thead>
        <tr>
          <th>Name</th>
          <th>Invoice Number</th>
          <th>Tax Invoice Date</th>
          <th>Tax Invoice Amount</th>
          <th>Amount</th>
          <th>VAT</th>
          <th>SUM Before VAT</th>
          <th>In ILS Invoice</th>
          <th>In ILS Debit</th>
          <th>Image</th>
          <th>Sum till now</th>
          <th>VAT Free Sum till now</th>
          <th>VAT Income Sum till now</th>
        </tr>
    </thead>
    <tbody>
        ${monthTaxHTMLTemplate}
    </tbody>
  </table>  
`;
  console.log('SUM to tax ------ ', incomeSum);
  console.log('Advance sum ------ ', (incomeSum / 100) * advancePercentageRate); // TODO: Move 8.2 to read from table
  console.log('VAT free SUM ------ ', VATFreeIncomeSum);
  console.log('VAT income SUM ------ ', VATIncomeSum);

  let overallMonthTaxHTMLTemplate = `
  <table>
    <thead>
        <tr>
          <th>Sum to Tax</th>
          <th>Advance Percentage Rate</th>
          <th>Advance Percent</th>
          <th>VAT Freee Sum</th>
          <th>VAT Income Sum</th>
        </tr>
    </thead>
    <tbody>
        <tr>
          <td>${hashNumberRounded(incomeSum)}</td>
          <td>${hashNumberRounded(
            (incomeSum / 100) * advancePercentageRate
          )}</td>
          <td>${advancePercentageRate}</td>
          <td>${VATFreeIncomeSum}</td>
          <td>${VATIncomeSum}</td>
        </tr>
    </tbody>
  </table>  
`;

  let monthVATReportHTMLTemplate = '';
  let overallVATHTMLTemplate = '';
  for (const transactionType of Object.values(TransactionType)) {
    console.log(`VAT transactions - ${transactionType}`);
    let monthIncomeVATTransactions: any = await pool.query(
      getVATTransaction(month, transactionType, businessName)
    );
    let expensesVATSum = 0;
    let expensesWithVATExcludingVATSum = 0;
    let expensesWithoutVATVATSum = 0;
    for (const monthIncomeVATTransaction of monthIncomeVATTransactions?.rows) {
      let hashBusinessIndexes = await getHashBusinessIndexes(
        { financial_entity: monthIncomeVATTransaction.financial_entity },
        owner
      );
      monthIncomeVATTransaction.tax_category =
        hashBusinessIndexes?.auto_tax_category
          ? hashBusinessIndexes?.auto_tax_category
          : monthIncomeVATTransaction.tax_category;
      addTrueVATtoTransaction(monthIncomeVATTransaction);
      let businessVATNumberQuery = `
        select vat_number
        from accounter_schema.businesses
        where
            name = $$${monthIncomeVATTransaction.financial_entity}$$;    
      `;
      let financialEntityVATNumber: any = await pool.query(
        businessVATNumberQuery
      );
      monthIncomeVATTransaction.vatNumber =
        financialEntityVATNumber?.rows[0]?.vat_number;
      console.log('vat transaction: ', {
        name: monthIncomeVATTransaction.financial_entity,
        invoiceDate: hashDateFormat(monthIncomeVATTransaction.tax_invoice_date),
        amount: monthIncomeVATTransaction.event_amount,
        currency: monthIncomeVATTransaction.currency_code,
        vat:
          Math.round(
            (parseFloat(monthIncomeVATTransaction.vat) + Number.EPSILON) * 100
          ) / 100,
        actualVat:
          Math.round(
            (parseFloat(monthIncomeVATTransaction.vatAfterDiduction) +
              Number.EPSILON) *
              100
          ) / 100,
        vatNumber: monthIncomeVATTransaction.vatNumber,
      });

      expensesVATSum +=
        Math.round(
          (parseFloat(monthIncomeVATTransaction.vatAfterDiduction) +
            Number.EPSILON) *
            100
        ) / 100;

      let transactionsExchnageRates = await getTransactionExchangeRates(
        monthIncomeVATTransaction
      );
      let invoiceExchangeRates = transactionsExchnageRates.invoiceExchangeRates;
      let amountBeforeVAT = 0;
      if (!monthIncomeVATTransaction.vat || monthIncomeVATTransaction.vat == 0 || monthIncomeVATTransaction.vat == '0.00') {
        amountBeforeVAT = Math.round(
          (parseFloat(getILSForDate(
            monthIncomeVATTransaction,
            invoiceExchangeRates
          ).eventAmountILS) +
            Number.EPSILON) *
            100
        ) / 100;
      } else {
        amountBeforeVAT = Math.round(
          (parseFloat(monthIncomeVATTransaction.amountBeforeFullVAT) +
            Number.EPSILON) *
            100
        ) / 100 // TODO: Add amount before VAT in ILS always
      }
      if (!monthIncomeVATTransaction.vat || monthIncomeVATTransaction.vat == 0 || monthIncomeVATTransaction.vat == '0.00') {
        expensesWithoutVATVATSum +=
        Math.round(
          (parseFloat(getILSForDate(
            monthIncomeVATTransaction,
            invoiceExchangeRates
          ).eventAmountILS) +
            Number.EPSILON) *
            100
        ) / 100;
      } else {
        expensesWithVATExcludingVATSum +=
        Math.round(
          (parseFloat(monthIncomeVATTransaction.amountBeforeFullVAT) +
            Number.EPSILON) *
            100
        ) / 100;
      }
      monthVATReportHTMLTemplate = monthVATReportHTMLTemplate.concat(`
    <tr>
      <td>${monthIncomeVATTransaction.financial_entity}-${
        monthIncomeVATTransaction.vatNumber
      }</td>
      <td><a href="${monthIncomeVATTransaction.proforma_invoice_file}">P</a></td>
      <td>${monthIncomeVATTransaction.tax_invoice_number}</td>
      <td>${hashDateFormat(monthIncomeVATTransaction.tax_invoice_date)}</td>
      <td>${monthIncomeVATTransaction.event_amount} ${
        monthIncomeVATTransaction.currency_code
      }</td>
      <td>${
        Math.round(
          (parseFloat(monthIncomeVATTransaction.vat) + Number.EPSILON) * 100
        ) / 100
      }</td>
      <td>${
        Math.round(
          (parseFloat(monthIncomeVATTransaction.vatAfterDiduction) +
            Number.EPSILON) *
            100
        ) / 100
      }</td>
      <td>${Math.round((expensesVATSum + Number.EPSILON) * 100) / 100}</td>
      <td>${amountBeforeVAT}</td> 
      <td>${
        Math.round((expensesWithVATExcludingVATSum + Number.EPSILON) * 100) / 100
      }</td>
      <td>${expensesWithoutVATVATSum}</td>
    </tr>
    `);
    }

    console.log(JSON.stringify(monthIncomeVATTransactions.rows));

    console.log(`expensesVATSum - ${transactionType}`, expensesVATSum);
    if (expensesVATSum != 0) {
      let hashBusinessIndexes = await getHashBusinessIndexes(
        { financial_entity: 'VAT' },
        owner
      );

      let entryForMonthlyVAT = [
        hashDateFormat(moment(month).endOf('month').toDate()),
        transactionType == TransactionType.Expenses
          ? hashAccounts(
              'VAT',
              null,
              hashBusinessIndexes,
              hashVATIndexes,
              null,
              null,
              null
            )
          : hashVATIndexes.vatOutputsIndex,
        hashNumberRounded(expensesVATSum),
        null,
        null,
        transactionType == TransactionType.Expenses
          ? hashVATIndexes.vatInputsIndex
          : hashAccounts(
              'VAT',
              null,
              hashBusinessIndexes,
              hashVATIndexes,
              null,
              null,
              null
            ),
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

      overallVATHTMLTemplate = overallVATHTMLTemplate.concat(`
            <tr>
              <td>${moment(month).format('MM/YYYY')}</td>
              <td>${
                transactionType == TransactionType.Expenses
                  ? hashAccounts(
                      'VAT',
                      null,
                      hashBusinessIndexes,
                      hashVATIndexes,
                      null,
                      null,
                      null
                    )
                  : hashVATIndexes.vatOutputsIndex
              }</td>
              <td>${
                transactionType == TransactionType.Expenses
                  ? hashVATIndexes.vatInputsIndex
                  : hashAccounts(
                      'VAT',
                      null,
                      hashBusinessIndexes,
                      hashVATIndexes,
                      null,
                      null,
                      null
                    )
              }</td>
              <td>${hashNumberRounded(expensesVATSum)}</td>
            </tr>
    `);

      let queryConfig = {
        text: insertMovementQuery,
        values: entryForMonthlyVAT,
      };

      // try {
      //   let updateResult = await pool.query(queryConfig);
      //   console.log(JSON.stringify(updateResult.rows[0]));
      // } catch (error) {
      //   // TODO: Log important checks
      //   console.log(`error in insert monthly VAT ${transactionType} - `, error);
      // }
    }
  }
  monthVATReportHTMLTemplate = `
  <table>
    <thead>
        <tr>
          <th>Name</th>
          <th>Invoice Image</th>
          <th>Invoice Number</th>
          <th>Tax Invoice Date</th>
          <th>Amount</th>
          <th>VAT</th>
          <th>Actual VAT</th>
          <th>Sum till now</th>
          <th>Amount Before VAT</th>
          <th>Hayavot without VAT SUM till now</th>
          <th>Pturot SUM till now</th>
        </tr>
    </thead>
    <tbody>
        ${monthVATReportHTMLTemplate}
    </tbody>
  </table>  
  `;
  overallVATHTMLTemplate = `
  <table>
    <thead>
        <tr>
          <th>Month</th>
          <th>Account</th>
          <th>Second Account</th>
          <th>VAT Amount</th>
        </tr>
    </thead>
    <tbody>
        ${overallVATHTMLTemplate}
    </tbody>
  </table>  
`;
  return {
    monthTaxHTMLTemplate,
    overallMonthTaxHTMLTemplate,
    monthVATReportHTMLTemplate,
    overallVATHTMLTemplate,
  };
}

// export const pool = new Pool({
//   connectionString: process.env.DATABASE_URL,
//   ssl: {
//     rejectUnauthorized: false,
//   },
// });

// let currrentCompany = 'Software Products Guilda Ltd.';
// currrentCompany = 'Uri Goldshtein LTD';
// await createTaxEntriesForMonth(
//   moment('2021-05-01', 'YYYY-MM-DD').toDate(),
//   currrentCompany,
//   pool,
// );
