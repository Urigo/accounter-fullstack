import { differenceInMonths } from 'date-fns';
import Listr, { ListrTaskWrapper, type ListrTask } from 'listr';
import { Logger } from 'logger.js';
import type { Pool } from 'pg';
import type { ForeignTransactionsBusinessSchema } from '@accounter/modern-poalim-scraper/dist/__generated__/foreignTransactionsBusinessSchema.js';
import type { ForeignTransactionsPersonalSchema } from '@accounter/modern-poalim-scraper/dist/__generated__/foreignTransactionsPersonalSchema.js';
import { sql, TaggedQuery } from '@pgtyped/runtime';
import { camelCase, convertNumberDateToString, reverse } from '../../helpers/misc.js';
import type {
  FilteredColumns,
  IGetPoalimForeignTransactionsQuery,
  IInsertPoalimEurTransactionsParams,
  IInsertPoalimEurTransactionsQuery,
  IInsertPoalimGbpTransactionsParams,
  IInsertPoalimGbpTransactionsQuery,
  IInsertPoalimUsdTransactionsParams,
  IInsertPoalimUsdTransactionsQuery,
  Json,
} from '../../helpers/types.js';
import type { ScrapedAccount } from './accounts.js';
import type { PoalimContext, PoalimScraper } from './index.js';
import { isSameTransaction } from './utils.js';

export type ForeignTransaction = (
  | ForeignTransactionsPersonalSchema
  | ForeignTransactionsBusinessSchema
)['balancesAndLimitsDataList'][number]['transactions'][number];
export type NormalizedForeignTransaction = ForeignTransaction & {
  metadataAttributesOriginalEventKey?: Json | null;
  metadataAttributesContraBranchNumber: Json | null;
  metadataAttributesContraAccountNumber: Json | null;
  metadataAttributesContraBankNumber: Json | null;
  metadataAttributesContraAccountFieldNameLable: Json | null;
  metadataAttributesDataGroupCode: Json | null;
  metadataAttributesCurrencyRate: Json | null;
  metadataAttributesContraCurrencyCode: Json | null;
  metadataAttributesRateFixingCode: Json | null;
  accountNumber: number;
  branchNumber: number;
  bankNumber: number;
};
type ForeignCurrency = 'usd' | 'eur' | 'gbp';
type Context = {
  transactionsByCurrencies?: Partial<{
    [key in ForeignCurrency]: NormalizedForeignTransaction[];
  }>;
};

type InsertionTransactionParams<T extends ForeignCurrency> = T extends 'usd'
  ? IInsertPoalimUsdTransactionsParams
  : T extends 'eur'
    ? IInsertPoalimEurTransactionsParams
    : T extends 'gbp'
      ? IInsertPoalimGbpTransactionsParams
      : never;

const getPoalimForeignTransactions = sql<IGetPoalimForeignTransactionsQuery>`
  SELECT *, 'usd' as currency
  FROM accounter_schema.poalim_usd_account_transactions
  UNION ALL
  SELECT *, 'eur' as currency
  FROM accounter_schema.poalim_eur_account_transactions
  UNION ALL
  SELECT *, 'gbp' as currency
  FROM accounter_schema.poalim_gbp_account_transactions
  WHERE account_number = $accountNumber
  AND branch_number = $branchNumber
  AND bank_number = $bankNumber
  AND executing_date = $executingDate
  AND value_date = $valueDate
  AND reference_number = $referenceNumber;`;

