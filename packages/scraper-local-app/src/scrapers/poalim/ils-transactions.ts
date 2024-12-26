// import { writeFileSync } from 'node:fs';
import Listr, { type ListrTaskWrapper } from 'listr';
import type { Pool } from 'pg';
import { ILSCheckingTransactionsDataSchema } from '@accounter/modern-poalim-scraper/dist/__generated__/ILSCheckingTransactionsDataSchema.js';
import { IsracardCardsTransactionsList } from '@accounter/modern-poalim-scraper/dist/__generated__/isracardCardsTransactionsList.js';
import { sql } from '@pgtyped/runtime';
import { camelCase } from '../../helpers/misc.js';
import type {
  IGetPoalimIlsTransactionsQuery,
  IGetPoalimIlsTransactionsResult,
  IGetTableColumnsResult,
} from '../../helpers/types.js';
import type { ScrapedAccount } from './accounts.js';
import type { PoalimContext, PoalimScraper } from './index.js';

type IsraelTransaction = NonNullable<
  IsracardCardsTransactionsList['CardsTransactionsListBean']['Index0']['CurrentCardTransactions'][number]['txnIsrael']
>[number];
type ForeignTransaction = NonNullable<
  IsracardCardsTransactionsList['CardsTransactionsListBean']['Index0']['CurrentCardTransactions'][number]['txnAbroad']
>[number];
export type DecoratedTransaction = (IsraelTransaction | ForeignTransaction) & { card: string };

type IlsTransaction = ILSCheckingTransactionsDataSchema['transactions'][number];

type NormalizedIlsTransaction = IlsTransaction & {
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

type FilteredColumns = (Omit<IGetTableColumnsResult, 'column_name' | 'data_type'> & {
  column_name: string;
  data_type: string;
})[];

export const getPoalimIlsTransactions = sql<IGetPoalimIlsTransactionsQuery>`
  SELECT * FROM accounter_schema.poalim_ils_account_transactions
  WHERE account_number = $accountNumber
    AND branch_number = $branchNumber
    AND bank_number = $bankNumber
    AND event_date = $eventDate
    AND value_date = $valueDate 
    AND reference_number = $referenceNumber;`;

// function reverse(s: string) {
//   return s.split('').reverse().join('');
// }

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
  if (
    typeof transaction.beneficiaryDetailsData !== 'undefined' &&
    transaction.beneficiaryDetailsData != null
  ) {
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

    transaction.beneficiaryDetailsData = null;
  } else {
    normalizedTransaction.beneficiaryDetailsDataPartyName = null;
    normalizedTransaction.beneficiaryDetailsDataMessageHeadline = null;
    normalizedTransaction.beneficiaryDetailsDataPartyHeadline = null;
    normalizedTransaction.beneficiaryDetailsDataMessageDetail = null;
    normalizedTransaction.beneficiaryDetailsDataTableNumber = null;
    normalizedTransaction.beneficiaryDetailsDataRecordNumber = null;
  }
  return normalizedTransaction;
}

// function createWhereClause(
//   transaction: NormalizedIlsTransaction,
//   checkingColumnNames: { column_name: string; data_type: string }[],
// ) {
//   let whereClause = `
//   SELECT * FROM accounter_schema.poalim_ils_account_transactions
//   WHERE account_number = ${transaction.accountNumber}
//     AND branch_number = ${transaction.branchNumber}
//     AND bank_number = ${transaction.bankNumber}
//     AND event_date = '${transaction.eventDate}'
//     AND value_date = ${transaction.valueDate}
//     AND reference_number = ${transaction.referenceNumber};`;

//   const columnNamesToExcludeFromComparison: (keyof NormalizedIlsTransaction | 'id')[] = [
//     'recordNumber',
//     'beneficiaryDetailsDataRecordNumber', // Same beneficiary will update the index whenever there is a new one
//     'id',
//     'formattedEventAmount',
//     'formattedCurrentBalance',
//   ];

