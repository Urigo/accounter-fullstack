import lodash from 'lodash';
import moment from 'moment';
import pg from 'pg';
import type { CalTransaction } from '../../../modern-poalim-scraper/src/scrapers/types/cal/get-card-transactions-details.js';
import type { DiscountTransaction } from '../../../modern-poalim-scraper/src/scrapers/types/discount/get-last-transactions.js';
import type { DecoratedTransaction } from '../scrape.js';

const { camelCase } = lodash;

function reverse(s: string) {
  return s.split('').reverse().join('');
}

export type AccountTypes =
  | 'ils'
  | 'usd'
  | 'eur'
  | 'gbp'
  | 'cad'
  | 'deposits'
  | 'foreign_deposits'
  | 'isracard'
  | 'amex'
  | 'cal';

type TransactionTypeSelector<T extends AccountTypes> = T extends 'isracard' | 'amex'
  ? DecoratedTransaction
  : any;

export async function saveTransactionsToDB<
  Type extends AccountTypes,
  TransactionType extends TransactionTypeSelector<Type>,
>(
  transactions: TransactionType[],
  accountType: Type,
  accountObject: {
    accountNumber: number;
    branchNumber: number;
    bankNumber: number;
  } | null,
  pool: pg.Pool,
) {
  if (accountObject) {
    transactions = transactions.map(transaction => ({
      ...transaction,
      ...accountObject,
    }));
  }

  for (const transaction of transactions) {
    let oldContraAccountFieldNameLableAPI = false;
    // console.log(transaction.card);
    if (transaction.card && transaction.card == '17 *') {
      transaction.card = '9217';
    }
    if (transaction.card && transaction.card == '70 *') {
      transaction.card = '9270';
    }
    if (accountType == 'ils') {
      normalizeBeneficiaryDetailsData<Type>(transaction);
      if (transaction.activityDescriptionIncludeValueDate == undefined) {
        transaction.activityDescriptionIncludeValueDate = null;
      }
    } else if (
      accountType == 'usd' ||
      accountType == 'eur' ||
      accountType == 'gbp' ||
      accountType == 'cad'
    ) {
      normalizeForeignTransactionMetadata<Type>(transaction);
      if (transaction.contraAccountFieldNameLable == 0) {
        console.log('old API!');
        transaction.contraAccountFieldNameLable = null;
        oldContraAccountFieldNameLableAPI = true;
      }
      // else {
      //   console.log('napi ', transaction.contraAccountFieldNameLable);
      // }
    }

    function getTableName(accountType: AccountTypes): string {
      if (accountType === 'isracard') return 'isracard_creditcard_transactions';
      if (accountType === 'amex') return 'amex_creditcard_transactions';
      return `poalim_${accountType}_account_transactions`;
    }
    const tableName = getTableName(accountType);

    const columnNamesResult = await pool.query<{
      column_name: string;
      data_type: string;
      is_nullable: string;
      column_default: string | null;
    }>(`
      SELECT * 
      FROM information_schema.columns
      WHERE table_schema = 'accounter_schema'
      AND table_name = '${tableName}';
    `);

    let optionalTransactionKeys: string[] = [];
    if (accountType == 'ils') {
      // TODO: Save the mandatory values to DB accourding to schema
      optionalTransactionKeys = [
        'beneficiaryDetailsDataPartyName',
        'beneficiaryDetailsDataMessageHeadline',
        'beneficiaryDetailsDataPartyHeadline',
        'beneficiaryDetailsDataMessageDetail',
        'beneficiaryDetailsDataTableNumber',
        'beneficiaryDetailsDataRecordNumber',
        'activityDescriptionIncludeValueDate',
        'urlAddressNiar',
        'displayCreditAccountDetails',
        'displayRTGSIncomingTrsDetails',
        'formattedEventAmount',
        'formattedCurrentBalance',
      ];
    } else if (
      accountType == 'usd' ||
      accountType == 'eur' ||
      accountType == 'gbp' ||
      accountType == 'cad'
    ) {
      // TODO: Save the mandatory values to DB accourding to schema
      optionalTransactionKeys = [
        'metadata',
        'urlAddressNiar',
        'displayCreditAccountDetails',
        'displayRTGSIncomingTrsDetails',
        'recordSerialNumber',
        'expendedExecutingDate',
      ];
    } else if (accountType == 'deposits') {
      // TODO: Check if we want to save it to DB
      optionalTransactionKeys = ['data0ExpectedRepaymentSwitch'];
    } else if (accountType == 'isracard' || accountType == 'amex') {
      optionalTransactionKeys = [
        'clientIpAddress',
        'bcKey',
        'chargingDate',
        'requestNumber',
        'accountErrorCode',
      ];
    }
    optionalTransactionKeys = optionalTransactionKeys.concat(['id']);
    findMissingTransactionKeys<Type>(
      transaction,
      columnNamesResult,
      optionalTransactionKeys,
      accountType,
    );
    fillInDefaultValues<Type>(transaction, columnNamesResult, accountType);

    const additionalColumnsToExcludeFromTransactionComparison: string[] = [];
    additionalColumnsToExcludeFromTransactionComparison.push('formattedEventAmount');
    additionalColumnsToExcludeFromTransactionComparison.push('formattedCurrentBalance');
    additionalColumnsToExcludeFromTransactionComparison.push('cardIndex'); // If you get a new creditcard, all indexes will change and you could get duplicates
    additionalColumnsToExcludeFromTransactionComparison.push('kodMatbeaMekori');
    if (oldContraAccountFieldNameLableAPI) {
      additionalColumnsToExcludeFromTransactionComparison.push('contraAccountFieldNameLable');
    }
    if (accountType == 'deposits') {
      additionalColumnsToExcludeFromTransactionComparison.push(
        'validityDate',
        'formattedDate',
        'validityTime',
        'formattedValidityTime',
      );
    }
    const whereClause = createWhereClause<Type>(
      transaction,
      columnNamesResult,
      `accounter_schema.` + tableName,
      additionalColumnsToExcludeFromTransactionComparison,
    );

    try {
      const res = await pool.query(whereClause);

      // console.log('pg result - ', res.rowCount);
      if ((res.rowCount ?? 0) > 0) {
        // console.log('found');
      } else {
        console.log('not found');

        let columnNames = columnNamesResult.rows.map(column => column.column_name);
        columnNames = columnNames.filter((columnName: string) => columnName != 'id');
        let text = `INSERT INTO accounter_schema.${tableName}
        (
          ${columnNames.map(x => x).join(', ')},
        )`;
        const lastIndexOfComma = text.lastIndexOf(',');
        text = text
          .substring(0, lastIndexOfComma)
          .concat(text.substring(lastIndexOfComma + 1, text.length));

        const arrayKeys = columnNames.keys();
        let denseKeys = [...arrayKeys];
        denseKeys = denseKeys.map(x => x + 1);
        const keysOfInputs = denseKeys.join(', $');
        text = text.concat(` VALUES($${keysOfInputs}) RETURNING *`);

        const values = transactionValuesToArray(transaction, accountType);

        if (values.length != columnNames.length) {
          // TODO: Log important checks
          console.log('Wrong Insert length');
        }

        try {
          let sign = '+';
          if (transaction.eventActivityTypeCode == 2) {
            sign = '-';
          }
          if (transaction.transactionType == 'TODAY') {
            console.log(`Today transaction - 
              ${reverse(transaction.activityDescription)},
              ${accountType}${sign}${transaction.eventAmount.toLocaleString()},
              ${transaction.accountNumber}
            `);
          } else if (transaction.transactionType == 'FUTURE') {
            console.log(`Future transaction - 
                ${reverse(transaction.activityDescription)},
                ${accountType}${sign}${transaction.eventAmount.toLocaleString()},
                ${transaction.accountNumber}
              `);
          } else if (
            accountType == 'ils' &&
            moment(transaction.eventDate, 'YYYY-MM-DD').diff(moment(), 'months') > 2
          ) {
            console.error('Was going to insert an old transaction!!', JSON.stringify(transaction));
          } else if (
            (accountType == 'usd' ||
              accountType == 'eur' ||
              accountType == 'gbp' ||
              accountType == 'cad') &&
            moment(transaction.executingDate, 'YYYY-MM-DD').diff(moment(), 'months') > 2
          ) {
            console.error('Was going to insert an old transaction!!', JSON.stringify(transaction));
          } else if (
            accountType == 'isracard' &&
            ((transaction.fullPurchaseDate != null &&
              moment(transaction.fullPurchaseDate, 'DD/MM/YYYY').diff(moment(), 'months') > 2) ||
              (transaction.fullPurchaseDateOutbound != null &&
                moment(transaction.fullPurchaseDateOutbound, 'DD/MM/YYYY').diff(
                  moment(),
                  'months',
                ) > 3))
          ) {
            console.error('Was going to insert an old transaction!!', JSON.stringify(transaction));
          } else {
            const res = await pool.query(text, values);
            if (res.rows[0].event_amount) {
              console.log(
                `success in insert to ${accountType} - ${transaction.accountNumber} - ${reverse(res.rows[0].activity_description)} - ${sign}${res.rows[0].event_amount.toLocaleString()} - ${res.rows[0].event_date}`,
              );
            } else if (res.rows[0].original_amount) {
              console.log(
                `success in insert to ${accountType}-${transaction.cardNumber} - `,
                res.rows[0].original_amount,
              );
            } else if (res.rows[0].card) {
              let supplierName = res.rows[0].supplier_name;
              if (supplierName) {
                supplierName = reverse(res.rows[0].supplier_name);
              } else {
                supplierName = res.rows[0].supplier_name_outbound;
              }
              console.log(
                `success in insert to ${res.rows[0].card} - ${res.rows[0].payment_sum} - ${res.rows[0].payment_sum_outbound} - ${supplierName} - ${res.rows[0].full_purchase_date_outbound}`,
                res.rows[0].full_purchase_date,
              );
            } else if (res.rows[0].source) {
              console.log(
                `success in insert to ${res.rows[0].source} - ${res.rows[0].amount} - ${res.rows[0].validityDate}`,
                res.rows[0].data_0_product_free_text,
              );
            } else {
              // console.log('saved', JSON.stringify(res));
            }
          }
          // console.log('nothing');
        } catch (error) {
          // TODO: Log important checks
          console.log(
            `error in insert - ${error} - ${text} - ${values} - ${JSON.stringify(transaction)}`,
          );
          // console.log('nothing');
        }
      }
    } catch (error) {
      // TODO: Log important checks
      console.log('pg error - ', error);
    }
  }
}

