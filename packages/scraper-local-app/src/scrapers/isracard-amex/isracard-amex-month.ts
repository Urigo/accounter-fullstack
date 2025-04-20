import { differenceInMonths, format } from 'date-fns';
import Listr, { ListrTaskWrapper } from 'listr';
import type { Pool } from 'pg';
import type {
  Index,
  IsracardCardsTransactionsList,
} from '@accounter/modern-israeli-scrapers/dist/__generated__/isracardCardsTransactionsList.js';
import { sql, type TaggedQuery } from '@pgtyped/runtime';
import {
  camelCase,
  fillInDefaultValues,
  isSameTransaction,
  newAttributesChecker,
  reverse,
} from '../../helpers/misc.js';
import type {
  IGetAmexTransactionsQuery,
  IGetIsracardTransactionsQuery,
  IInsertAmexTransactionsParams,
  IInsertAmexTransactionsQuery,
  IInsertIsracardTransactionsParams,
  IInsertIsracardTransactionsQuery,
} from '../../helpers/types.js';
import type { Logger } from '../../logger.js';
import type { IsracardAmexAccountContext, IsracardAmexContext } from './index.js';

type Context = {
  transactionsListBean?: IsracardCardsTransactionsList['CardsTransactionsListBean'];
  transactions?: Array<DecoratedTransaction>;
  newTransactions?: Array<DecoratedTransaction>;
};
type Transaction =
  | NonNullable<Index['CurrentCardTransactions'][number]['txnAbroad']>[number]
  | NonNullable<Index['CurrentCardTransactions'][number]['txnIsrael']>[number];
type DecoratedTransaction = Transaction & { card: string };
type InsertionTransactionParams =
  | IInsertAmexTransactionsParams['transactions'][number]
  | IInsertIsracardTransactionsParams['transactions'][number];

const getIsracardTransactions = sql<IGetIsracardTransactionsQuery>`
  SELECT * FROM accounter_schema.isracard_creditcard_transactions
  WHERE card = $card
    AND (CASE WHEN $fullPurchaseDateOutbound::TEXT IS NULL THEN full_purchase_date_outbound IS NULL ELSE full_purchase_date_outbound = $fullPurchaseDateOutbound END)
    AND (CASE WHEN $fullPurchaseDate::TEXT IS NULL THEN full_purchase_date IS NULL ELSE full_purchase_date = $fullPurchaseDate END)
    AND (CASE WHEN $fullPaymentDate::TEXT IS NULL THEN full_payment_date IS NULL ELSE full_payment_date = $fullPaymentDate END)
    AND (CASE WHEN $supplierId::INTEGER IS NULL THEN supplier_id IS NULL ELSE supplier_id = $supplierId END)
    AND (CASE WHEN $fullSupplierNameOutbound::VARCHAR IS NULL THEN full_supplier_name_outbound IS NULL ELSE full_supplier_name_outbound = $fullSupplierNameOutbound END)
    AND (CASE WHEN $voucherNumber::INTEGER IS NULL THEN voucher_number IS NULL ELSE voucher_number = $voucherNumber END)
    AND (CASE WHEN $moreInfo::VARCHAR IS NULL THEN more_info IS NULL ELSE more_info = $moreInfo END)
    AND (CASE WHEN $currentPaymentCurrency::VARCHAR IS NULL THEN current_payment_currency IS NULL ELSE current_payment_currency = $currentPaymentCurrency END)
    AND (CASE WHEN $paymentSum::NUMERIC IS NULL THEN payment_sum IS NULL ELSE payment_sum = $paymentSum END)
    AND (CASE WHEN $paymentSumOutbound::NUMERIC IS NULL THEN payment_sum_outbound IS NULL ELSE payment_sum_outbound = $paymentSumOutbound END);`;

