import { pool } from '../index';
import moment from 'moment';
import { v4 as uuidv4 } from 'uuid';

const entitiesWithoutInvoiceDate = ['Uri Goldshtein', 'Poalim', 'Isracard'];
const taxCategoriesWithoutInvoiceDate = ['אוריח'];
const entitiesWithoutAccounting = [
  'Isracard',
  'VAT',
  'Uri Goldshtein Employee Social Security',
  'Halman Aldubi Training Fund',
  'Halman Aldubi Pension',
];
function entitiesToTaxCategory(entity: string): string | null {
  switch (entity) {
    case 'Poalim':
      return 'עמל';
      break;
    default:
      return null;
  }
}

const taxCategoriesWithNotFullVAT = ['פלאפון', 'ציוד', 'מידע'];

export async function createTaxEntriesForTransaction(transactionId: string) {
  let transaction: any = await pool.query(`
    SELECT *
    FROM accounter_schema.all_transactions
    WHERE
        id = $$${transactionId}$$
  `);
  transaction = transaction.rows[0]; // Why numeric values are text?

  let entryForFinancialAccount: any = {};
  let entryForAccounting: any = {};

  // credit זכות
  // debit חובה

  transaction.vatAfterDiduction = !taxCategoriesWithNotFullVAT.includes(
    transaction.tax_category
  )
    ? transaction.vat
    : (transaction.vat / 3) * 2;
  // Add a check if there is vat and it's not equal for 17 percent, let us know
  transaction.amountBeforeVAT =
    transaction.event_amount - transaction.vatAfterDiduction; // parseFloat

  let debitExchangeRates;
  let invoiceExchangeRates;
  async function getExchangeRates(date: Date) {
    if (transaction.currency_code != 'ILS') {
      const exchangeQuery = `
        select usd, eur
        from accounter_schema.exchange_rates
        where exchange_date <= to_date('${moment(date).format(
        'YYYY-MM-DD'
      )}', 'YYYY-MM-DD') order by exchange_date desc limit 1;
      `;

      try {
        // Make sure we get a value in a day without values (small and limit 1)
        return await pool.query(exchangeQuery);
      } catch (error) {
        console.log('error in DB - ', error);
      }
    }
  }

  debitExchangeRates = await getExchangeRates(transaction.debit_date);
  invoiceExchangeRates = await getExchangeRates(transaction.tax_invoice_date);

  //////  invoice date

  function getILSForDate(transaction: any, date: any) {
    let amounts: any = {};
    if (['USD', 'EUR'].includes(transaction.currency_code)) {
      let currencyKey = transaction.currency_code.toLowerCase();
      amounts.eventAmountILS =
        transaction.event_amount * date?.rows[0][currencyKey];
      amounts.vatAfterDiductionILS =
        transaction.vatAfterDiduction * date?.rows[0][currencyKey];
      amounts.amountBeforeVATILS =
        transaction.amountBeforeVAT * date?.rows[0][currencyKey];
    } else if (transaction.currency_code == 'ILS') {
      amounts.eventAmountILS = transaction.event_amount;
      amounts.vatAfterDiductionILS = transaction.vatAfterDiduction;
      amounts.amountBeforeVATILS = transaction.amountBeforeVAT;
    } else {
      // TODO: Log important checks
      console.log('New account currency - ', transaction.currency_code);
    }
    return amounts;
  }

  entryForAccounting.movementType = null;

  entryForFinancialAccount.creditAccount = transaction.financial_entity;
  entryForFinancialAccount.debitAccount = transaction.account_type;
  entryForAccounting.creditAccount = entitiesToTaxCategory(
    transaction.financial_entity
  )
    ? entitiesToTaxCategory(transaction.financial_entity)
    : transaction.tax_category;
  entryForAccounting.debitAccount = transaction.financial_entity;

  entryForFinancialAccount.creditAmount = entryForFinancialAccount.debitAmount = entryForAccounting.creditAmount = entryForAccounting.debitAmount =
    transaction.event_amount;
  entryForFinancialAccount.creditAmountILS = entryForFinancialAccount.debitAmountILS = getILSForDate(
    transaction,
    debitExchangeRates
  ).eventAmountILS;
  entryForAccounting.creditAmountILS = entryForAccounting.debitAmountILS = getILSForDate(
    transaction,
    transaction.account_type == 'creditcard'
      ? debitExchangeRates
      : invoiceExchangeRates
  ).eventAmountILS;

  if (transaction.vatAfterDiduction && transaction.vatAfterDiduction != 0) {
    entryForAccounting.secondAccount = 'VAT'; // TODO: Entities enum
    entryForAccounting.secondAccountCreditAmount =
      transaction.vatAfterDiduction;
    entryForAccounting.secondAccountCreditAmountILS = getILSForDate(
      transaction,
      debitExchangeRates
    ).vatAfterDiductionILS;
    entryForAccounting.creditAmount = transaction.amountBeforeVAT;
    entryForAccounting.creditAmountILS = getILSForDate(
      transaction,
      debitExchangeRates
    ).amountBeforeVATILS;
    entryForAccounting.secondAccountDebitAmount = entryForAccounting.secondAccountDebitAmountILS = 0;
    entryForAccounting.movementType = 'חל';
  } else {
    if (transaction.tax_category != 'אוריח') {
      entryForAccounting.movementType = 'הכפ';
    }
  }
  entryForAccounting.reference2 = entryForFinancialAccount.reference2 =
    transaction.bank_reference;
  entryForAccounting.reference1 = entryForFinancialAccount.reference1 =
    transaction.tax_invoice_number;
  entryForAccounting.description = entryForFinancialAccount.description =
    transaction.user_description;

  if (transaction.event_amount < 0) {
    function swap(obj: any, key1: any, key2: any) {
      [obj[key1], obj[key2]] = [obj[key2], obj[key1]];
    }
    swap(entryForAccounting, 'creditAccount', 'debitAccount');
    swap(entryForAccounting, 'creditAmount', 'debitAmount');
    swap(entryForAccounting, 'creditAmountILS', 'debitAmountILS');
    swap(
      entryForAccounting,
      'secondAccountCreditAmount',
      'secondAccountDebitAmount'
    );
    swap(
      entryForAccounting,
      'secondAccountCreditAmountILS',
      'secondAccountDebitAmountILS'
    );
    swap(entryForAccounting, 'reference1', 'reference2');
    swap(entryForFinancialAccount, 'creditAccount', 'debitAccount');
    swap(entryForFinancialAccount, 'creditAmount', 'debitAmount');
    swap(entryForFinancialAccount, 'creditAmountILS', 'debitAmountILS');
    swap(entryForFinancialAccount, 'reference1', 'reference2');
    if (transaction.vatAfterDiduction && transaction.vatAfterDiduction != 0) {
      transaction.tax_category == 'פלאפון'
        ? (entryForAccounting.movementType = 'פלא')
        : (entryForAccounting.movementType = 'חס');
    } else {
      entryForAccounting.movementType = null;
    }
  }

  console.log({
    entryForAccounting,
    entryForFinancialAccount,
  });

  function hashDateFormat(date: Date): string {
    return moment(date).format('DD/MM/YYYY');
  }

  function hashCurrencyType(accountType: string): string | null {
    switch (accountType) {
      case 'ILS':
        return null;
        break;
      case 'EUR':
        return 'אירו';
        break;
      case 'USD':
        return '$';
        break;
      default:
        const errorMessage = `Unknown account type - ${accountType}`;
        console.error(errorMessage);
        return errorMessage;
    }
  }

  function hashAccounts(accountType: string): string | null {
    switch (accountType) {
      case 'checking_ils':
        return 'עוש';
        break;
      case 'checking_eur':
        return 'עוש2';
        break;
      case 'checking_usd':
        return 'עוש1';
        break;
      case 'creditcard':
        return 'כא';
        break;
      case 'Hot Mobile':
        return 'הוט';
        break;
      case 'Dotan Simha':
        return 'דותן';
        break;
      case 'Kamil Kisiela':
        return 'Kamil';
        break;
      case 'MapMe':
        return 'מאפלאבס';
        break;
      case 'Idan Am-Shalem':
        return 'עםשלם';
        break;
      case 'Isracard':
        return 'כא';
        break;
      case 'Poalim':
        return 'Poalim Bank';
        break;
      case 'VAT':
        return 'מעמחוז';
        break;
      case 'Israeli Corporations Authority':
        return 'רשם החברות';
        break;
      case 'SATURN AMSTERDAM ODE':
        return 'SATURN AMS';
        break;
      case 'Linux Foundation':
        return 'LinuxFound';
        break;
      case 'Malach':
        return 'מלאך';
        break;
      case 'Spaans&Spaans':
        return 'Spaans';
        break;
      case 'IMPACT HUB ATHENS':
        return 'IMPACT HUB ATHE';
        break;
      case 'ENTERPRISE GRAPHQL Conference':
        return 'ENTERPRISE GRAP';
        break;
      case 'Yaacov Matri':
        return 'יעקב';
        break;
      case 'Tax':
        return 'מקדמות20';
        break;
      case 'Uri Goldshtein Employee Tax Withholding':
        return 'מהני';
        break;
      case 'Uri Goldshtein Employee Social Security':
        return 'בלני';
        break;
      case 'Uri Goldshtein':
        return 'אורי';
        break;
      case 'Uri Goldshtein Hoz':
        return 'אוריח';
        break;
      case 'Raveh Ravid & Co':
        return 'יהל';
        break;
      case 'Production Ready GraphQL':
        return 'ProdReadyGraph';
        break;
      case 'הפרשי שער':
        return 'שער';
        break;
      case 'Tax Corona Grant':
        return 'מענק קורונה';
        break;
      case 'VAT interest refund':
        return 'מעמ שער';
        break;
      case 'Tax Shuma':
        return 'שומה 2018';
        break;
      case 'Halman Aldubi Training Fund':
        return 'הלמןקהל';
        break;
      case 'Halman Aldubi Pension':
        return 'הלמןפנסי';
        break;
      default:
        return accountType;
    }
  }

  function hashNumber(number: any): string | null {
    let formattedNumber = Math.abs(Number.parseFloat(number)).toFixed(2);
    return formattedNumber == '0.00' ? null : formattedNumber;
  }

  let entryForAccountingValues = [
    hashDateFormat(
      !entitiesWithoutInvoiceDate.includes(transaction.financial_entity) &&
        !taxCategoriesWithoutInvoiceDate.includes(transaction.tax_category)
        ? transaction.tax_invoice_date
        : transaction.event_date
    ), // add a check if should have an invoice but doesn't let user know
    hashAccounts(entryForAccounting.debitAccount),
    hashNumber(entryForAccounting.debitAmountILS),
    transaction.currency_code != 'ILS'
      ? hashNumber(entryForAccounting.debitAmount)
      : null,
    hashCurrencyType(transaction.currency_code),
    hashAccounts(entryForAccounting.creditAccount),
    hashNumber(entryForAccounting.creditAmountILS),
    transaction.currency_code != 'ILS'
      ? hashNumber(entryForAccounting.creditAmount)
      : null,
    entryForAccounting.secondAccountDebitAmount &&
      entryForAccounting.secondAccountDebitAmount != 0
      ? 'תשו'
      : null,
    entryForAccounting.secondAccountDebitAmount
      ? hashNumber(entryForAccounting.secondAccountDebitAmountILS)
      : null,
    entryForAccounting.secondAccountDebitAmount &&
      transaction.currency_code != 'ILS'
      ? hashNumber(entryForAccounting.secondAccountDebitAmount)
      : null,
    entryForAccounting.secondAccountCreditAmount &&
      entryForAccounting.secondAccountCreditAmount != 0
      ? 'עסק'
      : null,
    entryForAccounting.secondAccountCreditAmountILS
      ? hashNumber(entryForAccounting.secondAccountCreditAmountILS)
      : null,
    entryForAccounting.secondAccountCreditAmount &&
      transaction.currency_code != 'ILS'
      ? hashNumber(entryForAccounting.secondAccountCreditAmount)
      : null,
    entryForAccounting.description,
    entryForAccounting.reference1
      ? (entryForAccounting.reference1?.match(/\d+/g) || []).join('').substr(-9)
      : null, // add check on the db for it
    entryForAccounting.reference2
      ? (entryForAccounting.reference2?.match(/\d+/g) || []).join('').substr(-9)
      : null,
    entryForAccounting.movementType,
    hashDateFormat(
      transaction.account_type == 'creditcard'
        ? transaction.debit_date
          ? transaction.debit_date
          : !taxCategoriesWithoutInvoiceDate.includes(transaction.tax_category)
            ? transaction.tax_invoice_date
            : transaction.event_date
        : transaction.tax_invoice_date
          ? transaction.tax_invoice_date
          : transaction.debit_date
    ),
    hashDateFormat(transaction.event_date),
    transaction.id,
    'generated_accounting',
    transaction.proforma_invoice_file,
    uuidv4(),
  ];

  let entryForFinancialAccountValues = [
    hashDateFormat(transaction.event_date),
    hashAccounts(entryForFinancialAccount.debitAccount),
    hashNumber(entryForFinancialAccount.debitAmountILS),
    transaction.currency_code != 'ILS'
      ? hashNumber(entryForFinancialAccount.debitAmount)
      : null,
    hashCurrencyType(transaction.currency_code),
    hashAccounts(entryForFinancialAccount.creditAccount),
    hashNumber(entryForFinancialAccount.creditAmountILS),
    transaction.currency_code != 'ILS'
      ? hashNumber(entryForFinancialAccount.creditAmount)
      : null,
    null, // Check for interest transactions (הכנרבמ)
    null,
    null,
    null,
    null,
    null,
    entryForFinancialAccount.description,
    entryForFinancialAccount.reference1
      ? (entryForFinancialAccount.reference1?.match(/\d+/g) || [])
        .join('')
        .substr(-9)
      : null, // add check on the db for it
    entryForFinancialAccount.reference2
      ? (entryForFinancialAccount.reference2?.match(/\d+/g) || [])
        .join('')
        .substr(-9)
      : null,
    null,
    hashDateFormat(
      transaction.debit_date ? transaction.debit_date : transaction.event_date
    ),
    hashDateFormat(transaction.event_date),
    transaction.id,
    'generated_financial_account',
    transaction.proforma_invoice_file,
    uuidv4(),
  ];

  if (
    debitExchangeRates != invoiceExchangeRates &&
    transaction.account_type != 'creditcard' &&
    transaction.financial_entity != 'Isracard'
  ) {
    console.log('שערררררררר');
    let entryForExchangeRatesDifferenceValues = [
      hashDateFormat(transaction.event_date),
      hashAccounts(entryForFinancialAccount.debitAccount),
      hashNumber(entryForFinancialAccount.debitAmountILS),
      transaction.currency_code != 'ILS'
        ? hashNumber(entryForFinancialAccount.debitAmount)
        : null,
      hashCurrencyType(transaction.currency_code),
      hashAccounts(entryForFinancialAccount.creditAccount),
      hashNumber(entryForFinancialAccount.creditAmountILS),
      transaction.currency_code != 'ILS'
        ? hashNumber(entryForFinancialAccount.creditAmount)
        : null,
      null, // Check for interest transactions (הכנרבמ)
      null,
      null,
      null,
      null,
      null,
      entryForFinancialAccount.description,
      (entryForFinancialAccount.reference1.match(/\d+/g) || [])
        .join('')
        .substr(-9), // add check on the db for it
      (entryForFinancialAccount.reference2.match(/\d+/g) || [])
        .join('')
        .substr(-9),
      null,
      hashDateFormat(
        transaction.debit_date ? transaction.debit_date : transaction.event_date
      ),
      hashDateFormat(transaction.event_date),
      transaction.id,
      'generated_financial_account',
      transaction.proforma_invoice_file,
      uuidv4(),
    ];
  }

  let insertMovementQuery = `insert into accounter_schema.ledger (
    תאריך_חשבונית,
    חשבון_חובה_1,
    סכום_חובה_1,
    מטח_סכום_חובה_1,
    מטבע,
    חשבון_זכות_1,
    סכום_זכות_1,
    מטח_סכום_זכות_1,
    חשבון_חובה_2,
    סכום_חובה_2,
    מטח_סכום_חובה_2,
    חשבון_זכות_2,
    סכום_זכות_2,
    מטח_סכום_זכות_2,
    פרטים,
    אסמכתא_1,
    אסמכתא_2,
    סוג_תנועה,
    תאריך_ערך,
    תאריך_3,
    original_id,
    origin,
    proforma_invoice_file,
    id) VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24) returning *;
  `;

  let queryConfig = {
    text: insertMovementQuery,
    values: entryForAccountingValues,
  };
  if (!entitiesWithoutAccounting.includes(transaction.financial_entity)) {
    try {
      let updateResult = await pool.query(queryConfig);
      console.log(JSON.stringify(updateResult.rows[0]));
    } catch (error) {
      // TODO: Log important checks
      console.log('error in insert - ', error);
    }
  }

  queryConfig.values = entryForFinancialAccountValues;

  try {
    let updateResult = await pool.query(queryConfig);
    console.log(JSON.stringify(updateResult));
  } catch (error) {
    // TODO: Log important checks
    console.log('error in insert - ', error);
  }

  return 'done';
}
