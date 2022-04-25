import moment from 'moment';
import { v4 as uuidv4 } from 'uuid';
import { pool } from '.';

const TAX_CATEGORIES_WITH_NOT_FULL_VAT = ['פלאפון', 'מידע', 'מחשבים'];
const ENTITIES_WITHOUT_INVOICE_DATE = ['Uri Goldshtein', 'Poalim', 'Isracard'];
const TAX_CATEGORIES_WITHOUT_INVOICE_DATE = ['אוריח'];
const INSERT_MOVEMENT_QUERY = `insert into accounter_schema.ledger (
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
    id,
    business) VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25) returning *;
  `;
const ENTITIES_WITHOUT_ACCOUNTING = [
  'Isracard',
  'VAT',
  'Social Security Deductions',
  'Tax Deductions',
  'Tax',
  'Dividend Tax Deduction Origin',
  'Poalim',
  'Halman Aldubi Training Fund',
  'Halman Aldubi Pension',
  'Uri Goldshtein Hoz',
  'Uri Goldshtein',
];

async function getHashFinancialAccounts(transaction: any) {
  let hashFinancialAccountsResult: any = await pool.query(`
      select hashavshevet_account_ils,
             hashavshevet_account_usd,
             hashavshevet_account_eur
      from accounter_schema.financial_accounts
      where
        account_number = $$${transaction.account_number}$$;
    `);
  return hashFinancialAccountsResult.rows[0];
}

async function getHashBusinessIndexes(transaction: any, owner: any) {
  let businessIDResult: any;
  try {
    businessIDResult = await pool.query(`
      select id
      from accounter_schema.businesses
      where
        name = $$${transaction.financial_entity}$$;
    `);
  } catch (error) {
    console.log('Finding business id error - ', error);
  }

  // console.log('businessIDResult', businessIDResult);

  let hashBusinessIndexResult: any;
  try {
    const businessHashInfoQuery = `
      select hash_index, auto_tax_category
      from accounter_schema.hash_business_indexes
      where
        business = $$${businessIDResult.rows[0].id}$$ and
        hash_owner = $$${owner}$$;
    `;
    // console.log('businessHashInfoQuery', businessHashInfoQuery);
    hashBusinessIndexResult = await pool.query(businessHashInfoQuery);
  } catch (error) {
    console.log('Finding business Hash id error - ', error);
    console.log(`failed query: ${transaction.financial_entity}`);
  }
  // console.log('hashBusinessIndexResult.rows', hashBusinessIndexResult?.rows);
  return hashBusinessIndexResult?.rows[0];
}