const insertPoalimEurTransactions = sql<IInsertPoalimEurTransactionsQuery>`
  insert into accounter_schema.poalim_eur_account_transactions (metadata_attributes_original_event_key,
                                                                metadata_attributes_contra_branch_number,
                                                                metadata_attributes_contra_account_number,
                                                                metadata_attributes_contra_bank_number,
                                                                metadata_attributes_contra_account_field_name_lable,
                                                                metadata_attributes_data_group_code,
                                                                metadata_attributes_currency_rate,
                                                                metadata_attributes_contra_currency_code,
                                                                metadata_attributes_rate_fixing_code,
                                                                executing_date,
                                                                formatted_executing_date,
                                                                value_date,
                                                                formatted_value_date,
                                                                original_system_id,
                                                                activity_description,
                                                                event_amount,
                                                                current_balance,
                                                                reference_catenated_number,
                                                                reference_number,
                                                                currency_rate,
                                                                event_details,
                                                                rate_fixing_code,
                                                                contra_currency_code,
                                                                event_activity_type_code,
                                                                transaction_type,
                                                                rate_fixing_short_description,
                                                                currency_long_description,
                                                                activity_type_code,
                                                                event_number,
                                                                validity_date,
                                                                comments,
                                                                comment_existence_switch,
                                                                account_name,
                                                                contra_bank_number,
                                                                contra_branch_number,
                                                                contra_account_number,
                                                                original_event_key,
                                                                contra_account_field_name_lable,
                                                                data_group_code,
                                                                rate_fixing_description,
                                                                url_address_niar,
                                                                currency_swift_code,
                                                                url_address,
                                                                bank_number,
                                                                branch_number,
                                                                account_number)
  values $$transactions(metadataAttributesOriginalEventKey,
                        metadataAttributesContraBranchNumber,
                        metadataAttributesContraAccountNumber,
                        metadataAttributesContraBankNumber,
                        metadataAttributesContraAccountFieldNameLable,
                        metadataAttributesDataGroupCode,
                        metadataAttributesCurrencyRate,
                        metadataAttributesContraCurrencyCode,
                        metadataAttributesRateFixingCode,
                        executingDate,
                        formattedExecutingDate,
                        valueDate,
                        formattedValueDate,
                        originalSystemId,
                        activityDescription,
                        eventAmount,
                        currentBalance,
                        referenceCatenatedNumber,
                        referenceNumber,
                        currencyRate,
                        eventDetails,
                        rateFixingCode,
                        contraCurrencyCode,
                        eventActivityTypeCode,
                        transactionType,
                        rateFixingShortDescription,
                        currencyLongDescription,
                        activityTypeCode,
                        eventNumber,
                        validityDate,
                        comments,
                        commentExistenceSwitch,
                        accountName,
                        contraBankNumber,
                        contraBranchNumber,
                        contraAccountNumber,
                        originalEventKey,
                        contraAccountFieldNameLable,
                        dataGroupCode,
                        rateFixingDescription,
                        urlAddressNiar,
                        currencySwiftCode,
                        urlAddress,
                        bankNumber,
                        branchNumber,
                        accountNumber

  )
  RETURNING id, account_number, activity_description, event_activity_type_code, event_amount, executing_date;`;