export async function saveCalTransactionsToDB(
  card: string,
  transactions: CalTransaction[],
  pool: pg.Pool,
) {
  for (const transaction of transactions) {
    await saveCalTransaction(card, transaction, pool);
  }
}

async function saveCalTransaction(card: string, transaction: CalTransaction, pool: pg.Pool) {
  const tableName = 'accounter_schema.cal_creditcard_transactions';

  const transactionData = {
    card,
    trn_int_id: transaction.trnIntId,
    trn_numaretor: transaction.trnNumaretor,
    merchant_name: transaction.merchantName,
    trn_purchase_date: formatDate(new Date(transaction.trnPurchaseDate)),
    trn_amt: transaction.trnAmt,
    trn_currency_symbol: normalizeCurrencySymbol(transaction.trnCurrencySymbol),
    trn_type: transaction.trnType,
    trn_type_code: transaction.trnTypeCode,
    deb_crd_date: formatDate(new Date(transaction.debCrdDate)),
    amt_before_conv_and_index: transaction.amtBeforeConvAndIndex,
    deb_crd_currency_symbol: normalizeCurrencySymbol(transaction.debCrdCurrencySymbol),
    merchant_address: transaction.merchantAddress,
    merchant_phone_no: transaction.merchantPhoneNo,
    branch_code_desc: transaction.branchCodeDesc,
    trans_card_present_ind: transaction.transCardPresentInd,
    cur_payment_num: transaction.curPaymentNum,
    num_of_payments: transaction.numOfPayments,
    token_ind: transaction.tokenInd,
    wallet_provider_code: transaction.walletProviderCode,
    wallet_provider_desc: transaction.walletProviderDesc,
    token_number_part4: transaction.tokenNumberPart4,
    cash_account_trn_amt: transaction.cashAccountTrnAmt,
    charge_external_to_card_comment: transaction.chargeExternalToCardComment,
    refund_ind: transaction.refundInd,
    is_immediate_comment_ind: transaction.isImmediateCommentInd,
    is_immediate_hhk_ind: transaction.isImmediateHHKInd,
    is_margarita: transaction.isMargarita,
    is_spread_paymenst_abroad: transaction.isSpreadPaymenstAbroad,
    trn_exac_way: transaction.trnExacWay,
    debit_spread_ind: transaction.debitSpreadInd,
    on_going_transactions_comment: transaction.onGoingTransactionsComment,
    early_payment_ind: transaction.earlyPaymentInd,
    merchant_id: transaction.merchantId,
    crd_ext_id_num_type_code: transaction.crdExtIdNumTypeCode,
    trans_source: transaction.transSource,
    is_abroad_transaction: transaction.isAbroadTransaction,
  };

  const columns = Object.keys(transactionData);
  const values = Object.values(transactionData);

  const text = `INSERT INTO ${tableName} (
    ${columns.join(', ')}
  ) VALUES (
    ${columns.map((_, i) => `$${i + 1}`).join(', ')}
  ) RETURNING *`;

  try {
    await pool.query(text, values);
    console.log(
      `Success in insert to Cal - ${transaction.merchantName} - ${transaction.trnAmt} ${transaction.trnCurrencySymbol}`,
    );
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes('duplicate key value violates unique constraint')
    ) {
      console.log('Duplicate key violation, skipping insert', { id: transaction.trnIntId });
      return;
    }

    console.error('Error in Cal insert:', {
      error:
        error instanceof Error
          ? {
              message: error.message,
              stack: error.stack,
              cause: error.cause,
            }
          : error,
      query: {
        // text,
        values: transactionData,
      },
    });
  }
}

