import { Injectable, Scope } from 'graphql-modules';
import { sql } from '@pgtyped/runtime';
import {
  AmexTransactionInput,
  CalTransactionInput,
  ChangedTransaction,
  CurrencyRateInput,
  DiscountTransactionInput,
  IsracardTransactionInput,
  MaxTransactionInput,
  PoalimForeignTransactionInput,
  PoalimIlsTransactionInput,
  PoalimSwiftTransactionInput,
} from '../../../__generated__/types.js';
import { dateToTimelessDateString } from '../../../shared/helpers/index.js';
import { TimelessDateString } from '../../../shared/types/index.js';
import { TenantAwareDBClient } from '../../app-providers/tenant-db-client.js';
import {
  validateCalTransactions,
  validateDiscountTransactions,
  validateIsracardAmexTransactions,
  validateMaxTransactions,
  validatePoalimForeignTransactions,
  validatePoalimIlsTransactions,
  validatePoalimSwiftTransactions,
  validateRates,
} from '../helpers/validators.helper.js';
import type {
  IUploadAmexTransactionsQuery,
  IUploadCalTransactionsQuery,
  IUploadCurrencyRatesQuery,
  IUploadDiscountTransactionsQuery,
  IUploadIsracardTransactionsQuery,
  IUploadMaxTransactionsQuery,
  IUploadPoalimForeignTransactionsQuery,
  IUploadPoalimIlsTransactionsQuery,
  IUploadPoalimSwiftTransactionsQuery,
} from '../types.js';

export type InsertedTransactionSummary = {
  id: string;
  date: string | null;
  description: string | null;
  amount: string | null;
  account: string | null;
};

export type UploadResult = {
  inserted: number;
  skipped: number;
  insertedIds: string[];
  insertedTransactions: InsertedTransactionSummary[];
  changedTransactions: ChangedTransaction[];
};

const uploadPoalimIlsTransactions = sql<IUploadPoalimIlsTransactionsQuery>`
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
    account_number
  )
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
    accountNumber
  )
  ON CONFLICT (event_date, serial_number, reference_number, account_number, branch_number) DO NOTHING
  RETURNING id, event_date, activity_description, event_amount, account_number;
`;

const uploadPoalimForeignTransactions = sql<IUploadPoalimForeignTransactionsQuery>`
  INSERT INTO accounter_schema.poalim_foreign_account_transactions (
    metadata_attributes_original_event_key,
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
    account_number
  )
  VALUES $$transactions(
    metadataAttributesOriginalEventKey,
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
  ON CONFLICT (executing_date, reference_number, account_number, branch_number) DO NOTHING
  RETURNING id, executing_date, activity_description, event_amount, account_number;
`;

const uploadPoalimSwiftTransactions = sql<IUploadPoalimSwiftTransactionsQuery>`
  INSERT INTO accounter_schema.poalim_swift_account_transactions (
    account_number,
    branch_number,
    bank_number,
    start_date,
    formatted_start_date,
    swift_status_code,
    swift_status_desc,
    amount,
    currency_code_catenated_key,
    currency_long_description,
    charge_party_name,
    reference_number,
    transfer_catenated_id,
    data_origin_code,
    swift_isn_serial_number,
    swift_bank_code,
    order_customer_name,
    beneficiary_english_street_name,
    beneficiary_english_city_name,
    beneficiary_english_country_name,
    swift_senders_reference_20,
    swift_bank_operation_code_23B,
    swift_instruction_code_23e,
    swift_value_date_currency_amount_32A,
    swift_currency_instructed_amount_33B,
    swift_exchange_rate_36,
    swift_ordering_customer_50k,
    swift_ordering_institution_52A,
    swift_ordering_institution_52d,
    swift_senders_correspondent_53A,
    swift_receivers_correspondent_54A,
    swift_account_with_institution_57,
    swift_beneficiary_customer_59,
    swift_remittance_information_70,
    swift_details_of_charges_71A,
    swift_senders_charges_71F,
    swift_senders_to_receiver_information_72,
    swift_regulatory_reporting_77b
  )
  VALUES $$transactions(
    accountNumber,
    branchNumber,
    bankNumber,
    startDate,
    formattedStartDate,
    swiftStatusCode,
    swiftStatusDesc,
    amount,
    currencyCodeCatenatedKey,
    currencyLongDescription,
    chargePartyName,
    referenceNumber,
    transferCatenatedId,
    dataOriginCode,
    swiftIsnSerialNumber,
    swiftBankCode,
    orderCustomerName,
    beneficiaryEnglishStreetName,
    beneficiaryEnglishCityName,
    beneficiaryEnglishCountryName,
    swiftSendersReference20,
    swiftBankOperationCode23B,
    swiftInstructionCode23E,
    swiftValueDateCurrencyAmount32A,
    swiftCurrencyInstructedAmount33B,
    swiftExchangeRate36,
    swiftOrderingCustomer50K,
    swiftOrderingInstitution52A,
    swiftOrderingInstitution52D,
    swiftSendersCorrespondent53A,
    swiftReceiversCorrespondent54A,
    swiftAccountWithInstitution57,
    swiftBeneficiaryCustomer59,
    swiftRemittanceInformation70,
    swiftDetailsOfCharges71A,
    swiftSendersCharges71F,
    swiftSendersToReceiverInformation72,
    swiftRegulatoryReporting77B
  )
  ON CONFLICT (transfer_catenated_id) WHERE transfer_catenated_id IS NOT NULL DO NOTHING
  RETURNING id, start_date, charge_party_name, amount, account_number;
`;

