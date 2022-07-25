import pg from 'pg';
import lodash from 'lodash';
const { camelCase } = lodash;
import moment from 'moment';
import { ILSCheckingTransactionsDataSchema } from 'modern-poalim-scraper/dist/generatedTypes/ILSCheckingTransactionsDataSchema';
import { ForeignTransactionsBusinessSchema } from 'modern-poalim-scraper/dist/generatedTypes/foreignTransactionsBusinessSchema';
import { CardTransaction, DecoratedDeposit } from '../scrape';

export type AccountTypes = 'ils' | 'usd' | 'eur' | 'gbp' | 'deposits' | 'isracard';
type ILSTransaction = ILSCheckingTransactionsDataSchema['transactions'][0] & {
  beneficiaryDetailsDataPartyName?:
    | NonNullable<ILSCheckingTransactionsDataSchema['transactions'][0]['beneficiaryDetailsData']>['partyName']
    | null;
  beneficiaryDetailsDataMessageHeadline?:
    | NonNullable<ILSCheckingTransactionsDataSchema['transactions'][0]['beneficiaryDetailsData']>['messageHeadline']
    | null;
  beneficiaryDetailsDataPartyHeadline?:
    | NonNullable<ILSCheckingTransactionsDataSchema['transactions'][0]['beneficiaryDetailsData']>['partyHeadline']
    | null;
  beneficiaryDetailsDataMessageDetail?:
    | NonNullable<ILSCheckingTransactionsDataSchema['transactions'][0]['beneficiaryDetailsData']>['messageDetail']
    | null;
  beneficiaryDetailsDataTableNumber?:
    | NonNullable<ILSCheckingTransactionsDataSchema['transactions'][0]['beneficiaryDetailsData']>['tableNumber']
    | null;
  beneficiaryDetailsDataRecordNumber?:
    | NonNullable<ILSCheckingTransactionsDataSchema['transactions'][0]['beneficiaryDetailsData']>['recordNumber']
    | null;
};
type ForeignTransaction = ForeignTransactionsBusinessSchema['balancesAndLimitsDataList'][0]['transactions'][0] & {
  metadataAttributesOriginalEventKey?:
    | NonNullable<
        ForeignTransactionsBusinessSchema['balancesAndLimitsDataList'][0]['transactions'][0]['metadata']
      >['attributes']['originalEventKey']
    | null;
  metadataAttributesContraBranchNumber?:
    | NonNullable<
        ForeignTransactionsBusinessSchema['balancesAndLimitsDataList'][0]['transactions'][0]['metadata']
      >['attributes']['contraBranchNumber']
    | null;
  metadataAttributesContraAccountNumber?:
    | NonNullable<
        ForeignTransactionsBusinessSchema['balancesAndLimitsDataList'][0]['transactions'][0]['metadata']
      >['attributes']['contraAccountNumber']
    | null;
  metadataAttributesContraBankNumber?:
    | NonNullable<
        ForeignTransactionsBusinessSchema['balancesAndLimitsDataList'][0]['transactions'][0]['metadata']
      >['attributes']['contraBankNumber']
    | null;
  metadataAttributesContraAccountFieldNameLable?:
    | NonNullable<
        ForeignTransactionsBusinessSchema['balancesAndLimitsDataList'][0]['transactions'][0]['metadata']
      >['attributes']['contraAccountFieldNameLable']
    | null;
  metadataAttributesDataGroupCode?:
    | NonNullable<
        ForeignTransactionsBusinessSchema['balancesAndLimitsDataList'][0]['transactions'][0]['metadata']
      >['attributes']['dataGroupCode']
    | null;
  metadataAttributesCurrencyRate?:
    | NonNullable<
        ForeignTransactionsBusinessSchema['balancesAndLimitsDataList'][0]['transactions'][0]['metadata']
      >['attributes']['currencyRate']
    | null;
  metadataAttributesContraCurrencyCode?:
    | NonNullable<
        ForeignTransactionsBusinessSchema['balancesAndLimitsDataList'][0]['transactions'][0]['metadata']
      >['attributes']['contraCurrencyCode']
    | null;
  metadataAttributesRateFixingCode?:
    | NonNullable<
        ForeignTransactionsBusinessSchema['balancesAndLimitsDataList'][0]['transactions'][0]['metadata']
      >['attributes']['rateFixingCode']
    | null;
};
type Transactions = ILSTransaction[] | ForeignTransaction[] | DecoratedDeposit[] | CardTransaction[];
type AccountObject = {
  accountNumber: number;
  branchNumber: number;
  bankNumber: number;
};

