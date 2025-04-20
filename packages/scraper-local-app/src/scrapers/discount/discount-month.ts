import { format } from 'date-fns';
import Listr, { ListrTaskWrapper } from 'listr';
import type { Pool } from 'pg';
import type { IsracardCardsTransactionsList } from '@accounter/modern-israeli-scrapers/dist/__generated__/isracardCardsTransactionsList.js';
import { sql } from '@pgtyped/runtime';
import { convertNumberDateToString } from '../../helpers/misc.js';
import type {
  IInsertDiscountTransactionsParams,
  IInsertDiscountTransactionsQuery,
} from '../../helpers/types.js';
import type { Logger } from '../../logger.js';
import type { DiscountAccountContext, DiscountContext } from './index.js';

type Transaction = Awaited<
  ReturnType<DiscountAccountContext['scraper']['getMonthTransactions']>
>['transactions'][number];
type DecoratedTransaction = Transaction & { account: string };
type Context = {
  transactionsListBean?: IsracardCardsTransactionsList['CardsTransactionsListBean'];
  transactions?: Array<DecoratedTransaction>;
};

const insertDiscountTransactions = sql<IInsertDiscountTransactionsQuery>`
  INSERT INTO accounter_schema.bank_discount_transactions (
                                          operation_date,
                                          value_date,
                                          operation_code,
                                          operation_description,
                                          operation_description2,
                                          operation_description3,
                                          operation_branch,
                                          operation_bank,
                                          account_number,
                                          channel,
                                          channel_name,
                                          check_number,
                                          institute_code,
                                          operation_amount,
                                          balance_after_operation,
                                          operation_number,
                                          branch_treasury_number,
                                          urn,
                                          operation_details_service_name,
                                          commission_channel_code,
                                          commission_channel_name,
                                          commission_type_name,
                                          business_day_date,
                                          event_name,
                                          category_code,
                                          category_desc_code,
                                          category_description,
                                          operation_description_to_display,
                                          operation_order,
                                          is_last_seen)
  VALUES $transaction(operationDate,
          valueDate,
          operationCode,
          operationDescription,
          operationDescription2,
          operationDescription3,
          operationBranch,
          operationBank,
          accountNumber,
          channel,
          channelName,
          checkNumber,
          instituteCode,
          operationAmount,
          balanceAfterOperation,
          operationNumber,
          branchTreasuryNumber,
          urn,
          operationDetailsServiceName,
          commissionChannelCode,
          commissionChannelName,
          commissionTypeName,
          businessDayDate,
          eventName,
          categoryCode,
          categoryDescCode,
          categoryDescription,
          operationDescriptionToDisplay,
          operationOrder,
          isLastSeen)
  RETURNING *;`;

export async function saveDiscountTransactionsToDB(
  transactions: DecoratedTransaction[],
  pool: Pool,
  logger: Logger,
): Promise<number> {
  let saved = 0;
  for (const transaction of transactions) {
    await saveDiscountTransaction(transaction, pool, logger).then(
      success => (saved += success ? 1 : 0),
    );
  }
  return saved;
}

