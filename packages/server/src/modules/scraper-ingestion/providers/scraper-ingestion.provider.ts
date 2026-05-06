import { Injectable, Scope } from 'graphql-modules';
import { sql } from '@pgtyped/runtime';
import type {
  AmexTransactionInput,
  CalTransactionInput,
  ChangedField,
  ChangedTransaction,
  CurrencyRateInput,
  DiscountTransactionInput,
  InsertedTransactionSummary,
  IsracardTransactionInput,
  MaxTransactionInput,
  PoalimForeignTransactionInput,
  PoalimIlsTransactionInput,
  PoalimSwiftTransactionInput,
  ScraperUploadResult,
} from '../../../__generated__/types.js';
import { dateToTimelessDateString } from '../../../shared/helpers/index.js';
import { TimelessDateString } from '../../../shared/types/index.js';
import { TenantAwareDBClient } from '../../app-providers/tenant-db-client.js';
import { FiatExchangeProvider } from '../../exchange-rates/providers/fiat-exchange.provider.js';
import { IGetExchangeRatesByDatesResult } from '../../exchange-rates/types.js';
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
  IFetchAmexByCardsQuery,
  IFetchAmexByCardsResult,
  IFetchIsracardByCardsQuery,
  IFetchIsracardByCardsResult,
  IFetchPoalimForeignByKeysQuery,
  IFetchPoalimForeignByKeysResult,
  IFetchPoalimIlsByKeysQuery,
  IFetchPoalimIlsByKeysResult,
  IFetchPoalimSwiftByIdsQuery,
  IFetchPoalimSwiftByIdsResult,
  IUploadAmexTransactionsParams,
  IUploadAmexTransactionsQuery,
  IUploadCalTransactionsQuery,
  IUploadCurrencyRatesParams,
  IUploadCurrencyRatesQuery,
  IUploadDiscountTransactionsQuery,
  IUploadIsracardTransactionsParams,
  IUploadIsracardTransactionsQuery,
  IUploadMaxTransactionsQuery,
  IUploadPoalimForeignTransactionsParams,
  IUploadPoalimForeignTransactionsQuery,
  IUploadPoalimIlsTransactionsParams,
  IUploadPoalimIlsTransactionsQuery,
  IUploadPoalimSwiftTransactionsParams,
  IUploadPoalimSwiftTransactionsQuery,
} from '../types.js';

const fetchPoalimIlsByKeys = sql<IFetchPoalimIlsByKeysQuery>`
  SELECT
    id,
    event_date,
    serial_number,
    account_number,
    branch_number,
    activity_description,
    activity_type_code,
    text_code,
    reference_number,
    reference_catenated_number,
    value_date,
    event_amount,
    event_activity_type_code,
    current_balance,
    internal_link_code,
    transaction_type,
    data_group_code,
    executing_branch_number,
    event_id,
    details,
    pfm_details,
    different_date_indication,
    rejected_data_event_pertaining_indication,
    contra_bank_number,
    contra_branch_number,
    contra_account_number,
    contra_account_type_code,
    comment,
    beneficiary_details_data_party_name,
    beneficiary_details_data_message_headline,
    beneficiary_details_data_party_headline,
    beneficiary_details_data_message_detail
  FROM accounter_schema.poalim_ils_account_transactions
  WHERE account_number = ANY($accountNumbers!)
    AND branch_number = ANY($branchNumbers!)
    AND event_date = ANY($eventDates!)
`;

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
  ON CONFLICT (event_date, serial_number, account_number, branch_number) DO NOTHING
  RETURNING id, event_date, serial_number, account_number, branch_number, activity_description, event_amount;
`;

const fetchPoalimForeignByKeys = sql<IFetchPoalimForeignByKeysQuery>`
  SELECT
    id,
    executing_date,
    account_number,
    branch_number,
    event_number,
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
    comments,
    account_name,
    contra_bank_number,
    contra_branch_number,
    contra_account_number,
    contra_account_field_name_lable,
    rate_fixing_description,
    currency_swift_code
  FROM accounter_schema.poalim_foreign_account_transactions
  WHERE account_number = ANY($accountNumbers!)
    AND branch_number = ANY($branchNumbers!)
    AND executing_date = ANY($executingDates!)