const uploadIsracardTransactions = sql<IUploadIsracardTransactionsQuery>`
  INSERT INTO accounter_schema.isracard_creditcard_transactions (
    specific_date,
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
    kod_matbea_mekori,
    esb_services_call
  )
  VALUES $$transactions(
    specificDate,
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
    kodMatbeaMekori,
    esbServicesCall
  )
  ON CONFLICT (
    card,
    COALESCE(full_purchase_date, full_purchase_date_outbound, ''),
    COALESCE(full_payment_date, ''),
    COALESCE(payment_sum, payment_sum_outbound, 0),
    COALESCE(voucher_number, 0),
    COALESCE(supplier_id, 0),
    COALESCE(current_payment_currency, ''),
    COALESCE(full_supplier_name_heb, full_supplier_name_outbound, ''),
    COALESCE(more_info, '')
  )
  DO NOTHING
  RETURNING id, full_purchase_date, supplier_name, payment_sum, card;
`;

const uploadAmexTransactions = sql<IUploadAmexTransactionsQuery>`
  INSERT INTO accounter_schema.amex_creditcard_transactions (
    specific_date,
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
    kod_matbea_mekori,
    esb_services_call
  )
  VALUES $$transactions(
    specificDate,
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
    kodMatbeaMekori,
    esbServicesCall
  )
  ON CONFLICT (
    card,
    COALESCE(full_purchase_date, full_purchase_date_outbound, ''),
    COALESCE(full_payment_date, ''),
    COALESCE(payment_sum, payment_sum_outbound, 0),
    COALESCE(voucher_number, 0),
    COALESCE(supplier_id, 0),
    COALESCE(current_payment_currency, ''),
    COALESCE(full_supplier_name_heb, full_supplier_name_outbound, ''),
    COALESCE(more_info, '')
  )
  DO NOTHING
  RETURNING id, full_purchase_date, supplier_name, payment_sum, card;
`;

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
    usd,
    eur,
    gbp,
    cad,
    jpy,
    aud,
    sek
  )
  VALUES $$rates(
    exchangeDate,
    usd,
    eur,
    gbp,
    cad,
    jpy,
    aud,
    sek
  )
  ON CONFLICT (exchange_date) DO NOTHING
  RETURNING exchange_date;