const getAmexTransactions = sql<IGetAmexTransactionsQuery>`
  SELECT * FROM accounter_schema.amex_creditcard_transactions
  WHERE card = $card
    AND (CASE WHEN $fullPurchaseDateOutbound::TEXT IS NULL THEN full_purchase_date_outbound IS NULL ELSE full_purchase_date_outbound = $fullPurchaseDateOutbound END)
    AND (CASE WHEN $fullPurchaseDate::TEXT IS NULL THEN full_purchase_date IS NULL ELSE full_purchase_date = $fullPurchaseDate END)
    AND (CASE WHEN $fullPaymentDate::TEXT IS NULL THEN full_payment_date IS NULL ELSE full_payment_date = $fullPaymentDate END)
    AND (CASE WHEN $supplierId::INTEGER IS NULL THEN supplier_id IS NULL ELSE supplier_id = $supplierId END)
    AND (CASE WHEN $fullSupplierNameOutbound::VARCHAR IS NULL THEN full_supplier_name_outbound IS NULL ELSE full_supplier_name_outbound = $fullSupplierNameOutbound END)
    AND (CASE WHEN $voucherNumber::INTEGER IS NULL THEN voucher_number IS NULL ELSE voucher_number = $voucherNumber END)
    AND (CASE WHEN $moreInfo::VARCHAR IS NULL THEN more_info IS NULL ELSE more_info = $moreInfo END)
    AND (CASE WHEN $currentPaymentCurrency::VARCHAR IS NULL THEN current_payment_currency IS NULL ELSE current_payment_currency = $currentPaymentCurrency END)
    AND (CASE WHEN $paymentSum::NUMERIC IS NULL THEN payment_sum IS NULL ELSE payment_sum = $paymentSum END)
    AND (CASE WHEN $paymentSumOutbound::NUMERIC IS NULL THEN payment_sum_outbound IS NULL ELSE payment_sum_outbound = $paymentSumOutbound END);`;

const insertIsracardTransactions = sql<IInsertIsracardTransactionsQuery>`
  INSERT INTO accounter_schema.isracard_creditcard_transactions (specific_date,
                                                card_index,
                                                deals_inbound,
                                                supplier_id,
                                                supplier_name,
                                                deal_sum_type,
                                                payment_sum_sign,
                                                purchase_date,
                                                full_purchase_date,
                                                more_info,
                                                horaat_keva,
                                                voucher_number,
                                                voucher_number_ratz,
                                                solek,
                                                purchase_date_outbound,
                                                full_purchase_date_outbound,
                                                currency_id,
                                                current_payment_currency,
                                                city,
                                                supplier_name_outbound,
                                                full_supplier_name_outbound,
                                                payment_date,
                                                full_payment_date,
                                                is_show_deals_outbound,
                                                adendum,
                                                voucher_number_ratz_outbound,
                                                is_show_link_for_supplier_details,
                                                deal_sum,
                                                payment_sum,
                                                full_supplier_name_heb,
                                                deal_sum_outbound,
                                                payment_sum_outbound,
                                                is_horaat_keva,
                                                stage,
                                                return_code,
                                                message,
                                                return_message,
                                                display_properties,
                                                table_page_num,
                                                is_error,
                                                is_captcha,
                                                is_button,
                                                site_name,
                                                client_ip_address,
                                                card,
                                                charging_date,
                                                kod_matbea_mekori)
  VALUES $$transactions(specificDate,
                        cardIndex,
                        dealsInbound,
                        supplierId,
                        supplierName,
                        dealSumType,
                        paymentSumSign,
                        purchaseDate,
                        fullPurchaseDate,
                        moreInfo,
                        horaatKeva,
                        voucherNumber,
                        voucherNumberRatz,
                        solek,
                        purchaseDateOutbound,
                        fullPurchaseDateOutbound,
                        currencyId,
                        currentPaymentCurrency,
                        city,
                        supplierNameOutbound,
                        fullSupplierNameOutbound,
                        paymentDate,
                        fullPaymentDate,
                        isShowDealsOutbound,
                        adendum,
                        voucherNumberRatzOutbound,
                        isShowLinkForSupplierDetails,
                        dealSum,
                        paymentSum,
                        fullSupplierNameHeb,
                        dealSumOutbound,
                        paymentSumOutbound,
                        isHoraatKeva,
                        stage,
                        returnCode,
                        message,
                        returnMessage,
                        displayProperties,
                        tablePageNum,
                        isError,
                        isCaptcha,
                        isButton,
                        siteName,
                        clientIpAddress,
                        card,
                        chargingDate,
                        kodMatbeaMekori)
  RETURNING *;`;