//   for (const dBcolumn of checkingColumnNames) {
//     const camelCaseColumnName = camelCase(dBcolumn.column_name) as keyof NormalizedIlsTransaction;
//     if (columnNamesToExcludeFromComparison.includes(camelCaseColumnName)) {
//       continue;
//     }

//     let actualCondition = '';
//     const isNotNull = transaction[camelCaseColumnName] != null;

//     whereClause = whereClause.concat('  ' + dBcolumn.column_name);

//     if (
//       dBcolumn.data_type === 'character varying' ||
//       dBcolumn.data_type === 'USER-DEFINED' ||
//       dBcolumn.data_type === 'text'
//     ) {
//       if (isNotNull && camelCaseColumnName !== 'beneficiaryDetailsData') {
//         actualCondition = `= $$` + transaction[camelCaseColumnName] + `$$`;
//       }
//     } else if (dBcolumn.data_type === 'date' || dBcolumn.data_type === 'bit') {
//       actualCondition = `= '` + transaction[camelCaseColumnName] + `'`;
//       // if (dBcolumn.data_type == 'bit') {
//       //   console.log('bit - ', actualCondition);
//       //   console.log(transaction.eventAmount)
//       // }
//     } else if (
//       dBcolumn.data_type === 'integer' ||
//       dBcolumn.data_type === 'numeric' ||
//       dBcolumn.data_type === 'bigint'
//     ) {
//       actualCondition = `= ` + transaction[camelCaseColumnName];
//     } else if (isNotNull) {
//       // TODO: Log important checks
//       console.log('unknown type ' + dBcolumn.data_type + ' ' + camelCaseColumnName);
//     }

//     whereClause = whereClause.concat(
//       ` ${isNotNull ? actualCondition : 'IS NULL'} AND
//            `,
//     );
//   }
//   const lastIndexOfAND = whereClause.lastIndexOf('AND');
//   whereClause = whereClause.substring(0, lastIndexOfAND);

//   return whereClause;
// }

// function transactionValuesToArray(transaction: NormalizedIlsTransaction) {
//   let values: (string | null)[] = [];
//   values = [
//     transaction.eventDate,
//     transaction.formattedEventDate,
//     transaction.serialNumber,
//     transaction.activityTypeCode,
//     transaction.activityDescription,
//     transaction.textCode,
//     transaction.referenceNumber,
//     transaction.referenceCatenatedNumber,
//     transaction.valueDate,
//     transaction.formattedValueDate,
//     transaction.eventAmount,
//     transaction.eventActivityTypeCode,
//     transaction.currentBalance,
//     transaction.internalLinkCode,
//     transaction.originalEventCreateDate,
//     transaction.formattedOriginalEventCreateDate,
//     transaction.transactionType,
//     transaction.dataGroupCode,
//     transaction.beneficiaryDetailsData,
//     transaction.expandedEventDate,
//     transaction.executingBranchNumber,
//     transaction.eventId,
//     transaction.details,
//     transaction.pfmDetails,
//     transaction.differentDateIndication,
//     transaction.rejectedDataEventPertainingIndication,
//     transaction.tableNumber,
//     transaction.recordNumber,
//     transaction.contraBankNumber,
//     transaction.contraBranchNumber,
//     transaction.contraAccountNumber,
//     transaction.contraAccountTypeCode,
//     transaction.marketingOfferContext,
//     transaction.commentExistenceSwitch,
//     transaction.englishActionDesc,
//     transaction.fieldDescDisplaySwitch,
//     transaction.urlAddressNiar,
//     transaction.offerActivityContext,
//     transaction.comment,
//     transaction.beneficiaryDetailsDataPartyName,
//     transaction.beneficiaryDetailsDataMessageHeadline,
//     transaction.beneficiaryDetailsDataPartyHeadline,
//     transaction.beneficiaryDetailsDataMessageDetail,
//     transaction.beneficiaryDetailsDataTableNumber,
//     transaction.beneficiaryDetailsDataRecordNumber,
//     transaction.activityDescriptionIncludeValueDate,
//     transaction.bankNumber,
//     transaction.branchNumber,
//     transaction.accountNumber,
//   ];
//   return values;
// }