const insertPoalimGbpTransactions = sql<IInsertPoalimGbpTransactionsQuery>`
  insert into accounter_schema.poalim_gbp_account_transactions (metadata_attributes_original_event_key,
                                                                metadata_attributes_contra_branch_number,
                                                                metadata_attributes_contra_account_number,
                                                                metadata_attributes_contra_bank_number,
                                                                metadata_attributes_contra_account_field_name_lable,
                                                                metadata_attributes_data_group_code,
                                                                metadata_attributes_currency_rate,
                                                                metadata_attributes_contra_currency_code,
                                                                metadata_attributes_rate_fixing_code,
                                                                executing_date,
                                                                formatted_executing_date,
                                                                value_date,
                                                                formatted_value_date,
                                                                original_system_id,
                                                                activity_description,
                                                                event_amount,
                                                                current_balance,
                                                                reference_catenated_number,
                                                                reference_number,
                                                                currency_rate,
                                                                event_details,
                                                                rate_fixing_code,
                                                                contra_currency_code,
                                                                event_activity_type_code,
                                                                transaction_type,
                                                                rate_fixing_short_description,
                                                                currency_long_description,
                                                                activity_type_code,
                                                                event_number,
                                                                validity_date,
                                                                comments,
                                                                comment_existence_switch,
                                                                account_name,
                                                                contra_bank_number,
                                                                contra_branch_number,
                                                                contra_account_number,
                                                                original_event_key,
                                                                contra_account_field_name_lable,
                                                                data_group_code,
                                                                rate_fixing_description,
                                                                url_address_niar,
                                                                currency_swift_code,
                                                                url_address,
                                                                bank_number,
                                                                branch_number,
                                                                account_number)
  values $$transactions(metadataAttributesOriginalEventKey,
                        metadataAttributesContraBranchNumber,
                        metadataAttributesContraAccountNumber,
                        metadataAttributesContraBankNumber,
                        metadataAttributesContraAccountFieldNameLable,
                        metadataAttributesDataGroupCode,
                        metadataAttributesCurrencyRate,
                        metadataAttributesContraCurrencyCode,
                        metadataAttributesRateFixingCode,
                        executingDate,
                        formattedExecutingDate,
                        valueDate,
                        formattedValueDate,
                        originalSystemId,
                        activityDescription,
                        eventAmount,
                        currentBalance,
                        referenceCatenatedNumber,
                        referenceNumber,
                        currencyRate,
                        eventDetails,
                        rateFixingCode,
                        contraCurrencyCode,
                        eventActivityTypeCode,
                        transactionType,
                        rateFixingShortDescription,
                        currencyLongDescription,
                        activityTypeCode,
                        eventNumber,
                        validityDate,
                        comments,
                        commentExistenceSwitch,
                        accountName,
                        contraBankNumber,
                        contraBranchNumber,
                        contraAccountNumber,
                        originalEventKey,
                        contraAccountFieldNameLable,
                        dataGroupCode,
                        rateFixingDescription,
                        urlAddressNiar,
                        currencySwiftCode,
                        urlAddress,
                        bankNumber,
                        branchNumber,
                        accountNumber

  )
  RETURNING id, account_number, activity_description, event_activity_type_code, event_amount, executing_date`;

const insertPoalimUsdTransactions = sql<IInsertPoalimUsdTransactionsQuery>`
  insert into accounter_schema.poalim_usd_account_transactions (metadata_attributes_original_event_key,
                                                                metadata_attributes_contra_branch_number,
                                                                metadata_attributes_contra_account_number,
                                                                metadata_attributes_contra_bank_number,
                                                                metadata_attributes_contra_account_field_name_lable,
                                                                metadata_attributes_data_group_code,
                                                                metadata_attributes_currency_rate,
                                                                metadata_attributes_contra_currency_code,
                                                                metadata_attributes_rate_fixing_code,
                                                                executing_date,
                                                                formatted_executing_date,
                                                                value_date,
                                                                formatted_value_date,
                                                                original_system_id,
                                                                activity_description,
                                                                event_amount,
                                                                current_balance,
                                                                reference_catenated_number,
                                                                reference_number,
                                                                currency_rate,
                                                                event_details,
                                                                rate_fixing_code,
                                                                contra_currency_code,
                                                                event_activity_type_code,
                                                                transaction_type,
                                                                rate_fixing_short_description,
                                                                currency_long_description,
                                                                activity_type_code,
                                                                event_number,
                                                                validity_date,
                                                                comments,
                                                                comment_existence_switch,
                                                                account_name,
                                                                contra_bank_number,
                                                                contra_branch_number,
                                                                contra_account_number,
                                                                original_event_key,
                                                                contra_account_field_name_lable,
                                                                data_group_code,
                                                                rate_fixing_description,
                                                                url_address_niar,
                                                                currency_swift_code,
                                                                url_address,
                                                                bank_number,
                                                                branch_number,
                                                                account_number)
  values $$transactions(metadataAttributesOriginalEventKey,
                        metadataAttributesContraBranchNumber,
                        metadataAttributesContraAccountNumber,
                        metadataAttributesContraBankNumber,
                        metadataAttributesContraAccountFieldNameLable,
                        metadataAttributesDataGroupCode,
                        metadataAttributesCurrencyRate,
                        metadataAttributesContraCurrencyCode,
                        metadataAttributesRateFixingCode,
                        executingDate,
                        formattedExecutingDate,
                        valueDate,
                        formattedValueDate,
                        originalSystemId,
                        activityDescription,
                        eventAmount,
                        currentBalance,
                        referenceCatenatedNumber,
                        referenceNumber,
                        currencyRate,
                        eventDetails,
                        rateFixingCode,
                        contraCurrencyCode,
                        eventActivityTypeCode,
                        transactionType,
                        rateFixingShortDescription,
                        currencyLongDescription,
                        activityTypeCode,
                        eventNumber,
                        validityDate,
                        comments,
                        commentExistenceSwitch,
                        accountName,
                        contraBankNumber,
                        contraBranchNumber,
                        contraAccountNumber,
                        originalEventKey,
                        contraAccountFieldNameLable,
                        dataGroupCode,
                        rateFixingDescription,
                        urlAddressNiar,
                        currencySwiftCode,
                        urlAddress,
                        bankNumber,
                        branchNumber,
                        accountNumber

  )
  RETURNING id, account_number, activity_description, event_activity_type_code, event_amount, executing_date;`;