async function getVATIndexes(owner: any) {
  let hashVATInputsIndexResult: any = await pool.query(`
      select hash_index
      from accounter_schema.hash_gov_indexes
      where
        hash_owner = $$${owner}$$ and
        gov_entity = 'VAT_inputs';
    `);
  let hashVATPropertyInputsIndexResult: any = await pool.query(`
      select hash_index
      from accounter_schema.hash_gov_indexes
      where
        hash_owner = $$${owner}$$ and
        gov_entity = 'VAT_Property_Inputs';
    `);
  let hashVATOutputsIndexResult: any = await pool.query(`
      select hash_index
      from accounter_schema.hash_gov_indexes
      where
        hash_owner = $$${owner}$$ and
        gov_entity = 'VAT_outputs';
    `);
  let hashVATIncomesMovementTypeIndexResult: any = await pool.query(`
      select hash_index
      from accounter_schema.hash_gov_indexes
      where
        hash_owner = $$${owner}$$ and
        gov_entity = 'VAT_Incomes_Movement_Type';
    `);
  let hashVATFreeIncomesMovementTypeIndexResult: any = await pool.query(`
      select hash_index
      from accounter_schema.hash_gov_indexes
      where
        hash_owner = $$${owner}$$ and
        gov_entity = 'VAT_Free_Incomes_Movement_Type';
    `);
  let hashVATExpensesMovementTypeIndexResult: any = await pool.query(`
      select hash_index
      from accounter_schema.hash_gov_indexes
      where
        hash_owner = $$${owner}$$ and
        gov_entity = 'VAT_Expenses_Movement_Type';
    `);
  let hashVATPropertyExpensesMovementTypeIndexResult: any = await pool.query(`
      select hash_index
      from accounter_schema.hash_gov_indexes
      where
        hash_owner = $$${owner}$$ and
        gov_entity = 'VAT_Property_Expenses_Movement_Type';
    `);
  let hashVATIncomesIndexResult: any = await pool.query(`
      select hash_index
      from accounter_schema.hash_gov_indexes
      where
        hash_owner = $$${owner}$$ and
        gov_entity = 'VAT_Incomes';
    `);
  let hashVATFreeIncomesIndexResult: any = await pool.query(`
      select hash_index
      from accounter_schema.hash_gov_indexes
      where
        hash_owner = $$${owner}$$ and
        gov_entity = 'VAT_Free_Incomes';
    `);
  let hashCurrencyRatesDifferencesIndexResult: any = await pool.query(`
      select hash_index
      from accounter_schema.hash_gov_indexes
      where
        hash_owner = $$${owner}$$ and
        gov_entity = 'Currency_Rates_Differences';
    `);

  return {
    vatInputsIndex: hashVATInputsIndexResult.rows[0].hash_index,
    vatPropertyInputsIndex: hashVATPropertyInputsIndexResult.rows[0].hash_index,
    vatOutputsIndex: hashVATOutputsIndexResult.rows[0].hash_index,
    vatIncomesMovementTypeIndex:
      hashVATIncomesMovementTypeIndexResult.rows[0].hash_index,
    vatFreeIncomesMovementTypeIndex:
      hashVATFreeIncomesMovementTypeIndexResult.rows[0].hash_index,
    vatIncomesIndex: hashVATIncomesIndexResult.rows[0].hash_index,
    vatFreeIncomesIndex: hashVATFreeIncomesIndexResult.rows[0].hash_index,
    vatExpensesMovementTypeIndex:
      hashVATExpensesMovementTypeIndexResult.rows[0].hash_index,
    vatExpensesPropertyMovementTypeIndex:
      hashVATPropertyExpensesMovementTypeIndexResult.rows[0].hash_index,
    hashCurrencyRatesDifferencesIndex:
      hashCurrencyRatesDifferencesIndexResult.rows[0].hash_index,
  };
}

function addTrueVATtoTransaction(transaction: any) {
  let amountToUse = transaction.tax_invoice_amount
    ? transaction.tax_invoice_amount
    : transaction.event_amount;
  transaction.vatAfterDiduction = !TAX_CATEGORIES_WITH_NOT_FULL_VAT.includes(
    transaction.tax_category
  )
    ? parseFloat(transaction.vat)
    : (transaction.vat / 3) * 2;
  // TODO: Add a check if there is vat and it's not equal for 17 percent, let us know
  transaction.amountBeforeVAT = amountToUse - transaction.vatAfterDiduction;

  transaction.amountBeforeFullVAT = amountToUse - transaction.vat;
}

