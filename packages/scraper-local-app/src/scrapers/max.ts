import { differenceInMonths, format } from 'date-fns';
import Listr, { type ListrTaskWrapper } from 'listr';
import type { Pool } from 'pg';
import type { init } from '@accounter/modern-poalim-scraper';
import { MaxTransaction } from '@accounter/modern-poalim-scraper/dist/scrapers/types/max/get-transactions-for-month.js';
import { sql } from '@pgtyped/runtime';
import {
  camelCase,
  fillInDefaultValues,
  isSameTransaction,
  newAttributesChecker,
} from '../helpers/misc.js';
import { getTableColumns } from '../helpers/sql.js';
import type {
  FilteredColumns,
  IGetMaxCreditcardTransactionsQuery,
  IInsertMaxCreditcardTransactionsParams,
  IInsertMaxCreditcardTransactionsQuery,
} from '../helpers/types.js';
import type { MainContext } from '../index.js';
import type { Logger } from '../logger.js';

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
  normalizedTransactions?: Array<NormalizedTransaction>;
  newTransactions?: Array<NormalizedTransaction>;
};

type Transaction = MaxTransaction;
type DecoratedTransaction = Transaction & { card: string };
type NormalizedTransaction = Omit<Transaction, 'dealData' | 'merchantData' | 'runtimeReference'> & {
  dealDataAcq: string | null;
  dealDataAdjustmentAmount: null;
  dealDataAdjustmentType: number | null;
  dealDataAmount: number | null;
  dealDataAmountIls: number | null;
  dealDataAmountLeft: number | null;
  dealDataArn: string | null;
  dealDataAuthorizationNumber: string | null;
  dealDataCardName: string | null;
  dealDataCardToken: string | null;
  dealDataCommissionVat: number | null;
  dealDataDirectExchange: null;
  dealDataExchangeCommissionAmount: null;
  dealDataExchangeCommissionMaam: null;
  dealDataExchangeCommissionType: null;
  dealDataExchangeDirect: string | null;
  dealDataExchangeRate: number | null;
  dealDataIndexRateBase: null;
  dealDataIndexRatePmt: null;
  dealDataInterestAmount: number | null;
  dealDataIsAllowedSpreadWithBenefit: boolean | null;
  dealDataIssuerCurrency: string | null;
  dealDataIssuerExchangeRate: null;
  dealDataOriginalTerm: string | null;
  dealDataPercentMaam: number | null;
  dealDataPlan: number | null;
  dealDataPosEntryEmv: number | null;
  dealDataProcessingDate: string | null;
  dealDataPurchaseAmount: null;
  dealDataPurchaseTime: string | null;
  dealDataRefNbr: string | null;
  dealDataShowCancelDebit: boolean | null;
  dealDataShowSpread: boolean | null;
  dealDataShowSpreadBenefitButton: boolean | null;
  dealDataShowSpreadButton: boolean | null;
  dealDataShowSpreadForLeumi: boolean | null;
  dealDataTdmCardToken: string | null;
  dealDataTdmTransactionType: number | null;
  dealDataTransactionType: number | null;
  dealDataTxnCode: number | null;
  dealDataUserName: string | null;
  dealDataWithdrawalCommissionAmount: null;
  merchantAddress: string | null;
  merchantCoordinates: null;
  merchantMaxPhone: boolean;
  merchant: string;
  merchantCommercialName: string | null;
  merchantNumber: string;
  merchantPhone: string;
  merchantTaxId: string;
  runtimeReferenceInternalId: string;
  runtimeReferenceType: number;
};

export type MaxContext = MainContext & {
  [accountKey: string]: MaxAccountContext;
};

const getMaxCreditcardTransactions = sql<IGetMaxCreditcardTransactionsQuery>`
  SELECT * FROM accounter_schema.max_creditcard_transactions
  WHERE short_card_number = $card
    AND actual_payment_amount = $actualPaymentAmount
    AND arn = $arn
    AND payment_date = $paymentDate
    AND purchase_date = $purchaseDate
    ;`;

