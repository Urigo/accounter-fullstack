import { differenceInMonths } from 'date-fns';
import Listr, { type ListrTaskWrapper } from 'listr';
import type { Pool } from 'pg';
import type { init } from '@accounter/modern-poalim-scraper';
import { MaxTransaction } from '@accounter/modern-poalim-scraper/dist/scrapers/types/max/get-transactions-for-month.js';
import {
  camelCase,
  fillInDefaultValues,
  isSameTransaction,
  newAttributesChecker,
  reverse,
} from '../../helpers/misc.js';
import { getTableColumns } from '../../helpers/sql.js';
import type { FilteredColumns } from '../../helpers/types.js';
import type { MainContext } from '../../index.js';
import type { Logger } from '../../logger.js';

export type MaxCredentials = {
  nickname?: string;
  username: string;
  password: string;
  options?: {
    acceptedCardNumbers?: string[];
  };
};

type Scraper = Awaited<ReturnType<typeof init>>;
export type MaxScraper = Awaited<ReturnType<Scraper['max']>>;

export type MaxAccountContext = {
  nickname: string;
  scraper?: MaxScraper;
  options: MaxCredentials['options'];
  columns?: FilteredColumns;
  rawTransactions?: Array<DecoratedTransaction>;
  transactions?: Array<DecoratedTransaction>;
  newTransactions?: Array<DecoratedTransaction>;
};

type Transaction = MaxTransaction;
type DecoratedTransaction = Transaction & { card: string };
type NormalizedTransaction = DecoratedTransaction;

export type MaxContext = MainContext & {
  [accountKey: string]: MaxAccountContext;
};

