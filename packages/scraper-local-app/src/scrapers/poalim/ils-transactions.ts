import { writeFileSync } from 'node:fs';
import { differenceInMonths, format } from 'date-fns';
import Listr, { type ListrTaskWrapper } from 'listr';
import type { Pool } from 'pg';
import type { ILSCheckingTransactionsDataSchema } from '@accounter/modern-poalim-scraper/dist/__generated__/ILSCheckingTransactionsDataSchema.js';
import { sql } from '@pgtyped/runtime';
import { camelCase, convertNumberDateToString, reverse } from '../../helpers/misc.js';
import type {
  FilteredColumns,
  IGetPoalimIlsTransactionsQuery,
  IGetPoalimIlsTransactionsResult,
  IInsertPoalimIlsTransactionsParams,
  IInsertPoalimIlsTransactionsQuery,
} from '../../helpers/types.js';
import type { Logger } from '../../logger.js';
import type { ScrapedAccount } from './accounts.js';
import type { PoalimContext, PoalimScraper } from './index.js';

export type IlsTransaction = ILSCheckingTransactionsDataSchema['transactions'][number];
export type NormalizedIlsTransaction = IlsTransaction & {
  beneficiaryDetailsDataPartyName?: string | null;
  beneficiaryDetailsDataMessageHeadline?: string | null;
  beneficiaryDetailsDataPartyHeadline?: string | null;
  beneficiaryDetailsDataMessageDetail?: string | null;
  beneficiaryDetailsDataTableNumber?: number | null;
  beneficiaryDetailsDataRecordNumber?: number | null;
  accountNumber: number;
  branchNumber: number;
  bankNumber: number;
};
type Context = {
  transactions?: NormalizedIlsTransaction[];
  newTransactions?: NormalizedIlsTransaction[];
};

const getPoalimIlsTransactions = sql<IGetPoalimIlsTransactionsQuery>`
  SELECT * FROM accounter_schema.poalim_ils_account_transactions
  WHERE account_number = $accountNumber
    AND branch_number = $branchNumber
    AND bank_number = $bankNumber
    AND event_date = $eventDate
    AND value_date = $valueDate
    AND reference_number = $referenceNumber;`;

const insertPoalimIlsTransactions = sql<IInsertPoalimIlsTransactionsQuery>`
  INSERT INTO accounter_schema.poalim_ils_account_transactions (
    event_date,
    formatted_event_date,
    serial_number,
    activity_type_code,
    activity_description,
    text_code,
    reference_number,
    reference_catenated_number,
    value_date,
    formatted_value_date,
    event_amount,
    event_activity_type_code,
    current_balance,
    internal_link_code,
    original_event_create_date,
    formatted_original_event_create_date,
    transaction_type,
    data_group_code,
    beneficiary_details_data,
    expanded_event_date,
    executing_branch_number,
    event_id,
    details,
    pfm_details,
    different_date_indication,
    rejected_data_event_pertaining_indication,
    table_number,
    record_number,
    contra_bank_number,
    contra_branch_number,
    contra_account_number,
    contra_account_type_code,
    marketing_offer_context,
    comment_existence_switch,
    english_action_desc,
    field_desc_display_switch,
    url_address_niar,
    offer_activity_context,
    comment,
    beneficiary_details_data_party_name,
    beneficiary_details_data_message_headline,
    beneficiary_details_data_party_headline,
    beneficiary_details_data_message_detail,
    beneficiary_details_data_table_number,
    beneficiary_details_data_record_number,
    activity_description_include_value_date,
    bank_number,
    branch_number,
    account_number)
  VALUES $$transactions(
    eventDate,
    formattedEventDate,
    serialNumber,
    activityTypeCode,
    activityDescription,
    textCode,
    referenceNumber,
    referenceCatenatedNumber,
    valueDate,
    formattedValueDate,
    eventAmount,
    eventActivityTypeCode,
    currentBalance,
    internalLinkCode,
    originalEventCreateDate,
    formattedOriginalEventCreateDate,
    transactionType,
    dataGroupCode,
    beneficiaryDetailsData,
    expandedEventDate,
    executingBranchNumber,
    eventId,
    details,
    pfmDetails,
    differentDateIndication,
    rejectedDataEventPertainingIndication,
    tableNumber,
    recordNumber,
    contraBankNumber,
    contraBranchNumber,
    contraAccountNumber,
    contraAccountTypeCode,
    marketingOfferContext,
    commentExistenceSwitch,
    englishActionDesc,
    fieldDescDisplaySwitch,
    urlAddressNiar,
    offerActivityContext,
    comment,
    beneficiaryDetailsDataPartyName,
    beneficiaryDetailsDataMessageHeadline,
    beneficiaryDetailsDataPartyHeadline,
    beneficiaryDetailsDataMessageDetail,
    beneficiaryDetailsDataTableNumber,
    beneficiaryDetailsDataRecordNumber,
    activityDescriptionIncludeValueDate,
    bankNumber,
    branchNumber,
    accountNumber)
  RETURNING *;`;