const insertMaxCreditcardTransactions = sql<IInsertMaxCreditcardTransactionsQuery>`
INSERT INTO accounter_schema.max_creditcard_transactions (actual_payment_amount,
  arn,
  card_index,
  category_id,
  comments,
  deal_data_acq,
  deal_data_adjustment_amount,
  deal_data_adjustment_type,
  deal_data_amount,
  deal_data_amount_ils,
  deal_data_amount_left,
  deal_data_arn,
  deal_data_authorization_number,
  deal_data_card_name,
  deal_data_card_token,
  deal_data_commission_vat,
  deal_data_direct_exchange,
  deal_data_exchange_commission_amount,
  deal_data_exchange_commission_maam,
  deal_data_exchange_commission_type,
  deal_data_exchange_direct,
  deal_data_exchange_rate,
  deal_data_index_rate_base,
  deal_data_index_rate_pmt,
  deal_data_interest_amount,
  deal_data_is_allowed_spread_with_benefit,
  deal_data_issuer_currency,
  deal_data_issuer_exchange_rate,
  deal_data_original_term,
  deal_data_percent_maam,
  deal_data_plan,
  deal_data_pos_entry_emv,
  deal_data_processing_date,
  deal_data_purchase_amount,
  deal_data_purchase_time,
  deal_data_ref_nbr,
  deal_data_show_cancel_debit,
  deal_data_show_spread,
  deal_data_show_spread_benefit_button,
  deal_data_show_spread_button,
  deal_data_show_spread_for_leumi,
  deal_data_tdm_card_token,
  deal_data_tdm_transaction_type,
  deal_data_transaction_type,
  deal_data_txn_code,
  deal_data_user_name,
  deal_data_withdrawal_commission_amount,
  discount_key_amount,
  discount_key_rec_type,
  ethoca_ind,
  funds_transfer_comment,
  funds_transfer_receiver_or_transfer,
  is_register_ch,
  is_spreading_autorization_allowed,
  issuer_id,
  merchant_address,
  merchant_coordinates,
  merchant_max_phone,
  merchant,
  merchant_commercial_name,
  merchant_number,
  merchant_phone,
  merchant_tax_id,
  merchant_name,
  original_amount,
  original_currency,
  payment_currency,
  payment_date,
  plan_name,
  plan_type_id,
  promotion_amount,
  promotion_club,
  promotion_type,
  purchase_date,
  receipt_p_d_f,
  ref_index,
  runtime_reference_internal_id,
  runtime_reference_type,
  runtime_reference_id,
  short_card_number,
  spread_transaction_by_campain_ind,
  spread_transaction_by_campain_number,
  table_type,
  tag,
  uid,
  up_sale_for_transaction_result,
  user_index)
VALUES $$transactions(actualPaymentAmount,
  arn,
  cardIndex,
  categoryId,
  comments,
  dealDataAcq,
  dealDataAdjustmentAmount,
  dealDataAdjustmentType,
  dealDataAmount,
  dealDataAmountIls,
  dealDataAmountLeft,
  dealDataArn,
  dealDataAuthorizationNumber,
  dealDataCardName,
  dealDataCardToken,
  dealDataCommissionVat,
  dealDataDirectExchange,
  dealDataExchangeCommissionAmount,
  dealDataExchangeCommissionMaam,
  dealDataExchangeCommissionType,
  dealDataExchangeDirect,
  dealDataExchangeRate,
  dealDataIndexRateBase,
  dealDataIndexRatePmt,
  dealDataInterestAmount,
  dealDataIsAllowedSpreadWithBenefit,
  dealDataIssuerCurrency,
  dealDataIssuerExchangeRate,
  dealDataOriginalTerm,
  dealDataPercentMaam,
  dealDataPlan,
  dealDataPosEntryEmv,
  dealDataProcessingDate,
  dealDataPurchaseAmount,
  dealDataPurchaseTime,
  dealDataRefNbr,
  dealDataShowCancelDebit,
  dealDataShowSpread,
  dealDataShowSpreadBenefitButton,
  dealDataShowSpreadButton,
  dealDataShowSpreadForLeumi,
  dealDataTdmCardToken,
  dealDataTdmTransactionType,
  dealDataTransactionType,
  dealDataTxnCode,
  dealDataUserName,
  dealDataWithdrawalCommissionAmount,
  discountKeyAmount,
  discountKeyRecType,
  ethocaInd,
  fundsTransferComment,
  fundsTransferReceiverOrTransfer,
  isRegisterCh,
  isSpreadingAutorizationAllowed,
  issuerId,
  merchantAddress,
  merchantCoordinates,
  merchantMaxPhone,
  merchant,
  merchantCommercialName,
  merchantNumber,
  merchantPhone,
  merchantTaxId,
  merchantName,
  originalAmount,
  originalCurrency,
  paymentCurrency,
  paymentDate,
  planName,
  planTypeId,
  promotionAmount,
  promotionClub,
  promotionType,
  purchaseDate,
  receiptPDF,
  refIndex,
  runtimeReferenceInternalId,
  runtimeReferenceType,
  runtimeReferenceId,
  shortCardNumber,
  spreadTransactionByCampainInd,
  spreadTransactionByCampainNumber,
  tableType,
  tag,
  uid,
  upSaleForTransactionResult,
  userIndex)
RETURNING *;`;