export async function saveDiscountTransactionsToDB(
  transactions: DiscountTransaction[],
  pool: pg.Pool,
  accountNumber: string,
) {
  for (const transaction of transactions) {
    await saveDiscountTransaction(transaction, pool, accountNumber);
  }
}

async function saveDiscountTransaction(
  transaction: DiscountTransaction,
  pool: pg.Pool,
  accountNumber: string,
) {
  const tableName = 'accounter_schema.bank_discount_transactions';

  // converts 20240109 to Date object
  function convertToDate(dateStr: string): Date {
    return new Date(
      parseInt(dateStr.substring(0, 4)),
      parseInt(dateStr.substring(4, 6)) - 1,
      parseInt(dateStr.substring(6, 8)),
    );
  }

  const transactionData = {
    account_number: accountNumber,
    operation_date: formatDate(convertToDate(transaction.OperationDate)),
    value_date: formatDate(convertToDate(transaction.ValueDate)),
    operation_code: transaction.OperationCode,
    operation_description: transaction.OperationDescription,
    operation_description2: transaction.OperationDescription2,
    operation_description3: transaction.OperationDescription3,
    operation_branch: transaction.OperationBranch,
    operation_bank: transaction.OperationBank,
    channel: transaction.Channel,
    channel_name: transaction.ChannelName,
    check_number: transaction.CheckNumber || null,
    institute_code: transaction.InstituteCode,
    operation_amount: transaction.OperationAmount,
    balance_after_operation: transaction.BalanceAfterOperation,
    operation_number: transaction.OperationNumber,
    branch_treasury_number: transaction.BranchTreasuryNumber,
    urn: transaction.Urn,
    operation_details_service_name: transaction.OperationDetailsServiceName,
    commission_channel_code: transaction.CommissionChannelCode,
    commission_channel_name: transaction.CommissionChannelName,
    commission_type_name: transaction.CommissionTypeName,
    business_day_date: formatDate(convertToDate(transaction.BusinessDayDate)),
    event_name: transaction.EventName,
    category_code: transaction.CategoryCode,
    category_desc_code: transaction.CategoryDescCode,
    category_description: transaction.CategoryDescription,
    operation_description_to_display: transaction.OperationDescriptionToDisplay,
    operation_order: transaction.OperationOrder,
    is_last_seen: transaction.IsLastSeen,
  };

  const columns = Object.keys(transactionData);
  const values = Object.values(transactionData);

  const text = `INSERT INTO ${tableName} (
    ${columns.join(', ')}
  ) VALUES (
    ${columns.map((_, i) => `$${i + 1}`).join(', ')}
  ) RETURNING *`;

  try {
    await pool.query(text, values);
    console.log(
      `Success in insert to Discount - ${transaction.OperationDescription} - ${transaction.OperationAmount}`,
    );
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes('duplicate key value violates unique constraint')
    ) {
      console.log('Duplicate key violation, skipping insert', { urn: transaction.Urn });
      return;
    }

    console.error('Error in Discount insert:', {
      error:
        error instanceof Error
          ? {
              message: error.message,
              stack: error.stack,
              cause: error.cause,
            }
          : error,
      query: {
        // text,
        values: transactionData,
      },
    });
  }
}