export async function saveTransactionsToDB<T extends Transactions>(
  transactions1: T,
  accountType: AccountTypes,
  accountObject: AccountObject | null,
  pool: pg.Pool
) {
  const transactions = transactions1.map(transaction => ({
    ...transaction,
    ...(accountObject ?? {}),
  }));

  for (const transaction of transactions) {
    let oldContraAccountFieldNameLableAPI = false;
    // console.log(transaction.card);
    if ('card' in transaction && transaction.card == '17 *') {
      transaction.card = '9217';
    }
    if ('activityDescriptionIncludeValueDate' in transaction && accountType == 'ils') {
      normalizeBeneficiaryDetailsData(transaction);
      if (transaction.activityDescriptionIncludeValueDate == undefined) {
        transaction.activityDescriptionIncludeValueDate = null;
      }
    } else if (accountType == 'usd' || accountType == 'eur' || accountType == 'gbp') {
      normalizeForeignTransactionMetadata(transaction as ForeignTransaction);
      if ('contraAccountFieldNameLable' in transaction && transaction.contraAccountFieldNameLable == '0') {
        console.log('old API!');
        transaction.contraAccountFieldNameLable = null;
        oldContraAccountFieldNameLableAPI = true;
      }
      // else {
      //   console.log('napi ', transaction.contraAccountFieldNameLable);
      // }
    }

    let tableName = `poalim_${accountType}_account_transactions`;
    if (accountType == 'isracard') {
      tableName = 'isracard_creditcard_transactions';
    }
    const columnNamesResult = await pool.query(`
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
      ];
    } else if (accountType == 'usd' || accountType == 'eur' || accountType == 'gbp') {
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
    } else if (accountType == 'isracard') {
      optionalTransactionKeys = ['clientIpAddress'];
    }
    optionalTransactionKeys = optionalTransactionKeys.concat(['id']);
    findMissingTransactionKeys(transaction, columnNamesResult, optionalTransactionKeys, accountType);

    const additionalColumnsToExcludeFromTransactionComparison = [];
    additionalColumnsToExcludeFromTransactionComparison.push('cardIndex'); // If you get a new creditcard, all indexes will change and you could get duplicates
    if (oldContraAccountFieldNameLableAPI) {
      additionalColumnsToExcludeFromTransactionComparison.push('contraAccountFieldNameLable');
    }
    if (accountType == 'deposits') {
      additionalColumnsToExcludeFromTransactionComparison.push(
        'validityDate',
        'formattedDate',
        'validityTime',
        'formattedValidityTime'
      );
    }
    const whereClause = createWhereClause(
      transaction,
      columnNamesResult,
      `accounter_schema.` + tableName,
      additionalColumnsToExcludeFromTransactionComparison
    );

    try {
      const res = await pool.query(whereClause);

      // console.log('pg result - ', res.rowCount);
      if (res.rowCount > 0) {
        // console.log('found');
      } else {
        console.log('not found');

        let columnNames = columnNamesResult.rows.map((column: { column_name: string }) => column.column_name);
        columnNames = columnNames.filter((columnName: string) => columnName != 'id');
        let text = `INSERT INTO accounter_schema.${tableName}
        (
          ${columnNames.map(x => x).join(', ')},
        )`;
        const lastIndexOfComma = text.lastIndexOf(',');
        text = text.substring(0, lastIndexOfComma).concat(text.substring(lastIndexOfComma + 1, text.length));

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
          if ('transactionType' in transaction && transaction.transactionType == 'TODAY') {
            console.log('Today transaction - ', transaction);
          } else if (
            accountType == 'ils' &&
            'eventDate' in transaction &&
            moment(transaction.eventDate, 'YYYY-MM-DD').diff(moment(), 'months') > 2
          ) {
            console.error('Was going to insert an old transaction!!', JSON.stringify(transaction));
          } else if (
            (accountType == 'usd' || accountType == 'eur' || accountType == 'gbp') &&
            'executingDate' in transaction &&
            moment(transaction.executingDate, 'YYYY-MM-DD').diff(moment(), 'months') > 2
          ) {
            console.error('Was going to insert an old transaction!!', JSON.stringify(transaction));
          } else if (
            accountType == 'isracard' &&
            'fullPurchaseDateOutbound' in transaction &&
            ((transaction.fullPurchaseDate != null &&
              moment(transaction.fullPurchaseDate, 'DD/MM/YYYY').diff(moment(), 'months') > 2) ||
              (transaction.fullPurchaseDateOutbound != null &&
                moment(transaction.fullPurchaseDateOutbound, 'DD/MM/YYYY').diff(moment(), 'months') > 3))
          ) {
            console.error('Was going to insert an old transaction!!', JSON.stringify(transaction));
          } else {
            const res = await pool.query(text, values);
            if (res.rows[0].event_amount) {
              console.log(
                `success in insert to ${accountType} - ${transaction.accountNumber} - ${res.rows[0].activity_description} - ${res.rows[0].event_amount} - ${res.rows[0].event_date}`
              );
              // } else if (res.rows[0].original_amount) {
              //   console.log(
              //     `success in insert to ${accountType}-${transaction.cardNumber} - `,
              //     res.rows[0].original_amount
              //   );
            } else if (res.rows[0].card) {
              console.log(
                `success in insert to ${res.rows[0].card} - ${res.rows[0].payment_sum} - ${res.rows[0].payment_sum_outbound} - ${res.rows[0].supplier_name} - ${res.rows[0].supplier_name_outbound} - ${res.rows[0].full_purchase_date_outbound}`,
                res.rows[0].full_purchase_date
              );
            } else if (res.rows[0].source) {
              console.log(
                `success in insert to ${res.rows[0].source} - ${res.rows[0].amount} - ${res.rows[0].validityDate}`,
                res.rows[0].data_0_product_free_text
              );
            } else {
              // console.log('saved', JSON.stringify(res));
            }
          }
          // console.log('nothing');
        } catch (error) {
          // TODO: Log important checks
          console.log(`error in insert - ${error} - ${text} - ${values} - ${JSON.stringify(transaction)}`);
          // console.log('nothing');
        }
      }
    } catch (error) {
      // TODO: Log important checks
      console.log('pg error - ', error);
    }
  }
}

function normalizeBeneficiaryDetailsData(transaction: ILSTransaction) {
  if (typeof transaction.beneficiaryDetailsData !== 'undefined' && transaction.beneficiaryDetailsData != null) {
    transaction.beneficiaryDetailsDataPartyName = transaction.beneficiaryDetailsData.partyName;
    transaction.beneficiaryDetailsDataMessageHeadline = transaction.beneficiaryDetailsData.messageHeadline;
    transaction.beneficiaryDetailsDataPartyHeadline = transaction.beneficiaryDetailsData.partyHeadline;
    transaction.beneficiaryDetailsDataMessageDetail = transaction.beneficiaryDetailsData.messageDetail;
    transaction.beneficiaryDetailsDataTableNumber = transaction.beneficiaryDetailsData.tableNumber;
    transaction.beneficiaryDetailsDataRecordNumber = transaction.beneficiaryDetailsData.recordNumber;

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

function findMissingTransactionKeys(
  transaction: Transactions[0],
  columnNames: { rows: { column_name: string }[] },
  knownOptionals: string[],
  accountType: string
) {
  const allKeys = Object.keys(transaction);
  const fixedExistingKeys: string[] = columnNames.rows.map((column: { column_name: string }) =>
    camelCase(column.column_name)
  );

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

function createWhereClause<T>(
  transaction: T,
  checkingColumnNames: any,
  tableName: string,
  extraColumnsToExcludeFromComparison: string[]
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
    columnNamesToExcludeFromComparison = columnNamesToExcludeFromComparison.concat(extraColumnsToExcludeFromComparison);
  }
  for (const dBcolumn of checkingColumnNames.rows) {
    const camelCaseColumnName = camelCase(dBcolumn.column_name) as keyof T;
    if (!columnNamesToExcludeFromComparison.includes(camelCaseColumnName as string)) {
      let actualCondition = '';
      const isNotNull =
        typeof transaction[camelCaseColumnName] !== 'undefined' && transaction[camelCaseColumnName] != null;

      if (dBcolumn.column_name == 'more_info') {
        actualCondition = `${dBcolumn.column_name} IS NULL`;
        if (isNotNull) {
          actualCondition = `
            ${dBcolumn.column_name} = $$${transaction[camelCaseColumnName]}$$ OR 
            ${dBcolumn.column_name} = $$${String(transaction[camelCaseColumnName]).replace('הנחה', 'צבירת')}$$ OR 
            ${dBcolumn.column_name} = $$${String(transaction[camelCaseColumnName]).replace('צבירת', 'הנחה')}$$
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
          const value = transaction[camelCaseColumnName];
          actualCondition = `->> '` + firstKey + `' = '` + String(value[firstKey as keyof typeof value]) + `'`;
          if (Object.keys(transaction[camelCaseColumnName]).length > 1) {
            // TODO: Log important checks
            console.log('more keys in json!', Object.keys(transaction[camelCaseColumnName]));
          }
        } else if (isNotNull || dBcolumn.data_type != 'json') {
          // TODO: Log important checks
          console.log('unknown type ' + dBcolumn.data_type + ' ' + (camelCaseColumnName as string));
        }

        whereClause = whereClause.concat(
          ` ${isNotNull ? actualCondition : 'IS NULL'} AND
           `
        );
      }
    }
  }
  const lastIndexOfAND = whereClause.lastIndexOf('AND');
  whereClause = whereClause.substring(0, lastIndexOfAND);

  return whereClause;
}