`;

@Injectable({
  scope: Scope.Operation,
  global: true,
})
export class ScraperIngestionProvider {
  constructor(private db: TenantAwareDBClient) {}

  async uploadPoalimIlsTransactions(
    transactions: readonly PoalimIlsTransactionInput[],
  ): Promise<UploadResult> {
    if (transactions.length === 0)
      return {
        inserted: 0,
        skipped: 0,
        insertedIds: [],
        insertedTransactions: [],
        changedTransactions: [],
      };

    const result = await uploadPoalimIlsTransactions.run(
      { transactions: validatePoalimIlsTransactions(transactions) },
      this.db,
    );
    const insertedIds = result.map(r => r.id).filter((id): id is string => typeof id === 'string');
    const insertedTransactions: InsertedTransactionSummary[] = result.map(r => ({
      id: r.id,
      date: r.event_date ? dateToTimelessDateString(r.event_date) : null,
      description: r.activity_description ?? null,
      amount: r.event_amount == null ? null : String(r.event_amount),
      account: r.account_number == null ? null : String(r.account_number),
    }));
    return {
      inserted: insertedIds.length,
      skipped: transactions.length - insertedIds.length,
      insertedIds,
      insertedTransactions,
      changedTransactions: [],
    };
  }

  async uploadPoalimForeignTransactions(
    transactions: readonly PoalimForeignTransactionInput[],
  ): Promise<UploadResult> {
    if (transactions.length === 0)
      return {
        inserted: 0,
        skipped: 0,
        insertedIds: [],
        insertedTransactions: [],
        changedTransactions: [],
      };

    const result = await uploadPoalimForeignTransactions.run(
      { transactions: validatePoalimForeignTransactions(transactions) },
      this.db,
    );
    const insertedIds = result.map(r => r.id).filter((id): id is string => typeof id === 'string');
    const insertedTransactions: InsertedTransactionSummary[] = result.map(r => ({
      id: r.id,
      date: r.executing_date ? dateToTimelessDateString(r.executing_date) : null,
      description: r.activity_description ?? null,
      amount: r.event_amount == null ? null : String(r.event_amount),
      account: r.account_number == null ? null : String(r.account_number),
    }));
    return {
      inserted: insertedIds.length,
      skipped: transactions.length - insertedIds.length,
      insertedIds,
      insertedTransactions,
      changedTransactions: [],
    };
  }

  async uploadPoalimSwiftTransactions(
    swifts: readonly PoalimSwiftTransactionInput[],
  ): Promise<UploadResult> {
    if (swifts.length === 0)
      return {
        inserted: 0,
        skipped: 0,
        insertedIds: [],
        insertedTransactions: [],
        changedTransactions: [],
      };

    const result = await uploadPoalimSwiftTransactions.run(
      { transactions: validatePoalimSwiftTransactions(swifts) },
      this.db,
    );
    const insertedIds = result.map(r => r.id).filter((id): id is string => typeof id === 'string');
    const insertedTransactions: InsertedTransactionSummary[] = result.map(r => ({
      id: r.id,
      date: r.start_date ?? null,
      description: r.charge_party_name ?? null,
      amount: r.amount == null ? null : String(r.amount),
      account: r.account_number == null ? null : String(r.account_number),
    }));
    return {
      inserted: insertedIds.length,
      skipped: swifts.length - insertedIds.length,
      insertedIds,
      insertedTransactions,
      changedTransactions: [],
    };
  }

  async uploadIsracardTransactions(
    transactions: readonly IsracardTransactionInput[],
  ): Promise<UploadResult> {
    if (transactions.length === 0)
      return {
        inserted: 0,
        skipped: 0,
        insertedIds: [],
        insertedTransactions: [],
        changedTransactions: [],
      };

    const result = await uploadIsracardTransactions.run(
      { transactions: validateIsracardAmexTransactions(transactions) },
      this.db,
    );
    const insertedIds = result.map(r => r.id).filter((id): id is string => typeof id === 'string');
    const insertedTransactions: InsertedTransactionSummary[] = result.map(r => ({
      id: r.id,
      date: r.full_purchase_date ?? null,
      description: r.supplier_name ?? null,
      amount: r.payment_sum == null ? null : String(r.payment_sum),
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

  async uploadAmexTransactions(
    transactions: readonly AmexTransactionInput[],
  ): Promise<UploadResult> {
    if (transactions.length === 0)
      return {
        inserted: 0,
        skipped: 0,
        insertedIds: [],
        insertedTransactions: [],
        changedTransactions: [],
      };

    const result = await uploadAmexTransactions.run(
      { transactions: validateIsracardAmexTransactions(transactions) },
      this.db,
    );
    const insertedIds = result.map(r => r.id).filter((id): id is string => typeof id === 'string');
    const insertedTransactions: InsertedTransactionSummary[] = result.map(r => ({
      id: r.id,
      date: r.full_purchase_date ?? null,
      description: r.supplier_name ?? null,
      amount: r.payment_sum == null ? null : String(r.payment_sum),
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

  async uploadCalTransactions(transactions: readonly CalTransactionInput[]): Promise<UploadResult> {
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
  ): Promise<UploadResult> {
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

  async uploadMaxTransactions(transactions: readonly MaxTransactionInput[]): Promise<UploadResult> {
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

  async uploadCurrencyRates(rates: readonly CurrencyRateInput[]): Promise<UploadResult> {
    if (rates.length === 0)
      return {
        inserted: 0,
        skipped: 0,
        insertedIds: [],
        insertedTransactions: [],
        changedTransactions: [],
      };

    const result = await uploadCurrencyRates.run({ rates: validateRates(rates) }, this.db);
    const insertedIds = result
      .map(r => (r.exchange_date ? dateToTimelessDateString(r.exchange_date) : undefined))
      .filter((date): date is TimelessDateString => !!date);
    return {
      inserted: insertedIds.length,
      skipped: rates.length - insertedIds.length,
      insertedIds,
      insertedTransactions: [],
      changedTransactions: [],
    };
  }
}
