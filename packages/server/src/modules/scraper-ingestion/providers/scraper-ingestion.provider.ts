import { Injectable, Scope } from 'graphql-modules';
import { sql } from '@pgtyped/runtime';
import type {
  CalTransactionInput,
  ChangedField,
  ChangedTransaction,
  CurrencyRateInput,
  DiscountTransactionInput,
  InsertedTransactionSummary,
  MaxTransactionInput,
  ScraperUploadResult,
} from '../../../__generated__/types.js';
import { dateToTimelessDateString } from '../../../shared/helpers/index.js';
import { TimelessDateString } from '../../../shared/types/index.js';
import { TenantAwareDBClient } from '../../app-providers/tenant-db-client.js';
import { FiatExchangeProvider } from '../../exchange-rates/providers/fiat-exchange.provider.js';
import { IGetExchangeRatesByDatesResult } from '../../exchange-rates/types.js';
import { formatValue } from '../helpers/utils.helper.js';
import {
  validateCalTransactions,
  validateDiscountTransactions,
  validateMaxTransactions,
  validateRates,
} from '../helpers/validators.helper.js';
import type {
  IUploadCalTransactionsQuery,
  IUploadCurrencyRatesParams,
  IUploadCurrencyRatesQuery,
  IUploadDiscountTransactionsQuery,
  IUploadMaxTransactionsQuery,
} from '../types.js';

const uploadCalTransactions = sql<IUploadCalTransactionsQuery>`
  INSERT INTO accounter_schema.cal_creditcard_transactions (
    card,
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
    is_abroad_transaction
  )
  VALUES $$transactions(
    card,
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
    isAbroadTransaction
  )
  ON CONFLICT (trn_int_id) DO NOTHING
  RETURNING id, trn_purchase_date, merchant_name, trn_amt, card;
`;

const uploadDiscountTransactions = sql<IUploadDiscountTransactionsQuery>`
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
    is_last_seen
  )
  VALUES $$transactions(
    operationDate,
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
    isLastSeen
  )
  ON CONFLICT (urn, account_number) WHERE urn IS NOT NULL AND account_number IS NOT NULL DO NOTHING
  RETURNING id, operation_date, operation_description, operation_amount, account_number;
`;

const uploadMaxTransactions = sql<IUploadMaxTransactionsQuery>`
  INSERT INTO accounter_schema.max_creditcard_transactions (
    actual_payment_amount,
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
    user_index
  )
  VALUES $$transactions(
    actualPaymentAmount,
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
    userIndex
  )
  ON CONFLICT (uid, arn, purchase_date, payment_date, original_amount) DO NOTHING
  RETURNING id, purchase_date, merchant_name, actual_payment_amount, card_index;
`;

const uploadCurrencyRates = sql<IUploadCurrencyRatesQuery>`
  INSERT INTO accounter_schema.exchange_rates (
    exchange_date,
    aud,
    cad,
    eur,
    gbp,
    jpy,
    sek,
    uah,
    usd
  )
  VALUES $$rates(
    exchangeDate,
    aud,
    cad,
    eur,
    gbp,
    jpy,
    sek,
    uah,
    usd
  )
  ON CONFLICT (exchange_date) DO NOTHING
  RETURNING exchange_date, usd, eur, gbp, cad, jpy, aud, sek, uah;
`;

function diffExchangeRatesRow<T extends IGetExchangeRatesByDatesResult>(
  existing: T,
  incoming: IUploadCurrencyRatesParams['rates'][number],
): ChangedField[] {
  const changed: ChangedField[] = [];
  for (const currency of ['aud', 'cad', 'eur', 'gbp', 'jpy', 'sek', 'usd', 'uah'] as const) {
    const oldValue = formatValue(existing[currency], true);
    const newValue = formatValue(incoming[currency], true);
    const oldStr = oldValue;
    const newStr = newValue;
    if (oldStr !== newStr) {
      changed.push({ field: currency, oldValue: String(oldStr), newValue: String(newStr) });
    }
  }
  return changed;
}

@Injectable({
  scope: Scope.Operation,
  global: true,
})
export class ScraperIngestionProvider {
  constructor(
    private db: TenantAwareDBClient,
    private exchangeRates: FiatExchangeProvider,
  ) {}

  async uploadCalTransactions(
    transactions: readonly CalTransactionInput[],
  ): Promise<ScraperUploadResult> {
    if (transactions.length === 0)
      return {
        inserted: 0,
        skipped: 0,
        insertedIds: [],
        insertedTransactions: [],
        changedTransactions: [],
      };

    const result = await uploadCalTransactions.run(
      { transactions: validateCalTransactions(transactions) },
      this.db,
    );
    const insertedIds = result.map(r => r.id).filter((id): id is string => typeof id === 'string');
    const insertedTransactions: InsertedTransactionSummary[] = result.map(r => ({
      id: r.id,
      date: r.trn_purchase_date ?? null,
      description: r.merchant_name ?? null,
      amount: r.trn_amt == null ? null : String(r.trn_amt),
      account: String(r.card),
    }));
    return {
      inserted: insertedIds.length,
      skipped: transactions.length - insertedIds.length,
      insertedIds,
      insertedTransactions,
      changedTransactions: [],
    };
  }

