import { differenceInMonths } from 'date-fns';
import Listr, { ListrTaskWrapper } from 'listr';
import { Logger } from 'logger.js';
import type { Pool } from 'pg';
import { z } from 'zod';
import type { ForeignTransactionsBusinessSchema } from '@accounter/modern-poalim-scraper/dist/__generated__/foreignTransactionsBusinessSchema.js';
import type { ForeignTransactionsPersonalSchema } from '@accounter/modern-poalim-scraper/dist/__generated__/foreignTransactionsPersonalSchema.js';
import { sql } from '@pgtyped/runtime';
import {
  camelCase,
  convertNumberDateToString,
  fillInDefaultValues,
  isSameTransaction,
  newAttributesChecker,
  reverse,
} from '../../helpers/misc.js';
import type {
  FilteredColumns,
  IGetPoalimForeignTransactionsQuery,
  IInsertPoalimForeignTransactionsParams,
  IInsertPoalimForeignTransactionsQuery,
  Json,
} from '../../helpers/types.js';
import type { ScrapedAccount } from './accounts.js';
import type { PoalimScraper, PoalimUserContext } from './index.js';

export type ForeignTransaction = (
  | ForeignTransactionsPersonalSchema
  | ForeignTransactionsBusinessSchema
)['balancesAndLimitsDataList'][number]['transactions'][number];
type ForeignCurrency = 'USD' | 'EUR' | 'GBP' | 'CAD' | 'JPY' | 'AUD' | 'SEK';
export type NormalizedForeignTransaction = ForeignTransaction & {
  currency: ForeignCurrency;
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
type ForeignCurrenciesContext = {
  // transactionsByCurrencies?: Partial<{
  //   [key in ForeignCurrency]: NormalizedForeignTransaction[];
  // }>;
  transactions?: NormalizedForeignTransaction[];
  newTransactions?: NormalizedForeignTransaction[];
};

const getPoalimForeignTransactions = sql<IGetPoalimForeignTransactionsQuery>`
  SELECT *
  FROM accounter_schema.poalim_foreign_account_transactions
  WHERE account_number = $accountNumber
  AND branch_number = $branchNumber
  AND bank_number = $bankNumber
  AND executing_date = $executingDate
  AND value_date = $valueDate
  AND reference_number = $referenceNumber;`;

const insertPoalimForeignTransactions = sql<IInsertPoalimForeignTransactionsQuery>`
  insert into accounter_schema.poalim_foreign_account_transactions (metadata_attributes_original_event_key,
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
                                                                currency,
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
                        currency,
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

const PoalimForeignTransactionSchema = z.object({
  metadataAttributesOriginalEventKey: z.record(z.any(), z.any()).nullable(),
  metadataAttributesContraBranchNumber: z.record(z.any(), z.any()).nullable(),
  metadataAttributesContraAccountNumber: z.record(z.any(), z.any()).nullable(),
  metadataAttributesContraBankNumber: z.record(z.any(), z.any()).nullable(),
  metadataAttributesContraAccountFieldNameLable: z.record(z.any(), z.any()).nullable(),
  metadataAttributesDataGroupCode: z.record(z.any(), z.any()).nullable(),
  metadataAttributesCurrencyRate: z.record(z.any(), z.any()).nullable(),
  metadataAttributesContraCurrencyCode: z.record(z.any(), z.any()).nullable(),
  metadataAttributesRateFixingCode: z.record(z.any(), z.any()).nullable(),

  executingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // ISO date format
  formattedExecutingDate: z.string().max(24),
  valueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  formattedValueDate: z.string().max(24),
  originalSystemId: z.number().int(),
  activityDescription: z.string().max(30),
  eventAmount: z.number().refine(n => n >= -99_999_999.99 && n <= 99_999_999.99),
  currency: z.enum(['USD', 'EUR', 'GBP', 'CAD', 'JPY', 'AUD', 'SEK']),
  currentBalance: z.number().refine(n => n >= -99_999_999.99 && n <= 99_999_999.99),
  referenceCatenatedNumber: z.number().int(),
  referenceNumber: z.number().int(),
  currencyRate: z.number().refine(n => n >= -999.999_999_9 && n <= 999.999_999_9),

  eventDetails: z.string().max(20).nullable(),
  rateFixingCode: z.number().int(),
  contraCurrencyCode: z.number().int(),
  eventActivityTypeCode: z.number().int(),
  transactionType: z.string().max(7),
  rateFixingShortDescription: z.string().max(9),
  currencyLongDescription: z.string(),
  activityTypeCode: z.number().int(),
  eventNumber: z.number().int(),
  validityDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),

  comments: z.string().max(30).nullable(),
  commentExistenceSwitch: z.number().int().min(0).max(1),
  accountName: z.string().max(30).nullable(),
  contraBankNumber: z.number().int(),
  contraBranchNumber: z.number().int(),
  contraAccountNumber: z.number().int(),
  originalEventKey: z.number().int().min(0).max(1),
  contraAccountFieldNameLable: z.string().max(30).nullable(),
  dataGroupCode: z.number().int().min(0).max(1),
  rateFixingDescription: z.string().max(34).nullable(),
  urlAddressNiar: z.string().max(30).nullable(),
  currencySwiftCode: z.string().length(3),
  urlAddress: z.string().max(80).nullable(),
  bankNumber: z.number().int(),
  branchNumber: z.number().int(),
  accountNumber: z.number().int(),
});

function normalizeForeignTransactionMetadata(
  transaction: ForeignTransaction,
  currency: ForeignCurrency,
  accountObject: {
    accountNumber: number;
    branchNumber: number;
    bankNumber: number;
  },
): NormalizedForeignTransaction {
  const normalizedTransaction = {
    ...transaction,
    ...accountObject,
    currency,
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
  ctx: ForeignCurrenciesContext,
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
    ctx.transactions = [];
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
          accountCurrency = 'USD';
          break;
        case 27:
          accountCurrency = 'GBP';
          break;
        case 36:
          accountCurrency = 'AUD';
          break;
        case 51:
          accountCurrency = 'SEK';
          break;
        case 100:
          accountCurrency = 'EUR';
          break;
        case 140:
          accountCurrency = 'CAD';
          break;
        case 248:
          accountCurrency = 'JPY';
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

        ctx.transactions ??= [];
        foreignAccountsArray.transactions.map(transaction => {
          ctx.transactions?.push(
            normalizeForeignTransactionMetadata(transaction, accountCurrency, {
              accountNumber,
              branchNumber,
              bankNumber,
            }),
          );
        });
      }
    }),
  );
}

async function isTransactionNew(
  transaction: NormalizedForeignTransaction,
  pool: Pool,
  columns: FilteredColumns,
  logger: Logger,
): Promise<boolean> {
  let oldContraAccountFieldNameLableAPI = false;
  if (
    'contraAccountFieldNameLable' in transaction &&
    transaction.contraAccountFieldNameLable != null &&
    Number(transaction.contraAccountFieldNameLable) === 0
  ) {
    logger.log('old API!');
    transaction.contraAccountFieldNameLable = null;
    oldContraAccountFieldNameLableAPI = true;
  }

  const columnNames = columns.map(column => camelCase(column.column_name));
  const knownOptionals = [
    'metadata',
    'urlAddressNiar',
    'displayCreditAccountDetails',
    'displayRTGSIncomingTrsDetails',
    'recordSerialNumber',
    'expendedExecutingDate',
    'id',
  ];
  newAttributesChecker(transaction, columnNames, logger, 'Poalim Foreign', knownOptionals);

  // fill in default values for missing keys, to prevent missing preexisting DB records and creation of duplicates
  fillInDefaultValues(transaction, columns, logger, 'Poalim Foreign');

  const direction = transaction.eventActivityTypeCode === 2 ? -1 : 1;
  const amount = transaction.eventAmount * direction;
  if (transaction.transactionType === 'TODAY') {
    logger.log(`Today transaction -
  ${reverse(transaction.activityDescription)},
  ${transaction.currency}${amount.toLocaleString()},
  ${transaction.accountNumber}
`);
    return false;
  }
  if (transaction.transactionType === 'FUTURE') {
    logger.log(`Future transaction -
  ${reverse(transaction.activityDescription)},
  ${transaction.currency}${amount.toLocaleString()},
  ${transaction.accountNumber}
`);
    return false;
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
      .then(res => res.filter(t => t.currency === transaction.currency));

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

async function insertTransactions(
  transactions: NormalizedForeignTransaction[],
  pool: Pool,
  logger: Logger,
) {
  const transactionsToInsert: Array<
    IInsertPoalimForeignTransactionsParams['transactions'][number]
  > = [];
  for (const transaction of transactions) {
    if (
      differenceInMonths(
        new Date(),
        new Date(convertNumberDateToString(transaction.executingDate)),
      ) > 2
    ) {
      logger.error('Was going to insert an old transaction!!', JSON.stringify(transaction));
      throw new Error('Old transaction');
    }
    const transactionToInsert: IInsertPoalimForeignTransactionsParams['transactions'][number] = {
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
      currency: transaction.currency,
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

    const validation = PoalimForeignTransactionSchema.safeParse(transactionToInsert);

    if (validation.success) {
      transactionsToInsert.push(transactionToInsert);
    } else {
      logger.error(
        `Failed to validate Poalim foreign transaction`,
        JSON.stringify(validation.error, null, 2),
      );
    }
  }
  if (transactionsToInsert.length > 0) {
    try {
      const res = await insertPoalimForeignTransactions.run(
        { transactions: transactionsToInsert },
        pool,
      );
      res.map(transaction => {
        const direction = transaction.event_activity_type_code === 2 ? -1 : 1;
        const amount = Number(transaction.event_amount) * direction;
        logger.log(
          `success in insert to Poalim foreign - ${transaction.account_number} - ${reverse(transaction.activity_description)} - ${amount.toLocaleString()} - ${transaction.executing_date}`,
        );
      });
    } catch (error) {
      logger.error(`Failed to insert Poalim foreign transactions`, error);
      console.log(JSON.stringify(transactionsToInsert, null, 2));
      throw new Error('Failed to insert transactions');
    }
  }
}

type PoalimForeignCurrenciesContext = PoalimUserContext & {
  [bankKey: string]: { [foreignKey: string]: ForeignCurrenciesContext };
};

export async function getForeignTransactions(bankKey: string, account: ScrapedAccount) {
  const foreignKey = `${bankKey}_${account.branchNumber}_${account.accountNumber}_foreign`;
  return new Listr<
    PoalimForeignCurrenciesContext & {
      [bankKey: string]: {
        newTransactions?: NormalizedForeignTransaction[];
      };
    }
  >([
    {
      title: `Get Transactions`,
      task: async (ctx, task) => {
        ctx[bankKey][foreignKey] = {};
        const knownAccountNumbers = ctx[bankKey].accounts!.map(account => account.accountNumber);
        await normalizeForeignTransactionsForAccount(
          ctx[bankKey][foreignKey],
          task,
          ctx[bankKey].scraper!,
          account,
          knownAccountNumbers,
          ctx.logger,
        );
        const currencyTransactions = Object.keys(ctx[bankKey][foreignKey].transactions ?? []);
        if (currencyTransactions.length) {
          task.title = `${task.title} (Got ${currencyTransactions.length} transactions)`;
        }
      },
    },
    {
      title: `Check for New Transactions`,
      skip: ctx =>
        !ctx[bankKey][foreignKey]?.transactions ||
        Object.keys(ctx[bankKey][foreignKey].transactions).length === 0,
      task: async (ctx, task) => {
        const allColumns = ctx[bankKey].columns![`poalim_foreign_account_transactions`];
        if (!allColumns) {
          throw new Error(`No columns for foreign currencies`);
        }
        const columns = allColumns.filter(
          column => column.column_name && column.data_type,
        ) as FilteredColumns;
        const newTransactions: NormalizedForeignTransaction[] = [];
        await Promise.all(
          ctx[bankKey][foreignKey].transactions!.map(async normalizedTransaction => {
            if (await isTransactionNew(normalizedTransaction, ctx.pool, columns, ctx.logger)) {
              newTransactions.push(normalizedTransaction);
            }
          }),
        );
        ctx[bankKey][foreignKey].newTransactions = newTransactions;
        task.title = `${task.title} (${ctx[bankKey][foreignKey].newTransactions?.length} new transactions)`;
      },
    },
    {
      title: `Save New Transactions`,
      skip: ctx =>
        ctx[bankKey][foreignKey].newTransactions?.length === 0 ? 'No new transactions' : undefined,
      task: async ctx => {
        const { newTransactions = [] } = ctx[bankKey][foreignKey];
        await insertTransactions(newTransactions, ctx.pool, ctx.logger);
      },
    },
  ]);
}