async function isTransactionNew(
  transaction: NormalizedTransaction,
  context: MaxAccountContext,
  pool: Pool,
  logger: Logger,
): Promise<boolean> {
  const { columns, nickname } = context;
  const columnNames = columns!.map(column => camelCase(column.column_name));
  const optionalTransactionKeys = ['id'];
  newAttributesChecker(transaction, columnNames, logger, nickname, optionalTransactionKeys);

  // fill in default values for missing keys, to prevent missing preexisting DB records and creation of duplicates
  fillInDefaultValues(transaction, columns!, logger, context.nickname);

  try {
    const res = await getMaxCreditcardTransactions.run(
      {
        card: transaction.shortCardNumber,
        actualPaymentAmount: transaction.actualPaymentAmount ?? 0,
        arn: transaction.arn,
        paymentDate: transaction.paymentDate
          ? format(new Date(transaction.paymentDate), 'yyyy-MM-dd')
          : null,
        purchaseDate: format(new Date(transaction.purchaseDate), 'yyyy-MM-dd'),
      },
      pool,
    );

    const columnNamesToExcludeFromComparison: string[] = ['id', 'runtimeReferenceInternalId'];
    if (res.length > 0) {
      for (const dbTransaction of res) {
        if (
          isSameTransaction(
            {
              ...transaction,
              dealDataAmount: transaction.dealDataAmount
                ? Number(transaction.dealDataAmount.toFixed(2))
                : transaction.dealDataAmount,
              promotionAmount: transaction.promotionAmount
                ? Number(transaction.promotionAmount.toFixed(2))
                : transaction.promotionAmount,
            },
            dbTransaction,
            columns!,
            columnNamesToExcludeFromComparison,
            `yyyy-MM-dd'T'00:00:00`,
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
  transactions: NormalizedTransaction[],
  context: MaxAccountContext,
  pool: Pool,
  logger: Logger,
) {
  const { nickname } = context;
  const transactionsToInsert: Array<
    IInsertMaxCreditcardTransactionsParams['transactions'][number]
  > = [];
  for (const transaction of transactions) {
    if (differenceInMonths(new Date(), new Date(transaction.purchaseDate)) > 2) {
      logger.error('Was going to insert an old transaction!!', JSON.stringify(transaction));
      throw new Error('Old transaction');
    }

    const transactionToInsert: IInsertMaxCreditcardTransactionsParams['transactions'][number] = {
      ...transaction,
      actualPaymentAmount: transaction.actualPaymentAmount ?? 0,
      ethocaInd: transaction.ethocaInd ?? null,
      receiptPDF: transaction.receiptPDF ?? null,
      fundsTransferComment: transaction.fundsTransferComment ?? null,
      fundsTransferReceiverOrTransfer: transaction.fundsTransferReceiverOrTransfer ?? null,
      paymentDate: transaction.paymentDate ?? null,
    };
    transactionsToInsert.push(transactionToInsert);
  }
  if (transactionsToInsert.length > 0) {
    try {
      const res = await insertMaxCreditcardTransactions.run(
        {
          transactions: transactionsToInsert.map(t => ({
            ...t,
            actualPaymentAmount: t.actualPaymentAmount ?? 0,
            arn: t.arn ?? '',
            ethocaInd: t.ethocaInd ?? false,
            paymentDate: t.paymentDate ?? '1900-01-01',
            promotionClub: t.promotionClub ?? '',
            dealDataAcq: t.dealDataAcq ?? '',
            dealDataAmount: t.dealDataAmount ?? 0,
            dealDataAmountIls: t.dealDataAmountIls ?? 0,
            dealDataAmountLeft: t.dealDataAmountLeft ?? 0,
            dealDataArn: t.dealDataArn ?? '',
            dealDataCommissionVat: t.dealDataCommissionVat ?? 0,
            dealDataExchangeDirect: t.dealDataExchangeDirect ?? '',
            dealDataExchangeRate: t.dealDataExchangeRate ?? 0,
            dealDataInterestAmount: t.dealDataInterestAmount ?? 0,
            dealDataIssuerCurrency: t.dealDataIssuerCurrency ?? '',
            dealDataPlan: t.dealDataPlan ?? 0,
            dealDataProcessingDate: t.dealDataProcessingDate ?? '1900-01-01',
            dealDataRefNbr: t.dealDataRefNbr ?? '',
            dealDataTdmCardToken: t.dealDataTdmCardToken ?? '',
          })),
        },
        pool,
      );
      res.map(transaction => {
        logger.log(
          `success in insert to ${nickname}:${transaction.short_card_number} - ${transaction.actual_payment_amount} - ${transaction.merchant_name} - ${transaction.purchase_date.toISOString()}`,
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

        const normalizedTransactions: Array<NormalizedTransaction> = [];
        rawTransactions?.map(rawTransaction => {
          const {
            dealData,
            merchantData,
            runtimeReference,
            card: _card,
            ...transaction
          } = rawTransaction;
          normalizedTransactions.push({
            ...transaction,
            ethocaInd: (transaction.ethocaInd ? 1 : 0) as unknown as boolean,
            isRegisterCh: (transaction.isRegisterCh ? 1 : 0) as unknown as boolean,
            isSpreadingAutorizationAllowed: (transaction.isSpreadingAutorizationAllowed
              ? 1
              : 0) as unknown as boolean,
            spreadTransactionByCampainInd: (transaction.spreadTransactionByCampainInd
              ? 1
              : 0) as unknown as boolean,
            dealDataAcq: dealData?.acq ?? null,
            dealDataAdjustmentAmount: dealData?.adjustmentAmount ?? null,
            dealDataAdjustmentType: dealData?.adjustmentType ?? null,
            dealDataAmount: dealData?.amount ?? null,
            dealDataAmountIls: dealData?.amountIls ?? null,
            dealDataAmountLeft: dealData?.amountLeft ?? null,
            dealDataArn: dealData?.arn ?? null,
            dealDataAuthorizationNumber: dealData?.authorizationNumber ?? null,
            dealDataCardName: dealData?.cardName ?? null,
            dealDataCardToken: dealData?.cardToken ?? null,
            dealDataCommissionVat: dealData?.commissionVat ?? null,
            dealDataDirectExchange: dealData?.directExchange ?? null,
            dealDataExchangeCommissionAmount: dealData?.exchangeCommissionAmount ?? null,
            dealDataExchangeCommissionMaam: dealData?.exchangeCommissionMaam ?? null,
            dealDataExchangeCommissionType: dealData?.exchangeCommissionType ?? null,
            dealDataExchangeDirect: dealData?.exchangeDirect ?? null,
            dealDataExchangeRate: dealData?.exchangeRate ?? null,
            dealDataIndexRateBase: dealData?.indexRateBase ?? null,
            dealDataIndexRatePmt: dealData?.indexRatePmt ?? null,
            dealDataInterestAmount: dealData?.interestAmount ?? null,
            dealDataIsAllowedSpreadWithBenefit:
              dealData?.isAllowedSpreadWithBenefit == null
                ? null
                : ((dealData.isAllowedSpreadWithBenefit ? 1 : 0) as unknown as boolean),
            dealDataIssuerCurrency: dealData?.issuerCurrency ?? null,
            dealDataIssuerExchangeRate: dealData?.issuerExchangeRate ?? null,
            dealDataOriginalTerm: dealData?.originalTerm ? dealData?.originalTerm.toString() : null,
            dealDataPercentMaam: dealData?.percentMaam ?? null,
            dealDataPlan: dealData?.plan ?? null,
            dealDataPosEntryEmv: dealData?.posEntryEmv ?? null,
            dealDataProcessingDate: dealData?.processingDate ?? null,
            dealDataPurchaseAmount: dealData?.purchaseAmount ?? null,
            dealDataPurchaseTime: dealData?.purchaseTime ?? null,
            dealDataRefNbr: dealData?.refNbr ?? null,
            dealDataShowCancelDebit:
              dealData?.showCancelDebit == null
                ? null
                : ((dealData.showCancelDebit ? 1 : 0) as unknown as boolean),
            dealDataShowSpread:
              dealData?.showSpread == null
                ? null
                : ((dealData.showSpread ? 1 : 0) as unknown as boolean),
            dealDataShowSpreadBenefitButton:
              dealData?.showSpreadBenefitButton == null
                ? null
                : ((dealData.showSpreadBenefitButton ? 1 : 0) as unknown as boolean),
            dealDataShowSpreadButton:
              dealData?.showSpreadButton == null
                ? null
                : ((dealData.showSpreadButton ? 1 : 0) as unknown as boolean),
            dealDataShowSpreadForLeumi:
              dealData?.showSpreadForLeumi == null
                ? null
                : ((dealData.showSpreadForLeumi ? 1 : 0) as unknown as boolean),
            dealDataTdmCardToken: dealData?.tdmCardToken ?? null,
            dealDataTdmTransactionType: dealData?.tdmTransactionType ?? null,
            dealDataTransactionType: dealData?.transactionType ?? null,
            dealDataTxnCode: dealData?.txnCode ?? null,
            dealDataUserName: dealData?.userName ?? null,
            dealDataWithdrawalCommissionAmount: dealData?.withdrawalCommissionAmount ?? null,

            merchantAddress: merchantData.address,
            merchantCoordinates: merchantData.coordinates,
            merchantMaxPhone: (merchantData.maxPhone ? 1 : 0) as unknown as boolean,
            merchant: merchantData.merchant,
            merchantCommercialName: merchantData.merchantCommercialName,
            merchantNumber: merchantData.merchantNumber,
            merchantPhone: merchantData.merchantPhone,
            merchantTaxId: merchantData.merchantTaxId ?? '',

            runtimeReferenceInternalId: runtimeReference.id,
            runtimeReferenceType: runtimeReference.type,
          });
        });

        ctx[accountKey].normalizedTransactions = normalizedTransactions;

        task.title =
          task.title + ` (${ctx[accountKey].normalizedTransactions.length} transactions)`;
        return;
      },
    },
    {
      title: `Check for New Transactions`,
      skip: ctx =>
        ctx[accountKey].normalizedTransactions?.length === 0 ? 'No transactions' : undefined,
      task: async (ctx, task) => {
        try {
          const { normalizedTransactions = [] } = ctx[accountKey];
          const newTransactions: NormalizedTransaction[] = [];
          await Promise.all(
            normalizedTransactions.map(async transaction => {
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
          status += `${status.length ? ', ' : ''}Nothing New`;
        } else if (ctx[accountKey].newTransactions) {
          status += `${status.length ? ', ' : ''}${ctx[accountKey].newTransactions.length} New`;
        }
        if (status !== '') {
          parentTask.title = `${parentTask.title} (${status})`;
        }
        return;
      },
    },
  ]);
}