`;

const fetchPoalimSwiftByIds = sql<IFetchPoalimSwiftByIdsQuery>`
  SELECT
    id,
    transfer_catenated_id,
    account_number,
    branch_number,
    bank_number,
    start_date,
    swift_status_code,
    swift_status_desc,
    amount,
    currency_code_catenated_key,
    currency_long_description,
    charge_party_name,
    reference_number,
    data_origin_code,
    order_customer_name,
    beneficiary_english_street_name,
    beneficiary_english_city_name,
    beneficiary_english_country_name,
    swift_remittance_information_70,
    swift_details_of_charges_71a,
    swift_senders_charges_71f
  FROM accounter_schema.poalim_swift_account_transactions
  WHERE transfer_catenated_id = ANY($transferCatenatedIds!)

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
  ON CONFLICT (executing_date, account_number, branch_number, event_number) DO NOTHING
  RETURNING id, executing_date, account_number, branch_number, event_number, activity_description, event_amount;
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
  ON CONFLICT (transfer_catenated_id) DO NOTHING
  RETURNING id, start_date, charge_party_name, amount, account_number;
`;

const fetchIsracardByCards = sql<IFetchIsracardByCardsQuery>`
  SELECT
    id,
    card,
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
    kod_matbea_mekori,
    esb_services_call
  FROM accounter_schema.isracard_creditcard_transactions
  WHERE card = ANY($cards!)
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

const fetchAmexByCards = sql<IFetchAmexByCardsQuery>`
  SELECT
    id,
    card,
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
    kod_matbea_mekori,
    esb_services_call
  FROM accounter_schema.amex_creditcard_transactions
  WHERE card = ANY($cards!)
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
  RETURNING exchange_date, usd, eur, gbp, cad, jpy, aud, sek;
`;

function formatValue(value: unknown, isNumberField: boolean): string {
  if (value === null || value === undefined) return 'null';
  if (isNumberField) {
    const num = Number(value);
    return Number.isNaN(num) ? 'null' : String(num);
  }
  return String(value);
}

type IsracardAmexKeyShape = {
  card: number;
  full_purchase_date?: string | null;
  full_purchase_date_outbound?: string | null;
  full_payment_date?: string | null;
  payment_sum?: string | number | null;
  payment_sum_outbound?: string | number | null;
  voucher_number?: number | null;
  supplier_id?: number | null;
  current_payment_currency?: string | null;
  full_supplier_name_heb?: string | null;
  full_supplier_name_outbound?: string | null;
  more_info?: string | null;
};

function isracardAmexConflictKey(row: IsracardAmexKeyShape): string {
  return JSON.stringify([
    row.card,
    row.full_purchase_date ?? row.full_purchase_date_outbound ?? '',
    row.full_payment_date ?? '',
    Number(row.payment_sum ?? row.payment_sum_outbound ?? 0),
    row.voucher_number ?? 0,
    row.supplier_id ?? 0,
    row.current_payment_currency ?? '',
    row.full_supplier_name_heb ?? row.full_supplier_name_outbound ?? '',
    row.more_info ?? '',
  ]);
}