  async uploadDiscountTransactions(
    transactions: readonly DiscountTransactionInput[],
  ): Promise<ScraperUploadResult> {
    if (transactions.length === 0)
      return {
        inserted: 0,
        skipped: 0,
        insertedIds: [],
        insertedTransactions: [],
        changedTransactions: [],
      };

    const result = await uploadDiscountTransactions.run(
      { transactions: validateDiscountTransactions(transactions) },
      this.db,
    );
    const insertedIds = result.map(r => r.id).filter((id): id is string => typeof id === 'string');
    const insertedTransactions: InsertedTransactionSummary[] = result.map(r => ({
      id: r.id,
      date: r.operation_date ?? null,
      description: r.operation_description ?? null,
      amount: r.operation_amount ?? null,
      account: r.account_number ?? null,
    }));
    return {
      inserted: insertedIds.length,
      skipped: transactions.length - insertedIds.length,
      insertedIds,
      insertedTransactions,
      changedTransactions: [],
    };
  }

  async uploadMaxTransactions(
    transactions: readonly MaxTransactionInput[],
  ): Promise<ScraperUploadResult> {
    if (transactions.length === 0)
      return {
        inserted: 0,
        skipped: 0,
        insertedIds: [],
        insertedTransactions: [],
        changedTransactions: [],
      };

    const result = await uploadMaxTransactions.run(
      { transactions: validateMaxTransactions(transactions) },
      this.db,
    );
    const insertedIds = result.map(r => r.id).filter((id): id is string => typeof id === 'string');
    const insertedTransactions: InsertedTransactionSummary[] = result.map(r => ({
      id: r.id,
      date: r.purchase_date ? dateToTimelessDateString(r.purchase_date) : null,
      description: r.merchant_name ?? null,
      amount: r.actual_payment_amount == null ? null : String(r.actual_payment_amount),
      account: String(r.card_index),
    }));
    return {
      inserted: insertedIds.length,
      skipped: transactions.length - insertedIds.length,
      insertedIds,
      insertedTransactions,
      changedTransactions: [],
    };
  }

  async uploadCurrencyRates(rates: readonly CurrencyRateInput[]): Promise<ScraperUploadResult> {
    if (rates.length === 0)
      return {
        inserted: 0,
        skipped: 0,
        insertedIds: [],
        insertedTransactions: [],
        changedTransactions: [],
      };

    const validated = validateRates(rates);

    const existing = await this.exchangeRates.getExchangeRatesByDatesLoader
      .loadMany(rates.map(r => new Date(r.exchangeDate)))
      .then(res =>
        res.filter((r): r is IGetExchangeRatesByDatesResult => r !== null && !(r instanceof Error)),
      );
    const existingByDate = new Map(
      existing.map(row => [
        row.exchange_date ? dateToTimelessDateString(row.exchange_date) : null,
        row,
      ]),
    );

    const result = await uploadCurrencyRates.run({ rates: validated }, this.db);
    const insertedDates = result
      .map(r => (r.exchange_date ? dateToTimelessDateString(r.exchange_date) : undefined))
      .filter((date): date is TimelessDateString => !!date);
    const insertedDatesSet = new Set(insertedDates);

    const insertedRates: InsertedTransactionSummary[] = result.map(r => {
      const date = dateToTimelessDateString(r.exchange_date!);
      const description = (['aud', 'cad', 'eur', 'gbp', 'jpy', 'sek', 'uah', 'usd'] as const)
        .filter(c => r[c] != null)
        .map(c => `${c.toUpperCase()}=${r[c]}`)
        .join(', ');
      return {
        id: date ?? undefined,
        date,
        description,
        amount: undefined,
        account: undefined,
      };
    });

    const changedRates: ChangedTransaction[] = [];
    for (const r of validated) {
      if (!r.exchangeDate) continue;
      const date = dateToTimelessDateString(new Date(r.exchangeDate));
      const existingRow = existingByDate.get(date);
      if (
        existingRow?.exchange_date &&
        !insertedDatesSet.has(dateToTimelessDateString(existingRow.exchange_date))
      ) {
        const changedFields = diffExchangeRatesRow(existingRow, r);
        if (changedFields.length > 0) {
          changedRates.push({ id: date, changedFields });
        }
      }
    }

    return {
      inserted: insertedDates.length,
      skipped: rates.length - insertedDates.length,
      insertedIds: insertedDates,
      insertedTransactions: insertedRates,
      changedTransactions: changedRates,
    };
  }
}