function normalizeForeignTransactionMetadata(transaction: ForeignTransaction) {
  if (typeof transaction.metadata !== 'undefined' && transaction.metadata != null) {
    if (typeof transaction.metadata.attributes !== 'undefined' && transaction.metadata.attributes != null) {
      transaction.metadataAttributesOriginalEventKey = transaction.metadata.attributes.originalEventKey;
      transaction.metadataAttributesContraBranchNumber = transaction.metadata.attributes.contraBranchNumber;
      transaction.metadataAttributesContraAccountNumber = transaction.metadata.attributes.contraAccountNumber;
      transaction.metadataAttributesContraBankNumber = transaction.metadata.attributes.contraBankNumber;
      transaction.metadataAttributesContraAccountFieldNameLable =
        transaction.metadata.attributes.contraAccountFieldNameLable;
      transaction.metadataAttributesDataGroupCode = transaction.metadata.attributes.dataGroupCode;
      transaction.metadataAttributesCurrencyRate = transaction.metadata.attributes.currencyRate;
      transaction.metadataAttributesContraCurrencyCode = transaction.metadata.attributes.contraCurrencyCode;
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

function transactionValuesToArray(transaction: Transactions[0], accountType: AccountTypes) {
  let values: (number | string | null | Record<string, any>)[] = [];
  if (accountType == 'ils') {
    values = [
      (transaction as ILSTransaction & AccountObject).eventDate,
      (transaction as ILSTransaction & AccountObject).formattedEventDate,
      (transaction as ILSTransaction & AccountObject).serialNumber,
      (transaction as ILSTransaction & AccountObject).activityTypeCode,
      (transaction as ILSTransaction & AccountObject).activityDescription,
      (transaction as ILSTransaction & AccountObject).textCode,
      (transaction as ILSTransaction & AccountObject).referenceNumber,
      (transaction as ILSTransaction & AccountObject).referenceCatenatedNumber,
      (transaction as ILSTransaction & AccountObject).valueDate,
      (transaction as ILSTransaction & AccountObject).formattedValueDate,
      (transaction as ILSTransaction & AccountObject).eventAmount,
      (transaction as ILSTransaction & AccountObject).eventActivityTypeCode,
      (transaction as ILSTransaction & AccountObject).currentBalance,
      (transaction as ILSTransaction & AccountObject).internalLinkCode,
      (transaction as ILSTransaction & AccountObject).originalEventCreateDate,
      (transaction as ILSTransaction & AccountObject).formattedOriginalEventCreateDate,
      (transaction as ILSTransaction & AccountObject).transactionType,
      (transaction as ILSTransaction & AccountObject).dataGroupCode,
      (transaction as ILSTransaction & AccountObject).beneficiaryDetailsData,
      (transaction as ILSTransaction & AccountObject).expandedEventDate,
      (transaction as ILSTransaction & AccountObject).executingBranchNumber,
      (transaction as ILSTransaction & AccountObject).eventId,
      (transaction as ILSTransaction & AccountObject).details,
      (transaction as ILSTransaction & AccountObject).pfmDetails,
      (transaction as ILSTransaction & AccountObject).differentDateIndication,
      (transaction as ILSTransaction & AccountObject).rejectedDataEventPertainingIndication,
      (transaction as ILSTransaction & AccountObject).tableNumber,
      (transaction as ILSTransaction & AccountObject).recordNumber,
      (transaction as ILSTransaction & AccountObject).contraBankNumber,
      (transaction as ILSTransaction & AccountObject).contraBranchNumber,
      (transaction as ILSTransaction & AccountObject).contraAccountNumber,
      (transaction as ILSTransaction & AccountObject).contraAccountTypeCode,
      (transaction as ILSTransaction & AccountObject).marketingOfferContext,
      (transaction as ILSTransaction & AccountObject).commentExistenceSwitch,
      (transaction as ILSTransaction & AccountObject).englishActionDesc,
      (transaction as ILSTransaction & AccountObject).fieldDescDisplaySwitch,
      // (transaction as ILSTransaction & AccountObject).urlAddressNiar,
      null,
      (transaction as ILSTransaction & AccountObject).offerActivityContext,
      (transaction as ILSTransaction & AccountObject).comment,
      (transaction as ILSTransaction & AccountObject).beneficiaryDetailsDataPartyName ?? null,
      (transaction as ILSTransaction & AccountObject).beneficiaryDetailsDataMessageHeadline ?? null,
      (transaction as ILSTransaction & AccountObject).beneficiaryDetailsDataPartyHeadline ?? null,
      (transaction as ILSTransaction & AccountObject).beneficiaryDetailsDataMessageDetail ?? null,
      (transaction as ILSTransaction & AccountObject).beneficiaryDetailsDataTableNumber ?? null,
      (transaction as ILSTransaction & AccountObject).beneficiaryDetailsDataRecordNumber ?? null,
      (transaction as ILSTransaction & AccountObject).activityDescriptionIncludeValueDate,
      (transaction as ILSTransaction & AccountObject).bankNumber,
      (transaction as ILSTransaction & AccountObject).branchNumber,
      (transaction as ILSTransaction & AccountObject).accountNumber,
    ];
  } else if (accountType == 'usd' || accountType == 'eur' || accountType == 'gbp') {
    values = [
      (transaction as ForeignTransaction & AccountObject).metadataAttributesOriginalEventKey ?? null,
      (transaction as ForeignTransaction & AccountObject).metadataAttributesContraBranchNumber ?? null,
      (transaction as ForeignTransaction & AccountObject).metadataAttributesContraAccountNumber ?? null,
      (transaction as ForeignTransaction & AccountObject).metadataAttributesContraBankNumber ?? null,
      (transaction as ForeignTransaction & AccountObject).metadataAttributesContraAccountFieldNameLable ?? null,
      (transaction as ForeignTransaction & AccountObject).metadataAttributesDataGroupCode ?? null,
      (transaction as ForeignTransaction & AccountObject).metadataAttributesCurrencyRate ?? null,
      (transaction as ForeignTransaction & AccountObject).metadataAttributesContraCurrencyCode ?? null,
      (transaction as ForeignTransaction & AccountObject).metadataAttributesRateFixingCode ?? null,
      (transaction as ForeignTransaction & AccountObject).executingDate,
      (transaction as ForeignTransaction & AccountObject).formattedExecutingDate,
      (transaction as ForeignTransaction & AccountObject).valueDate,
      (transaction as ForeignTransaction & AccountObject).formattedValueDate,
      (transaction as ForeignTransaction & AccountObject).originalSystemId,
      (transaction as ForeignTransaction & AccountObject).activityDescription,
      (transaction as ForeignTransaction & AccountObject).eventAmount,
      (transaction as ForeignTransaction & AccountObject).currentBalance,
      (transaction as ForeignTransaction & AccountObject).referenceCatenatedNumber,
      (transaction as ForeignTransaction & AccountObject).referenceNumber,
      (transaction as ForeignTransaction & AccountObject).currencyRate,
      (transaction as ForeignTransaction & AccountObject).eventDetails,
      (transaction as ForeignTransaction & AccountObject).rateFixingCode,
      (transaction as ForeignTransaction & AccountObject).contraCurrencyCode,
      (transaction as ForeignTransaction & AccountObject).eventActivityTypeCode,
      (transaction as ForeignTransaction & AccountObject).transactionType,
      (transaction as ForeignTransaction & AccountObject).rateFixingShortDescription,
      (transaction as ForeignTransaction & AccountObject).currencyLongDescription,
      (transaction as ForeignTransaction & AccountObject).activityTypeCode,
      (transaction as ForeignTransaction & AccountObject).eventNumber,
      (transaction as ForeignTransaction & AccountObject).validityDate,
      (transaction as ForeignTransaction & AccountObject).comments,
      (transaction as ForeignTransaction & AccountObject).commentExistenceSwitch,
      (transaction as ForeignTransaction & AccountObject).accountName,
      (transaction as ForeignTransaction & AccountObject).contraBankNumber,
      (transaction as ForeignTransaction & AccountObject).contraBranchNumber,
      (transaction as ForeignTransaction & AccountObject).contraAccountNumber,
      (transaction as ForeignTransaction & AccountObject).originalEventKey,
      (transaction as ForeignTransaction & AccountObject).contraAccountFieldNameLable,
      (transaction as ForeignTransaction & AccountObject).dataGroupCode,
      (transaction as ForeignTransaction & AccountObject).rateFixingDescription,
      // (transaction as ForeignTransaction & AccountObject).urlAddressNiar,
      null,
      (transaction as ForeignTransaction & AccountObject).currencySwiftCode,
      (transaction as ForeignTransaction & AccountObject).urlAddress,
      (transaction as ForeignTransaction & AccountObject).bankNumber,
      (transaction as ForeignTransaction & AccountObject).branchNumber,
      (transaction as ForeignTransaction & AccountObject).accountNumber,
    ];
  } else if (accountType == 'isracard') {
    values = [
      (transaction as CardTransaction & AccountObject).specificDate,
      (transaction as CardTransaction & AccountObject).cardIndex,
      (transaction as CardTransaction & AccountObject).dealsInbound,
      (transaction as CardTransaction & AccountObject).supplierId,
      (transaction as CardTransaction & AccountObject).supplierName,
      (transaction as CardTransaction & AccountObject).dealSumType,
      (transaction as CardTransaction & AccountObject).paymentSumSign,
      (transaction as CardTransaction & AccountObject).purchaseDate,
      (transaction as CardTransaction & AccountObject).fullPurchaseDate,
      (transaction as CardTransaction & AccountObject).moreInfo,
      (transaction as CardTransaction & AccountObject).horaatKeva,
      (transaction as CardTransaction & AccountObject).voucherNumber,
      (transaction as CardTransaction & AccountObject).voucherNumberRatz,
      (transaction as CardTransaction & AccountObject).solek,
      (transaction as CardTransaction & AccountObject).purchaseDateOutbound,
      (transaction as CardTransaction & AccountObject).fullPurchaseDateOutbound,
      (transaction as CardTransaction & AccountObject).currencyId,
      (transaction as CardTransaction & AccountObject).currentPaymentCurrency,
      (transaction as CardTransaction & AccountObject).city,
      (transaction as CardTransaction & AccountObject).supplierNameOutbound,
      (transaction as CardTransaction & AccountObject).fullSupplierNameOutbound,
      (transaction as CardTransaction & AccountObject).paymentDate,
      (transaction as CardTransaction & AccountObject).fullPaymentDate,
      (transaction as CardTransaction & AccountObject).isShowDealsOutbound,
      (transaction as CardTransaction & AccountObject).adendum,
      (transaction as CardTransaction & AccountObject).voucherNumberRatzOutbound,
      (transaction as CardTransaction & AccountObject).isShowLinkForSupplierDetails,
      (transaction as CardTransaction & AccountObject).dealSum,
      (transaction as CardTransaction & AccountObject).paymentSum,
      (transaction as CardTransaction & AccountObject).fullSupplierNameHeb,
      (transaction as CardTransaction & AccountObject).dealSumOutbound,
      (transaction as CardTransaction & AccountObject).paymentSumOutbound,
      (transaction as CardTransaction & AccountObject).isHoraatKeva,
      (transaction as CardTransaction & AccountObject).stage,
      (transaction as CardTransaction & AccountObject).returnCode,
      (transaction as CardTransaction & AccountObject).message,
      (transaction as CardTransaction & AccountObject).returnMessage,
      (transaction as CardTransaction & AccountObject).displayProperties,
      (transaction as CardTransaction & AccountObject).tablePageNum,
      (transaction as CardTransaction & AccountObject).isError,
      (transaction as CardTransaction & AccountObject).isCaptcha,
      (transaction as CardTransaction & AccountObject).isButton,
      (transaction as CardTransaction & AccountObject).siteName,
      (transaction as CardTransaction & AccountObject).clientIpAddress ?? null,
      (transaction as CardTransaction & AccountObject).card,
    ];
  } else if (accountType == 'deposits') {
    values = [
      (transaction as DecoratedDeposit & AccountObject).data0ShortProductName,
      (transaction as DecoratedDeposit & AccountObject).data0PrincipalAmount,
      (transaction as DecoratedDeposit & AccountObject).data0RevaluedTotalAmount,
      (transaction as DecoratedDeposit & AccountObject).data0EndExitDate,
      (transaction as DecoratedDeposit & AccountObject).data0PaymentDate,
      (transaction as DecoratedDeposit & AccountObject).data0StatedAnnualInterestRate,
      (transaction as DecoratedDeposit & AccountObject).data0HebrewPurposeDescription,
      (transaction as DecoratedDeposit & AccountObject).data0ObjectiveAmount,
      (transaction as DecoratedDeposit & AccountObject).data0ObjectiveDate,
      (transaction as DecoratedDeposit & AccountObject).data0AgreementOpeningDate,
      (transaction as DecoratedDeposit & AccountObject).data0EventWithdrawalAmount,
      (transaction as DecoratedDeposit & AccountObject).data0StartExitDate,
      (transaction as DecoratedDeposit & AccountObject).data0PeriodUntilNextEvent,
      (transaction as DecoratedDeposit & AccountObject).data0RenewalDescription,
      (transaction as DecoratedDeposit & AccountObject).data0RequestedRenewalNumber,
      (transaction as DecoratedDeposit & AccountObject).data0InterestBaseDescription,
      (transaction as DecoratedDeposit & AccountObject).data0InterestTypeDescription,
      (transaction as DecoratedDeposit & AccountObject).data0SpreadPercent,
      (transaction as DecoratedDeposit & AccountObject).data0VariableInterestDescription,
      (transaction as DecoratedDeposit & AccountObject).data0AdjustedInterest,
      (transaction as DecoratedDeposit & AccountObject).data0InterestCalculatingMethodDescription,
      (transaction as DecoratedDeposit & AccountObject).data0InterestCreditingMethodDescription,
      (transaction as DecoratedDeposit & AccountObject).data0InterestPaymentDescription,
      (transaction as DecoratedDeposit & AccountObject).data0NominalInterest,
      (transaction as DecoratedDeposit & AccountObject).data0DepositSerialId,
      (transaction as DecoratedDeposit & AccountObject).data0LinkageBaseDescription,
      (transaction as DecoratedDeposit & AccountObject).data0RenewalCounter,
      (transaction as DecoratedDeposit & AccountObject).data0ProductFreeText,
      (transaction as DecoratedDeposit & AccountObject).data0PartyTextId,
      (transaction as DecoratedDeposit & AccountObject).data0ActualIndexRate,
      (transaction as DecoratedDeposit & AccountObject).data0InterestTypeCode,
      (transaction as DecoratedDeposit & AccountObject).data0ProductNumber,
      (transaction as DecoratedDeposit & AccountObject).data0ProductPurposeCode,
      (transaction as DecoratedDeposit & AccountObject).data0DetailedAccountTypeCode,
      (transaction as DecoratedDeposit & AccountObject).data0FormattedEndExitDate,
      (transaction as DecoratedDeposit & AccountObject).data0FormattedPaymentDate,
      (transaction as DecoratedDeposit & AccountObject).data0FormattedObjectiveDate,
      (transaction as DecoratedDeposit & AccountObject).data0FormattedAgreementOpeningDate,
      (transaction as DecoratedDeposit & AccountObject).data0FormattedStartExitDate,
      (transaction as DecoratedDeposit & AccountObject).data0LienDescription,
      (transaction as DecoratedDeposit & AccountObject).data0WithdrawalEnablingIndication,
      (transaction as DecoratedDeposit & AccountObject).data0RenewalEnablingIndication,
      (transaction as DecoratedDeposit & AccountObject).data0StandingOrderEnablingIndication,
      (transaction as DecoratedDeposit & AccountObject).data0AdditionEnablingIndication,
      (transaction as DecoratedDeposit & AccountObject).data0TimeUnitDescription,
      (transaction as DecoratedDeposit & AccountObject).data0FormattedRevaluedTotalAmount,
      (transaction as DecoratedDeposit & AccountObject).data0WarningExistanceIndication,
      (transaction as DecoratedDeposit & AccountObject).data0RenewalDateExplanation,
      (transaction as DecoratedDeposit & AccountObject).source,
      (transaction as DecoratedDeposit & AccountObject).validityDate,
      (transaction as DecoratedDeposit & AccountObject).validityTime,
      (transaction as DecoratedDeposit & AccountObject).israeliCurrencyDepositPrincipalBalanceAmount,
      (transaction as DecoratedDeposit & AccountObject).depositsRevaluedAmount,
      (transaction as DecoratedDeposit & AccountObject).formattedValidityTime,
      (transaction as DecoratedDeposit & AccountObject).formattedDate,
      (transaction as DecoratedDeposit & AccountObject).amount,
      (transaction as DecoratedDeposit & AccountObject).revaluatedAmount,
      (transaction as DecoratedDeposit & AccountObject).accountNumber,
      (transaction as DecoratedDeposit & AccountObject).branchNumber,
      (transaction as DecoratedDeposit & AccountObject).bankNumber,
    ];
  }
  return values;
}
