import { format } from 'date-fns';
import Listr, { ListrTaskWrapper } from 'listr';
import type { Pool } from 'pg';
import type { IsracardCardsTransactionsList } from '@accounter/modern-israeli-scrapers/dist/__generated__/isracardCardsTransactionsList.js';
import { sql } from '@pgtyped/runtime';
import { normalizeCurrencySymbol } from '../../helpers/currency.js';
import type {
  IInsertCalTransactionsParams,
  IInsertCalTransactionsQuery,
} from '../../helpers/types.js';
import type { Logger } from '../../logger.js';
import type { CalAccountContext, CalContext } from './index.js';

type Transaction = Awaited<
  ReturnType<NonNullable<CalAccountContext['scraper']>['getMonthTransactions']>
>[number];
type DecoratedTransaction = Transaction & { card: string };
type Context = {
  transactionsListBean?: IsracardCardsTransactionsList['CardsTransactionsListBean'];
  transactions?: Array<DecoratedTransaction>;
};

const insertCalTransactions = sql<IInsertCalTransactionsQuery>`
  INSERT INTO accounter_schema.cal_creditcard_transactions (card,
                                            trn_int_id,
                                            trn_numaretor,
                                            merchant_name,
                                            trn_purchase_date,
                                            trn_amt,
                                            trn_currency_symbol,
                                            trn_type,
                                            trn_type_code,
                                            deb_crd_date,
                                            amt_before_conv_and_index,
                                            deb_crd_currency_symbol,
                                            merchant_address,
                                            merchant_phone_no,
                                            branch_code_desc,
                                            trans_card_present_ind,
                                            cur_payment_num,
                                            num_of_payments,
                                            token_ind,
                                            wallet_provider_code,
                                            wallet_provider_desc,
                                            token_number_part4,
                                            cash_account_trn_amt,
                                            charge_external_to_card_comment,
                                            refund_ind,
                                            is_immediate_comment_ind,
                                            is_immediate_hhk_ind,
                                            is_margarita,
                                            is_spread_paymenst_abroad,
                                            trn_exac_way,
                                            debit_spread_ind,
                                            on_going_transactions_comment,
                                            early_payment_ind,
                                            merchant_id,
                                            crd_ext_id_num_type_code,
                                            trans_source,
                                            is_abroad_transaction)
  VALUES $transaction(card,
                      trnIntId,
                      trnNumaretor,
                      merchantName,
                      trnPurchaseDate,
                      trnAmt,
                      trnCurrencySymbol,
                      trnType,
                      trnTypeCode,
                      debCrdDate,
                      amtBeforeConvAndIndex,
                      debCrdCurrencySymbol,
                      merchantAddress,
                      merchantPhoneNo,
                      branchCodeDesc,
                      transCardPresentInd,
                      curPaymentNum,
                      numOfPayments,
                      tokenInd,
                      walletProviderCode,
                      walletProviderDesc,
                      tokenNumberPart4,
                      cashAccountTrnAmt,
                      chargeExternalToCardComment,
                      refundInd,
                      isImmediateCommentInd,
                      isImmediateHhkInd,
                      isMargarita,
                      isSpreadPaymenstAbroad,
                      trnExacWay,
                      debitSpreadInd,
                      onGoingTransactionsComment,
                      earlyPaymentInd,
                      merchantId,
                      crdExtIdNumTypeCode,
                      transSource,
                      isAbroadTransaction)
  RETURNING *;`;

export async function saveCalTransactionsToDB(
  transactions: DecoratedTransaction[],
  pool: Pool,
  logger: Logger,
): Promise<number> {
  let saved = 0;
  for (const transaction of transactions) {
    await saveCalTransaction(transaction, pool, logger).then(success => (saved += success ? 1 : 0));
  }
  return saved;
}