const insertAmexTransactions = sql<IInsertAmexTransactionsQuery>`
  INSERT INTO accounter_schema.amex_creditcard_transactions (specific_date,
                                                card_index,
                                                deals_inbound,
                                                supplier_id,
                                                supplier_name,
                                                deal_sum_type,
                                                payment_sum_sign,
                                                purchase_date,
                                                full_purchase_date,
                                                more_info,
                                                horaat_keva,
                                                voucher_number,
                                                voucher_number_ratz,
                                                solek,
                                                purchase_date_outbound,
                                                full_purchase_date_outbound,
                                                currency_id,
                                                current_payment_currency,
                                                city,
                                                supplier_name_outbound,
                                                full_supplier_name_outbound,
                                                payment_date,
                                                full_payment_date,
                                                is_show_deals_outbound,
                                                adendum,
                                                voucher_number_ratz_outbound,
                                                is_show_link_for_supplier_details,
                                                deal_sum,
                                                payment_sum,
                                                full_supplier_name_heb,
                                                deal_sum_outbound,
                                                payment_sum_outbound,
                                                is_horaat_keva,
                                                stage,
                                                return_code,
                                                message,
                                                return_message,
                                                display_properties,
                                                table_page_num,
                                                is_error,
                                                is_captcha,
                                                is_button,
                                                site_name,
                                                client_ip_address,
                                                card,
                                                charging_date,
                                                kod_matbea_mekori)
  VALUES $$transactions(specificDate,
                        cardIndex,
                        dealsInbound,
                        supplierId,
                        supplierName,
                        dealSumType,
                        paymentSumSign,
                        purchaseDate,
                        fullPurchaseDate,
                        moreInfo,
                        horaatKeva,
                        voucherNumber,
                        voucherNumberRatz,
                        solek,
                        purchaseDateOutbound,
                        fullPurchaseDateOutbound,
                        currencyId,
                        currentPaymentCurrency,
                        city,
                        supplierNameOutbound,
                        fullSupplierNameOutbound,
                        paymentDate,
                        fullPaymentDate,
                        isShowDealsOutbound,
                        adendum,
                        voucherNumberRatzOutbound,
                        isShowLinkForSupplierDetails,
                        dealSum,
                        paymentSum,
                        fullSupplierNameHeb,
                        dealSumOutbound,
                        paymentSumOutbound,
                        isHoraatKeva,
                        stage,
                        returnCode,
                        message,
                        returnMessage,
                        displayProperties,
                        tablePageNum,
                        isError,
                        isCaptcha,
                        isButton,
                        siteName,
                        clientIpAddress,
                        card,
                        chargingDate,
                        kodMatbeaMekori)
  RETURNING *;`;

