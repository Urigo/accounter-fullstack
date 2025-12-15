import { differenceInMonths } from 'date-fns';
import Listr, { type ListrTaskWrapper } from 'listr';
import type { Pool } from 'pg';
import { sql } from '@pgtyped/runtime';
import type { HapoalimILSTransactions } from '@accounter/modern-poalim-scraper';
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
  IGetPoalimIlsTransactionsQuery,
  IInsertPoalimIlsTransactionsParams,
  IInsertPoalimIlsTransactionsQuery,
} from '../../helpers/types.js';
import type { Logger } from '../../logger.js';
import type { ScrapedAccount } from './accounts.js';
import type { PoalimScraper, PoalimUserContext } from './index.js';

export type IlsTransaction = HapoalimILSTransactions['transactions'][number];
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

  if (!transactions.isValid) {
    if ('errors' in transactions) {
      logger.error(transactions.errors);
    }
    throw new Error(
      `Invalid transactions data for ${bankAccount.branchNumber}:${bankAccount.accountNumber}`,
    );
  }

  if (!transactions.data) {
    task.skip('No data');
    ctx.transactions = [];
    return;
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
  newAttributesChecker(transaction, columnNames, logger, 'Poalim ILS', knownOptionals);

  // fill in default values for missing keys, to prevent missing preexisting DB records and creation of duplicates
  fillInDefaultValues(transaction, columns, logger, 'Poalim Foreign');

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
      continue;
    } else if (transaction.transactionType === 'FUTURE') {
      logger.log(`Future transaction -
                ${reverse(transaction.activityDescription)},
                ils${amount.toLocaleString()},
                ${transaction.accountNumber}
              `);
      continue;
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

export async function getIlsTransactions(bankKey: string, account: ScrapedAccount) {
  const ilsKey = `${bankKey}_${account.branchNumber}_${account.accountNumber}_ils`;
  return new Listr<PoalimUserContext & { [bankKey: string]: { [ilsKey: string]: Context } }>([
    {
      title: `Get Transactions`,
      task: async (ctx, task) => {
        ctx[bankKey][ilsKey] = {};

        const knownAccountNumbers = ctx[bankKey].accounts!.map(account => account.accountNumber);
        await normalizeIlsForAccount(
          ctx[bankKey][ilsKey],
          task,
          ctx[bankKey].scraper!,
          account,
          knownAccountNumbers,
          ctx.logger,
        );
        task.title = `${task.title} (Got ${ctx[bankKey][ilsKey].transactions?.length} transactions)`;
      },
    },
    {
      title: `Check for New Transactions`,
      skip: ctx =>
        ctx[bankKey][ilsKey].transactions?.length === 0 ? 'No transactions' : undefined,
      task: async (ctx, task) => {
        const { transactions = [] } = ctx[bankKey][ilsKey];
        const columns = ctx[bankKey].columns!.poalim_ils_account_transactions!.filter(
          column => column.column_name && column.data_type,
        ) as FilteredColumns;
        const newTransactions: NormalizedIlsTransaction[] = [];
        await Promise.all(
          transactions.map(async normalizedTransaction => {
            if (await isTransactionNew(normalizedTransaction, ctx.pool, columns, ctx.logger)) {
              newTransactions.push(normalizedTransaction);
            }
          }),
        );
        ctx[bankKey][ilsKey].newTransactions = newTransactions;
        task.title = `${task.title} (${ctx[bankKey][ilsKey].newTransactions?.length} new transactions)`;
      },
    },
    {
      title: `Save New Transactions`,
      skip: ctx =>
        ctx[bankKey][ilsKey].newTransactions?.length === 0 ? 'No new transactions' : undefined,
      task: async ctx => {
        const { newTransactions = [] } = ctx[bankKey][ilsKey];
        await insertTransactions(newTransactions, ctx.pool, ctx.logger);
      },
    },
  ]);
}