async function saveCalTransaction(
  transaction: DecoratedTransaction,
  pool: Pool,
  logger: Logger,
): Promise<boolean> {
  const transactionData: IInsertCalTransactionsParams['transaction'] = {
    card: Number(transaction.card),
    trnIntId: transaction.trnIntId,
    trnNumaretor: transaction.trnNumaretor,
    merchantName: transaction.merchantName,
    trnPurchaseDate: format(new Date(transaction.trnPurchaseDate), 'yyyy-MM-dd'),
    trnAmt: transaction.trnAmt,
    trnCurrencySymbol: normalizeCurrencySymbol(transaction.trnCurrencySymbol),
    trnType: transaction.trnType,
    trnTypeCode: transaction.trnTypeCode,
    debCrdDate: format(new Date(transaction.debCrdDate), 'yyyy-MM-dd'),
    amtBeforeConvAndIndex: transaction.amtBeforeConvAndIndex,
    debCrdCurrencySymbol: normalizeCurrencySymbol(transaction.debCrdCurrencySymbol),
    merchantAddress: transaction.merchantAddress,
    merchantPhoneNo: transaction.merchantPhoneNo,
    branchCodeDesc: transaction.branchCodeDesc,
    transCardPresentInd: transaction.transCardPresentInd,
    curPaymentNum: transaction.curPaymentNum,
    numOfPayments: transaction.numOfPayments,
    tokenInd: transaction.tokenInd,
    walletProviderCode: transaction.walletProviderCode,
    walletProviderDesc: transaction.walletProviderDesc,
    tokenNumberPart4: transaction.tokenNumberPart4,
    cashAccountTrnAmt: transaction.cashAccountTrnAmt,
    chargeExternalToCardComment: transaction.chargeExternalToCardComment,
    refundInd: transaction.refundInd,
    isImmediateCommentInd: transaction.isImmediateCommentInd,
    isImmediateHhkInd: transaction.isImmediateHHKInd,
    isMargarita: transaction.isMargarita,
    isSpreadPaymenstAbroad: transaction.isSpreadPaymenstAbroad,
    trnExacWay: transaction.trnExacWay,
    debitSpreadInd: transaction.debitSpreadInd,
    onGoingTransactionsComment: transaction.onGoingTransactionsComment,
    earlyPaymentInd: transaction.earlyPaymentInd,
    merchantId: transaction.merchantId,
    crdExtIdNumTypeCode: transaction.crdExtIdNumTypeCode,
    transSource: transaction.transSource,
    isAbroadTransaction: transaction.isAbroadTransaction,
  };

  try {
    await insertCalTransactions.run({ transaction: transactionData }, pool);
    logger.log(
      `Success in insert to Cal - ${transaction.merchantName} - ${transaction.trnAmt} ${transaction.trnCurrencySymbol}`,
    );
    return true;
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes('duplicate key value violates unique constraint')
    ) {
      logger.log('Duplicate key violation, skipping insert', { id: transaction.trnIntId });
      return false;
    }

    logger.error('Error in Cal insert:', {
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
  return new Listr<CalContext & { [accountKey: string]: { [monthKey: string]: Context } }>([
    {
      title: 'Get Transactions',
      task: async (ctx, task) => {
        if (!ctx[accountKey]) {
          task.skip('No account');
          return;
        }

        ctx[accountKey][monthKey] ??= {};
        const { logger } = ctx;

        const { scraper } = ctx[accountKey];
        try {
          const transactions = await scraper!.getMonthTransactions(accountKey, month);

          if (!transactions.length) {
            task.skip('No data');
            ctx[accountKey].processedData ??= {};
            ctx[accountKey].processedData.transactions ??= 0;
            parentTask.title = originalTitle + ' (No data)';
            return;
          }

          ctx[accountKey][monthKey].transactions = transactions.map(transaction => ({
            ...transaction,
            card: accountKey,
          }));
        } catch (error) {
          logger.error(`CAL ${accountKey} - Failed to get transactions: ${error}`);
          throw new Error(
            `Failed to get transactions for CAL ${accountKey} ${format(month, 'MM-yyyy')}`,
          );
        }
      },
    },
    {
      title: 'Save Transactions',
      enabled: ctx => !!ctx[accountKey]?.[monthKey]?.transactions,
      task: async (ctx, task) => {
        const { transactions = [] } = ctx[accountKey]?.[monthKey] ?? {};
        if (transactions.length === 0) {
          task.skip('No new transactions');
          return;
        }

        try {
          await saveCalTransactionsToDB(transactions, ctx.pool, ctx.logger).then(saved => {
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