const ISRACARD_DIFF_FIELDS: Array<{
  key: keyof IFetchIsracardByCardsResult;
  incoming: (
    t:
      | IUploadIsracardTransactionsParams['transactions'][number]
      | IUploadAmexTransactionsParams['transactions'][number],
  ) => string | number | boolean | null;
}> = [
  { key: 'adendum', incoming: t => t.adendum ?? null },
  { key: 'city', incoming: t => t.city ?? null },
  { key: 'currency_id', incoming: t => t.currencyId ?? null },
  { key: 'deal_sum', incoming: t => t.dealSum ?? null },
  {
    key: 'deal_sum_outbound',
    incoming: t =>
      t.dealSumOutbound !== null && t.dealSumOutbound !== undefined
        ? String(t.dealSumOutbound)
        : null,
  },
  { key: 'deal_sum_type', incoming: t => t.dealSumType ?? null },
  { key: 'deals_inbound', incoming: t => t.dealsInbound ?? null },
  { key: 'display_properties', incoming: t => t.displayProperties ?? null },
  { key: 'esb_services_call', incoming: t => t.esbServicesCall ?? null },
  { key: 'horaat_keva', incoming: t => t.horaatKeva ?? null },
  { key: 'is_button', incoming: t => t.isButton ?? null },
  { key: 'is_captcha', incoming: t => t.isCaptcha ?? null },
  { key: 'is_error', incoming: t => t.isError ?? null },
  { key: 'is_horaat_keva', incoming: t => t.isHoraatKeva ?? null },
  { key: 'is_show_deals_outbound', incoming: t => t.isShowDealsOutbound ?? null },
  {
    key: 'is_show_link_for_supplier_details',
    incoming: t => t.isShowLinkForSupplierDetails ?? null,
  },
  { key: 'kod_matbea_mekori', incoming: t => t.kodMatbeaMekori ?? null },
  { key: 'message', incoming: t => t.message ?? null },
  { key: 'payment_date', incoming: t => t.paymentDate ?? null },
  { key: 'payment_sum_sign', incoming: t => t.paymentSumSign ?? null },
  { key: 'purchase_date', incoming: t => t.purchaseDate ?? null },
  { key: 'purchase_date_outbound', incoming: t => t.purchaseDateOutbound ?? null },
  { key: 'return_code', incoming: t => t.returnCode ?? null },
  { key: 'return_message', incoming: t => t.returnMessage ?? null },
  { key: 'site_name', incoming: t => t.siteName ?? null },
  { key: 'solek', incoming: t => t.solek ?? null },
  { key: 'specific_date', incoming: t => t.specificDate ?? null },
  { key: 'stage', incoming: t => t.stage ?? null },
  { key: 'supplier_name', incoming: t => t.supplierName ?? null },
  { key: 'supplier_name_outbound', incoming: t => t.supplierNameOutbound ?? null },
  { key: 'table_page_num', incoming: t => t.tablePageNum ?? null },
  { key: 'voucher_number_ratz', incoming: t => t.voucherNumberRatz ?? null },
  { key: 'voucher_number_ratz_outbound', incoming: t => t.voucherNumberRatzOutbound ?? null },
];

const ISRACARD_AMEX_NUMERIC_FIELDS: (keyof IFetchIsracardByCardsResult)[] = [
  'deal_sum',
  'deal_sum_outbound',
  'payment_sum',
  'payment_sum_outbound',
] as const;

function diffIsracardAmexRow<T extends IFetchIsracardByCardsResult | IFetchAmexByCardsResult>(
  existing: T,
  incoming: ReturnType<
    typeof validateIsracardAmexTransactions<
      T extends IFetchIsracardByCardsResult ? IsracardTransactionInput : AmexTransactionInput
    >
  >[number],
): ChangedField[] {
  const changed: ChangedField[] = [];
  for (const { key, incoming: getIncoming } of ISRACARD_DIFF_FIELDS) {
    const isNumberField = ISRACARD_AMEX_NUMERIC_FIELDS.includes(key);
    const oldValue = formatValue(existing[key], isNumberField);
    const newValue = formatValue(getIncoming(incoming), isNumberField);
    const oldStr = oldValue;
    const newStr = newValue;
    if (oldStr !== newStr) {
      changed.push({ field: key, oldValue: oldStr, newValue: newStr });
    }
  }
  return changed;
}