async function isTransactionNew(
  transaction: DecoratedTransaction,
  context: IsracardAmexAccountContext,
  pool: Pool,
  logger: Logger,
): Promise<boolean> {
  const { columns, type, nickname } = context;
  const columnNames = columns!.map(column => camelCase(column.column_name));
  const optionalTransactionKeys = [
    'clientIpAddress',
    'bcKey',
    'chargingDate',
    'requestNumber',
    'accountErrorCode',
    'id',
  ];
  newAttributesChecker(transaction, columnNames, logger, nickname, optionalTransactionKeys);

  // fill in default values for missing keys, to prevent missing preexisting DB records and creation of duplicates
  fillInDefaultValues(transaction, columns!, logger, context.nickname);

  let existingTransactionsChecker: TaggedQuery<
    IGetIsracardTransactionsQuery | IGetAmexTransactionsQuery
  >;
  switch (type) {
    case 'ISRACARD':
      existingTransactionsChecker = getIsracardTransactions;
      break;
    case 'AMEX':
      existingTransactionsChecker = getAmexTransactions;
      break;
    default:
      throw new Error('Invalid creditcard type');
  }

  try {
    const res = await existingTransactionsChecker.run(
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
      'formattedEventAmount',
      'formattedCurrentBalance',
      'cardIndex',
      'kodMatbeaMekori',
      'id',
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
  context: IsracardAmexAccountContext,
  pool: Pool,
  logger: Logger,
) {
  const { type, nickname } = context;
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
      specificDate: transaction.specificDate,
      cardIndex: Number(transaction.cardIndex),
      dealsInbound: transaction.dealsInbound,
      supplierId: transaction.supplierId ? Number(transaction.supplierId) : null,
      supplierName: transaction.supplierName,
      dealSumType: transaction.dealSumType,
      paymentSumSign: transaction.paymentSumSign,
      purchaseDate: transaction.purchaseDate,
      fullPurchaseDate: transaction.fullPurchaseDate,
      moreInfo: transaction.moreInfo,
      horaatKeva: transaction.horaatKeva,
      voucherNumber: transaction.voucherNumber ? Number(transaction.voucherNumber) : null,
      voucherNumberRatz: transaction.voucherNumberRatz
        ? Number(transaction.voucherNumberRatz)
        : null,
      solek: transaction.solek,
      purchaseDateOutbound: transaction.purchaseDateOutbound,
      fullPurchaseDateOutbound: transaction.fullPurchaseDateOutbound,
      currencyId: transaction.currencyId,
      currentPaymentCurrency: transaction.currentPaymentCurrency,
      city: transaction.city,
      supplierNameOutbound: transaction.supplierNameOutbound,
      fullSupplierNameOutbound: transaction.fullSupplierNameOutbound,
      paymentDate: transaction.paymentDate,
      fullPaymentDate: transaction.fullPaymentDate,
      isShowDealsOutbound: transaction.isShowDealsOutbound,
      adendum: transaction.adendum,
      voucherNumberRatzOutbound: transaction.voucherNumberRatzOutbound
        ? Number(transaction.voucherNumberRatzOutbound)
        : null,
      isShowLinkForSupplierDetails: transaction.isShowLinkForSupplierDetails,
      dealSum: transaction.dealSum,
      paymentSum: transaction.paymentSum,
      fullSupplierNameHeb: transaction.fullSupplierNameHeb,
      dealSumOutbound: transaction.dealSumOutbound,
      paymentSumOutbound: transaction.paymentSumOutbound,
      isHoraatKeva: transaction.isHoraatKeva,
      stage: transaction.stage,
      returnCode: transaction.returnCode,
      message: transaction.message,
      returnMessage: transaction.returnMessage,
      displayProperties: transaction.displayProperties,
      tablePageNum: Number(transaction.tablePageNum) as unknown as boolean,
      isError: transaction.isError,
      isCaptcha: transaction.isCaptcha,
      isButton: transaction.isButton,
      siteName: transaction.siteName,
      clientIpAddress: transaction.clientIpAddress ?? null,
      card: Number(transaction.card),
      chargingDate: null,
      kodMatbeaMekori: transaction.kodMatbeaMekori ?? null,
    };
    transactionsToInsert.push(transactionToInsert);
  }
  if (transactionsToInsert.length > 0) {
    let insertTransactions: TaggedQuery<
      IInsertAmexTransactionsQuery | IInsertIsracardTransactionsQuery
    >;
    switch (type) {
      case 'AMEX':
        insertTransactions = insertAmexTransactions;
        break;
      case 'ISRACARD':
        insertTransactions = insertIsracardTransactions;
        break;
      default:
        throw new Error(`Invalid creditcard type: ${type}`);
    }
    try {
      const res = await insertTransactions.run({ transactions: transactionsToInsert }, pool);
      res.map(transaction => {
        const supplierName = transaction.supplier_name
          ? reverse(transaction.supplier_name)
          : transaction.supplier_name_outbound;
        logger.log(
          `success in insert to ${transaction.card} - ${transaction.payment_sum ?? transaction.payment_sum_outbound} - ${supplierName} - ${transaction.full_purchase_date ?? transaction.full_purchase_date_outbound}`,
          transaction.full_purchase_date,
        );
      });
    } catch (error) {
      logger.error(`Failed to insert ${type} ${nickname} transactions`, error);
      throw new Error('Failed to insert transactions');
    }
  }
}