function compareTransactions(
  transaction: NormalizedIlsTransaction,
  dbTransaction: IGetPoalimIlsTransactionsResult,
) {
  // const whereClause = createWhereClause(transaction, columns);
  // console.log('whereClause', whereClause);

  // do exact comparison

  console.log(transaction && dbTransaction);
  return false;
}

function newAttributesChecker(transaction: NormalizedIlsTransaction, columnNames: string[]) {
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
    console.log('New Poalim ILS keys, in DB missing from transaction', inDBNotInTransaction);
  }
  if (InTransactionNotInDB.length) {
    console.log(`New Poalim ILS keys, in transaction missing from DB`, InTransactionNotInDB);
  }
}

async function isTransactionNew(
  transaction: NormalizedIlsTransaction,
  pool: Pool,
  columns: FilteredColumns,
): Promise<boolean> {
  const columnNames = columns.map(column => camelCase(column.column_name));
  newAttributesChecker(transaction, columnNames);

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
      console.log(`Poalim ILS: Cannot autofill ${key.name} in ils with ${key.defaultValue}`);
    } else {
      switch (key.type) {
        case 'integer':
        case 'bit':
          transaction[key.name] = 0 as never;
          break;
        default:
          console.log(`Cannot autofill ${key.name}, no default value for ${key.type}`);
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
        if (compareTransactions(transaction, dbTransaction)) return false;
      }
    }
    return true;
  } catch (error) {
    console.error(error);
    throw new Error('Failed to check if transaction is new');
  }
}

// async function insertTransactions(
//   transactions: NormalizedIlsTransaction[],
//   pool: Pool,
//   columns: IGetTableColumnsResult[],
// ) {
//   for (const transaction of transactions) {
//     try {
//       let columnNames = columns.map(column => column.column_name);
//       columnNames = columnNames.filter(columnName => columnName !== 'id');
//       let text = `INSERT INTO accounter_schema.poalim_ils_account_transactions
//         (
//           ${columnNames.map(x => x).join(', ')},
//         )`;
//       const lastIndexOfComma = text.lastIndexOf(',');
//       text = text
//         .substring(0, lastIndexOfComma)
//         .concat(text.substring(lastIndexOfComma + 1, text.length));

//       const arrayKeys = columnNames.keys();
//       let denseKeys = [...arrayKeys];
//       denseKeys = denseKeys.map(x => x + 1);
//       const keysOfInputs = denseKeys.join(', $');
//       text = text.concat(` VALUES($${keysOfInputs}) RETURNING *`);

//       const values = transactionValuesToArray(transaction);

//       if (values.length !== columnNames.length) {
//         // TODO: Log important checks
//         console.log('Wrong Insert length');
//       }

//       try {
//         let sign = '+';
//         if (transaction.eventActivityTypeCode === 2) {
//           sign = '-';
//         }
//         if (transaction.transactionType === 'TODAY') {
//           console.log(`Today transaction -
//               ${reverse(transaction.activityDescription)},
//               ils${sign}${transaction.eventAmount.toLocaleString()},
//               ${transaction.accountNumber}
//             `);
//         } else if (transaction.transactionType === 'FUTURE') {
//           console.log(`Future transaction -
//                 ${reverse(transaction.activityDescription)},
//                 ils${sign}${transaction.eventAmount.toLocaleString()},
//                 ${transaction.accountNumber}
//               `);
//         } else if (moment(transaction.eventDate, 'YYYY-MM-DD').diff(moment(), 'months') > 2) {
//           console.error('Was going to insert an old transaction!!', JSON.stringify(transaction));
//         } else {
//           const res = await pool.query(text, values);
//           if (res.rows[0].event_amount) {
//             console.log(
//               `success in insert to ils - ${transaction.accountNumber} - ${reverse(res.rows[0].activity_description)} - ${sign}${res.rows[0].event_amount.toLocaleString()} - ${res.rows[0].event_date}`,
//             );
//           } else if (res.rows[0].original_amount) {
//             console.log(
//               `success in insert to ils-${transaction.accountNumber} - `,
//               res.rows[0].original_amount,
//             );
//           } else if (res.rows[0].card) {
//             let supplierName = res.rows[0].supplier_name;
//             if (supplierName) {
//               supplierName = reverse(res.rows[0].supplier_name);
//             } else {
//               supplierName = res.rows[0].supplier_name_outbound;
//             }
//             console.log(
//               `success in insert to ${res.rows[0].card} - ${res.rows[0].payment_sum} - ${res.rows[0].payment_sum_outbound} - ${supplierName} - ${res.rows[0].full_purchase_date_outbound}`,
//               res.rows[0].full_purchase_date,
//             );
//           } else if (res.rows[0].source) {
//             console.log(
//               `success in insert to ${res.rows[0].source} - ${res.rows[0].amount} - ${res.rows[0].validityDate}`,
//               res.rows[0].data_0_product_free_text,
//             );
//           } else {
//             // console.log('saved', JSON.stringify(res));
//           }
//         }
//         // console.log('nothing');
//       } catch (error) {
//         // TODO: Log important checks
//         console.log(
//           `error in insert - ${error} - ${text} - ${values} - ${JSON.stringify(transaction)}`,
//         );
//         // console.log('nothing');
//       }
//     } catch (error) {
//       // TODO: Log important checks
//       console.log('pg error - ', error);
//     }
//   }
// }

