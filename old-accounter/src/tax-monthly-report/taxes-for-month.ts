import pg from 'pg';
import moment from 'moment';
import {
  addTrueVATtoTransaction,
  hashDateFormat,
  hashAccounts,
  // insertMovementQuery,
  getVATIndexes,
  getILSForDate,
  getTransactionExchangeRates,
  getHashBusinessIndexes,
  hashNumberRounded,
  hashNumber,
  hashNumberNoAbs,
} from './taxes-for-transaction';
import { v4 as uuidv4 } from 'uuid';

enum TransactionType {
  Income = '>',
  Expenses = '<',
}

function getVATTransaction(
  month: Date,
  transactionType: TransactionType,
  businessName: string,
  VATCadence: string
): any {
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

  let initialMonth = moment(month).format('YYYY-MM-DD');
  if (VATCadence == '1') {
    initialMonth = moment(month).format('YYYY-MM-DD');
  } else if (VATCadence == '2') {
    initialMonth = moment(month).subtract(1, 'months').format('YYYY-MM-DD');
  }

  return {
    transactionsByInvoiceDate: `
    SELECT 
      docs.date as tax_invoice_date,
      docs.serial_number as tax_invoice_number,
      docs.total_amount as tax_invoice_amount,
      docs.currency_code as currency_code,
      docs.image_url as proforma_invoice_file,
      transactions.tax_category as tax_category,
      transactions.event_date as event_date,
      transactions.debit_date as debit_date,
      transactions.event_amount as event_amount,
      transactions.financial_entity as financial_entity,
      transactions.vat as vat,
      transactions.user_description as user_description,
      transactions.bank_description as bank_description,
      transactions.withholding_tax as withholding_tax,
      transactions.interest as interest,
      transactions.id as id,
      transactions.detailed_bank_description as detailed_bank_description,
      transactions.receipt_number as receipt_number,
      transactions.business_trip as business_trip,
      transactions.personal_category as personal_category,
      transactions.financial_accounts_to_balance as financial_accounts_to_balance,
      transactions.bank_reference as bank_reference,
      transactions.event_number as event_number,
      transactions.account_number as account_number,
      transactions.account_type as account_type,
      transactions.is_conversion as is_conversion,
      transactions.currency_rate as currency_rate,
      transactions.contra_currency_code as contra_currency_code,
      transactions.original_id as original_id,
      transactions.reviewed as reviewed,
      transactions.hashavshevet_id as hashavshevet_id,
      transactions.current_balance as current_balance,
      transactions.tax_invoice_file as tax_invoice_file,
      transactions.links as links,
      transactions.receipt_image as receipt_image,
      transactions.receipt_url as receipt_url,
      transactions.receipt_date as receipt_date,
      transactions.is_property as is_property,
      transactions.tax_invoice_currency as tax_invoice_currency
      -- transactions.*
    FROM (
      select *
      from accounter_schema.all_transactions
      where
        account_number in ${getCurrentBusinessAccountsQuery} 
        AND (vat ${symbolToUse} 0 or vat is null) ${extraSymbol}
        AND financial_entity <> 'Social Security Deductions'
        AND financial_entity <> 'Tax'
        AND financial_entity <> 'VAT'
        AND financial_entity <> 'Dotan Simha Dividend'
    ) as "transactions"
    inner join (
      select *
      from accounter_schema.documents
      where
        date >= date_trunc('month', to_date('${initialMonth}', 'YYYY-MM-DD')) AND
        date <= date_trunc('month', to_date('${moment(month).format(
          'YYYY-MM-DD'
        )}', 'YYYY-MM-DD')) + interval '1 month' - interval '1 day'
    ) as "docs"
    on transactions.id = docs.charge_id
    order by docs.date;   
  `,
    transactionsByEventDate: `
      (SELECT *
      FROM accounter_schema.all_transactions
      WHERE
        account_number in (${getCurrentBusinessAccountsQuery}) AND
        event_date >= date_trunc('month', to_date('${moment(month)
          .subtract(1, 'months')
          .format('YYYY-MM-DD')}', 'YYYY-MM-DD')) AND
        event_date <= date_trunc('month', to_date('${moment(month).format(
          'YYYY-MM-DD'
        )}', 'YYYY-MM-DD')) + interval '1 month' - interval '1 day' AND
        (tax_invoice_date < date_trunc('month', to_date('${moment(month)
          .subtract(1, 'months')
          .format('YYYY-MM-DD')}', 'YYYY-MM-DD')) OR
        tax_invoice_date > date_trunc('month', to_date('${moment(month).format(
          'YYYY-MM-DD'
        )}', 'YYYY-MM-DD')) + interval '1 month' - interval '1 day' ) AND        
        (vat ${symbolToUse} 0 or vat is null) ${extraSymbol}
        AND financial_entity <> 'Social Security Deductions'
        order by event_date)
      UNION ALL
      (SELECT *
      FROM accounter_schema.all_transactions
      WHERE
        account_number in (${getCurrentBusinessAccountsQuery}) AND
        tax_invoice_date >= date_trunc('month', to_date('${initialMonth}', 'YYYY-MM-DD')) AND
        tax_invoice_date <= date_trunc('month', to_date('${moment(month).format(
          'YYYY-MM-DD'
        )}', 'YYYY-MM-DD')) + interval '1 month' - interval '1 day' AND
        (vat ${symbolToUse} 0 or vat is null) ${extraSymbol}
        AND financial_entity <> 'Social Security Deductions'
        AND financial_entity <> 'Tax'
        AND financial_entity <> 'VAT'
        AND financial_entity <> 'Dotan Simha Dividend'
        AND id in (select transaction_id from accounter_schema.taxes_transactions)
        order by tax_invoice_date)	     
      ;	    
    `,
    transactionsWithSharedInvoice: `
      SELECT *
      FROM accounter_schema.all_transactions
      WHERE
        account_number in (${getCurrentBusinessAccountsQuery}) AND
        tax_invoice_date >= date_trunc('month', to_date('${initialMonth}', 'YYYY-MM-DD')) AND
        tax_invoice_date <= date_trunc('month', to_date('${moment(month).format(
          'YYYY-MM-DD'
        )}', 'YYYY-MM-DD')) + interval '1 month' - interval '1 day' AND
        (vat ${symbolToUse} 0 or vat is null) ${extraSymbol}
        AND financial_entity <> 'Social Security Deductions'
        AND financial_entity <> 'Tax'
        AND financial_entity <> 'VAT'
        AND financial_entity <> 'Dotan Simha Dividend'
        AND id in (select transaction_id from accounter_schema.taxes_transactions)
        order by tax_invoice_date;	    
    `,
  };
}