const POALIM_ILS_DIFF_FIELDS: Array<{
  key: keyof IFetchPoalimIlsByKeysResult;
  incoming: (
    t: IUploadPoalimIlsTransactionsParams['transactions'][number],
  ) => string | number | boolean | null;
}> = [
  { key: 'activity_description', incoming: t => t.activityDescription ?? null },
  { key: 'activity_type_code', incoming: t => t.activityTypeCode ?? null },
  { key: 'text_code', incoming: t => t.textCode ?? null },
  {
    key: 'reference_number',
    incoming: t => (t.referenceNumber == null ? null : Number(t.referenceNumber)),
  },
  { key: 'reference_catenated_number', incoming: t => t.referenceCatenatedNumber ?? null },
  { key: 'event_amount', incoming: t => (t.eventAmount == null ? null : Number(t.eventAmount)) },
  { key: 'event_activity_type_code', incoming: t => t.eventActivityTypeCode ?? null },
  {
    key: 'current_balance',
    incoming: t => (t.currentBalance == null ? null : Number(t.currentBalance)),
  },
  { key: 'internal_link_code', incoming: t => t.internalLinkCode ?? null },
  { key: 'transaction_type', incoming: t => t.transactionType ?? null },
  { key: 'data_group_code', incoming: t => t.dataGroupCode ?? null },
  { key: 'executing_branch_number', incoming: t => t.executingBranchNumber ?? null },
  { key: 'event_id', incoming: t => (t.eventId == null ? null : Number(t.eventId)) },
  { key: 'details', incoming: t => t.details ?? null },
  { key: 'pfm_details', incoming: t => t.pfmDetails ?? null },
  { key: 'different_date_indication', incoming: t => t.differentDateIndication ?? null },
  {
    key: 'rejected_data_event_pertaining_indication',
    incoming: t => t.rejectedDataEventPertainingIndication ?? null,
  },
  { key: 'contra_bank_number', incoming: t => t.contraBankNumber ?? null },
  { key: 'contra_branch_number', incoming: t => t.contraBranchNumber ?? null },
  { key: 'contra_account_number', incoming: t => t.contraAccountNumber ?? null },
  { key: 'contra_account_type_code', incoming: t => t.contraAccountTypeCode ?? null },
  { key: 'comment', incoming: t => t.comment ?? null },
  {
    key: 'beneficiary_details_data_party_name',
    incoming: t => t.beneficiaryDetailsDataPartyName ?? null,
  },
  {
    key: 'beneficiary_details_data_message_headline',
    incoming: t => t.beneficiaryDetailsDataMessageHeadline ?? null,
  },
  {
    key: 'beneficiary_details_data_party_headline',
    incoming: t => t.beneficiaryDetailsDataPartyHeadline ?? null,
  },
  {
    key: 'beneficiary_details_data_message_detail',
    incoming: t => t.beneficiaryDetailsDataMessageDetail ?? null,
  },
];

const POALIM_ILS_NUMERIC_FIELDS: (keyof IFetchPoalimIlsByKeysResult)[] = [
  'event_amount',
  'current_balance',
] as const;

function diffPoalimIlsRow(
  existing: IFetchPoalimIlsByKeysResult,
  incoming: IUploadPoalimIlsTransactionsParams['transactions'][number],
): ChangedField[] {
  const changed: ChangedField[] = [];
  for (const { key, incoming: getIncoming } of POALIM_ILS_DIFF_FIELDS) {
    const isNumberField = POALIM_ILS_NUMERIC_FIELDS.includes(key);
    const oldValue = formatValue(existing[key], isNumberField);
    const newValue = formatValue(getIncoming(incoming), isNumberField);
    const oldStr = oldValue;
    const newStr = newValue;
    if (oldStr !== newStr) {
      changed.push({ field: key, oldValue: oldStr, newValue: newStr });
    }
  }
  return changed;
}