function normalizeForeignTransactionMetadata(
  transaction: ForeignTransaction,
  accountObject: {
    accountNumber: number;
    branchNumber: number;
    bankNumber: number;
  },
): NormalizedForeignTransaction {
  const normalizedTransaction = {
    ...transaction,
    ...accountObject,
  } as NormalizedForeignTransaction;
  if (transaction.metadata == null) {
    normalizedTransaction.metadataAttributesOriginalEventKey = null;
    normalizedTransaction.metadataAttributesContraBranchNumber = null;
    normalizedTransaction.metadataAttributesContraAccountNumber = null;
    normalizedTransaction.metadataAttributesContraBankNumber = null;
    normalizedTransaction.metadataAttributesContraAccountFieldNameLable = null;
    normalizedTransaction.metadataAttributesDataGroupCode = null;
    normalizedTransaction.metadataAttributesCurrencyRate = null;
    normalizedTransaction.metadataAttributesContraCurrencyCode = null;
    normalizedTransaction.metadataAttributesRateFixingCode = null;
  } else if (transaction.metadata.attributes != null) {
    normalizedTransaction.metadataAttributesOriginalEventKey = transaction.metadata.attributes
      .originalEventKey as Json;
    normalizedTransaction.metadataAttributesContraBranchNumber = transaction.metadata.attributes
      .contraBranchNumber as Json;
    normalizedTransaction.metadataAttributesContraAccountNumber = transaction.metadata.attributes
      .contraAccountNumber as Json;
    normalizedTransaction.metadataAttributesContraBankNumber = transaction.metadata.attributes
      .contraBankNumber as Json;
    normalizedTransaction.metadataAttributesContraAccountFieldNameLable = transaction.metadata
      .attributes.contraAccountFieldNameLable as Json;
    normalizedTransaction.metadataAttributesDataGroupCode = transaction.metadata.attributes
      .dataGroupCode as Json;
    normalizedTransaction.metadataAttributesCurrencyRate = transaction.metadata.attributes
      .currencyRate as Json;
    normalizedTransaction.metadataAttributesContraCurrencyCode = transaction.metadata.attributes
      .contraCurrencyCode as Json;
    normalizedTransaction.metadataAttributesRateFixingCode = transaction.metadata.attributes
      .rateFixingCode as Json;
  }
  return normalizedTransaction;
}