async function saveDiscountTransaction(
  transaction: DecoratedTransaction,
  pool: Pool,
  logger: Logger,
): Promise<boolean> {
  const transactionData: IInsertDiscountTransactionsParams['transaction'] = {
    accountNumber: transaction.account,
    operationDate: convertNumberDateToString(Number(transaction.OperationDate)),
    valueDate: convertNumberDateToString(Number(transaction.ValueDate)),
    operationCode: transaction.OperationCode,
    operationDescription: transaction.OperationDescription,
    operationDescription2: transaction.OperationDescription2,
    operationDescription3: transaction.OperationDescription3,
    operationBranch: transaction.OperationBranch,
    operationBank: transaction.OperationBank,
    channel: transaction.Channel,
    channelName: transaction.ChannelName,
    checkNumber: transaction.CheckNumber || null,
    instituteCode: transaction.InstituteCode,
    operationAmount: transaction.OperationAmount,
    balanceAfterOperation: transaction.BalanceAfterOperation,
    operationNumber: transaction.OperationNumber,
    branchTreasuryNumber: transaction.BranchTreasuryNumber,
    urn: transaction.Urn,
    operationDetailsServiceName: transaction.OperationDetailsServiceName,
    commissionChannelCode: transaction.CommissionChannelCode,
    commissionChannelName: transaction.CommissionChannelName,
    commissionTypeName: transaction.CommissionTypeName,
    businessDayDate: convertNumberDateToString(Number(transaction.BusinessDayDate)),
    eventName: transaction.EventName,
    categoryCode: transaction.CategoryCode,
    categoryDescCode: transaction.CategoryDescCode,
    categoryDescription: transaction.CategoryDescription,
    operationDescriptionToDisplay: transaction.OperationDescriptionToDisplay,
    operationOrder: transaction.OperationOrder,
    isLastSeen: transaction.IsLastSeen,
  };

  try {
    await insertDiscountTransactions.run({ transaction: transactionData }, pool);
    logger.log(
      `Success in insert to Discount - ${transaction.OperationDescription} - ${transaction.OperationAmount}`,
    );
    return true;
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes('duplicate key value violates unique constraint')
    ) {
      logger.log('Duplicate key violation, skipping insert', { urn: transaction.Urn });
      return false;
    }

    logger.error('Error in Discount insert:', {
      error:
        error instanceof Error
          ? {
              message: error.message,
              stack: error.stack,
              cause: error.cause,
            }
          : error,
      query: {
        values: transactionData,
      },
    });
    return false;
  }
}

export async function getMonthTransactions(
  month: Date,
  accountKey: string,
  parentTask: ListrTaskWrapper,
) {
  const monthKey = format(month, 'MM-yyyy');
  const originalTitle = parentTask.title;
  return new Listr<DiscountContext & { [accountKey: string]: { [monthKey: string]: Context } }>([
    {
      title: 'Get Transactions',
      task: async (ctx, task) => {
        if (!ctx[accountKey]) {
          task.skip('No account');
          return;
        }
        ctx[accountKey][monthKey] ??= {};
        const { logger } = ctx;

        const { scraper, nickname } = ctx[accountKey];
        try {
          const { transactions, accountNumber } = await scraper!.getMonthTransactions(month);

          if (!transactions.length) {
            task.skip('No data');
            ctx[accountKey].processedData ??= {};
            ctx[accountKey].processedData.transactions ??= 0;
            parentTask.title = originalTitle + ' (No data)';
            return;
          }

          ctx[accountKey][monthKey].transactions = transactions.map(transaction => ({
            ...transaction,
            account: accountNumber,
          }));
        } catch (error) {
          logger.error(`${accountKey} - Failed to get transactions: ${error}`);
          throw new Error(`Failed to get transactions for ${nickname} ${format(month, 'MM-yyyy')}`);
        }
      },
    },
    {
      title: 'Save Transactions',
      enabled: ctx => !!ctx[accountKey]?.[monthKey]?.transactions,
      task: async (ctx, task) => {
        if (!ctx[accountKey]) {
          task.skip('No account');
          return;
        }

        const { transactions = [] } = ctx[accountKey][monthKey] ?? {};
        if (transactions.length === 0) {
          task.skip('No new transactions');
          return;
        }

        try {
          await saveDiscountTransactionsToDB(transactions, ctx.pool, ctx.logger).then(saved => {
            parentTask.title = `${originalTitle} (${transactions.length} new transactions inserted)`;
            ctx[accountKey].processedData ??= {};
            ctx[accountKey].processedData.insertedTransactions ??= 0;
            ctx[accountKey].processedData.insertedTransactions += saved;
          });
        } catch (error) {
          ctx.logger.error(`${accountKey} - Failed to save transactions: ${error}`);
          throw new Error(`Failed to save transactions for ${accountKey}`);
        }
      },
    },
  ]);
}