async function isTransactionNew(
  transaction: DecoratedTransaction,
  context: MaxAccountContext,
  pool: Pool,
  logger: Logger,
): Promise<boolean> {
  const { columns, nickname } = context;
  const columnNames = columns!.map(column => camelCase(column.column_name));
  newAttributesChecker(transaction, columnNames, logger, nickname);

  // fill in default values for missing keys, to prevent missing preexisting DB records and creation of duplicates
  fillInDefaultValues(transaction, columns!, logger, context.nickname);

  try {
    const res = await getMaxTransactions.run(
      {
        card: Number(transaction.card),
        currentPaymentCurrency: transaction.currentPaymentCurrency,
        fullPaymentDate: transaction.fullPaymentDate,
        fullPurchaseDate: transaction.fullPurchaseDate,
        fullPurchaseDateOutbound: transaction.fullPurchaseDateOutbound,
        fullSupplierNameOutbound: transaction.fullSupplierNameOutbound,
        moreInfo: transaction.moreInfo,
        paymentSum: transaction.paymentSum,
        paymentSumOutbound: transaction.paymentSumOutbound,
        supplierId: transaction.supplierId ? Number(transaction.supplierId) : null,
        voucherNumber: transaction.voucherNumber ? Number(transaction.voucherNumber) : null,
      },
      pool,
    );

    const columnNamesToExcludeFromComparison: string[] = [
      /* empty */
    ];
    if (res.length > 0) {
      for (const dbTransaction of res) {
        if (
          isSameTransaction(
            transaction,
            dbTransaction,
            columns!,
            columnNamesToExcludeFromComparison,
          )
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
  transactions: DecoratedTransaction[],
  context: MaxAccountContext,
  pool: Pool,
  logger: Logger,
) {
  const { nickname } = context;
  const transactionsToInsert: Array<InsertionTransactionParams> = [];
  for (const transaction of transactions) {
    if (
      (transaction.fullPurchaseDate != null &&
        differenceInMonths(new Date(), new Date(transaction.fullPurchaseDate)) > 2) ||
      (transaction.fullPurchaseDateOutbound != null &&
        differenceInMonths(new Date(), new Date(transaction.fullPurchaseDateOutbound)) > 2)
    ) {
      logger.error('Was going to insert an old transaction!!', JSON.stringify(transaction));
      throw new Error('Old transaction');
    }

    const transactionToInsert: InsertionTransactionParams = {
      // specificDate: transaction.specificDate,
      // cardIndex: Number(transaction.cardIndex),
      // dealsInbound: transaction.dealsInbound,
      // supplierId: transaction.supplierId ? Number(transaction.supplierId) : null,
      // supplierName: transaction.supplierName,
      // dealSumType: transaction.dealSumType,
      // paymentSumSign: transaction.paymentSumSign,
      // purchaseDate: transaction.purchaseDate,
      // fullPurchaseDate: transaction.fullPurchaseDate,
      // moreInfo: transaction.moreInfo,
      // horaatKeva: transaction.horaatKeva,
      // voucherNumber: transaction.voucherNumber ? Number(transaction.voucherNumber) : null,
      // voucherNumberRatz: transaction.voucherNumberRatz
      //   ? Number(transaction.voucherNumberRatz)
      //   : null,
      // solek: transaction.solek,
      // purchaseDateOutbound: transaction.purchaseDateOutbound,
      // fullPurchaseDateOutbound: transaction.fullPurchaseDateOutbound,
      // currencyId: transaction.currencyId,
      // currentPaymentCurrency: transaction.currentPaymentCurrency,
      // city: transaction.city,
      // supplierNameOutbound: transaction.supplierNameOutbound,
      // fullSupplierNameOutbound: transaction.fullSupplierNameOutbound,
      // paymentDate: transaction.paymentDate,
      // fullPaymentDate: transaction.fullPaymentDate,
      // isShowDealsOutbound: transaction.isShowDealsOutbound,
      // adendum: transaction.adendum,
      // voucherNumberRatzOutbound: transaction.voucherNumberRatzOutbound
      //   ? Number(transaction.voucherNumberRatzOutbound)
      //   : null,
      // isShowLinkForSupplierDetails: transaction.isShowLinkForSupplierDetails,
      // dealSum: transaction.dealSum,
      // paymentSum: transaction.paymentSum,
      // fullSupplierNameHeb: transaction.fullSupplierNameHeb,
      // dealSumOutbound: transaction.dealSumOutbound,
      // paymentSumOutbound: transaction.paymentSumOutbound,
      // isHoraatKeva: transaction.isHoraatKeva,
      // stage: transaction.stage,
      // returnCode: transaction.returnCode,
      // message: transaction.message,
      // returnMessage: transaction.returnMessage,
      // displayProperties: transaction.displayProperties,
      // tablePageNum: Number(transaction.tablePageNum) as unknown as boolean,
      // isError: transaction.isError,
      // isCaptcha: transaction.isCaptcha,
      // isButton: transaction.isButton,
      // siteName: transaction.siteName,
      // clientIpAddress: transaction.clientIpAddress ?? null,
      // card: Number(transaction.card),
      // chargingDate: null,
      // kodMatbeaMekori: transaction.kodMatbeaMekori ?? null,
    };
    transactionsToInsert.push(transactionToInsert);
  }
  if (transactionsToInsert.length > 0) {
    try {
      const res = await insertMaxTransactions.run({ transactions: transactionsToInsert }, pool);
      res.map(transaction => {
        const supplierName = transaction.supplier_name
          ? reverse(transaction.supplier_name)
          : transaction.supplier_name_outbound;
        logger.log(
          `success in insert to ${nickname}:${transaction.card} - ${transaction.payment_sum ?? transaction.payment_sum_outbound} - ${supplierName} - ${transaction.full_purchase_date ?? transaction.full_purchase_date_outbound}`,
          transaction.full_purchase_date,
        );
      });
    } catch (error) {
      logger.error(`Failed to insert ${nickname} transactions`, error);
      throw new Error('Failed to insert transactions');
    }
  }
}

export async function getMaxData(
  credentials: MaxCredentials,
  parentTask: ListrTaskWrapper,
  accountKey: string,
) {
  return new Listr<MaxContext>([
    {
      title: 'Login',
      task: async (ctx, task) => {
        if (!credentials.username || !credentials.password) {
          throw new Error('Missing credentials for MAX');
        }
        ctx[accountKey] = {
          options: credentials.options,
          nickname: accountKey,
        };

        task.output = 'Scraper Init';

        const newMaxInstance = await ctx.scraper.max({
          username: credentials.username,
          password: credentials.password,
        });

        ctx[accountKey].scraper = newMaxInstance;
        return;
      },
    },
    {
      title: 'Get metadata from DB',
      task: async ctx => {
        try {
          const tableName = 'max_creditcard_transactions';
          const allColumns = await getTableColumns.run({ tableName }, ctx.pool);
          ctx[accountKey].columns = allColumns.filter(
            column => column.column_name && column.data_type,
          ) as FilteredColumns;
        } catch (error) {
          ctx.logger.error(error);
          throw new Error('Error on getting columns info');
        }
      },
    },
    {
      title: 'Get Transactions',
      task: async (ctx, task) => {
        const { logger } = ctx;
        const { scraper } = ctx[accountKey];
        const transactions: DecoratedTransaction[] = [];
        try {
          const accountsTransactions = await scraper!.getTransactions();

          for (const account of accountsTransactions) {
            for (const transaction of account.txns) {
              transactions.push({
                ...transaction,
                card: account.accountNumber,
              });
            }
          }
        } catch (error) {
          logger.error(`Failed to get transactions: ${error}`);
          throw new Error(`Failed to get transactions for ${accountKey}`);
        }

        if (!transactions.length) {
          task.skip('No data');
        }
        ctx[accountKey].rawTransactions = transactions;
      },
    },
    {
      title: 'Normalize Transactions',
      skip: ctx => (ctx[accountKey].rawTransactions?.length === 0 ? 'No transactions' : undefined),
      task: async (ctx, task) => {
        const { rawTransactions } = ctx[accountKey];
        const normalizedTransactions: Array<NormalizedTransaction> = rawTransactions ?? [];
        // const cardNumberMapping = ctx[accountKey].options?.cardNumberMapping;
        // const cardNumbersToMap = cardNumberMapping ? Object.keys(cardNumberMapping) : [];
        // transactionsListBean?.cardNumberList.map((cardInformation, index) => {
        //   let card = cardInformation.slice(cardInformation.length - 4);
        //   if (cardNumberMapping && cardNumbersToMap.includes(card)) {
        //     card = cardNumberMapping[card];
        //   }

        //   const transactionsGroups =
        //     transactionsListBean[`Index${index}` as 'Index0'].CurrentCardTransactions;

        //   if (transactionsGroups) {
        //     transactionsGroups.map(txnGroup => {
        //       if (txnGroup.txnIsrael) {
        //         txnGroup.txnIsrael.map(transaction => {
        //           normalizedTransactions.push({
        //             ...transaction,
        //             card,
        //           });
        //         });
        //       }
        //       if (txnGroup.txnAbroad) {
        //         txnGroup.txnAbroad.map(transaction => {
        //           normalizedTransactions.push({
        //             ...transaction,
        //             card,
        //           });
        //         });
        //       }
        //     });
        //   }
        // });

        const { acceptedCardNumbers } = ctx[accountKey].options ?? {};
        if (acceptedCardNumbers && acceptedCardNumbers.length > 0) {
          ctx[accountKey].transactions = normalizedTransactions.filter(transaction =>
            acceptedCardNumbers.includes(transaction.card),
          );
        } else {
          ctx[accountKey].transactions = normalizedTransactions;
        }

        task.title = task.title + ` (${ctx[accountKey].transactions.length} transactions)`;
        return;
      },
    },
    {
      title: `Check for New Transactions`,
      skip: ctx => (ctx[accountKey].transactions?.length === 0 ? 'No transactions' : undefined),
      task: async (ctx, task) => {
        try {
          const { transactions = [] } = ctx[accountKey];
          const newTransactions: DecoratedTransaction[] = [];
          await Promise.all(
            transactions.map(async transaction => {
              if (await isTransactionNew(transaction, ctx[accountKey], ctx.pool, ctx.logger)) {
                newTransactions.push(transaction);
              }
            }),
          );
          ctx[accountKey].newTransactions = newTransactions;
          task.title = `${task.title} (${ctx[accountKey].newTransactions?.length} new transactions)`;
        } catch (error) {
          ctx.logger.error(`Failed to save transactions: ${error}`);
          throw new Error(`Failed to check rather transactions are new for ${accountKey}`);
        }
      },
    },
    {
      title: 'Save Transactions',
      enabled: ctx => !!ctx[accountKey]?.newTransactions,
      task: async (ctx, task) => {
        const { newTransactions = [] } = ctx[accountKey];
        if (newTransactions.length === 0) {
          task.skip('No new transactions');
          return;
        }

        try {
          await insertTransactions(newTransactions, ctx[accountKey], ctx.pool, ctx.logger).then(
            () => {
              task.title = `${task.title} (${newTransactions.length} inserted)`;
            },
          );
        } catch (error) {
          ctx.logger.error(`Failed to save transactions: ${error}`);
          throw new Error(`Failed to save transactions for ${accountKey}`);
        }
      },
    },
    {
      title: 'Status Update',
      task: async ctx => {
        let status: string = '';
        if (ctx[accountKey].transactions) {
          status += `Reviewed ${ctx[accountKey].rawTransactions} Transactions`;
        }
        if (ctx[accountKey].newTransactions?.length === 0) {
          status += `, Nothing New`;
        } else if (ctx[accountKey].newTransactions) {
          status += `, ${ctx[accountKey].newTransactions} New`;
        }
        if (status !== '') {
          parentTask.title = `${parentTask.title} (${status})`;
        }
        return;
      },
    },
  ]);
}