function normalizeBeneficiaryDetailsData(
  transaction: IlsTransaction,
  accountObject: {
    accountNumber: number;
    branchNumber: number;
    bankNumber: number;
  },
): NormalizedIlsTransaction {
  const normalizedTransaction = { ...transaction, ...accountObject } as NormalizedIlsTransaction;
  normalizedTransaction.activityDescriptionIncludeValueDate ??= null;
  if (transaction.beneficiaryDetailsData == null) {
    normalizedTransaction.beneficiaryDetailsDataPartyName = null;
    normalizedTransaction.beneficiaryDetailsDataMessageHeadline = null;
    normalizedTransaction.beneficiaryDetailsDataPartyHeadline = null;
    normalizedTransaction.beneficiaryDetailsDataMessageDetail = null;
    normalizedTransaction.beneficiaryDetailsDataTableNumber = null;
    normalizedTransaction.beneficiaryDetailsDataRecordNumber = null;
  } else {
    normalizedTransaction.beneficiaryDetailsDataPartyName =
      transaction.beneficiaryDetailsData.partyName;
    normalizedTransaction.beneficiaryDetailsDataMessageHeadline =
      transaction.beneficiaryDetailsData.messageHeadline;
    normalizedTransaction.beneficiaryDetailsDataPartyHeadline =
      transaction.beneficiaryDetailsData.partyHeadline;
    normalizedTransaction.beneficiaryDetailsDataMessageDetail =
      transaction.beneficiaryDetailsData.messageDetail;
    normalizedTransaction.beneficiaryDetailsDataTableNumber =
      transaction.beneficiaryDetailsData.tableNumber;
    normalizedTransaction.beneficiaryDetailsDataRecordNumber =
      transaction.beneficiaryDetailsData.recordNumber;

    normalizedTransaction.beneficiaryDetailsData = null;
  }
  return normalizedTransaction;
}

async function normalizeIlsForAccount(
  ctx: Context,
  task: ListrTaskWrapper<unknown>,
  scraper: PoalimScraper,
  bankAccount: ScrapedAccount,
  knownAccountsNumbers: number[],
  logger: Logger,
) {
  task.output = `Getting transactions`;
  const transactions = await scraper.getILSTransactions(bankAccount);

  if (!transactions.data) {
    task.skip('No data');
    ctx.transactions = [];
    return;
  }

  if (!transactions.isValid) {
    if ('errors' in transactions) {
      logger.error(transactions.errors);
    }
    throw new Error(
      `Invalid transactions data for ${transactions.data.retrievalTransactionData.branchNumber}:${transactions.data.retrievalTransactionData.accountNumber}`,
    );
  }

  if (knownAccountsNumbers.includes(transactions.data.retrievalTransactionData.accountNumber)) {
    task.output = `Normalizing transactions`;
    const account = {
      accountNumber: transactions.data.retrievalTransactionData.accountNumber,
      branchNumber: transactions.data.retrievalTransactionData.branchNumber,
      bankNumber: transactions.data.retrievalTransactionData.bankNumber,
    };
    ctx.transactions = transactions.data.transactions.map(transaction =>
      normalizeBeneficiaryDetailsData(transaction, account),
    );
  } else {
    throw new Error(
      `UNKNOWN ACCOUNT ${transactions.data.retrievalTransactionData.branchNumber}:${transactions.data.retrievalTransactionData.accountNumber}`,
    );
  }
}