async function normalizeForeignTransactionsForAccount(
  ctx: Context,
  task: ListrTaskWrapper<unknown>,
  scraper: PoalimScraper,
  bankAccount: ScrapedAccount,
  knownAccountsNumbers: number[],
  logger: Logger,
) {
  task.output = `Getting transactions`;
  const transactions = await scraper.getForeignTransactions(bankAccount);

  if (!transactions.data) {
    task.skip('No data');
    ctx.transactionsByCurrencies = {};
    return;
  }

  if (!transactions.isValid) {
    if ('errors' in transactions) {
      logger.error(transactions.errors);
      if (transactions.errors === 'Data seems unreachable. Is the account active?') {
        return;
      }
    }
    throw new Error(
      `Invalid transactions data for ${bankAccount.branchNumber}:${bankAccount.accountNumber}`,
    );
  }

  await Promise.all(
    transactions.data.balancesAndLimitsDataList.map(async foreignAccountsArray => {
      let accountCurrency: ForeignCurrency | undefined;
      switch (foreignAccountsArray.currencyCode) {
        case 19:
          accountCurrency = 'usd';
          break;
        case 100:
          accountCurrency = 'eur';
          break;
        case 27:
          accountCurrency = 'gbp';
          break;
        default:
          throw new Error(`New Poalim account currency - ${foreignAccountsArray.currencyCode}`);
      }
      if (accountCurrency && foreignAccountsArray.transactions.length) {
        const bankNumber =
          'bankNumber' in foreignAccountsArray
            ? foreignAccountsArray.bankNumber
            : bankAccount.bankNumber;
        const branchNumber =
          'branchNumber' in foreignAccountsArray
            ? foreignAccountsArray.branchNumber
            : bankAccount.branchNumber;
        const accountNumber =
          'accountNumber' in foreignAccountsArray
            ? foreignAccountsArray.accountNumber
            : bankAccount.accountNumber;

        if (!knownAccountsNumbers.includes(accountNumber)) {
          throw new Error(`UNKNOWN ACCOUNT ${branchNumber}:${accountNumber}`);
        }

        ctx.transactionsByCurrencies ??= {};
        ctx.transactionsByCurrencies[accountCurrency] = foreignAccountsArray.transactions.map(
          transaction =>
            normalizeForeignTransactionMetadata(transaction, {
              accountNumber,
              branchNumber,
              bankNumber,
            }),
        );
      }
    }),
  );
}

function newAttributesChecker(
  transaction: NormalizedForeignTransaction,
  columnNames: string[],
  logger: Logger,
) {
  const knownOptionals = [
    'metadata',
    'urlAddressNiar',
    'displayCreditAccountDetails',
    'displayRTGSIncomingTrsDetails',
    'recordSerialNumber',
    'expendedExecutingDate',
    'id',
  ];
  const allKeys = Object.keys(transaction);

  const InTransactionNotInDB = allKeys.filter(
    x => !columnNames.includes(x) && !knownOptionals.includes(x),
  );
  const inDBNotInTransaction = columnNames.filter(
    x => !allKeys.includes(x) && !knownOptionals.includes(x),
  );
  if (InTransactionNotInDB.length) {
    logger.log('New Poalim Foreign keys, in DB missing from transaction', inDBNotInTransaction);
  }
  if (InTransactionNotInDB.length) {
    logger.log(`New Poalim Foreign keys, in transaction missing from DB`, InTransactionNotInDB);
  }
}