function diffExchangeRatesRow<T extends IGetExchangeRatesByDatesResult>(
  existing: T,
  incoming: IUploadCurrencyRatesParams['rates'][number],
): ChangedField[] {
  const changed: ChangedField[] = [];
  for (const currency of ['aud', 'cad', 'eur', 'gbp', 'jpy', 'sek', 'usd'] as const) {
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

const POALIM_FOREIGN_DIFF_FIELDS: Array<{
  key: keyof IFetchPoalimForeignByKeysResult;
  incoming: (
    t: IUploadPoalimForeignTransactionsParams['transactions'][number],
  ) => string | number | boolean | null;
}> = [
  { key: 'activity_description', incoming: t => t.activityDescription ?? null },
  { key: 'event_amount', incoming: t => (t.eventAmount == null ? null : Number(t.eventAmount)) },
  { key: 'currency', incoming: t => t.currency ?? null },
  {
    key: 'current_balance',
    incoming: t => (t.currentBalance == null ? null : Number(t.currentBalance)),
  },
  { key: 'reference_catenated_number', incoming: t => t.referenceCatenatedNumber ?? null },
  { key: 'reference_number', incoming: t => t.referenceNumber ?? null },
  { key: 'currency_rate', incoming: t => (t.currencyRate == null ? null : Number(t.currencyRate)) },
  { key: 'event_details', incoming: t => t.eventDetails ?? null },
  { key: 'rate_fixing_code', incoming: t => t.rateFixingCode ?? null },
  { key: 'contra_currency_code', incoming: t => t.contraCurrencyCode ?? null },
  { key: 'event_activity_type_code', incoming: t => t.eventActivityTypeCode ?? null },
  { key: 'transaction_type', incoming: t => t.transactionType ?? null },
  { key: 'rate_fixing_short_description', incoming: t => t.rateFixingShortDescription ?? null },
  { key: 'currency_long_description', incoming: t => t.currencyLongDescription ?? null },
  { key: 'activity_type_code', incoming: t => t.activityTypeCode ?? null },
  { key: 'comments', incoming: t => t.comments ?? null },
  { key: 'account_name', incoming: t => t.accountName ?? null },
  { key: 'contra_bank_number', incoming: t => t.contraBankNumber ?? null },
  { key: 'contra_branch_number', incoming: t => t.contraBranchNumber ?? null },
  { key: 'contra_account_number', incoming: t => t.contraAccountNumber ?? null },
  { key: 'contra_account_field_name_lable', incoming: t => t.contraAccountFieldNameLable ?? null },
  { key: 'rate_fixing_description', incoming: t => t.rateFixingDescription ?? null },
  { key: 'currency_swift_code', incoming: t => t.currencySwiftCode ?? null },
];

function diffPoalimForeignRow(
  existing: IFetchPoalimForeignByKeysResult,
  incoming: IUploadPoalimForeignTransactionsParams['transactions'][number],
): ChangedField[] {
  const changed: ChangedField[] = [];
  for (const { key, incoming: getIncoming } of POALIM_FOREIGN_DIFF_FIELDS) {
    const oldStr = existing[key] == null ? 'null' : String(existing[key]);
    const newStr = getIncoming(incoming) == null ? 'null' : String(getIncoming(incoming));
    if (oldStr !== newStr) {
      changed.push({ field: key, oldValue: oldStr, newValue: newStr });
    }
  }
  return changed;
}

const POALIM_SWIFT_DIFF_FIELDS: Array<{
  key: keyof IFetchPoalimSwiftByIdsResult;
  incoming: (
    t: IUploadPoalimSwiftTransactionsParams['transactions'][number],
  ) => string | number | boolean | null;
}> = [
  { key: 'swift_status_code', incoming: t => t.swiftStatusCode ?? null },
  { key: 'swift_status_desc', incoming: t => t.swiftStatusDesc ?? null },
  { key: 'amount', incoming: t => t.amount ?? null },
  { key: 'currency_code_catenated_key', incoming: t => t.currencyCodeCatenatedKey ?? null },
  { key: 'currency_long_description', incoming: t => t.currencyLongDescription ?? null },
  { key: 'charge_party_name', incoming: t => t.chargePartyName ?? null },
  { key: 'reference_number', incoming: t => t.referenceNumber ?? null },
  { key: 'data_origin_code', incoming: t => t.dataOriginCode ?? null },
  { key: 'order_customer_name', incoming: t => t.orderCustomerName ?? null },
  { key: 'beneficiary_english_street_name', incoming: t => t.beneficiaryEnglishStreetName ?? null },
  { key: 'beneficiary_english_city_name', incoming: t => t.beneficiaryEnglishCityName ?? null },
  {
    key: 'beneficiary_english_country_name',
    incoming: t => t.beneficiaryEnglishCountryName ?? null,
  },
  { key: 'swift_remittance_information_70', incoming: t => t.swiftRemittanceInformation70 ?? null },
  { key: 'swift_details_of_charges_71a', incoming: t => t.swiftDetailsOfCharges71A ?? null },
  { key: 'swift_senders_charges_71f', incoming: t => t.swiftSendersCharges71F ?? null },
];

function diffPoalimSwiftRow(
  existing: IFetchPoalimSwiftByIdsResult,
  incoming: IUploadPoalimSwiftTransactionsParams['transactions'][number],
): ChangedField[] {
  const changed: ChangedField[] = [];
  for (const { key, incoming: getIncoming } of POALIM_SWIFT_DIFF_FIELDS) {
    const oldStr = existing[key] == null ? 'null' : String(existing[key]);
    const newStr = getIncoming(incoming) == null ? 'null' : String(getIncoming(incoming));
    if (oldStr !== newStr) {
      changed.push({ field: key, oldValue: oldStr, newValue: newStr });
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

  async uploadPoalimIlsTransactions(
    transactions: readonly PoalimIlsTransactionInput[],
  ): Promise<ScraperUploadResult> {
    if (transactions.length === 0)
      return {
        inserted: 0,
        skipped: 0,
        insertedIds: [],
        insertedTransactions: [],
        changedTransactions: [],
      };

    const validated = validatePoalimIlsTransactions(transactions);

    const eventDates = validated
      .map(t => (t.eventDate ? new Date(t.eventDate) : null))
      .filter((d): d is Date => d !== null);
    const accountNumbers = validated
      .map(t => t.accountNumber ?? null)
      .filter((n): n is number => n !== null);
    const branchNumbers = validated
      .map(t => t.branchNumber ?? null)
      .filter((n): n is number => n !== null);

    const existing = await fetchPoalimIlsByKeys.run(
      { eventDates, accountNumbers, branchNumbers },
      this.db,
    );

    type ConflictKey = `${string}_${string}_${string}_${string}`;
    const existingByKey = new Map<ConflictKey, IFetchPoalimIlsByKeysResult>();
    for (const row of existing) {
      const key: ConflictKey = `${row.event_date ? dateToTimelessDateString(row.event_date) : ''}_${row.serial_number}_${row.account_number}_${row.branch_number}`;
      existingByKey.set(key, row);
    }

    const result = await uploadPoalimIlsTransactions.run({ transactions: validated }, this.db);
    const insertedIds = result.map(r => r.id).filter((id): id is string => typeof id === 'string');
    const insertedIdSet = new Set(insertedIds);

    const insertedTransactions: InsertedTransactionSummary[] = result.map(r => ({
      id: r.id,
      date: dateToTimelessDateString(r.event_date),
      description: r.activity_description,
      amount: r.event_amount,
      account: String(r.account_number),
    }));

    const changedTransactions: ChangedTransaction[] = [];
    for (const t of validated) {
      const key: ConflictKey = `${t.eventDate ? dateToTimelessDateString(new Date(t.eventDate)) : ''}_${t.serialNumber}_${t.accountNumber}_${t.branchNumber}`;
      const existingRow = existingByKey.get(key);
      if (existingRow && !insertedIdSet.has(existingRow.id)) {
        const changedFields = diffPoalimIlsRow(existingRow, t);
        if (changedFields.length > 0) {
          changedTransactions.push({ id: existingRow.id, changedFields });
        }
      }
    }

    return {
      inserted: insertedIds.length,
      skipped: transactions.length - insertedIds.length,
      insertedIds,
      insertedTransactions,
      changedTransactions,
    };
  }

  async uploadPoalimForeignTransactions(
    transactions: readonly PoalimForeignTransactionInput[],
  ): Promise<ScraperUploadResult> {
    if (transactions.length === 0)
      return {
        inserted: 0,
        skipped: 0,
        insertedIds: [],
        insertedTransactions: [],
        changedTransactions: [],
      };

    const validated = validatePoalimForeignTransactions(transactions);

    const executingDates = validated
      .map(t => (t.executingDate ? new Date(t.executingDate) : null))
      .filter((d): d is Date => d !== null);
    const accountNumbers = validated
      .map(t => t.accountNumber ?? null)
      .filter((n): n is number => n !== null);
    const branchNumbers = validated
      .map(t => t.branchNumber ?? null)
      .filter((n): n is number => n !== null);

    const existing = await fetchPoalimForeignByKeys.run(
      { executingDates, accountNumbers, branchNumbers },
      this.db,
    );

    type ForeignKey = `${string}_${string}_${string}_${string}`;
    const existingByKey = new Map<ForeignKey, IFetchPoalimForeignByKeysResult>();
    for (const row of existing) {
      const key: ForeignKey = `${row.executing_date ? dateToTimelessDateString(row.executing_date) : ''}_${row.account_number}_${row.branch_number}_${row.event_number}`;
      existingByKey.set(key, row);
    }

    const result = await uploadPoalimForeignTransactions.run({ transactions: validated }, this.db);
    const insertedIds = result.map(r => r.id).filter((id): id is string => typeof id === 'string');
    const insertedIdSet = new Set(insertedIds);

    const insertedTransactions: InsertedTransactionSummary[] = result.map(r => ({
      id: r.id,
      date: r.executing_date ? dateToTimelessDateString(r.executing_date) : null,
      description: null,
      amount: null,
      account: r.account_number == null ? null : String(r.account_number),
    }));

    const changedTransactions: ChangedTransaction[] = [];
    for (const t of validated) {
      const key: ForeignKey = `${t.executingDate ? dateToTimelessDateString(new Date(t.executingDate)) : ''}_${t.accountNumber}_${t.branchNumber}_${t.eventNumber}`;
      const existingRow = existingByKey.get(key);
      if (existingRow && !insertedIdSet.has(existingRow.id)) {
        const changedFields = diffPoalimForeignRow(existingRow, t);
        if (changedFields.length > 0) {
          changedTransactions.push({ id: existingRow.id, changedFields });
        }
      }
    }

    return {
      inserted: insertedIds.length,
      skipped: transactions.length - insertedIds.length,
      insertedIds,
      insertedTransactions,
      changedTransactions,
    };
  }

  async uploadPoalimSwiftTransactions(
    swifts: readonly PoalimSwiftTransactionInput[],
  ): Promise<ScraperUploadResult> {
    if (swifts.length === 0)
      return {
        inserted: 0,
        skipped: 0,
        insertedIds: [],
        insertedTransactions: [],
        changedTransactions: [],
      };

    const validated = validatePoalimSwiftTransactions(swifts);

    const transferCatenatedIds = validated
      .map(t => t.transferCatenatedId ?? null)
      .filter((id): id is string => id !== null);

    const existing = await fetchPoalimSwiftByIds.run({ transferCatenatedIds }, this.db);
    const existingById = new Map(existing.map(row => [row.transfer_catenated_id, row]));

    const result = await uploadPoalimSwiftTransactions.run({ transactions: validated }, this.db);
    const insertedIds = result.map(r => r.id).filter((id): id is string => typeof id === 'string');
    const insertedIdSet = new Set(insertedIds);

    const insertedTransactions: InsertedTransactionSummary[] = result.map(r => ({
      id: r.id,
      date: r.start_date ?? null,
      description: r.charge_party_name ?? null,
      amount: r.amount == null ? null : String(r.amount),
      account: r.account_number == null ? null : String(r.account_number),
    }));

    const changedTransactions: ChangedTransaction[] = [];
    for (const t of validated) {
      if (!t.transferCatenatedId) continue;
      const existingRow = existingById.get(t.transferCatenatedId);
      if (existingRow && !insertedIdSet.has(existingRow.id)) {
        const changedFields = diffPoalimSwiftRow(existingRow, t);
        if (changedFields.length > 0) {
          changedTransactions.push({ id: existingRow.id, changedFields });
        }
      }
    }

    return {
      inserted: insertedIds.length,
      skipped: swifts.length - insertedIds.length,
      insertedIds,
      insertedTransactions,
      changedTransactions,
    };
  }

  async uploadIsracardTransactions(
    transactions: readonly IsracardTransactionInput[],
  ): Promise<ScraperUploadResult> {
    if (transactions.length === 0)
      return {
        inserted: 0,
        skipped: 0,
        insertedIds: [],
        insertedTransactions: [],
        changedTransactions: [],
      };

    const validated = validateIsracardAmexTransactions(transactions);

    const cards = [
      ...new Set(validated.map(t => t.card).filter((c): c is number => Number.isFinite(c))),
    ];
    const existing = await fetchIsracardByCards.run({ cards: [...cards] }, this.db);
    const existingByKey = new Map(existing.map(row => [isracardAmexConflictKey(row), row]));

    const result = await uploadIsracardTransactions.run({ transactions: validated }, this.db);
    const insertedIds = result.map(r => r.id).filter((id): id is string => typeof id === 'string');
    const insertedIdSet = new Set(insertedIds);

    const insertedTransactions: InsertedTransactionSummary[] = result.map(r => ({
      id: r.id,
      date: r.full_purchase_date ?? null,
      description: r.supplier_name ?? null,
      amount: r.payment_sum == null ? null : String(r.payment_sum),
      account: String(r.card),
    }));

    const changedTransactions: ChangedTransaction[] = [];
    for (const t of validated) {
      if (t.card === null || t.card === undefined) continue;
      const key = isracardAmexConflictKey({
        card: t.card,
        full_purchase_date: t.fullPurchaseDate ?? null,
        full_purchase_date_outbound: t.fullPurchaseDateOutbound ?? null,
        full_payment_date: t.fullPaymentDate ?? null,
        payment_sum:
          t.paymentSum !== null && t.paymentSum !== undefined ? String(t.paymentSum) : null,
        payment_sum_outbound:
          t.paymentSumOutbound !== null && t.paymentSumOutbound !== undefined
            ? String(t.paymentSumOutbound)
            : null,
        voucher_number: t.voucherNumber ?? null,
        supplier_id: t.supplierId ?? null,
        current_payment_currency: t.currentPaymentCurrency ?? null,
        full_supplier_name_heb: t.fullSupplierNameHeb ?? null,
        full_supplier_name_outbound: t.fullSupplierNameOutbound ?? null,
        more_info: t.moreInfo ?? null,
      });
      const existingRow = existingByKey.get(key);
      if (existingRow && !insertedIdSet.has(existingRow.id)) {
        const changedFields = diffIsracardAmexRow(existingRow, t);
        if (changedFields.length > 0) {
          changedTransactions.push({ id: existingRow.id, changedFields });
        }
      }
    }

    return {
      inserted: insertedIds.length,
      skipped: transactions.length - insertedIds.length,
      insertedIds,
      insertedTransactions,
      changedTransactions,
    };
  }

  async uploadAmexTransactions(
    transactions: readonly AmexTransactionInput[],
  ): Promise<ScraperUploadResult> {
    if (transactions.length === 0)
      return {
        inserted: 0,
        skipped: 0,
        insertedIds: [],
        insertedTransactions: [],
        changedTransactions: [],
      };

    const validated = validateIsracardAmexTransactions(transactions);

    const cards = [
      ...new Set(validated.map(t => t.card).filter((c): c is number => Number.isFinite(c))),
    ];
    const existing = await fetchAmexByCards.run({ cards: [...cards] }, this.db);
    const existingByKey = new Map(existing.map(row => [isracardAmexConflictKey(row), row]));

    const result = await uploadAmexTransactions.run({ transactions: validated }, this.db);
    const insertedIds = result.map(r => r.id).filter((id): id is string => typeof id === 'string');
    const insertedIdSet = new Set(insertedIds);

    const insertedTransactions: InsertedTransactionSummary[] = result.map(r => ({
      id: r.id,
      date: r.full_purchase_date ?? null,
      description: r.supplier_name ?? null,
      amount: r.payment_sum == null ? null : String(r.payment_sum),
      account: String(r.card),
    }));

    const changedTransactions: ChangedTransaction[] = [];
    for (const t of validated) {
      if (t.card === null || t.card === undefined) continue;
      const key = isracardAmexConflictKey({
        card: t.card,
        full_purchase_date: t.fullPurchaseDate ?? null,
        full_purchase_date_outbound: t.fullPurchaseDateOutbound ?? null,
        full_payment_date: t.fullPaymentDate ?? null,
        payment_sum:
          t.paymentSum !== null && t.paymentSum !== undefined ? String(t.paymentSum) : null,
        payment_sum_outbound:
          t.paymentSumOutbound !== null && t.paymentSumOutbound !== undefined
            ? String(t.paymentSumOutbound)
            : null,
        voucher_number: t.voucherNumber ?? null,
        supplier_id: t.supplierId ?? null,
        current_payment_currency: t.currentPaymentCurrency ?? null,
        full_supplier_name_heb: t.fullSupplierNameHeb ?? null,
        full_supplier_name_outbound: t.fullSupplierNameOutbound ?? null,
        more_info: t.moreInfo ?? null,
      });
      const existingRow = existingByKey.get(key);
      if (existingRow && !insertedIdSet.has(existingRow.id)) {
        const changedFields = diffIsracardAmexRow(existingRow, t);
        if (changedFields.length > 0) {
          changedTransactions.push({ id: existingRow.id, changedFields });
        }
      }
    }

    return {
      inserted: insertedIds.length,
      skipped: transactions.length - insertedIds.length,
      insertedIds,
      insertedTransactions,
      changedTransactions,
    };
  }

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
      const description = (['usd', 'eur', 'gbp', 'cad', 'jpy', 'aud', 'sek'] as const)
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