async function getExchangeRates(currencyCode: any, date: Date) {
  if (currencyCode != 'ILS') {
    const exchangeQuery = `
        select usd, eur, gbp
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

async function getTransactionExchangeRates(transaction: any) {
  let debitExchangeRates = await getExchangeRates(
    transaction.currency_code,
    transaction.debit_date
  );
  let invoiceExchangeRates = await getExchangeRates(
    transaction.currency_code,
    transaction.tax_invoice_date
  );
  return {
    debitExchangeRates,
    invoiceExchangeRates,
  };
}

function getILSForDate(transaction: any, date: any) {
  let amounts: any = {};
  let amountToUse = transaction.tax_invoice_amount
    ? transaction.tax_invoice_amount
    : transaction.event_amount;
  if (['USD', 'EUR', 'GBP'].includes(transaction.currency_code)) {
    let currencyKey = transaction.currency_code.toLowerCase();
    amounts.eventAmountILS = amountToUse * date?.rows[0][currencyKey];
    amounts.vatAfterDiductionILS =
      transaction.vatAfterDiduction * date?.rows[0][currencyKey];
    amounts.amountBeforeVATILS =
      transaction.amountBeforeVAT * date?.rows[0][currencyKey];
    amounts.amountBeforeFullVATILS =
      transaction.amountBeforeFullVAT * date?.rows[0][currencyKey];
  } else if (transaction.currency_code == 'ILS') {
    amounts.eventAmountILS = amountToUse;
    amounts.vatAfterDiductionILS = transaction.vatAfterDiduction;
    amounts.amountBeforeVATILS = transaction.amountBeforeVAT;
    amounts.amountBeforeFullVATILS = transaction.amountBeforeFullVAT;
  } else {
    // TODO: Log important checks
    console.log('New account currency - ', transaction.currency_code);
  }
  return amounts;
}

function hashDateFormat(date: Date): string {
  return moment(date).format('DD/MM/YYYY');
}

function hashAccounts(
  accountType: string,
  financialAccounts: any,
  hashBusinessIndexes: any,
  hashVATIndexes: any,
  currency: any,
  isracardHashIndexes: any,
  transactionDescription: any
): string | null {
  let creditCardHashAccount;
  switch (accountType) {
    case 'checking_ils':
      return financialAccounts.hashavshevet_account_ils;
      break;
    case 'checking_usd':
      return financialAccounts.hashavshevet_account_usd;
      break;
    case 'checking_eur':
      return financialAccounts.hashavshevet_account_eur;
      break;
    case 'creditcard':
      switch (currency) {
        case 'ILS':
          creditCardHashAccount = financialAccounts.hashavshevet_account_ils;
          break;
        case 'USD':
          creditCardHashAccount = financialAccounts.hashavshevet_account_usd;
          break;
        case 'EUR':
          creditCardHashAccount = financialAccounts.hashavshevet_account_eur;
          break;
        default:
          const errorMessage = `Unknown currency - ${currency}`;
          console.error(errorMessage);
          creditCardHashAccount = errorMessage;
      }
      return creditCardHashAccount;
      break;
    case 'Isracard':
      console.log('isracardHashIndexes', isracardHashIndexes);
      return isracardHashIndexes;
      break;
    // case 'Hot Mobile':
    //   return 'הוט';
    //   break;
    // case 'Dotan Simha':
    //   return 'דותן';
    //   break;
    // case 'MapMe':
    //   return 'מאפלאבס';
    //   break;
    // case 'Israeli Corporations Authority':
    //   return 'רשם החברות';
    //   break;
    // case 'SATURN AMSTERDAM ODE':
    //   return 'SATURN AMS';
    //   break;
    // case 'Linux Foundation':
    //   return 'LinuxFound';
    //   break;
    // case 'Malach':
    //   return 'מלאך';
    //   break;
    // case 'Spaans&Spaans':
    //   return 'Spaans';
    //   break;
    // case 'IMPACT HUB ATHENS':
    //   return 'IMPACT HUB ATHE';
    //   break;
    // case 'ENTERPRISE GRAPHQL Conference':
    //   return 'ENTERPRISE GRAP';
    //   break;
    // case 'Yaacov Matri':
    //   return 'יעקב';
    //   break;
    // case 'Uri Goldshtein':
    //   return 'אורי';
    //   break;
    // case 'Uri Goldshtein Hoz':
    //   return 'אוריח';
    //   break;
    // case 'Raveh Ravid & Co':
    //   return 'יהל';
    //   break;
    // case 'Production Ready GraphQL':
    //   return 'ProdReadyGraph';
    //   break;
    // case 'Tax Corona Grant':
    //   return 'מענק קורונה';
    //   break;
    // case 'VAT interest refund':
    //   return 'מעמ שער';
    //   break;
    // case 'Tax Shuma':
    //   return 'שומה 2018';
    //   break;
    // case 'Halman Aldubi Training Fund':
    //   return 'הלמןקהל';
    //   break;
    // case 'Halman Aldubi Pension':
    //   return 'הלמןפנסי';
    //   break;
    default:
      if (
        hashBusinessIndexes &&
        !Object.values(hashVATIndexes).includes(accountType) &&
        hashBusinessIndexes.auto_tax_category != accountType
      ) {
        if (transactionDescription == 'הפקדה לפקדון') {
          return 'פקדון';
          // return '4668039';
        } else {
          if (hashBusinessIndexes.hash_index) {
            return hashBusinessIndexes.hash_index;
          } else {
            return accountType ? accountType.substring(0, 15).trimEnd() : null;
          }
        }
      }
      return accountType ? accountType.substring(0, 15).trimEnd() : null;
  }
}

function hashNumber(number: any): string | null {
  let formattedNumber = Math.abs(Number.parseFloat(number)).toFixed(2);
  return formattedNumber == '0.00' ? null : formattedNumber;
}

function hashNumberNoAbs(number: any): string | null {
  let formattedNumber = Number.parseFloat(number).toFixed(2);
  return formattedNumber == '0.00' ? null : formattedNumber;
}

function parseIntRound(v: any) {
  return parseInt(v + Math.sign(v) / 2);
}

function numberRounded(number: number): number {
  return parseIntRound((number + Number.EPSILON) * 100) / 100;
}

export const generateTaxMovement = async (transactionId: string) => {
  let transaction: any = await pool.query(`
  SELECT *
  FROM accounter_schema.all_transactions
  WHERE
      id = $$${transactionId}$$
`);
  transaction = transaction.rows[0]; // Why numeric values are text?

  let ownerResult: any = await pool.query(`
  SELECT owner
  FROM accounter_schema.financial_accounts
  WHERE
      account_number = $$${transaction.account_number}$$
`);
  let owner = ownerResult.rows[0].owner;

  let financialAccounts = await getHashFinancialAccounts(transaction);
  let hashBusinessIndexes = await getHashBusinessIndexes(transaction, owner);
  let hashVATIndexes = await getVATIndexes(owner);

  let isracardHashIndexes;
  if (transaction.financial_entity == 'Isracard') {
    let hashCreditcardIndexResult: any = await pool.query(`
    select hashavshevet_account_ils,
          hashavshevet_account_usd,
          hashavshevet_account_eur
    from accounter_schema.financial_accounts
    where
      account_number = $$${transaction.bank_reference}$$;
`);
    console.log('transaction.bank_reference', transaction.bank_reference);
    console.log('hashCreditcardIndexResult', hashCreditcardIndexResult.rows[0]);
    switch (transaction.currency_code) {
      case 'ILS':
        isracardHashIndexes =
          hashCreditcardIndexResult.rows[0].hashavshevet_account_ils;
        break;
      case 'USD':
        isracardHashIndexes =
          hashCreditcardIndexResult.rows[0].hashavshevet_account_usd;
        break;
      case 'EUR':
        isracardHashIndexes =
          hashCreditcardIndexResult.rows[0].hashavshevet_account_eur;
        break;
      default:
        const errorMessage = `Unknown account type - ${transaction.currency_code}`;
        console.error(errorMessage);
        return errorMessage;
    }
  }

  let entryForFinancialAccount: any = {};
  let entryForAccounting: any = {};
  // credit זכות
  // debit חובה

  // if (transaction.vat == 0 &&
  //     !transaction.tax_invoice_date &&
  //     !transaction.tax_invoice_number &&
  //     !transaction.tax_invoice_file &&
  //     !transaction.
  //     transaction.receipt_number &&
  //     ) {

  transaction.tax_category = hashBusinessIndexes?.auto_tax_category
    ? hashBusinessIndexes?.auto_tax_category
    : transaction.tax_category;

  let originalTransaction = { ...transaction };

  if (
    transaction.currency_code != 'ILS' &&
    !transaction.tax_invoice_date &&
    !transaction.tax_invoice_number &&
    !transaction.tax_invoice_file &&
    !transaction.proforma_invoice_file &&
    transaction.receipt_number &&
    transaction.receipt_date &&
    transaction.receipt_url &&
    transaction.receipt_image
  ) {
    transaction.tax_invoice_date = transaction.receipt_date;
    transaction.tax_invoice_number = transaction.receipt_number;
    transaction.tax_invoice_file = transaction.receipt_url;
    transaction.proforma_invoice_file = transaction.receipt_image;
  }
  if (transaction.tax_invoice_currency) {
    transaction.currency_code = transaction.tax_invoice_currency;
    transaction.event_amount = transaction.tax_invoice_amount;
    if (transaction.account_type == 'creditcard') {
      transaction.account_type = 'checking_usd';
    } else {
      transaction.debit_date = transaction.tax_invoice_date;
    }
  }

  addTrueVATtoTransaction(transaction); // parseFloat

  let transactionsExchnageRates = await getTransactionExchangeRates(
    transaction
  );
  let debitExchangeRates = transactionsExchnageRates.debitExchangeRates;
  let invoiceExchangeRates = transactionsExchnageRates.invoiceExchangeRates;

  //////  invoice date

  entryForAccounting.movementType = null;

  entryForFinancialAccount.creditAccount = transaction.financial_entity;
  entryForFinancialAccount.debitAccount = transaction.account_type;
  entryForAccounting.creditAccount = transaction.tax_category;
  entryForAccounting.debitAccount = transaction.financial_entity;

  entryForFinancialAccount.creditAmount = entryForFinancialAccount.debitAmount =
    transaction.event_amount;
  entryForAccounting.creditAmount = entryForAccounting.debitAmount =
    transaction.tax_invoice_amount
      ? transaction.tax_invoice_amount
      : transaction.event_amount;

  entryForFinancialAccount.creditAmountILS =
    entryForFinancialAccount.debitAmountILS = getILSForDate(
      transaction,
      debitExchangeRates
    ).eventAmountILS;
  entryForAccounting.creditAmountILS = entryForAccounting.debitAmountILS =
    getILSForDate(
      transaction,
      transaction.account_type == 'creditcard'
        ? debitExchangeRates
        : invoiceExchangeRates
    ).eventAmountILS;

  if (transaction.vatAfterDiduction && transaction.vatAfterDiduction != 0) {
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
    entryForAccounting.secondAccountDebitAmount =
      entryForAccounting.secondAccountDebitAmountILS = 0;
    entryForAccounting.movementType =
      hashVATIndexes.vatIncomesMovementTypeIndex;
    if (transaction.event_amount > 0) {
      entryForAccounting.creditAccount = hashVATIndexes.vatIncomesIndex;
    }
  } else {
    if (transaction.tax_category != 'אוריח') {
      entryForAccounting.movementType =
        hashVATIndexes.vatFreeIncomesMovementTypeIndex;

      if (transaction.event_amount > 0) {
        entryForAccounting.creditAccount = hashVATIndexes.vatFreeIncomesIndex;
      }
    }
  }

  if (transaction.tax_invoice_currency) {
    entryForFinancialAccount.creditAmountILS =
      entryForFinancialAccount.debitAmountILS =
        originalTransaction.event_amount;
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
        : transaction.is_property
        ? (entryForAccounting.movementType =
            hashVATIndexes.vatExpensesPropertyMovementTypeIndex)
        : (entryForAccounting.movementType =
            hashVATIndexes.vatExpensesMovementTypeIndex);
    } else {
      entryForAccounting.movementType = null;
    }
  }

  console.log({
    entryForAccounting,
    entryForFinancialAccount,
  });

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

  let entryForAccountingValues = [
    hashDateFormat(
      !ENTITIES_WITHOUT_INVOICE_DATE.includes(transaction.financial_entity) &&
        !TAX_CATEGORIES_WITHOUT_INVOICE_DATE.includes(transaction.tax_category)
        ? transaction.tax_invoice_date
        : transaction.event_date
    ), // add a check if should have an invoice but doesn't let user know
    hashAccounts(
      entryForAccounting.debitAccount,
      financialAccounts,
      hashBusinessIndexes,
      hashVATIndexes,
      transaction.currency_code,
      isracardHashIndexes,
      transaction.bank_description
    ),
    hashNumber(entryForAccounting.debitAmountILS),
    transaction.currency_code != 'ILS'
      ? hashNumber(entryForAccounting.debitAmount)
      : null,
    hashCurrencyType(transaction.currency_code),
    hashAccounts(
      entryForAccounting.creditAccount,
      financialAccounts,
      hashBusinessIndexes,
      hashVATIndexes,
      transaction.currency_code,
      isracardHashIndexes,
      transaction.bank_description
    ),
    hashNumber(entryForAccounting.creditAmountILS),
    transaction.currency_code != 'ILS'
      ? hashNumber(entryForAccounting.creditAmount)
      : null,
    entryForAccounting.secondAccountDebitAmount &&
    entryForAccounting.secondAccountDebitAmount != 0
      ? transaction.is_property
        ? hashVATIndexes.vatPropertyInputsIndex
        : hashVATIndexes.vatInputsIndex
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
      ? hashVATIndexes.vatOutputsIndex
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
          : !TAX_CATEGORIES_WITHOUT_INVOICE_DATE.includes(
              transaction.tax_category
            )
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
    owner,
  ];

  let foreignBalance = null;
  let currency = hashCurrencyType(transaction.currency_code);
  if (transaction.financial_entity == 'Isracard') {
    let originalInvoicedAmountAndCurrency: any = await pool.query(`
    select tax_invoice_amount, tax_invoice_currency
    from accounter_schema.all_transactions
    where
      debit_date = to_date('${moment(transaction.event_date).format(
        'YYYY-MM-DD'
      )}', 'YYYY-MM-DD')
      and account_number = $$${transaction.bank_reference}$$
      and tax_invoice_currency is not null;  
`);
    if (
      originalInvoicedAmountAndCurrency &&
      originalInvoicedAmountAndCurrency.rows &&
      originalInvoicedAmountAndCurrency.rows.length > 0
    ) {
      foreignBalance = hashNumber(
        originalInvoicedAmountAndCurrency.rows[0].tax_invoice_amount
      );
      currency = hashCurrencyType(
        originalInvoicedAmountAndCurrency.rows[0].tax_invoice_currency
      );
    }
  }
  let entryForFinancialAccountValues = [
    hashDateFormat(transaction.event_date),
    hashAccounts(
      entryForFinancialAccount.debitAccount,
      financialAccounts,
      hashBusinessIndexes,
      hashVATIndexes,
      transaction.currency_code,
      isracardHashIndexes,
      transaction.bank_description
    ),
    hashNumber(entryForFinancialAccount.debitAmountILS),
    transaction.currency_code != 'ILS'
      ? hashNumber(entryForFinancialAccount.debitAmount)
      : foreignBalance,
    currency, // TODO: Check if it works for forgien creditcard in ILS
    hashAccounts(
      entryForFinancialAccount.creditAccount,
      financialAccounts,
      hashBusinessIndexes,
      hashVATIndexes,
      transaction.currency_code,
      isracardHashIndexes,
      transaction.bank_description
    ),
    hashNumber(entryForFinancialAccount.creditAmountILS),
    transaction.currency_code != 'ILS'
      ? hashNumber(entryForFinancialAccount.creditAmount)
      : foreignBalance,
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
    owner,
  ];

  if (transaction.is_conversion) {
    let conversionOtherSide: any = await pool.query(`
    select event_amount, currency_code
    from accounter_schema.all_transactions
    where
      bank_reference = $$${transaction.bank_reference}$$ and 
      id <> $$${transaction.id}$$;
  `);
    console.log('conversation!  ', conversionOtherSide.rows);

    if (transaction.event_amount > 0 && transaction.currency_code != 'ILS') {
      entryForFinancialAccountValues[2] = hashNumber(
        conversionOtherSide.rows[0].event_amount
      );
      entryForFinancialAccountValues[5] = null;
      entryForFinancialAccountValues[6] = null;
      entryForFinancialAccountValues[7] = null;
    } else if (
      transaction.event_amount < 0 &&
      transaction.currency_code == 'ILS'
    ) {
      entryForFinancialAccountValues[1] = null;
      entryForFinancialAccountValues[2] = null;
      entryForFinancialAccountValues[3] = null;
      entryForFinancialAccountValues[4] = hashCurrencyType(
        conversionOtherSide.rows[0].currency_code
      );
      entryForFinancialAccountValues[7] = hashNumber(
        conversionOtherSide.rows[0].event_amount
      );
    } else if (
      transaction.event_amount > 0 &&
      transaction.currency_code == 'ILS'
    ) {
      entryForFinancialAccountValues[3] = hashNumber(
        conversionOtherSide.rows[0].event_amount
      );
      entryForFinancialAccountValues[4] = hashCurrencyType(
        conversionOtherSide.rows[0].currency_code
      );
      entryForFinancialAccountValues[5] = null;
      entryForFinancialAccountValues[6] = null;
      entryForFinancialAccountValues[7] = null;
    } else if (
      transaction.event_amount < 0 &&
      transaction.currency_code != 'ILS'
    ) {
      entryForFinancialAccountValues[1] = null;
      entryForFinancialAccountValues[2] = null;
      entryForFinancialAccountValues[3] = null;
      entryForFinancialAccountValues[6] = hashNumber(
        conversionOtherSide.rows[0].event_amount
      );
    }
  }

  let queryConfig = {
    text: INSERT_MOVEMENT_QUERY,
    values: entryForAccountingValues,
  };
  if (!ENTITIES_WITHOUT_ACCOUNTING.includes(transaction.financial_entity)) {
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

  if (
    transaction.tax_invoice_currency &&
    entryForFinancialAccount.debitAmountILS != entryForAccounting.debitAmountILS
  ) {
    console.log('שערררררררר של different currencies');
    let credit = hashAccounts(
      entryForFinancialAccount.creditAccount,
      financialAccounts,
      hashBusinessIndexes,
      hashVATIndexes,
      transaction.currency_code,
      isracardHashIndexes,
      transaction.bank_description
    );
    if (transaction.event_amount < 0) {
      credit = hashAccounts(
        entryForFinancialAccount.debitAccount,
        financialAccounts,
        hashBusinessIndexes,
        hashVATIndexes,
        transaction.currency_code,
        isracardHashIndexes,
        transaction.bank_description
      );
    }
    let entryForExchangeRatesDifferenceValues = [
      hashDateFormat(transaction.event_date),
      hashVATIndexes.hashCurrencyRatesDifferencesIndex,
      hashNumber(
        entryForFinancialAccount.debitAmountILS -
          entryForAccounting.debitAmountILS
      ),
      null,
      hashCurrencyType('ILS'),
      credit,
      hashNumber(
        entryForFinancialAccount.debitAmountILS -
          entryForAccounting.debitAmountILS
      ),
      hashCurrencyType('ILS'),
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
      'generated_invoice_rates_change_invoice_currency',
      transaction.proforma_invoice_file,
      uuidv4(),
      owner,
    ];

    queryConfig.values = entryForExchangeRatesDifferenceValues;

    try {
      let updateResult = await pool.query(queryConfig);
      console.log(JSON.stringify(updateResult));
    } catch (error) {
      // TODO: Log important checks
      console.log(
        'error in insert entryForExchangeRatesDifferenceValues - ',
        error
      );
    }
  } else if (
    getILSForDate(transaction, invoiceExchangeRates).eventAmountILS !=
      getILSForDate(transaction, debitExchangeRates).eventAmountILS &&
    transaction.account_type != 'creditcard' &&
    transaction.financial_entity != 'Isracard' &&
    transaction.tax_invoice_date
  ) {
    console.log('שערררררררר');
    let credit = hashAccounts(
      entryForFinancialAccount.creditAccount,
      financialAccounts,
      hashBusinessIndexes,
      hashVATIndexes,
      transaction.currency_code,
      isracardHashIndexes,
      transaction.bank_description
    );
    if (transaction.event_amount < 0) {
      credit = hashAccounts(
        entryForFinancialAccount.debitAccount,
        financialAccounts,
        hashBusinessIndexes,
        hashVATIndexes,
        transaction.currency_code,
        isracardHashIndexes,
        transaction.bank_description
      );
    }
    let amount = hashNumberNoAbs(
      numberRounded(
        getILSForDate(transaction, debitExchangeRates).eventAmountILS
      ) -
        numberRounded(
          getILSForDate(transaction, invoiceExchangeRates).eventAmountILS
        )
    );
    let entryForExchangeRatesDifferenceValues = [
      hashDateFormat(transaction.tax_invoice_date),
      credit,
      amount,
      null,
      hashCurrencyType('ILS'),
      hashVATIndexes.hashCurrencyRatesDifferencesIndex,
      amount,
      hashCurrencyType('ILS'),
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
      'generated_invoice_rates_change',
      transaction.proforma_invoice_file,
      uuidv4(),
      owner,
    ];

    queryConfig.values = entryForExchangeRatesDifferenceValues;

    try {
      let updateResult = await pool.query(queryConfig);
      console.log(JSON.stringify(updateResult));
    } catch (error) {
      // TODO: Log important checks
      console.log(
        'error in insert entryForExchangeRatesDifferenceValues - ',
        error
      );
    }
  }

  return 'done';
};