function newAttributesChecker(
  transaction: NormalizedIlsTransaction,
  columnNames: string[],
  logger: Logger,
) {
  const knownOptionals = [
    'beneficiaryDetailsDataPartyName',
    'beneficiaryDetailsDataMessageHeadline',
    'beneficiaryDetailsDataPartyHeadline',
    'beneficiaryDetailsDataMessageDetail',
    'beneficiaryDetailsDataTableNumber',
    'beneficiaryDetailsDataRecordNumber',
    'activityDescriptionIncludeValueDate',
    'displayCreditAccountDetails',
    'displayRTGSIncomingTrsDetails',
    'formattedEventAmount',
    'formattedCurrentBalance',
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
    logger.log('New Poalim ILS keys, in DB missing from transaction', inDBNotInTransaction);
  }
  if (InTransactionNotInDB.length) {
    logger.log(`New Poalim ILS keys, in transaction missing from DB`, InTransactionNotInDB);
  }
}

function isSameTransaction(
  transaction: NormalizedIlsTransaction,
  dbTransaction: IGetPoalimIlsTransactionsResult,
  columns: FilteredColumns,
  ignoredColumns: string[] = [],
) {
  for (const column of columns) {
    if (ignoredColumns.includes(camelCase(column.column_name))) {
      continue;
    }

    const key = column.column_name as keyof IGetPoalimIlsTransactionsResult;
    const attribute = camelCase(key) as keyof NormalizedIlsTransaction;
    const type = column.data_type;

    // normalize nullables
    const isNullable = column.is_nullable === 'YES';
    const dbValue = isNullable ? (dbTransaction[key] ?? null) : dbTransaction[key];
    const transactionValue = isNullable ? (transaction[attribute] ?? null) : transaction[attribute];

    switch (type) {
      case 'character varying':
      case 'USER-DEFINED':
      case 'text': {
        // string values
        if (dbValue !== transactionValue) {
          return false;
        }
        break;
      }
      case 'date': {
        // date values
        const dbDateString = dbValue ? format(dbValue as Date, 'yyyyMMdd') : null;
        const transactionDateString = transactionValue ? transactionValue.toString() : null;

        if (dbDateString !== transactionDateString) {
          return false;
        }
        break;
      }
      case 'bit': {
        // boolean values
        const transactionBit = transactionValue == null ? null : transactionValue.toString();
        if (transactionBit !== dbValue) {
          return false;
        }
        break;
      }
      case 'integer':
      case 'numeric':
      case 'bigint': {
        // numeric values
        // should consider 0 value, string numbers, etc
        const dbNumber = dbValue == null ? null : Number(dbValue);
        const transactionNumber = transactionValue == null ? null : Number(transactionValue);
        if (dbNumber !== transactionNumber) {
          return false;
        }
        break;
      }
      default: {
        if (!isNullable) {
          throw new Error(`Unhandled type ${type}`);
        }
      }
    }
  }

  // case no diffs found
  return true;
}

const columnNamesToExcludeFromComparison = [
  'recordNumber',
  'beneficiaryDetailsDataRecordNumber', // Same beneficiary will update the index whenever there is a new one
  'id',
  'formattedEventAmount',
  'formattedCurrentBalance',
  'beneficiaryDetailsData',
];