function parseIntRound(v: any) {
  return parseInt(v + Math.sign(v) / 2);
}

export function stringNumberRounded(number: string): number {
  return parseIntRound((parseFloat(number) + Number.EPSILON) * 100) / 100;
}

export function numberRounded(number: number): number {
  return parseIntRound((number + Number.EPSILON) * 100) / 100;
}

export async function createTaxEntriesForMonth(month: Date, businessName: string, pool: pg.Pool) {
  const businessIdByNameQuery = `
  (
    select id
    from accounter_schema.businesses
    where name = $$${businessName}$$
  )
  `;
  const VATCadenceByNameResult: any = await pool.query(`
    select vat_report_cadence
    from accounter_schema.businesses
    where name = $$${businessName}$$
  `);
  const VATCadence = VATCadenceByNameResult.rows[0].vat_report_cadence;
  const ownerResult: any = await pool.query(`
    select owner
    from accounter_schema.financial_accounts
    where owner = ${businessIdByNameQuery}
  `);
  const owner = ownerResult.rows[0].owner;
  const hashVATIndexes = await getVATIndexes(owner);

  const getCurrentBusinessAccountsQuery = `
    (select account_number
      from accounter_schema.financial_accounts
      where owner = ${businessIdByNameQuery})
  `;

  const getAllIncomeTransactionsQuery = `
      SELECT 
        docs.date as tax_invoice_date,
        docs.serial_number as tax_invoice_number,
        docs.total_amount as tax_invoice_amount,
        docs.currency_code as currency_code,
        docs.image_url as proforma_invoice_file,
        transactions.tax_category as tax_category,
        transactions.event_date as event_date,
        transactions.debit_date as debit_date,
        transactions.event_amount as event_amount,
        transactions.financial_entity as financial_entity,
        transactions.vat as vat,
        transactions.user_description as user_description,
        transactions.bank_description as bank_description,
        transactions.withholding_tax as withholding_tax,
        transactions.interest as interest,
        transactions.id as id,
        transactions.detailed_bank_description as detailed_bank_description
      FROM (
        select *
        from accounter_schema.all_transactions
        where
          account_number in (${getCurrentBusinessAccountsQuery}) 
          and event_amount > 0 
          and is_conversion is false
      ) as "transactions"
      inner join (
        select *
        from accounter_schema.documents
        where
          date >= date_trunc('month', to_date('${moment(month).format('YYYY-MM-DD')}', 'YYYY-MM-DD')) AND
          date <= date_trunc('month', to_date('${moment(month).format(
            'YYYY-MM-DD'
          )}', 'YYYY-MM-DD')) + interval '1 month' - interval '1 day'
      ) as "docs"
      on transactions.id = docs.charge_id
      order by event_date;	
    `;

  const monthIncomeTransactions: any = await pool.query(getAllIncomeTransactionsQuery);

  let monthTaxHTMLTemplate = '';
  let incomeSum = 0;
  let VATFreeIncomeSum = 0;
  let VATIncomeSum = 0;
  const advancePercentageRate = 7;
  for (const monthIncomeTransaction of monthIncomeTransactions?.rows ?? []) {
    if (monthIncomeTransaction.tax_invoice_currency) {
      const originalCurrency = monthIncomeTransaction.currency_code;
      monthIncomeTransaction.currency_code = monthIncomeTransaction.tax_invoice_currency;

      const transactionsExchnageRates = await getTransactionExchangeRates(monthIncomeTransaction);
      const invoiceExchangeRates = transactionsExchnageRates.invoiceExchangeRates;

      monthIncomeTransaction.event_amount = monthIncomeTransaction.tax_invoice_amount = getILSForDate(
        monthIncomeTransaction,
        invoiceExchangeRates
      ).eventAmountILS;
      monthIncomeTransaction.debit_date = monthIncomeTransaction.tax_invoice_date;
      monthIncomeTransaction.vat =
        monthIncomeTransaction.vat * invoiceExchangeRates?.rows[0][monthIncomeTransaction.currency_code.toLowerCase()];
      monthIncomeTransaction.currency_code = originalCurrency;
    }
    const isExcludedFromTaxReportQuery = `
      select include_in_tax_report
      from accounter_schema.hash_business_indexes
      where business = (
        select id
        from accounter_schema.businesses
        where name = $$${monthIncomeTransaction.financial_entity}$$
      ) and hash_owner = ${businessIdByNameQuery};    
    `;
    const isExcludedFromTaxReport: any = await pool.query(isExcludedFromTaxReportQuery);
    if (
      isExcludedFromTaxReport.rowCount == 0 ||
      isExcludedFromTaxReport?.rows[0]?.include_in_tax_report == null ||
      isExcludedFromTaxReport?.rows[0]?.include_in_tax_report == true
    ) {
      const transactionsExchnageRates = await getTransactionExchangeRates(monthIncomeTransaction);
      const hashBusinessIndexes = await getHashBusinessIndexes(
        { financial_entity: monthIncomeTransaction.financial_entity },
        owner
      );
      monthIncomeTransaction.tax_category = hashBusinessIndexes?.auto_tax_category
        ? hashBusinessIndexes?.auto_tax_category
        : monthIncomeTransaction.tax_category;
      addTrueVATtoTransaction(monthIncomeTransaction);
      const debitExchangeRates = transactionsExchnageRates.debitExchangeRates;
      const invoiceExchangeRates = transactionsExchnageRates.invoiceExchangeRates;
      // console.log('Income Tax Transaction: ', {
      //   name: monthIncomeTransaction.financial_entity,
      //   invoiceDate: hashDateFormat(monthIncomeTransaction.tax_invoice_date),
      //   amount: monthIncomeTransaction.event_amount,
      //   currency: monthIncomeTransaction.currency_code,
      //   ILSAmountInvoiceExchangeRates: getILSForDate(
      //     monthIncomeTransaction,
      //     invoiceExchangeRates
      //   ).eventAmountILS,
      //   ILSAmountDebitExchangeRates: getILSForDate(
      //     monthIncomeTransaction,
      //     debitExchangeRates
      //   ).eventAmountILS,
      //   invoiceImage: monthIncomeTransaction.proforma_invoice_file,
      //   vat: monthIncomeTransaction.vat,
      // });
      incomeSum +=
        parseFloat(getILSForDate(monthIncomeTransaction, invoiceExchangeRates).eventAmountILS) -
        parseFloat(getILSForDate(monthIncomeTransaction, invoiceExchangeRates).vatAfterDiductionILS);
      if (monthIncomeTransaction.vat) {
        // console.log(
        //   'vat income',
        //   parseFloat(
        //     getILSForDate(monthIncomeTransaction, invoiceExchangeRates)
        //       .eventAmountILS
        //   ) - monthIncomeTransaction.vat
        // );
        VATIncomeSum +=
          parseFloat(getILSForDate(monthIncomeTransaction, invoiceExchangeRates).eventAmountILS) -
          parseFloat(getILSForDate(monthIncomeTransaction, invoiceExchangeRates).vatAfterDiductionILS);
      } else {
        // console.log(
        //   'not vat income',
        //   parseFloat(
        //     getILSForDate(monthIncomeTransaction, invoiceExchangeRates)
        //       .eventAmountILS
        //   )
        // );
        VATFreeIncomeSum += parseFloat(getILSForDate(monthIncomeTransaction, invoiceExchangeRates).eventAmountILS);
      }
      // console.log('SUM till now - ', incomeSum);
      // console.log('VAT free income SUM till now - ', VATFreeIncomeSum);
      // console.log('VAT income SUM till now - ', VATIncomeSum);
      monthTaxHTMLTemplate = monthTaxHTMLTemplate.concat(`
      <tr>
        <td>${monthIncomeTransaction.financial_entity}</td>
        <td>${monthIncomeTransaction.tax_invoice_number}</td>
        <td>${hashDateFormat(monthIncomeTransaction.tax_invoice_date)}</td>
        <td>${monthIncomeTransaction.tax_invoice_amount}</td>
        <td>${monthIncomeTransaction.event_amount} ${monthIncomeTransaction.currency_code}</td>
        <td>${monthIncomeTransaction.vat}</td>
        <td>${stringNumberRounded(
          getILSForDate(monthIncomeTransaction, invoiceExchangeRates).vatAfterDiductionILS
        )}</td>
        <td>${monthIncomeTransaction.amountBeforeVAT}</td>
        <td>${stringNumberRounded(getILSForDate(monthIncomeTransaction, invoiceExchangeRates).amountBeforeVATILS)}</td>
        <td>${stringNumberRounded(getILSForDate(monthIncomeTransaction, invoiceExchangeRates).eventAmountILS)}</td>
        <td>${stringNumberRounded(getILSForDate(monthIncomeTransaction, debitExchangeRates).eventAmountILS)}</td>
        <td><a href="${monthIncomeTransaction.proforma_invoice_file}">P</a></td>
        <td>${numberRounded(incomeSum)}</td>
        <td>${numberRounded(VATFreeIncomeSum)}</td>
        <td>${numberRounded(VATIncomeSum)}</td>
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
          <th>VAT in Shekels</th>
          <th>SUM Before VAT</th>
          <th>SUM Before VAT in Shekels</th>
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
  // console.log('SUM to tax ------ ', incomeSum);
  // console.log('Advance sum ------ ', (incomeSum / 100) * advancePercentageRate); // TODO: Move 7 to read from table
  // console.log('VAT free SUM ------ ', VATFreeIncomeSum);
  // console.log('VAT income SUM ------ ', VATIncomeSum);

  const overallMonthTaxHTMLTemplate = `
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
          <td>${hashNumberRounded((incomeSum / 100) * advancePercentageRate)}</td>
          <td>${advancePercentageRate}</td>
          <td>${VATFreeIncomeSum}</td>
          <td>${VATIncomeSum}</td>
        </tr>
    </tbody>
  </table>  
`;

  let monthVATReportHTMLTemplate = '';
  let leftMonthVATReportHTMLTemplate = '';
  let overallVATHTMLTemplate = '';
  const transactionsForReport = [];
  for (const transactionType of Object.values(TransactionType)) {
    console.log(`VAT transactions - ${transactionType}`);
    const monthIncomeVATTransactions: any = await pool.query(
      getVATTransaction(month, transactionType, businessName, VATCadence).transactionsByInvoiceDate
    );
    const leftTransactions: any = await pool.query(
      getVATTransaction(month, transactionType, businessName, VATCadence).transactionsByEventDate
    );
    // let sharedInvoiceTransactions: any = await pool.query(
    //   getVATTransaction(month, transactionType, businessName, VATCadence)
    //     .transactionsWithSharedInvoice
    // );
    console.log('left transactions', leftTransactions?.rows);
    let expensesVATSum = 0;
    let expensesVATSumWithoutRound = 0;
    let expensesWithVATExcludingVATSum = 0;
    let expensesWithoutVATVATSum = 0;
    const sharedInvoiceIDs: any[] = [];
    const changedVATTransactions = [];
    for (const monthIncomeVATTransaction of monthIncomeVATTransactions?.rows ?? []) {
      const referencedInvoice: any = await pool.query(`
        select * from accounter_schema.taxes where
        id = (
          select tax_id from accounter_schema.taxes_transactions where
          transaction_id = $$${monthIncomeVATTransaction.id}$$
        )
      `);
      console.log('referenced invoice', referencedInvoice?.rows);
      if (
        referencedInvoice?.rows &&
        referencedInvoice?.rows.length > 0 &&
        sharedInvoiceIDs.includes(referencedInvoice.rows[0].id)
      ) {
        console.log('DO NOTHING');
      } else {
        if (
          referencedInvoice?.rows &&
          referencedInvoice?.rows.length > 0 &&
          !sharedInvoiceIDs.includes(referencedInvoice.rows[0].id)
        ) {
          sharedInvoiceIDs.push(referencedInvoice.rows[0].id);
          monthIncomeVATTransaction.event_amount = referencedInvoice.rows[0].tax_invoice_amount;
          monthIncomeVATTransaction.tax_invoice_amount = referencedInvoice.rows[0].tax_invoice_amount;
          monthIncomeVATTransaction.vat = referencedInvoice.rows[0].vat;
          monthIncomeVATTransaction.tax_invoice_date = referencedInvoice.rows[0].tax_invoice_date;
          monthIncomeVATTransaction.proforma_invoice_file = referencedInvoice.rows[0].tax_invoice_image;
          monthIncomeVATTransaction.tax_invoice_number = referencedInvoice.rows[0].tax_invoice_number;
          monthIncomeVATTransaction.tax_invoice_file = referencedInvoice.rows[0].tax_invoice_file;
        }
        if (monthIncomeVATTransaction.tax_invoice_currency) {
          const originalCurrency = monthIncomeVATTransaction.currency_code;
          monthIncomeVATTransaction.currency_code = monthIncomeVATTransaction.tax_invoice_currency;

          const transactionsExchnageRates = await getTransactionExchangeRates(monthIncomeVATTransaction);
          const invoiceExchangeRates = transactionsExchnageRates.invoiceExchangeRates;

          monthIncomeVATTransaction.event_amount = monthIncomeVATTransaction.tax_invoice_amount = getILSForDate(
            monthIncomeVATTransaction,
            invoiceExchangeRates
          ).eventAmountILS;
          monthIncomeVATTransaction.debit_date = monthIncomeVATTransaction.tax_invoice_date;
          monthIncomeVATTransaction.vat =
            monthIncomeVATTransaction.vat *
            invoiceExchangeRates?.rows[0][monthIncomeVATTransaction.currency_code.toLowerCase()];
          monthIncomeVATTransaction.currency_code = originalCurrency;
        }
        const hashBusinessIndexes = await getHashBusinessIndexes(
          { financial_entity: monthIncomeVATTransaction.financial_entity },
          owner
        );
        monthIncomeVATTransaction.tax_category = hashBusinessIndexes?.auto_tax_category
          ? hashBusinessIndexes?.auto_tax_category
          : monthIncomeVATTransaction.tax_category;
        addTrueVATtoTransaction(monthIncomeVATTransaction);
        const businessVATNumberQuery = `
        select vat_number
        from accounter_schema.businesses
        where
            name = $$${monthIncomeVATTransaction.financial_entity}$$;    
      `;
        const financialEntityVATNumber: any = await pool.query(businessVATNumberQuery);
        monthIncomeVATTransaction.vatNumber = financialEntityVATNumber?.rows[0]?.vat_number;
        // console.log('vat transaction: ', {
        //   name: monthIncomeVATTransaction.financial_entity,
        //   invoiceDate: hashDateFormat(monthIncomeVATTransaction.tax_invoice_date),
        //   amount: monthIncomeVATTransaction.event_amount,
        //   currency: monthIncomeVATTransaction.currency_code,
        //   vat:
        //     Math.round(
        //       (parseFloat(monthIncomeVATTransaction.vat) + Number.EPSILON) * 100
        //     ) / 100,
        //   actualVat:
        //     Math.round(
        //       (parseFloat(monthIncomeVATTransaction.vatAfterDiduction) +
        //         Number.EPSILON) *
        //         100
        //     ) / 100,
        //   vatNumber: monthIncomeVATTransaction.vatNumber,
        // });

        const transactionsExchnageRates = await getTransactionExchangeRates(monthIncomeVATTransaction);
        const invoiceExchangeRates = transactionsExchnageRates.invoiceExchangeRates;
        const roundedVATToAdd = parseIntRound(
          getILSForDate(monthIncomeVATTransaction, invoiceExchangeRates).vatAfterDiductionILS
        );
        expensesVATSum += roundedVATToAdd;
        expensesVATSumWithoutRound += stringNumberRounded(
          getILSForDate(monthIncomeVATTransaction, invoiceExchangeRates).vatAfterDiductionILS
        );
        let amountBeforeVAT = 0;
        if (
          !monthIncomeVATTransaction.vat ||
          monthIncomeVATTransaction.vat == 0 ||
          monthIncomeVATTransaction.vat == '0.00'
        ) {
          amountBeforeVAT = stringNumberRounded(
            getILSForDate(monthIncomeVATTransaction, invoiceExchangeRates).eventAmountILS
          );
        } else {
          amountBeforeVAT = stringNumberRounded(
            getILSForDate(monthIncomeVATTransaction, invoiceExchangeRates).amountBeforeFullVATILS
          ); // TODO: Add amount before VAT in ILS always
        }
        monthIncomeVATTransaction.amountBeforeFullVAT = amountBeforeVAT;
        if (
          !monthIncomeVATTransaction.vat ||
          monthIncomeVATTransaction.vat == 0 ||
          monthIncomeVATTransaction.vat == '0.00'
        ) {
          expensesWithoutVATVATSum += stringNumberRounded(
            getILSForDate(monthIncomeVATTransaction, invoiceExchangeRates).eventAmountILS
          );
        } else {
          expensesWithVATExcludingVATSum += parseIntRound(monthIncomeVATTransaction.amountBeforeFullVAT);
        }
        monthVATReportHTMLTemplate = monthVATReportHTMLTemplate.concat(`
    <tr>
      <td>${monthIncomeVATTransaction.financial_entity}-${monthIncomeVATTransaction.vatNumber}</td>
      <td><a href="${monthIncomeVATTransaction.proforma_invoice_file}">P</a></td>
      <td>${monthIncomeVATTransaction.tax_invoice_number}</td>
      <td>${hashDateFormat(monthIncomeVATTransaction.tax_invoice_date)}</td>
      <td>${hashDateFormat(monthIncomeVATTransaction.event_date)}</td>
      <td>${monthIncomeVATTransaction.currency_code} ${monthIncomeVATTransaction.event_amount}</td>
      <td>${stringNumberRounded(getILSForDate(monthIncomeVATTransaction, invoiceExchangeRates).eventAmountILS)}</td>
      <td>${stringNumberRounded(monthIncomeVATTransaction.vat)}</td>
      <td>${stringNumberRounded(
        getILSForDate(monthIncomeVATTransaction, invoiceExchangeRates).vatAfterDiductionILS
      )}</td>
      <td>${stringNumberRounded(monthIncomeVATTransaction.vatAfterDiduction)}</td>
      <td>${roundedVATToAdd}</td>
      <td>${parseIntRound((expensesVATSum + Number.EPSILON) * 100) / 100}</td>
      <td>${amountBeforeVAT}</td>
      <td>${parseIntRound((expensesWithVATExcludingVATSum + Number.EPSILON) * 100) / 100}</td>
      <td>${expensesWithoutVATVATSum}</td>
    </tr>
    `);
        monthIncomeVATTransaction.vat = getILSForDate(
          monthIncomeVATTransaction,
          invoiceExchangeRates
        ).vatAfterDiductionILS.toString();
        monthIncomeVATTransaction.vatAfterDiduction = getILSForDate(
          monthIncomeVATTransaction,
          invoiceExchangeRates
        ).vatAfterDiductionILS;
        monthIncomeVATTransaction.tax_invoice_amount = `${monthIncomeVATTransaction.tax_invoice_amount}`;
        if (!monthIncomeVATTransaction.vatNumber) {
          monthIncomeVATTransaction.vatNumber = null;
        }
        // monthIncomeVATTransaction.amountBeforeFullVAT = getILSForDate(
        //   monthIncomeVATTransaction,
        //   invoiceExchangeRates
        // ).amountBeforeFullVATILS;
        // monthIncomeVATTransaction.event_amount =
        //   monthIncomeVATTransaction.tax_invoice_amount = getILSForDate(
        //     monthIncomeVATTransaction,
        //     invoiceExchangeRates
        //   ).eventAmountILS.toString();
        changedVATTransactions.push(monthIncomeVATTransaction);
      }
    }

    for (const leftTransaction of leftTransactions?.rows ?? []) {
      leftMonthVATReportHTMLTemplate = leftMonthVATReportHTMLTemplate.concat(`
      <tr>
        <td>${leftTransaction.financial_entity}-${leftTransaction.vatNumber}</td>
        <td><a href="${leftTransaction.proforma_invoice_file}">P</a></td>
        <td>${leftTransaction.tax_invoice_number}</td>
        <td>${hashDateFormat(leftTransaction.tax_invoice_date)}</td>
        <td>${hashDateFormat(leftTransaction.event_date)}</td>
        <td>${leftTransaction.event_amount} ${leftTransaction.currency_code}</td>
        <td>${leftTransaction.vat}</td>
      </tr>
      `);
    }

    transactionsForReport.push(...changedVATTransactions);

    // console.log(`expensesVATSum - ${transactionType}`, expensesVATSum);
    if (expensesVATSum != 0) {
      const hashBusinessIndexes = await getHashBusinessIndexes({ financial_entity: 'VAT' }, owner);

      const entryForMonthlyVAT = [
        hashDateFormat(moment(month).endOf('month').toDate()),
        transactionType == TransactionType.Expenses
          ? hashAccounts('VAT', null, hashBusinessIndexes, hashVATIndexes, null, null, null)
          : hashVATIndexes.vatOutputsIndex,
        hashNumber(expensesVATSum),
        null,
        null,
        transactionType == TransactionType.Expenses
          ? hashVATIndexes.vatInputsIndex
          : hashAccounts('VAT', null, hashBusinessIndexes, hashVATIndexes, null, null, null),
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
          ? 'generated_all_vat_to_pay_for_previous_month'
          : 'generated_all_vat_to_recieve_for_previous_month',
        null,
        uuidv4(),
        // false,
        // null,
        owner,
      ];

      console.log('entryForMonthlyVAT', entryForMonthlyVAT);

      overallVATHTMLTemplate = overallVATHTMLTemplate.concat(`
            <tr>
              <td>${moment(month).format('MM/YYYY')}</td>
              <td>${
                transactionType == TransactionType.Expenses
                  ? hashAccounts('VAT', null, hashBusinessIndexes, hashVATIndexes, null, null, null)
                  : hashVATIndexes.vatOutputsIndex
              }</td>
              <td>${
                transactionType == TransactionType.Expenses
                  ? hashVATIndexes.vatInputsIndex
                  : hashAccounts('VAT', null, hashBusinessIndexes, hashVATIndexes, null, null, null)
              }</td>
              <td>${hashNumberRounded(expensesVATSum)}</td>
            </tr>
    `);

      // let queryConfig = {
      //   text: insertMovementQuery,
      //   values: entryForMonthlyVAT,
      // };

      // try {
      //   let updateResult = await pool.query(queryConfig);
      //   console.log(JSON.stringify(updateResult.rows[0]));
      // } catch (error) {
      //   // TODO: Log important checks
      //   console.log(`error in insert monthly VAT ${transactionType} - `, error);
      // }

      if (expensesVATSumWithoutRound != expensesVATSum) {
        const entryForMonthlyRoundVATDifference = [
          hashDateFormat(moment(month).endOf('month').toDate()),
          transactionType == TransactionType.Expenses ? hashVATIndexes.vatInputsIndex : hashVATIndexes.vatOutputsIndex,
          hashNumberNoAbs(expensesVATSumWithoutRound - expensesVATSum),
          null,
          null,
          'ביטול',
          hashNumberNoAbs(expensesVATSumWithoutRound - expensesVATSum),
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
            ? 'generated_all_vat_to_pay_for_previous_month'
            : 'generated_all_vat_to_recieve_for_previous_month',
          null,
          uuidv4(),
          // false,
          // null,
          owner,
        ];

        // queryConfig = {
        //   text: insertMovementQuery,
        //   values: entryForMonthlyRoundVATDifference,
        // };

        console.log('entryForMonthlyRoundVATDifference', entryForMonthlyRoundVATDifference);

        // try {
        //   let updateResult = await pool.query(queryConfig);
        //   console.log(JSON.stringify(updateResult.rows[0]));
        // } catch (error) {
        //   // TODO: Log important checks
        //   console.log(
        //     `error in insert monthly VAT ${transactionType} - `,
        //     error
        //   );
        // }
      }
    }
  }

  console.log(JSON.stringify(transactionsForReport));
  monthVATReportHTMLTemplate = `
  <table>
    <thead>
        <tr>
          <th>Name</th>
          <th>Invoice Image</th>
          <th>Invoice Number</th>
          <th>Tax Invoice Date</th>
          <th>Event Date</th>
          <th>Amount</th>
          <th>Amount ILS</th>
          <th>VAT</th>
          <th>VAT in ILS</th>
          <th>Actual VAT</th>
          <th>Rounded VAT to add</th>
          <th>Sum till now</th>
          <th>Amount Before VAT ILS</th>
          <th>Hayavot without VAT SUM till now</th>
          <th>Pturot SUM till now</th>
        </tr>
    </thead>
    <tbody>
        ${monthVATReportHTMLTemplate}
    </tbody>
  </table>  
  `;
  leftMonthVATReportHTMLTemplate = `
  <table>
    <thead>
        <tr>
          <th>Name</th>
          <th>Invoice Image</th>
          <th>Invoice Number</th>
          <th>Tax Invoice Date</th>
          <th>Event Date</th>
          <th>Amount</th>
          <th>VAT</th>
        </tr>
    </thead>
    <tbody>
        ${leftMonthVATReportHTMLTemplate}
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
    leftMonthVATReportHTMLTemplate,
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