async function isTransactionNew(
  transaction: NormalizedForeignTransaction,
  currency: ForeignCurrency,
  pool: Pool,
  columns: FilteredColumns,
  logger: Logger,
): Promise<boolean> {
  let oldContraAccountFieldNameLableAPI = false;
  if (
    'contraAccountFieldNameLable' in transaction &&
    Number(transaction.contraAccountFieldNameLable) === 0
  ) {
    logger.log('old API!');
    transaction.contraAccountFieldNameLable = null;
    oldContraAccountFieldNameLableAPI = true;
  }

  const columnNames = columns.map(column => camelCase(column.column_name));
  newAttributesChecker(transaction, columnNames, logger);

  // fill in default values for missing keys, to prevent missing preexisting DB records and creation of duplicates
  const allKeys = Object.keys(transaction);
  const existingFields = columns.map(column => ({
    name: camelCase(column.column_name ?? '') as keyof NormalizedForeignTransaction | 'id',
    nullable: column.is_nullable === 'YES',
    type: column.data_type,
    defaultValue: column.column_default,
  }));

  const inDBNotInTransaction = existingFields.filter(x => !allKeys.includes(x.name) && !x.nullable);

  for (const key of inDBNotInTransaction) {
    if (key.name === 'id') {
      continue;
    }
    if (key.defaultValue) {
      logger.log(`Poalim ILS: Cannot autofill ${key.name} in ils with ${key.defaultValue}`);
    } else {
      switch (key.type) {
        case 'integer':
        case 'bit':
          transaction[key.name] = 0 as never;
          break;
        default:
          logger.log(`Cannot autofill ${key.name}, no default value for ${key.type}`);
      }
    }
  }

  try {
    const res = await getPoalimForeignTransactions
      .run(
        {
          accountNumber: transaction.accountNumber,
          bankNumber: transaction.bankNumber,
          branchNumber: transaction.branchNumber,
          executingDate: transaction.executingDate.toString(),
          referenceNumber: transaction.referenceNumber,
          valueDate: transaction.valueDate.toString(),
        },
        pool,
      )
      .then(res => res.filter(t => t.currency === currency));

    const columnNamesToExcludeFromComparison: string[] = [
      'formattedEventAmount',
      'formattedCurrentBalance',
      'cardIndex',
      'kodMatbeaMekori',
      'id',
    ];
    if (oldContraAccountFieldNameLableAPI) {
      columnNamesToExcludeFromComparison.push('contraAccountFieldNameLable');
    }
    if (res.length > 0) {
      for (const dbTransaction of res) {
        if (
          isSameTransaction(transaction, dbTransaction, columns, columnNamesToExcludeFromComparison)
        )
          return false;
      }
    }
    return true;
  } catch (error) {
    logger.error(error);
    throw new Error('Failed to check if transaction is new');
  }
}

async function insertTransactions<
  T extends ForeignCurrency,
  U extends InsertionTransactionParams<T>,