async function normalizeIlsForAccount(
  ctx: Context,
  task: ListrTaskWrapper<unknown>,
  scraper: PoalimScraper,
  bankAccount: ScrapedAccount,
  knownAccountsNumbers: number[],
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
      console.error(transactions.errors);
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

// function createDumpFile(transactions: NormalizedIlsTransaction[], bankAccount: ScrapedAccount) {
//   const date = new Date();
//   const dateString = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
//     .toISOString()
//     .split('T')[0];

//   writeFileSync(
//     `../archived_data/POALIM_original_checking_bank_dump_${dateString}_${bankAccount.accountNumber}.json`,
//     JSON.stringify(transactions),
//     'utf8',
//   );
// }

type Context = {
  transactions?: NormalizedIlsTransaction[];
  newTransactions?: NormalizedIlsTransaction[];
};

export async function getIlsTransactions(
  pool: Pool,
  account: ScrapedAccount,
  parentCtx: PoalimContext,
) {
  const knownAccountNumbers = parentCtx.accounts!.map(account => account.accountNumber);
  return new Listr<Context>([
    {
      title: `Get Transactions`,
      enabled: () => !!parentCtx.scraper,
      task: async (ctx, task) => {
        await normalizeIlsForAccount(ctx, task, parentCtx.scraper!, account, knownAccountNumbers);
      },
    },
    {
      title: `Check for New Transactions`,
      enabled: ctx =>
        !!ctx.transactions && !!parentCtx.columns?.['poalim_ils_account_transactions'],
      skip: ctx => ctx.transactions?.length === 0,
      task: async ctx => {
        const { transactions = [] } = ctx;
        const columns = parentCtx.columns!.poalim_ils_account_transactions!.filter(
          column => column.column_name && column.data_type,
        ) as FilteredColumns;
        const newTransactions: NormalizedIlsTransaction[] = [];
        for (const normalizedTransaction of transactions) {
          if (await isTransactionNew(normalizedTransaction, pool, columns)) {
            newTransactions.push(normalizedTransaction);
          }
        }
        ctx.newTransactions = newTransactions;
      },
    },
    // {
    //   title: `Save New Transactions`,
    //   enabled: ctx => !!ctx.newTransactions,
    //   skip: ctx => ctx.newTransactions?.length === 0,
    //   task: async ctx => {
    //     const { newTransactions = [] } = ctx;
    //     const columns = parentCtx.columns!.poalim_ils_account_transactions!.filter(
    //       column => column.column_name,
    //     );
    //     await insertTransactions(newTransactions, pool, columns);
    //   },
    // },
    // {
    //   title: 'Create dump file',
    //   skip: ctx => ctx.transactions?.length === 0,
    //   task: ctx => createDumpFile(ctx.transactions!, account),
    // },
  ]);
}