function normalizeCurrencySymbol(currencySymbol: string): string {
  switch (currencySymbol) {
    case '$':
    case 'USD':
    case 'דולר':
      return 'USD';
    case '₪':
    case 'NIS':
    case 'ש"ח':
      return 'ILS';
    case '€':
    case 'EUR':
      return 'EUR';
    case '£':
    case 'GBP':
      return 'GBP';
    case 'CAD':
      return 'CAD';
    default:
      return 'ILS';
  }
}

function formatDate(date: Date): string {
  // Convert ISO date string to DD/MM/YYYY format for to_date() function
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

function normalizeBeneficiaryDetailsData<Type extends AccountTypes>(
  transaction: TransactionTypeSelector<Type>,
) {
  if (
    typeof transaction.beneficiaryDetailsData !== 'undefined' &&
    transaction.beneficiaryDetailsData != null
  ) {
    transaction.beneficiaryDetailsDataPartyName = transaction.beneficiaryDetailsData.partyName;
    transaction.beneficiaryDetailsDataMessageHeadline =
      transaction.beneficiaryDetailsData.messageHeadline;
    transaction.beneficiaryDetailsDataPartyHeadline =
      transaction.beneficiaryDetailsData.partyHeadline;
    transaction.beneficiaryDetailsDataMessageDetail =
      transaction.beneficiaryDetailsData.messageDetail;
    transaction.beneficiaryDetailsDataTableNumber = transaction.beneficiaryDetailsData.tableNumber;
    transaction.beneficiaryDetailsDataRecordNumber =
      transaction.beneficiaryDetailsData.recordNumber;

    transaction.beneficiaryDetailsData = null;
  } else {
    transaction.beneficiaryDetailsDataPartyName = null;
    transaction.beneficiaryDetailsDataMessageHeadline = null;
    transaction.beneficiaryDetailsDataPartyHeadline = null;
    transaction.beneficiaryDetailsDataMessageDetail = null;
    transaction.beneficiaryDetailsDataTableNumber = null;
    transaction.beneficiaryDetailsDataRecordNumber = null;
  }
}

function findMissingTransactionKeys<Type extends AccountTypes>(
  transaction: TransactionTypeSelector<Type>,
  columnNames: { rows: { column_name: string }[] },
  knownOptionals: string[],
  accountType: string,
) {
  const allKeys = Object.keys(transaction);
  const fixedExistingKeys: string[] = columnNames.rows.map(column => camelCase(column.column_name));

  const InTransactionNotInDB = allKeys.filter(x => !fixedExistingKeys.includes(x));
  const inDBNotInTransaction = fixedExistingKeys.filter(x => !allKeys.includes(x));

  if (InTransactionNotInDB.length != 0 || inDBNotInTransaction.length != 0) {
    // TODO: Log important checks
    if (!inDBNotInTransaction.every(e => knownOptionals.includes(e))) {
      console.log('new keys!! inDBNotInTransaction', inDBNotInTransaction);
    }
    if (!InTransactionNotInDB.every(e => knownOptionals.includes(e))) {
      console.log(`new keys!! InTransactionNotInDB ${accountType}`, InTransactionNotInDB);
    }
  }
}

function fillInDefaultValues<Type extends AccountTypes>(
  // fill in default values for missing keys, to prevent missing preexisting DB records and creation of duplicates
  transaction: TransactionTypeSelector<Type>,
  columnNames: {
    rows: {
      column_name: string;
      is_nullable: string;
      data_type: string;
      column_default: string | null;
    }[];
  },
  accountType: string,
) {
  const allKeys = Object.keys(transaction);
  const existingFields = columnNames.rows.map(column => ({
    name: camelCase(column.column_name),
    nullable: column.is_nullable === 'YES',
    type: column.data_type,
    defaultValue: column.column_default,
  }));

  // const InTransactionNotInDB = allKeys.filter(x => !fixedExistingKeys.includes(x));
  const inDBNotInTransaction = existingFields.filter(x => !allKeys.includes(x.name) && !x.nullable);

  for (const key of inDBNotInTransaction) {
    if (key.name == 'id') {
      continue;
    }
    if (key.defaultValue) {
      console.log(`Cannot autofill ${key.name} in ${accountType} with ${key.defaultValue}`);
    } else {
      switch (key.type) {
        case 'integer':
        case 'bit':
          transaction[key.name] = 0;
          break;
        default:
          console.log(`Cannot autofill ${key.name}, no default value for ${key.type}`);
      }
    }
  }

  return;
}

function createWhereClause<Type extends AccountTypes>(
  transaction: TransactionTypeSelector<Type>,
  checkingColumnNames: { rows: { column_name: string; data_type: string }[] },
  tableName: string,
  extraColumnsToExcludeFromComparison: string[],
) {
  let whereClause = `
  SELECT * FROM ${tableName}
  WHERE 
  `;

  let columnNamesToExcludeFromComparison = [
    'recordNumber',
    'beneficiaryDetailsDataRecordNumber', // Same beneficiary will update the index whenever there is a new one
    'id',
  ];

  if (extraColumnsToExcludeFromComparison.length > 0) {
    columnNamesToExcludeFromComparison = columnNamesToExcludeFromComparison.concat(
      extraColumnsToExcludeFromComparison,
    );
  }
  for (const dBcolumn of checkingColumnNames.rows) {
    const camelCaseColumnName = camelCase(dBcolumn.column_name);
    if (!columnNamesToExcludeFromComparison.includes(camelCaseColumnName)) {
      let actualCondition = '';
      const isNotNull =
        typeof transaction[camelCaseColumnName] !== 'undefined' &&
        transaction[camelCaseColumnName] != null;

      if (dBcolumn.column_name == 'more_info') {
        actualCondition = `${dBcolumn.column_name} IS NULL`;
        if (isNotNull) {
          actualCondition = `
            ${dBcolumn.column_name} = $$${transaction[camelCaseColumnName]}$$ OR 
            ${dBcolumn.column_name} = $$${transaction[camelCaseColumnName].replace(
              'הנחה',
              'צבירת',
            )}$$ OR 
            ${dBcolumn.column_name} = $$${transaction[camelCaseColumnName].replace(
              'צבירת',
              'הנחה',
            )}$$
          `;
        }
        whereClause = whereClause.concat(`  (${actualCondition}) AND  `);
      } else {
        whereClause = whereClause.concat('  ' + dBcolumn.column_name);

        if (
          dBcolumn.data_type == 'character varying' ||
          dBcolumn.data_type == 'USER-DEFINED' ||
          dBcolumn.data_type == 'text'
        ) {
          if (isNotNull && camelCaseColumnName != 'beneficiaryDetailsData') {
            actualCondition = `= $$` + transaction[camelCaseColumnName] + `$$`;
          }
        } else if (dBcolumn.data_type == 'date' || dBcolumn.data_type == 'bit') {
          actualCondition = `= '` + transaction[camelCaseColumnName] + `'`;
          // if (dBcolumn.data_type == 'bit') {
          //   console.log('bit - ', actualCondition);
          //   console.log(transaction.eventAmount)
          // }
        } else if (
          dBcolumn.data_type == 'integer' ||
          dBcolumn.data_type == 'numeric' ||
          dBcolumn.data_type == 'bigint'
        ) {
          actualCondition = `= ` + transaction[camelCaseColumnName];
        } else if (isNotNull && dBcolumn.data_type == 'json') {
          const firstKey = Object.keys(transaction[camelCaseColumnName])[0];
          actualCondition =
            `->> '` + firstKey + `' = '` + transaction[camelCaseColumnName][firstKey] + `'`;
          if (Object.keys(transaction[camelCaseColumnName]).length > 1) {
            // TODO: Log important checks
            console.log('more keys in json!', Object.keys(transaction[camelCaseColumnName]));
          }
        } else if (isNotNull || dBcolumn.data_type != 'json') {
          // TODO: Log important checks
          console.log('unknown type ' + dBcolumn.data_type + ' ' + camelCaseColumnName);
        }

        whereClause = whereClause.concat(
          ` ${isNotNull ? actualCondition : 'IS NULL'} AND
           `,
        );
      }
    }
  }
  const lastIndexOfAND = whereClause.lastIndexOf('AND');
  whereClause = whereClause.substring(0, lastIndexOfAND);

  return whereClause;
}

function normalizeForeignTransactionMetadata<Type extends AccountTypes>(
  transaction: TransactionTypeSelector<Type>,
) {
  if (typeof transaction.metadata !== 'undefined' && transaction.metadata != null) {
    if (
      typeof transaction.metadata.attributes !== 'undefined' &&
      transaction.metadata.attributes != null
    ) {
      transaction.metadataAttributesOriginalEventKey =
        transaction.metadata.attributes.originalEventKey;
      transaction.metadataAttributesContraBranchNumber =
        transaction.metadata.attributes.contraBranchNumber;
      transaction.metadataAttributesContraAccountNumber =
        transaction.metadata.attributes.contraAccountNumber;
      transaction.metadataAttributesContraBankNumber =
        transaction.metadata.attributes.contraBankNumber;
      transaction.metadataAttributesContraAccountFieldNameLable =
        transaction.metadata.attributes.contraAccountFieldNameLable;
      transaction.metadataAttributesDataGroupCode = transaction.metadata.attributes.dataGroupCode;
      transaction.metadataAttributesCurrencyRate = transaction.metadata.attributes.currencyRate;
      transaction.metadataAttributesContraCurrencyCode =
        transaction.metadata.attributes.contraCurrencyCode;
      transaction.metadataAttributesRateFixingCode = transaction.metadata.attributes.rateFixingCode;
      transaction.metadataAttributesCurrencyRate = transaction.metadata.attributes.currencyRate;
      transaction.metadataAttributesContraCurrencyCode =
        transaction.metadata.attributes.contraCurrencyCode;
      transaction.metadataAttributesRateFixingCode = transaction.metadata.attributes.rateFixingCode;

      // transaction.beneficiaryDetailsData = null;
    }
  } else {
    transaction.metadataAttributesOriginalEventKey = null;
    transaction.metadataAttributesContraBranchNumber = null;
    transaction.metadataAttributesContraAccountNumber = null;
    transaction.metadataAttributesContraBankNumber = null;
    transaction.metadataAttributesContraAccountFieldNameLable = null;
    transaction.metadataAttributesDataGroupCode = null;
    transaction.metadataAttributesCurrencyRate = null;
    transaction.metadataAttributesContraCurrencyCode = null;
    transaction.metadataAttributesRateFixingCode = null;
    transaction.metadataAttributesCurrencyRate = null;
    transaction.metadataAttributesContraCurrencyCode = null;
    transaction.metadataAttributesRateFixingCode = null;
  }
}

function transactionValuesToArray<
  Type extends AccountTypes,
  TransactionType extends TransactionTypeSelector<Type>,
>(transaction: TransactionType, accountType: Type) {
  let values: (string | null)[] = [];
  if (accountType == 'ils') {
    values = [
      transaction.eventDate,
      transaction.formattedEventDate,
      transaction.serialNumber,
      transaction.activityTypeCode,
      transaction.activityDescription,
      transaction.textCode,
      transaction.referenceNumber,
      transaction.referenceCatenatedNumber,
      transaction.valueDate,
      transaction.formattedValueDate,
      transaction.eventAmount,
      transaction.eventActivityTypeCode,
      transaction.currentBalance,
      transaction.internalLinkCode,
      transaction.originalEventCreateDate,
      transaction.formattedOriginalEventCreateDate,
      transaction.transactionType,
      transaction.dataGroupCode,
      transaction.beneficiaryDetailsData,
      transaction.expandedEventDate,
      transaction.executingBranchNumber,
      transaction.eventId,
      transaction.details,
      transaction.pfmDetails,
      transaction.differentDateIndication,
      transaction.rejectedDataEventPertainingIndication,
      transaction.tableNumber,
      transaction.recordNumber,
      transaction.contraBankNumber,
      transaction.contraBranchNumber,
      transaction.contraAccountNumber,
      transaction.contraAccountTypeCode,
      transaction.marketingOfferContext,
      transaction.commentExistenceSwitch,
      transaction.englishActionDesc,
      transaction.fieldDescDisplaySwitch,
      transaction.urlAddressNiar,
      transaction.offerActivityContext,
      transaction.comment,
      transaction.beneficiaryDetailsDataPartyName,
      transaction.beneficiaryDetailsDataMessageHeadline,
      transaction.beneficiaryDetailsDataPartyHeadline,
      transaction.beneficiaryDetailsDataMessageDetail,
      transaction.beneficiaryDetailsDataTableNumber,
      transaction.beneficiaryDetailsDataRecordNumber,
      transaction.activityDescriptionIncludeValueDate,
      transaction.bankNumber,
      transaction.branchNumber,
      transaction.accountNumber,
    ];
  } else if (
    accountType == 'usd' ||
    accountType == 'eur' ||
    accountType == 'gbp' ||
    accountType == 'cad'
  ) {
    values = [
      transaction.metadataAttributesOriginalEventKey,
      transaction.metadataAttributesContraBranchNumber,
      transaction.metadataAttributesContraAccountNumber,
      transaction.metadataAttributesContraBankNumber,
      transaction.metadataAttributesContraAccountFieldNameLable,
      transaction.metadataAttributesDataGroupCode,
      transaction.metadataAttributesCurrencyRate,
      transaction.metadataAttributesContraCurrencyCode,
      transaction.metadataAttributesRateFixingCode,
      transaction.executingDate,
      transaction.formattedExecutingDate,
      transaction.valueDate,
      transaction.formattedValueDate,
      transaction.originalSystemId,
      transaction.activityDescription,
      transaction.eventAmount,
      transaction.currentBalance,
      transaction.referenceCatenatedNumber,
      transaction.referenceNumber,
      transaction.currencyRate,
      transaction.eventDetails,
      transaction.rateFixingCode,
      transaction.contraCurrencyCode,
      transaction.eventActivityTypeCode,
      transaction.transactionType,
      transaction.rateFixingShortDescription,
      transaction.currencyLongDescription,
      transaction.activityTypeCode,
      transaction.eventNumber,
      transaction.validityDate,
      transaction.comments,
      transaction.commentExistenceSwitch ?? 0,
      transaction.accountName,
      transaction.contraBankNumber ?? 0,
      transaction.contraBranchNumber ?? 0,
      transaction.contraAccountNumber ?? 0,
      transaction.originalEventKey ?? 0,
      transaction.contraAccountFieldNameLable,
      transaction.dataGroupCode ?? 0,
      transaction.rateFixingDescription,
      transaction.urlAddressNiar,
      transaction.currencySwiftCode,
      transaction.urlAddress,
      transaction.bankNumber,
      transaction.branchNumber,
      transaction.accountNumber,
    ];
  } else if (accountType == 'isracard' || accountType == 'amex') {
    const temp: DecoratedTransaction = transaction;
    values = [
      temp.specificDate,
      temp.cardIndex,
      temp.dealsInbound,
      temp.supplierId,
      temp.supplierName,
      temp.dealSumType,
      temp.paymentSumSign,
      temp.purchaseDate,
      temp.fullPurchaseDate,
      temp.moreInfo,
      temp.horaatKeva,
      temp.voucherNumber,
      temp.voucherNumberRatz,
      temp.solek,
      temp.purchaseDateOutbound,
      temp.fullPurchaseDateOutbound,
      temp.currencyId,
      temp.currentPaymentCurrency,
      temp.city,
      temp.supplierNameOutbound,
      temp.fullSupplierNameOutbound,
      temp.paymentDate,
      temp.fullPaymentDate,
      temp.isShowDealsOutbound,
      temp.adendum,
      temp.voucherNumberRatzOutbound,
      temp.isShowLinkForSupplierDetails,
      temp.dealSum,
      temp.paymentSum,
      temp.fullSupplierNameHeb,
      temp.dealSumOutbound,
      temp.paymentSumOutbound,
      temp.isHoraatKeva,
      temp.stage,
      temp.returnCode,
      temp.message,
      temp.returnMessage,
      temp.displayProperties,
      temp.tablePageNum,
      temp.isError,
      temp.isCaptcha,
      temp.isButton,
      temp.siteName,
      temp.clientIpAddress ?? null,
      temp.card,
      null,
      temp.kodMatbeaMekori ?? null,
    ];
  } else if (accountType == 'deposits') {
    values = [
      transaction.data0ShortProductName,
      transaction.data0PrincipalAmount,
      transaction.data0RevaluedTotalAmount,
      transaction.data0EndExitDate,
      transaction.data0PaymentDate,
      transaction.data0StatedAnnualInterestRate,
      transaction.data0HebrewPurposeDescription,
      transaction.data0ObjectiveAmount,
      transaction.data0ObjectiveDate,
      transaction.data0AgreementOpeningDate,
      transaction.data0EventWithdrawalAmount,
      transaction.data0StartExitDate,
      transaction.data0PeriodUntilNextEvent,
      transaction.data0RenewalDescription,
      transaction.data0RequestedRenewalNumber,
      transaction.data0InterestBaseDescription,
      transaction.data0InterestTypeDescription,
      transaction.data0SpreadPercent,
      transaction.data0VariableInterestDescription,
      transaction.data0AdjustedInterest,
      transaction.data0InterestCalculatingMethodDescription,
      transaction.data0InterestCreditingMethodDescription,
      transaction.data0InterestPaymentDescription,
      transaction.data0NominalInterest,
      transaction.data0DepositSerialId,
      transaction.data0LinkageBaseDescription,
      transaction.data0RenewalCounter,
      transaction.data0ProductFreeText,
      transaction.data0PartyTextId,
      transaction.data0ActualIndexRate,
      transaction.data0InterestTypeCode,
      transaction.data0ProductNumber,
      transaction.data0ProductPurposeCode,
      transaction.data0DetailedAccountTypeCode,
      transaction.data0FormattedEndExitDate,
      transaction.data0FormattedPaymentDate,
      transaction.data0FormattedObjectiveDate,
      transaction.data0FormattedAgreementOpeningDate,
      transaction.data0FormattedStartExitDate,
      transaction.data0LienDescription,
      transaction.data0WithdrawalEnablingIndication,
      transaction.data0RenewalEnablingIndication,
      transaction.data0StandingOrderEnablingIndication,
      transaction.data0AdditionEnablingIndication,
      transaction.data0TimeUnitDescription,
      transaction.data0FormattedRevaluedTotalAmount,
      transaction.data0WarningExistanceIndication,
      transaction.data0RenewalDateExplanation,
      transaction.source,
      transaction.validityDate,
      transaction.validityTime,
      transaction.israeliCurrencyDepositPrincipalBalanceAmount,
      transaction.depositsRevaluedAmount,
      transaction.formattedValidityTime,
      transaction.formattedDate,
      transaction.amount,
      transaction.revaluatedAmount,
      transaction.accountNumber,
      transaction.branchNumber,
      transaction.bankNumber,
    ];
  }
  return values;
}