>(transactions: NormalizedForeignTransaction[], pool: Pool, currency: T, logger: Logger) {
  const transactionsToInsert: Array<U['transactions'][number]> = [];
  for (const transaction of transactions) {
    const direction = transaction.eventActivityTypeCode === 2 ? -1 : 1;
    const amount = transaction.eventAmount * direction;
    if (transaction.transactionType === 'TODAY') {
      logger.log(`Today transaction -
              ${reverse(transaction.activityDescription)},
              ${currency}${amount.toLocaleString()},
              ${transaction.accountNumber}
            `);
    } else if (transaction.transactionType === 'FUTURE') {
      logger.log(`Future transaction -
                ${reverse(transaction.activityDescription)},
                ${currency}${amount.toLocaleString()},
                ${transaction.accountNumber}
              `);
    } else if (
      differenceInMonths(
        new Date(),
        new Date(convertNumberDateToString(transaction.executingDate)),
      ) > 2
    ) {
      logger.error('Was going to insert an old transaction!!', JSON.stringify(transaction));
      throw new Error('Old transaction');
    }
    const transactionToInsert: U['transactions'][number] = {
      metadataAttributesOriginalEventKey: transaction.metadataAttributesOriginalEventKey,
      metadataAttributesContraBranchNumber: transaction.metadataAttributesContraBranchNumber,
      metadataAttributesContraAccountNumber: transaction.metadataAttributesContraAccountNumber,
      metadataAttributesContraBankNumber: transaction.metadataAttributesContraBankNumber,
      metadataAttributesContraAccountFieldNameLable:
        transaction.metadataAttributesContraAccountFieldNameLable,
      metadataAttributesDataGroupCode: transaction.metadataAttributesDataGroupCode,
      metadataAttributesCurrencyRate: transaction.metadataAttributesCurrencyRate,
      metadataAttributesContraCurrencyCode: transaction.metadataAttributesContraCurrencyCode,
      metadataAttributesRateFixingCode: transaction.metadataAttributesRateFixingCode,
      executingDate: convertNumberDateToString(transaction.executingDate),
      formattedExecutingDate: transaction.formattedExecutingDate,
      valueDate: convertNumberDateToString(transaction.valueDate),
      formattedValueDate: transaction.formattedValueDate,
      originalSystemId: transaction.originalSystemId,
      activityDescription: transaction.activityDescription,
      eventAmount: transaction.eventAmount,
      currentBalance: transaction.currentBalance,
      referenceCatenatedNumber: transaction.referenceCatenatedNumber,
      referenceNumber: transaction.referenceNumber,
      currencyRate: transaction.currencyRate,
      eventDetails: transaction.eventDetails,
      rateFixingCode: transaction.rateFixingCode,
      contraCurrencyCode: transaction.contraCurrencyCode,
      eventActivityTypeCode: transaction.eventActivityTypeCode,
      transactionType: transaction.transactionType,
      rateFixingShortDescription: transaction.rateFixingShortDescription,
      currencyLongDescription: transaction.currencyLongDescription,
      activityTypeCode: transaction.activityTypeCode,
      eventNumber: transaction.eventNumber,
      validityDate: convertNumberDateToString(transaction.validityDate),
      comments: 'comments' in transaction ? transaction.comments : null,
      commentExistenceSwitch: ('commentExistenceSwitch' in transaction
        ? transaction.commentExistenceSwitch
        : 0) as unknown as boolean,
      accountName: 'accountName' in transaction ? transaction.accountName : null,
      contraBankNumber: 'contraBankNumber' in transaction ? transaction.contraBankNumber : 0,
      contraBranchNumber: 'contraBranchNumber' in transaction ? transaction.contraBranchNumber : 0,
      contraAccountNumber:
        'contraAccountNumber' in transaction ? transaction.contraAccountNumber : 0,
      originalEventKey: ('originalEventKey' in transaction
        ? transaction.originalEventKey
        : 0) as unknown as boolean,
      contraAccountFieldNameLable:
        'contraAccountFieldNameLable' in transaction
          ? transaction.contraAccountFieldNameLable
          : null,
      dataGroupCode: ('dataGroupCode' in transaction
        ? transaction.dataGroupCode
        : 0) as unknown as boolean,
      rateFixingDescription: transaction.rateFixingDescription,
      urlAddressNiar: null,
      currencySwiftCode: transaction.currencySwiftCode,
      urlAddress: transaction.urlAddress,
      bankNumber: transaction.bankNumber,
      branchNumber: transaction.branchNumber,
      accountNumber: transaction.accountNumber,
    };
    transactionsToInsert.push(transactionToInsert as U['transactions'][number]);
  }
  if (transactionsToInsert.length > 0) {
    let insertPoalimIlsTransactions: TaggedQuery<
      | IInsertPoalimEurTransactionsQuery
      | IInsertPoalimGbpTransactionsQuery
      | IInsertPoalimUsdTransactionsQuery
    >;
    switch (currency) {
      case 'usd':
        insertPoalimIlsTransactions = insertPoalimUsdTransactions;
        break;
      case 'eur':
        insertPoalimIlsTransactions = insertPoalimEurTransactions;
        break;
      case 'gbp':
        insertPoalimIlsTransactions = insertPoalimGbpTransactions;
        break;
      default:
        throw new Error('Invalid currency');
    }
    try {
      const res = await insertPoalimIlsTransactions.run(
        { transactions: transactionsToInsert },
        pool,
      );
      res.map(transaction => {
        const direction = transaction.event_activity_type_code === 2 ? -1 : 1;
        const amount = Number(transaction.event_amount) * direction;
        logger.log(
          `success in insert to Poalim ${currency} - ${transaction.account_number} - ${reverse(transaction.activity_description)} - ${amount.toLocaleString()} - ${transaction.executing_date}`,
        );
      });
    } catch (error) {
      logger.error(`Failed to insert Poalim ${currency} transactions`, error);
      throw new Error('Failed to insert transactions');
    }
  }
}