export async function getMonthTransactions(
  month: Date,
  accountKey: string,
  parentTask: ListrTaskWrapper,
) {
  const monthKey = format(month, 'MM-yyyy');
  const originalTitle = parentTask.title;
  return new Listr<IsracardAmexContext & { [accountKey: string]: { [monthKey: string]: Context } }>(
    [
      {
        title: 'Get Transactions',
        task: async (ctx, task) => {
          ctx[accountKey][monthKey] ??= {};
          const { logger } = ctx;
          const { scraper, type, nickname } = ctx[accountKey];
          try {
            const monthTransactions = await scraper!.getMonthTransactions(month);

            if (!monthTransactions.isValid) {
              if ('errors' in monthTransactions) {
                logger.error(monthTransactions.errors);
              }
              throw new Error(
                `Invalid transactions data for ${type} ${nickname} ${format(month, 'MM-yyyy')}`,
              );
            }

            if (!monthTransactions.data) {
              task.skip('No data');
              ctx[accountKey].processedData ??= {};
              ctx[accountKey].processedData.transactions ??= 0;
              parentTask.title = originalTitle + ' (No data)';
              return;
            }

            if (monthTransactions?.data?.Header?.Status !== '1') {
              logger.log(JSON.stringify(monthTransactions.data?.Header));
              throw new Error(
                `Replace password for ${type} ${nickname} ${format(month, 'MM-yyyy')}`,
              );
            }

            ctx[accountKey][monthKey].transactionsListBean =
              monthTransactions.data.CardsTransactionsListBean;
          } catch (error) {
            logger.error(`Failed to get transactions: ${error}`);
            throw new Error(
              `Failed to get transactions for ${type} ${nickname} ${format(month, 'MM-yyyy')}`,
            );
          }
        },
      },
      {
        title: 'Normalize Transactions',
        enabled: ctx => !!ctx[accountKey][monthKey]?.transactionsListBean,
        task: async (ctx, task) => {
          const { transactionsListBean } = ctx[accountKey][monthKey];
          const normalizedTransactions: Array<DecoratedTransaction> = [];
          const cardNumberMapping = ctx[accountKey].options?.cardNumberMapping;
          const cardNumbersToMap = cardNumberMapping ? Object.keys(cardNumberMapping) : [];
          transactionsListBean?.cardNumberList.map((cardInformation, index) => {
            let card = cardInformation.slice(cardInformation.length - 4);
            if (cardNumberMapping && cardNumbersToMap.includes(card)) {
              card = cardNumberMapping[card];
            }

            const transactionsGroups =
              transactionsListBean[`Index${index}` as 'Index0'].CurrentCardTransactions;

            if (transactionsGroups) {
              transactionsGroups.map(txnGroup => {
                if (txnGroup.txnIsrael) {
                  txnGroup.txnIsrael.map(transaction => {
                    normalizedTransactions.push({
                      ...transaction,
                      card,
                    });
                  });
                }
                if (txnGroup.txnAbroad) {
                  txnGroup.txnAbroad.map(transaction => {
                    normalizedTransactions.push({
                      ...transaction,
                      card,
                    });
                  });
                }
              });
            }
          });

          const { acceptedCardNumbers } = ctx[accountKey].options ?? {};
          if (acceptedCardNumbers && acceptedCardNumbers.length > 0) {
            ctx[accountKey][monthKey].transactions = normalizedTransactions.filter(transaction =>
              acceptedCardNumbers.includes(transaction.card),
            );
          } else {
            ctx[accountKey][monthKey].transactions = normalizedTransactions;
          }

          parentTask.title = `${originalTitle} (${ctx[accountKey][monthKey].transactions.length} transactions)`;
          task.title =
            task.title + ` (${ctx[accountKey][monthKey].transactions.length} transactions)`;
          ctx[accountKey].processedData ??= {};
          ctx[accountKey].processedData.transactions ??= 0;
          ctx[accountKey].processedData.transactions +=
            ctx[accountKey][monthKey].transactions.length;
          return;
        },
      },
      {
        title: `Check for New Transactions`,
        skip: ctx =>
          ctx[accountKey][monthKey]?.transactions?.length === 0 ? 'No transactions' : undefined,
        task: async (ctx, task) => {
          try {
            const { transactions = [] } = ctx[accountKey][monthKey];
            const newTransactions: DecoratedTransaction[] = [];
            await Promise.all(
              transactions.map(async transaction => {
                if (await isTransactionNew(transaction, ctx[accountKey], ctx.pool, ctx.logger)) {
                  newTransactions.push(transaction);
                }
              }),
            );
            ctx[accountKey][monthKey].newTransactions = newTransactions;
            task.title = `${task.title} (${ctx[accountKey][monthKey].newTransactions?.length} new transactions)`;
            parentTask.title = `${originalTitle} (${ctx[accountKey][monthKey].newTransactions?.length} new transactions)`;
            ctx[accountKey].processedData ??= {};
            ctx[accountKey].processedData.newTransactions ??= 0;
            ctx[accountKey].processedData.newTransactions +=
              ctx[accountKey][monthKey].newTransactions.length;
          } catch (error) {
            ctx.logger.error(`Failed to save transactions: ${error}`);
            throw new Error(
              `Failed to check rather transactions are new for ${ctx[accountKey].type} ${ctx[accountKey].nickname}`,
            );
          }
        },
      },
      {
        title: 'Save Transactions',
        enabled: ctx => !!ctx[accountKey][monthKey]?.newTransactions,
        task: async (ctx, task) => {
          const { newTransactions = [] } = ctx[accountKey][monthKey];
          if (newTransactions.length === 0) {
            task.skip('No new transactions');
            return;
          }

          try {
            await insertTransactions(newTransactions, ctx[accountKey], ctx.pool, ctx.logger).then(
              () => {
                parentTask.title = `${originalTitle} (${newTransactions.length} new transactions inserted)`;
              },
            );
            ctx[accountKey].processedData ??= {};
            ctx[accountKey].processedData.insertedTransactions ??= 0;
            ctx[accountKey].processedData.insertedTransactions += newTransactions.length;
          } catch (error) {
            ctx.logger.error(`Failed to save transactions: ${error}`);
            throw new Error(
              `Failed to save transactions for ${ctx[accountKey].type} ${ctx[accountKey].nickname}`,
            );
          }
        },
      },
    ],
  );
}