async function isTransactionNew(
  transaction: NormalizedIlsTransaction,
  pool: Pool,
  columns: FilteredColumns,
  logger: Logger,
): Promise<boolean> {
  const columnNames = columns.map(column => camelCase(column.column_name));
  newAttributesChecker(transaction, columnNames, logger);

  // fill in default values for missing keys, to prevent missing preexisting DB records and creation of duplicates
  const allKeys = Object.keys(transaction);
  const existingFields = columns.map(column => ({
    name: camelCase(column.column_name ?? '') as keyof NormalizedIlsTransaction | 'id',
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
    const res = await getPoalimIlsTransactions.run(
      {
        accountNumber: transaction.accountNumber,
        bankNumber: transaction.bankNumber,
        branchNumber: transaction.branchNumber,
        eventDate: transaction.eventDate.toString(),
        referenceNumber: transaction.referenceNumber,
        valueDate: transaction.valueDate.toString(),
      },
      pool,
    );
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
  transactions: NormalizedIlsTransaction[],
  pool: Pool,
  logger: Logger,
) {
  const transactionsToInsert: Array<IInsertPoalimIlsTransactionsParams['transactions'][number]> =
    [];
  for (const transaction of transactions) {
    const direction = transaction.eventActivityTypeCode === 2 ? -1 : 1;
    const amount = transaction.eventAmount * direction;
    if (transaction.transactionType === 'TODAY') {
      logger.log(`Today transaction -
              ${reverse(transaction.activityDescription)},
              ils${amount.toLocaleString()},
              ${transaction.accountNumber}
            `);
    } else if (transaction.transactionType === 'FUTURE') {
      logger.log(`Future transaction -
                ${reverse(transaction.activityDescription)},
                ils${amount.toLocaleString()},
                ${transaction.accountNumber}
              `);
    } else if (
      differenceInMonths(new Date(), new Date(convertNumberDateToString(transaction.eventDate))) > 2
    ) {
      logger.error('Was going to insert an old transaction!!', JSON.stringify(transaction));
      throw new Error('Old transaction');
    }
    const transactionToInsert: IInsertPoalimIlsTransactionsParams['transactions'][number] = {
      eventDate: convertNumberDateToString(transaction.eventDate),
      formattedEventDate: transaction.formattedEventDate,
      serialNumber: transaction.serialNumber,
      activityTypeCode: transaction.activityTypeCode,
      activityDescription: transaction.activityDescription,
      textCode: transaction.textCode,
      referenceNumber: transaction.referenceNumber,
      referenceCatenatedNumber: transaction.referenceCatenatedNumber,
      valueDate: convertNumberDateToString(transaction.valueDate),
      formattedValueDate: transaction.formattedValueDate,
      eventAmount: transaction.eventAmount,
      eventActivityTypeCode: transaction.eventActivityTypeCode,
      currentBalance: transaction.currentBalance,
      internalLinkCode: transaction.internalLinkCode,
      originalEventCreateDate: transaction.originalEventCreateDate,
      formattedOriginalEventCreateDate: transaction.formattedOriginalEventCreateDate,
      transactionType: transaction.transactionType,
      dataGroupCode: transaction.dataGroupCode,
      beneficiaryDetailsData: transaction.beneficiaryDetailsData
        ? JSON.stringify(transaction.beneficiaryDetailsData)
        : null,
      expandedEventDate: transaction.expandedEventDate,
      executingBranchNumber: transaction.executingBranchNumber,
      eventId: transaction.eventId,
      details: transaction.details,
      pfmDetails: transaction.pfmDetails,
      differentDateIndication: transaction.differentDateIndication,
      rejectedDataEventPertainingIndication: transaction.rejectedDataEventPertainingIndication,
      tableNumber: transaction.tableNumber,
      recordNumber: transaction.recordNumber,
      contraBankNumber: transaction.contraBankNumber,
      contraBranchNumber: transaction.contraBranchNumber,
      contraAccountNumber: transaction.contraAccountNumber,
      contraAccountTypeCode: transaction.contraAccountTypeCode,
      marketingOfferContext: transaction.marketingOfferContext as unknown as boolean,
      commentExistenceSwitch: transaction.commentExistenceSwitch as unknown as boolean,
      englishActionDesc: transaction.englishActionDesc,
      fieldDescDisplaySwitch: transaction.fieldDescDisplaySwitch as unknown as boolean,
      urlAddressNiar: null, // TODO: why this attribute exists?
      offerActivityContext: transaction.offerActivityContext,
      comment: transaction.comment,
      beneficiaryDetailsDataPartyName: transaction.beneficiaryDetailsDataPartyName,
      beneficiaryDetailsDataMessageHeadline: transaction.beneficiaryDetailsDataMessageHeadline,
      beneficiaryDetailsDataPartyHeadline: transaction.beneficiaryDetailsDataPartyHeadline,
      beneficiaryDetailsDataMessageDetail: transaction.beneficiaryDetailsDataMessageDetail,
      beneficiaryDetailsDataTableNumber: transaction.beneficiaryDetailsDataTableNumber,
      beneficiaryDetailsDataRecordNumber: transaction.beneficiaryDetailsDataRecordNumber,
      activityDescriptionIncludeValueDate: transaction.activityDescriptionIncludeValueDate,
      bankNumber: transaction.bankNumber,
      branchNumber: transaction.branchNumber,
      accountNumber: transaction.accountNumber,
    };
    transactionsToInsert.push(
      transactionToInsert as IInsertPoalimIlsTransactionsParams['transactions'][number],
    );
  }
  if (transactionsToInsert.length > 0) {
    try {
      const res = await insertPoalimIlsTransactions.run(
        { transactions: transactionsToInsert },
        pool,
      );
      res.map(transaction => {
        const direction = transaction.event_activity_type_code === 2 ? -1 : 1;
        const amount = Number(transaction.event_amount) * direction;
        logger.log(
          `success in insert to Poalim ILS - ${transaction.account_number} - ${reverse(transaction.activity_description)} - ${amount.toLocaleString()} - ${transaction.event_date}`,
        );
      });
    } catch (error) {
      logger.error('Failed to insert Poalim ILS transactions', error);
      throw new Error('Failed to insert transactions');
    }
  }
}

function createDumpFile(transactions: NormalizedIlsTransaction[], bankAccount: ScrapedAccount) {
  const date = new Date();
  const dateString = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
    .toISOString()
    .split('T')[0];

  writeFileSync(
    `../archived_data/POALIM_original_checking_bank_dump_${dateString}_${bankAccount.accountNumber}.json`,
    JSON.stringify(transactions),
    'utf8',
  );
}

export async function getIlsTransactions(
  pool: Pool,
  account: ScrapedAccount,
  parentCtx: PoalimContext,
) {
  const { logger, accounts } = parentCtx;
  const knownAccountNumbers = accounts!.map(account => account.accountNumber);
  return new Listr<Context>([
    {
      title: `Get Transactions`,
      task: async (ctx, task) => {
        await normalizeIlsForAccount(
          ctx,
          task,
          parentCtx.scraper!,
          account,
          knownAccountNumbers,
          logger,
        );
        task.title = `${task.title} (Got ${ctx.transactions?.length} transactions)`;
      },
    },
    {
      title: `Check for New Transactions`,
      skip: ctx => (ctx.transactions?.length === 0 ? 'No transactions' : undefined),
      task: async (ctx, task) => {
        const { transactions = [] } = ctx;
        const columns = parentCtx.columns!.poalim_ils_account_transactions!.filter(
          column => column.column_name && column.data_type,
        ) as FilteredColumns;
        const newTransactions: NormalizedIlsTransaction[] = [];
        for (const normalizedTransaction of transactions) {
          if (await isTransactionNew(normalizedTransaction, pool, columns, logger)) {
            newTransactions.push(normalizedTransaction);
          }
        }
        ctx.newTransactions = newTransactions;
        task.title = `${task.title} (${ctx.newTransactions?.length} new transactions)`;
      },
    },
    {
      title: `Save New Transactions`,
      skip: ctx => (ctx.newTransactions?.length === 0 ? 'No new transactions' : undefined),
      task: async ctx => {
        const { newTransactions = [] } = ctx;
        await insertTransactions(newTransactions, pool, logger);
      },
    },
    {
      title: 'Create dump file',
      skip: ctx => ctx.transactions?.length === 0 || !parentCtx.createDumpFile,
      task: ctx => createDumpFile(ctx.transactions!, account),
    },
  ]);
}