export async function getForeignTransactions(
  pool: Pool,
  account: ScrapedAccount,
  parentCtx: PoalimContext,
) {
  const { logger, accounts } = parentCtx;
  const knownAccountNumbers = accounts!.map(account => account.accountNumber);
  return new Listr<Context>([
    {
      title: `Get Transactions`,
      task: async (foreignAccountsContext, task) => {
        await normalizeForeignTransactionsForAccount(
          foreignAccountsContext,
          task,
          parentCtx.scraper!,
          account,
          knownAccountNumbers,
          logger,
        );
        const currencyAccounts = Object.keys(foreignAccountsContext.transactionsByCurrencies ?? {});
        if (currencyAccounts.length) {
          task.title = `${task.title} (Got ${currencyAccounts.length} currency accounts)`;
        }
      },
    },
    {
      title: `Handle Foreign Currencies`,
      skip: foreignAccountsContext =>
        foreignAccountsContext.transactionsByCurrencies &&
        Object.keys(foreignAccountsContext.transactionsByCurrencies).length === 0,
      task: async foreignAccountsContext => {
        const currencies = Object.keys(
          foreignAccountsContext.transactionsByCurrencies ?? {},
        ) as ForeignCurrency[];
        const tasks = currencies.map(currency => {
          const transactions = foreignAccountsContext.transactionsByCurrencies![currency]!;
          return {
            title: `Currency ${currency.toLocaleUpperCase()}`,
            task: () => {
              if (!transactions.length) {
                throw new Error(`No transactions for ${currency}`);
              }
              return new Listr<{
                newTransactions?: NormalizedForeignTransaction[];
              }>([
                {
                  title: `Check for New Transactions`,
                  task: async (specificForeignAccountContext, task) => {
                    const allColumns =
                      parentCtx.columns![`poalim_${currency}_account_transactions`];
                    if (!allColumns) {
                      throw new Error(`No columns for ${currency}`);
                    }
                    const columns = allColumns.filter(
                      column => column.column_name && column.data_type,
                    ) as FilteredColumns;
                    const newTransactions: NormalizedForeignTransaction[] = [];
                    for (const normalizedTransaction of transactions) {
                      if (
                        await isTransactionNew(
                          normalizedTransaction,
                          currency,
                          pool,
                          columns,
                          logger,
                        )
                      ) {
                        newTransactions.push(normalizedTransaction);
                      }
                    }
                    specificForeignAccountContext.newTransactions = newTransactions;
                    task.title = `${task.title} (${specificForeignAccountContext.newTransactions?.length} new transactions)`;
                  },
                },
                {
                  title: `Save New Transactions`,
                  skip: specificForeignAccountContext =>
                    specificForeignAccountContext.newTransactions?.length === 0
                      ? 'No new transactions'
                      : undefined,
                  task: async specificForeignAccountContext => {
                    const { newTransactions = [] } = specificForeignAccountContext;
                    await insertTransactions(newTransactions, pool, currency, logger);
                  },
                },
              ]);
            },
          } as ListrTask;
        });
        return tasks.length ? new Listr(tasks, { concurrent: true }) : undefined;
      },
    },
  ]);
}
