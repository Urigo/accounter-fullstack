import { GraphQLError } from 'graphql';
import { Injectable, Scope } from 'graphql-modules';
import { sql } from '@pgtyped/runtime';
import type {
  ChangedField,
  ChangedTransaction,
  InsertedTransactionSummary,
  PoalimForeignTransactionInput,
  PoalimIlsTransactionInput,
  PoalimSecurityInput,
  PoalimSecurityTransactionInput,
  PoalimSwiftTransactionInput,
  ScraperUploadResult,
} from '../../../__generated__/types.js';
import { instantToTimelessDate } from '../../../shared/helpers/index.js';
import type { TimelessDateString } from '../../../shared/types/index.js';
import { AdminContextProvider } from '../../admin-context/providers/admin-context.provider.js';
import { TenantAwareDBClient } from '../../app-providers/tenant-db-client.js';
import { AuthContextProvider } from '../../auth/providers/auth-context.provider.js';
import { getSecurityLocality } from '../../foreign-securities/helpers/security-locality.helper.js';
import { SecurityBusinessesProvider } from '../../foreign-securities/providers/security-businesses.provider.js';
import { SecurityExecutionChargesProvider } from '../../foreign-securities/providers/security-execution-charges.provider.js';
import type { SecurityBusinessDescriptors } from '../../foreign-securities/types.js';
import {
  assignSecurityTransactionOccurrences,
  dropRepeatedSecurityTransactions,
  securityTransactionKeyOf,
} from '../helpers/security-transaction-identity.helper.js';
import { formatValue } from '../helpers/utils.helper.js';
import {
  validatePoalimForeignTransactions,
  validatePoalimIlsTransactions,
  validatePoalimSecurities,
  validatePoalimSecuritiesTransactions,
  validatePoalimSwiftTransactions,
} from '../helpers/validators.helper.js';
import type {
  IFetchPoalimForeignByKeysQuery,
  IFetchPoalimForeignByKeysResult,
  IFetchPoalimIlsByKeysQuery,
  IFetchPoalimIlsByKeysResult,
  IFetchPoalimSecuritiesByKeysQuery,
  IFetchPoalimSecuritiesByKeysResult,
  IFetchPoalimSecuritiesTransactionsByKeysQuery,
  IFetchPoalimSecuritiesTransactionsByKeysResult,
  IFetchPoalimSwiftByIdsQuery,
  IFetchPoalimSwiftByIdsResult,
  IUploadPoalimForeignTransactionsParams,
  IUploadPoalimForeignTransactionsQuery,
  IUploadPoalimForeignTransactionsResult,
  IUploadPoalimIlsTransactionsParams,
  IUploadPoalimIlsTransactionsQuery,
  IUploadPoalimIlsTransactionsResult,
  IUploadPoalimSecuritiesParams,
  IUploadPoalimSecuritiesQuery,
  IUploadPoalimSecuritiesResult,
  IUploadPoalimSecuritiesTransactionsParams,
  IUploadPoalimSecuritiesTransactionsQuery,
  IUploadPoalimSecuritiesTransactionsResult,
  IUploadPoalimSwiftTransactionsParams,
  IUploadPoalimSwiftTransactionsQuery,
  IUploadPoalimSwiftTransactionsResult,
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

const fetchPoalimSecuritiesByKeys = sql<IFetchPoalimSecuritiesByKeysQuery>`
  SELECT
    id,
    bank_number,
    branch_number,
    account_number,
    as_of_date,
    security_key,
    eng_name,
    heb_name,
    item_type,
    is_etf,
    is_foreign,
    currency_code,
    exchange,
    equity_type,
    allowed_order_direction,
    equity_sub_type,
    eng_symbol,
    heb_symbol,
    symbol,
    expiration_date,
    stock_type,
    creation_equity_num,
    contract_type
  FROM accounter_schema.poalim_securities
  WHERE bank_number = ANY($bankNumbers!)
    AND branch_number = ANY($branchNumbers!)
    AND account_number = ANY($accountNumbers!)
    AND security_key = ANY($securityKeys!)
`;

const uploadPoalimSecurities = sql<IUploadPoalimSecuritiesQuery>`
  INSERT INTO accounter_schema.poalim_securities (
    bank_number,
    branch_number,
    account_number,
    as_of_date,
    security_key,
    eng_name,
    heb_name,
    item_type,
    is_etf,
    is_foreign,
    currency_code,
    exchange,
    equity_type,
    allowed_order_direction,
    equity_sub_type,
    eng_symbol,
    heb_symbol,
    symbol,
    expiration_date,
    stock_type,
    creation_equity_num,
    contract_type,
    owner_id
  )
  VALUES $$securities(
    bankNumber,
    branchNumber,
    accountNumber,
    asOfDate,
    securityKey,
    engName,
    hebName,
    itemType,
    isEtf,
    isForeign,
    currencyCode,
    exchange,
    equityType,
    allowedOrderDirection,
    equitySubType,
    engSymbol,
    hebSymbol,
    symbol,
    expirationDate,
    stockType,
    creationEquityNum,
    contractType,
    ownerId
  )
  ON CONFLICT (owner_id, bank_number, branch_number, account_number, security_key) DO NOTHING
  RETURNING id, bank_number, branch_number, account_number, security_key, eng_name, as_of_date;
`;

const fetchPoalimSecuritiesTransactionsByKeys = sql<IFetchPoalimSecuritiesTransactionsByKeysQuery>`
  SELECT
    id,
    bank_number,
    branch_number,
    account_number,
    security,
    trade_date,
    value_date,
    settlement_date,
    trade_type,
    transaction_type,
    nv,
    trade_price,
    net_value_trade_currency,
    payment_type,
    payment_date,
    ex_date,
    cancel_date,
    isin,
    symbol,
    eng_name,
    heb_name,
    security_group,
    trade_currency,
    settlement_currency,
    trade_gross_value_trade_currency,
    trade_gross_value_nis,
    net_value_nis,
    net_value_settlement_currency,
    trade_commission_value_nis,
    israe_tax_value,
    foreign_tax_value_settlement_currency,
    capital_tax_value_settlement_currency,
    is_cancel_transaction,
    occurrence
  FROM accounter_schema.poalim_securities_transactions
  WHERE bank_number = ANY($bankNumbers!)
    AND branch_number = ANY($branchNumbers!)
    AND account_number = ANY($accountNumbers!)
    AND security = ANY($securities!)
    AND trade_date = ANY($tradeDates!)
`;

/**
 * Upserts on the dedup key, which leaves out the fields the bank restates as an execution
 * settles (value/settlement dates, price, net value). A re-scrape of a known execution therefore
 * overwrites it with the bank's latest figures instead of adding a second row; the WHERE skips the
 * write when nothing changed. `inserted` tells new rows from updated ones in RETURNING.
 */
const uploadPoalimSecuritiesTransactions = sql<IUploadPoalimSecuritiesTransactionsQuery>`
  INSERT INTO accounter_schema.poalim_securities_transactions (
    owner_id,
    bank_number,
    branch_number,
    account_number,
    security,
    trade_date,
    value_date,
    settlement_date,
    trade_type,
    transaction_type,
    nv,
    trade_price,
    net_value_trade_currency,
    payment_type,
    payment_date,
    ex_date,
    cancel_date,
    isin,
    symbol,
    symbol_osi,
    eng_name,
    heb_name,
    eng_name_full,
    heb_name_full,
    security_group,
    security_sub_group,
    issue_currency,
    issuer_country,
    issuer_country_code,
    issuer_exchange,
    exchange_country,
    is_tradable,
    is_us_equity,
    is_jumbo,
    implied_asset_mult,
    expiry_date,
    trade_currency,
    settlement_currency,
    commissions_currency,
    payment_currency,
    trade_gross_value_trade_currency,
    trade_gross_value_nis,
    net_value_nis,
    net_value_settlement_currency,
    settlement_price,
    trade_commission_percent,
    trade_commission_value_nis,
    trade_commission_value_trade_currency,
    agent_commission_value_trade_currency,
    management_fees_percent,
    management_fees_value_nis,
    management_fees_value_trade_currency,
    israe_tax_value,
    israel_tax_percent,
    israel_tax_value_by_payments_settlement_currency,
    foreign_tax_percent,
    foreign_tax_value_settlement_currency,
    capital_tax_percent,
    capital_tax_value_settlement_currency,
    post_deduction_tax_value_nis,
    previous_actions_deductions,
    post_action_deduction_balance,
    nominal_profit_loss_nis,
    nominal_profit_loss_linkage,
    real_profit_loss_nis,
    accumulated_interest,
    fund_plus_accumulated_inerest_value,
    peyment_pecentage,
    payment_linking_value,
    ex_date_balance,
    issue_currency_to_trade_currency_rate,
    trade_currnecy_rate,
    personal_currency_rate,
    payment_name,
    order_origin,
    order_type,
    order_subject,
    ordered_nv,
    executed_nv,
    ordered_value,
    execution_date,
    last_tranaction_date,
    is_cancel_transaction,
    executing_branch,
    financial_account_branch,
    financial_account_number,
    account_name,
    occurrence
  )
  VALUES $$transactions(
    ownerId,
    bankNumber,
    branchNumber,
    accountNumber,
    security,
    tradeDate,
    valueDate,
    settlementDate,
    tradeType,
    transactionType,
    nv,
    tradePrice,
    netValueTradeCurrency,
    paymentType,
    paymentDate,
    exDate,
    cancelDate,
    isin,
    symbol,
    symbolOsi,
    engName,
    hebName,
    engNameFull,
    hebNameFull,
    securityGroup,
    securitySubGroup,
    issueCurrency,
    issuerCountry,
    issuerCountryCode,
    issuerExchange,
    exchangeCountry,
    isTradable,
    isUsEquity,
    isJumbo,
    impliedAssetMult,
    expiryDate,
    tradeCurrency,
    settlementCurrency,
    commissionsCurrency,
    paymentCurrency,
    tradeGrossValueTradeCurrency,
    tradeGrossValueNis,
    netValueNis,
    netValueSettlementCurrency,
    settlementPrice,
    tradeCommissionPercent,
    tradeCommissionValueNis,
    tradeCommissionValueTradeCurrency,
    agentCommissionValueTradeCurrency,
    managementFeesPercent,
    managementFeesValueNis,
    managementFeesValueTradeCurrency,
    israeTaxValue,
    israelTaxPercent,
    israelTaxValueByPaymentsSettlementCurrency,
    foreignTaxPercent,
    foreignTaxValueSettlementCurrency,
    capitalTaxPercent,
    capitalTaxValueSettlementCurrency,
    postDeductionTaxValueNis,
    previousActionsDeductions,
    postActionDeductionBalance,
    nominalProfitLossNis,
    nominalProfitLossLinkage,
    realProfitLossNis,
    accumulatedInterest,
    fundPlusAccumulatedInerestValue,
    peymentPecentage,
    paymentLinkingValue,
    exDateBalance,
    issueCurrencyToTradeCurrencyRate,
    tradeCurrnecyRate,
    personalCurrencyRate,
    paymentName,
    orderOrigin,
    orderType,
    orderSubject,
    orderedNv,
    executedNv,
    orderedValue,
    executionDate,
    lastTranactionDate,
    isCancelTransaction,
    executingBranch,
    financialAccountBranch,
    financialAccountNumber,
    accountName,
    occurrence
  )
  ON CONFLICT (
    owner_id,
    bank_number,
    branch_number,
    account_number,
    security,
    trade_date,
    trade_type,
    transaction_type,
    nv,
    payment_type,
    payment_date,
    ex_date,
    cancel_date,
    occurrence
  ) DO UPDATE SET
    value_date = EXCLUDED.value_date,
    settlement_date = EXCLUDED.settlement_date,
    trade_price = EXCLUDED.trade_price,
    net_value_trade_currency = EXCLUDED.net_value_trade_currency,
    isin = EXCLUDED.isin,
    symbol = EXCLUDED.symbol,
    symbol_osi = EXCLUDED.symbol_osi,
    eng_name = EXCLUDED.eng_name,
    heb_name = EXCLUDED.heb_name,
    eng_name_full = EXCLUDED.eng_name_full,
    heb_name_full = EXCLUDED.heb_name_full,
    security_group = EXCLUDED.security_group,
    security_sub_group = EXCLUDED.security_sub_group,
    issue_currency = EXCLUDED.issue_currency,
    issuer_country = EXCLUDED.issuer_country,
    issuer_country_code = EXCLUDED.issuer_country_code,
    issuer_exchange = EXCLUDED.issuer_exchange,
    exchange_country = EXCLUDED.exchange_country,
    is_tradable = EXCLUDED.is_tradable,
    is_us_equity = EXCLUDED.is_us_equity,
    is_jumbo = EXCLUDED.is_jumbo,
    implied_asset_mult = EXCLUDED.implied_asset_mult,
    expiry_date = EXCLUDED.expiry_date,
    trade_currency = EXCLUDED.trade_currency,
    settlement_currency = EXCLUDED.settlement_currency,
    commissions_currency = EXCLUDED.commissions_currency,
    payment_currency = EXCLUDED.payment_currency,
    trade_gross_value_trade_currency = EXCLUDED.trade_gross_value_trade_currency,
    trade_gross_value_nis = EXCLUDED.trade_gross_value_nis,
    net_value_nis = EXCLUDED.net_value_nis,
    net_value_settlement_currency = EXCLUDED.net_value_settlement_currency,
    settlement_price = EXCLUDED.settlement_price,
    trade_commission_percent = EXCLUDED.trade_commission_percent,
    trade_commission_value_nis = EXCLUDED.trade_commission_value_nis,
    trade_commission_value_trade_currency = EXCLUDED.trade_commission_value_trade_currency,
    agent_commission_value_trade_currency = EXCLUDED.agent_commission_value_trade_currency,
    management_fees_percent = EXCLUDED.management_fees_percent,
    management_fees_value_nis = EXCLUDED.management_fees_value_nis,
    management_fees_value_trade_currency = EXCLUDED.management_fees_value_trade_currency,
    israe_tax_value = EXCLUDED.israe_tax_value,
    israel_tax_percent = EXCLUDED.israel_tax_percent,
    israel_tax_value_by_payments_settlement_currency = EXCLUDED.israel_tax_value_by_payments_settlement_currency,
    foreign_tax_percent = EXCLUDED.foreign_tax_percent,
    foreign_tax_value_settlement_currency = EXCLUDED.foreign_tax_value_settlement_currency,
    capital_tax_percent = EXCLUDED.capital_tax_percent,
    capital_tax_value_settlement_currency = EXCLUDED.capital_tax_value_settlement_currency,
    post_deduction_tax_value_nis = EXCLUDED.post_deduction_tax_value_nis,
    previous_actions_deductions = EXCLUDED.previous_actions_deductions,
    post_action_deduction_balance = EXCLUDED.post_action_deduction_balance,
    nominal_profit_loss_nis = EXCLUDED.nominal_profit_loss_nis,
    nominal_profit_loss_linkage = EXCLUDED.nominal_profit_loss_linkage,
    real_profit_loss_nis = EXCLUDED.real_profit_loss_nis,
    accumulated_interest = EXCLUDED.accumulated_interest,
    fund_plus_accumulated_inerest_value = EXCLUDED.fund_plus_accumulated_inerest_value,
    peyment_pecentage = EXCLUDED.peyment_pecentage,
    payment_linking_value = EXCLUDED.payment_linking_value,
    ex_date_balance = EXCLUDED.ex_date_balance,
    issue_currency_to_trade_currency_rate = EXCLUDED.issue_currency_to_trade_currency_rate,
    trade_currnecy_rate = EXCLUDED.trade_currnecy_rate,
    personal_currency_rate = EXCLUDED.personal_currency_rate,
    payment_name = EXCLUDED.payment_name,
    order_origin = EXCLUDED.order_origin,
    order_type = EXCLUDED.order_type,
    order_subject = EXCLUDED.order_subject,
    ordered_nv = EXCLUDED.ordered_nv,
    executed_nv = EXCLUDED.executed_nv,
    ordered_value = EXCLUDED.ordered_value,
    execution_date = EXCLUDED.execution_date,
    last_tranaction_date = EXCLUDED.last_tranaction_date,
    is_cancel_transaction = EXCLUDED.is_cancel_transaction,
    executing_branch = EXCLUDED.executing_branch,
    financial_account_branch = EXCLUDED.financial_account_branch,
    financial_account_number = EXCLUDED.financial_account_number,
    account_name = EXCLUDED.account_name
  WHERE (
    poalim_securities_transactions.value_date,
    poalim_securities_transactions.settlement_date,
    poalim_securities_transactions.trade_price,
    poalim_securities_transactions.net_value_trade_currency,
    poalim_securities_transactions.isin,
    poalim_securities_transactions.symbol,
    poalim_securities_transactions.symbol_osi,
    poalim_securities_transactions.eng_name,
    poalim_securities_transactions.heb_name,
    poalim_securities_transactions.eng_name_full,
    poalim_securities_transactions.heb_name_full,
    poalim_securities_transactions.security_group,
    poalim_securities_transactions.security_sub_group,
    poalim_securities_transactions.issue_currency,
    poalim_securities_transactions.issuer_country,
    poalim_securities_transactions.issuer_country_code,
    poalim_securities_transactions.issuer_exchange,
    poalim_securities_transactions.exchange_country,
    poalim_securities_transactions.is_tradable,
    poalim_securities_transactions.is_us_equity,
    poalim_securities_transactions.is_jumbo,
    poalim_securities_transactions.implied_asset_mult,
    poalim_securities_transactions.expiry_date,
    poalim_securities_transactions.trade_currency,
    poalim_securities_transactions.settlement_currency,
    poalim_securities_transactions.commissions_currency,
    poalim_securities_transactions.payment_currency,
    poalim_securities_transactions.trade_gross_value_trade_currency,
    poalim_securities_transactions.trade_gross_value_nis,
    poalim_securities_transactions.net_value_nis,
    poalim_securities_transactions.net_value_settlement_currency,
    poalim_securities_transactions.settlement_price,
    poalim_securities_transactions.trade_commission_percent,
    poalim_securities_transactions.trade_commission_value_nis,
    poalim_securities_transactions.trade_commission_value_trade_currency,
    poalim_securities_transactions.agent_commission_value_trade_currency,
    poalim_securities_transactions.management_fees_percent,
    poalim_securities_transactions.management_fees_value_nis,
    poalim_securities_transactions.management_fees_value_trade_currency,
    poalim_securities_transactions.israe_tax_value,
    poalim_securities_transactions.israel_tax_percent,
    poalim_securities_transactions.israel_tax_value_by_payments_settlement_currency,
    poalim_securities_transactions.foreign_tax_percent,
    poalim_securities_transactions.foreign_tax_value_settlement_currency,
    poalim_securities_transactions.capital_tax_percent,
    poalim_securities_transactions.capital_tax_value_settlement_currency,
    poalim_securities_transactions.post_deduction_tax_value_nis,
    poalim_securities_transactions.previous_actions_deductions,
    poalim_securities_transactions.post_action_deduction_balance,
    poalim_securities_transactions.nominal_profit_loss_nis,
    poalim_securities_transactions.nominal_profit_loss_linkage,
    poalim_securities_transactions.real_profit_loss_nis,
    poalim_securities_transactions.accumulated_interest,
    poalim_securities_transactions.fund_plus_accumulated_inerest_value,
    poalim_securities_transactions.peyment_pecentage,
    poalim_securities_transactions.payment_linking_value,
    poalim_securities_transactions.ex_date_balance,
    poalim_securities_transactions.issue_currency_to_trade_currency_rate,
    poalim_securities_transactions.trade_currnecy_rate,
    poalim_securities_transactions.personal_currency_rate,
    poalim_securities_transactions.payment_name,
    poalim_securities_transactions.order_origin,
    poalim_securities_transactions.order_type,
    poalim_securities_transactions.order_subject,
    poalim_securities_transactions.ordered_nv,
    poalim_securities_transactions.executed_nv,
    poalim_securities_transactions.ordered_value,
    poalim_securities_transactions.execution_date,
    poalim_securities_transactions.last_tranaction_date,
    poalim_securities_transactions.is_cancel_transaction,
    poalim_securities_transactions.executing_branch,
    poalim_securities_transactions.financial_account_branch,
    poalim_securities_transactions.financial_account_number,
    poalim_securities_transactions.account_name
  ) IS DISTINCT FROM (
    EXCLUDED.value_date,
    EXCLUDED.settlement_date,
    EXCLUDED.trade_price,
    EXCLUDED.net_value_trade_currency,
    EXCLUDED.isin,
    EXCLUDED.symbol,
    EXCLUDED.symbol_osi,
    EXCLUDED.eng_name,
    EXCLUDED.heb_name,
    EXCLUDED.eng_name_full,
    EXCLUDED.heb_name_full,
    EXCLUDED.security_group,
    EXCLUDED.security_sub_group,
    EXCLUDED.issue_currency,
    EXCLUDED.issuer_country,
    EXCLUDED.issuer_country_code,
    EXCLUDED.issuer_exchange,
    EXCLUDED.exchange_country,
    EXCLUDED.is_tradable,
    EXCLUDED.is_us_equity,
    EXCLUDED.is_jumbo,
    EXCLUDED.implied_asset_mult,
    EXCLUDED.expiry_date,
    EXCLUDED.trade_currency,
    EXCLUDED.settlement_currency,
    EXCLUDED.commissions_currency,
    EXCLUDED.payment_currency,
    EXCLUDED.trade_gross_value_trade_currency,
    EXCLUDED.trade_gross_value_nis,
    EXCLUDED.net_value_nis,
    EXCLUDED.net_value_settlement_currency,
    EXCLUDED.settlement_price,
    EXCLUDED.trade_commission_percent,
    EXCLUDED.trade_commission_value_nis,
    EXCLUDED.trade_commission_value_trade_currency,
    EXCLUDED.agent_commission_value_trade_currency,
    EXCLUDED.management_fees_percent,
    EXCLUDED.management_fees_value_nis,
    EXCLUDED.management_fees_value_trade_currency,
    EXCLUDED.israe_tax_value,
    EXCLUDED.israel_tax_percent,
    EXCLUDED.israel_tax_value_by_payments_settlement_currency,
    EXCLUDED.foreign_tax_percent,
    EXCLUDED.foreign_tax_value_settlement_currency,
    EXCLUDED.capital_tax_percent,
    EXCLUDED.capital_tax_value_settlement_currency,
    EXCLUDED.post_deduction_tax_value_nis,
    EXCLUDED.previous_actions_deductions,
    EXCLUDED.post_action_deduction_balance,
    EXCLUDED.nominal_profit_loss_nis,
    EXCLUDED.nominal_profit_loss_linkage,
    EXCLUDED.real_profit_loss_nis,
    EXCLUDED.accumulated_interest,
    EXCLUDED.fund_plus_accumulated_inerest_value,
    EXCLUDED.peyment_pecentage,
    EXCLUDED.payment_linking_value,
    EXCLUDED.ex_date_balance,
    EXCLUDED.issue_currency_to_trade_currency_rate,
    EXCLUDED.trade_currnecy_rate,
    EXCLUDED.personal_currency_rate,
    EXCLUDED.payment_name,
    EXCLUDED.order_origin,
    EXCLUDED.order_type,
    EXCLUDED.order_subject,
    EXCLUDED.ordered_nv,
    EXCLUDED.executed_nv,
    EXCLUDED.ordered_value,
    EXCLUDED.execution_date,
    EXCLUDED.last_tranaction_date,
    EXCLUDED.is_cancel_transaction,
    EXCLUDED.executing_branch,
    EXCLUDED.financial_account_branch,
    EXCLUDED.financial_account_number,
    EXCLUDED.account_name
  )
  RETURNING
    id,
    trade_date,
    trade_type,
    eng_name,
    net_value_trade_currency,
    branch_number,
    account_number,
    (xmax = 0) AS inserted;
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

const POALIM_FOREIGN_NUMERIC_FIELDS: (keyof IFetchPoalimForeignByKeysResult)[] = [
  'event_amount',
  'current_balance',
  'currency_rate',
] as const;

function diffPoalimForeignRow(
  existing: IFetchPoalimForeignByKeysResult,
  incoming: IUploadPoalimForeignTransactionsParams['transactions'][number],
): ChangedField[] {
  const changed: ChangedField[] = [];
  for (const { key, incoming: getIncoming } of POALIM_FOREIGN_DIFF_FIELDS) {
    const isNumberField = POALIM_FOREIGN_NUMERIC_FIELDS.includes(key);
    const oldValue = formatValue(existing[key], isNumberField);
    const newValue = formatValue(getIncoming(incoming), isNumberField);
    if (oldValue !== newValue) {
      changed.push({ field: key, oldValue, newValue });
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

/**
 * The scraper sends a blank placeholder (`' '`) for absent optional SWIFT fields, while rows
 * already in the DB may hold `null` for the same absence. Treat both as `null` so they don't
 * register as a change.
 */
function normalizeSwiftDiffValue(value: unknown): string {
  if (value == null) return 'null';
  const str = String(value);
  return str.trim() === '' ? 'null' : str;
}

function diffPoalimSwiftRow(
  existing: IFetchPoalimSwiftByIdsResult,
  incoming: IUploadPoalimSwiftTransactionsParams['transactions'][number],
): ChangedField[] {
  const changed: ChangedField[] = [];
  for (const { key, incoming: getIncoming } of POALIM_SWIFT_DIFF_FIELDS) {
    const oldStr = normalizeSwiftDiffValue(existing[key]);
    const newStr = normalizeSwiftDiffValue(getIncoming(incoming));
    if (oldStr !== newStr) {
      changed.push({ field: key, oldValue: oldStr, newValue: newStr });
    }
  }
  return changed;
}

/**
 * as_of_date is deliberately absent: it changes on every scrape and would flag
 * every row as changed. Only the security's own attributes are compared.
 */
const POALIM_SECURITIES_DIFF_FIELDS: Array<{
  key: keyof IFetchPoalimSecuritiesByKeysResult;
  incoming: (
    s: IUploadPoalimSecuritiesParams['securities'][number],
  ) => string | number | boolean | null;
}> = [
  { key: 'eng_name', incoming: s => s.engName ?? null },
  { key: 'heb_name', incoming: s => s.hebName ?? null },
  { key: 'item_type', incoming: s => s.itemType ?? null },
  { key: 'is_etf', incoming: s => s.isEtf ?? null },
  { key: 'is_foreign', incoming: s => s.isForeign ?? null },
  { key: 'currency_code', incoming: s => s.currencyCode ?? null },
  { key: 'exchange', incoming: s => s.exchange ?? null },
  { key: 'equity_type', incoming: s => s.equityType ?? null },
  { key: 'allowed_order_direction', incoming: s => s.allowedOrderDirection ?? null },
  { key: 'equity_sub_type', incoming: s => s.equitySubType ?? null },
  { key: 'eng_symbol', incoming: s => s.engSymbol ?? null },
  { key: 'heb_symbol', incoming: s => s.hebSymbol ?? null },
  { key: 'symbol', incoming: s => s.symbol ?? null },
  { key: 'expiration_date', incoming: s => s.expirationDate ?? null },
  { key: 'stock_type', incoming: s => s.stockType ?? null },
  { key: 'creation_equity_num', incoming: s => s.creationEquityNum ?? null },
  { key: 'contract_type', incoming: s => s.contractType ?? null },
];

const POALIM_SECURITIES_NUMERIC_FIELDS: (keyof IFetchPoalimSecuritiesByKeysResult)[] = [
  'equity_type',
  'equity_sub_type',
] as const;

function diffPoalimSecurityRow(
  existing: IFetchPoalimSecuritiesByKeysResult,
  incoming: IUploadPoalimSecuritiesParams['securities'][number],
): ChangedField[] {
  const changed: ChangedField[] = [];
  for (const { key, incoming: getIncoming } of POALIM_SECURITIES_DIFF_FIELDS) {
    const isNumberField = POALIM_SECURITIES_NUMERIC_FIELDS.includes(key);
    const oldValue = formatValue(existing[key], isNumberField);
    const newValue = formatValue(getIncoming(incoming), isNumberField);
    if (oldValue !== newValue) {
      changed.push({ field: key, oldValue, newValue });
    }
  }
  return changed;
}

/**
 * Only the fields that are *not* part of the dedup key can differ on a matched row —
 * everything in the key is, by definition, identical. These are the descriptive and
 * monetary fields the bank could restate after the fact, led by the ones it restates as
 * an execution settles (value/settlement dates, price and net value).
 */
const POALIM_SECURITIES_TRANSACTIONS_DIFF_FIELDS: Array<{
  key: keyof IFetchPoalimSecuritiesTransactionsByKeysResult;
  incoming: (
    t: IUploadPoalimSecuritiesTransactionsParams['transactions'][number],
  ) => string | number | boolean | null;
}> = [
  { key: 'value_date', incoming: t => t.valueDate ?? null },
  { key: 'settlement_date', incoming: t => t.settlementDate ?? null },
  { key: 'trade_price', incoming: t => t.tradePrice ?? null },
  { key: 'net_value_trade_currency', incoming: t => t.netValueTradeCurrency ?? null },
  { key: 'isin', incoming: t => t.isin ?? null },
  { key: 'symbol', incoming: t => t.symbol ?? null },
  { key: 'eng_name', incoming: t => t.engName ?? null },
  { key: 'heb_name', incoming: t => t.hebName ?? null },
  { key: 'security_group', incoming: t => t.securityGroup ?? null },
  { key: 'trade_currency', incoming: t => t.tradeCurrency ?? null },
  { key: 'settlement_currency', incoming: t => t.settlementCurrency ?? null },
  {
    key: 'trade_gross_value_trade_currency',
    incoming: t => t.tradeGrossValueTradeCurrency ?? null,
  },
  { key: 'trade_gross_value_nis', incoming: t => t.tradeGrossValueNis ?? null },
  { key: 'net_value_nis', incoming: t => t.netValueNis ?? null },
  { key: 'net_value_settlement_currency', incoming: t => t.netValueSettlementCurrency ?? null },
  { key: 'trade_commission_value_nis', incoming: t => t.tradeCommissionValueNis ?? null },
  { key: 'israe_tax_value', incoming: t => t.israeTaxValue ?? null },
  {
    key: 'foreign_tax_value_settlement_currency',
    incoming: t => t.foreignTaxValueSettlementCurrency ?? null,
  },
  {
    key: 'capital_tax_value_settlement_currency',
    incoming: t => t.capitalTaxValueSettlementCurrency ?? null,
  },
  { key: 'is_cancel_transaction', incoming: t => t.isCancelTransaction ?? null },
];

const POALIM_SECURITIES_TRANSACTIONS_NUMERIC_FIELDS: (keyof IFetchPoalimSecuritiesTransactionsByKeysResult)[] =
  [
    'trade_price',
    'net_value_trade_currency',
    'trade_gross_value_trade_currency',
    'trade_gross_value_nis',
    'net_value_nis',
    'net_value_settlement_currency',
    'trade_commission_value_nis',
    'israe_tax_value',
    'foreign_tax_value_settlement_currency',
    'capital_tax_value_settlement_currency',
  ] as const;

function diffPoalimSecurityTransactionRow(
  existing: IFetchPoalimSecuritiesTransactionsByKeysResult,
  incoming: IUploadPoalimSecuritiesTransactionsParams['transactions'][number],
): ChangedField[] {
  const changed: ChangedField[] = [];
  for (const { key, incoming: getIncoming } of POALIM_SECURITIES_TRANSACTIONS_DIFF_FIELDS) {
    const isNumberField = POALIM_SECURITIES_TRANSACTIONS_NUMERIC_FIELDS.includes(key);
    const oldValue = formatValue(existing[key], isNumberField);
    const newValue = formatValue(getIncoming(incoming), isNumberField);
    if (oldValue !== newValue) {
      changed.push({ field: key, oldValue, newValue });
    }
  }
  return changed;
}

/** The descriptor columns a security business is built from, as the payload spells them. */
type SecurityDescriptorSource = {
  isin?: string | null | void;
  security?: string | null | void;
  symbol?: string | null | void;
  engName?: string | null | void;
  hebName?: string | null | void;
  issuerExchange?: string | null | void;
  tradeCurrency?: string | null | void;
  issuerCountryCode?: string | null | void;
};

/** pgtyped spells an absent value `void`; the descriptors take null. */
const text = (value: string | null | void): string | null => value ?? null;

@Injectable({
  scope: Scope.Operation,
  global: true,
})
export class PoalimScraperIngestionProvider {
  private businessIdCache: string | null = null;

  constructor(
    private db: TenantAwareDBClient,
    private authContextProvider: AuthContextProvider,
    private adminContextProvider: AdminContextProvider,
    private securityBusinessesProvider: SecurityBusinessesProvider,
    private securityExecutionChargesProvider: SecurityExecutionChargesProvider,
  ) {}

  /**
   * Give every security in the payload a business of its own, and record the Poalim key it is
   * known by here.
   *
   * Driven off the whole validated payload rather than only the newly inserted rows: a
   * re-scrape inserts nothing, but a security whose business was never created (ingested
   * before this existed, or created while an earlier scrape failed here) still needs one.
   * Both steps are idempotent, and `ensureSecurityBusinesses` settles the whole payload with a
   * single lookup, so a repeat scrape costs one query rather than one per security.
   *
   * Rows with no ISIN are skipped: the ISIN is the identity, and one cannot be invented from
   * the Poalim key alone. Those securities stay unlinked and are assigned by hand.
   *
   * Failures are logged rather than thrown: the executions are already stored, and reporting
   * the upload as failed would be a lie. The next scrape repairs the gap.
   */
  private async ensureSecurityBusinesses(
    transactions: readonly SecurityDescriptorSource[],
  ): Promise<void> {
    const bySecurityIsin = new Map<
      string,
      { descriptors: SecurityBusinessDescriptors; poalimKeys: Set<string> }
    >();

    for (const transaction of transactions) {
      const isin = transaction.isin?.trim();
      if (!isin) {
        continue;
      }

      let entry = bySecurityIsin.get(isin);
      if (!entry) {
        entry = {
          descriptors: {
            isin,
            symbol: text(transaction.symbol),
            engName: text(transaction.engName),
            hebName: text(transaction.hebName),
            exchange: text(transaction.issuerExchange),
            currencyCode: text(transaction.tradeCurrency),
            issuerCountryCode: text(transaction.issuerCountryCode),
          },
          poalimKeys: new Set(),
        };
        bySecurityIsin.set(isin, entry);
      }
      if (transaction.security) {
        entry.poalimKeys.add(transaction.security);
      }
    }

    if (bySecurityIsin.size === 0) {
      return;
    }

    try {
      const { locality } = await this.adminContextProvider.getVerifiedAdminContext();
      const securityBusinesses = await this.securityBusinessesProvider.ensureSecurityBusinesses(
        [...bySecurityIsin.values()].map(({ descriptors }) => {
          const securityLocality = getSecurityLocality(
            { issuer_country_code: descriptors.issuerCountryCode, isin: descriptors.isin },
            locality,
          );
          return {
            ...descriptors,
            isForeign: securityLocality === null ? null : securityLocality === 'FOREIGN',
          };
        }),
      );

      for (const [isin, { poalimKeys }] of bySecurityIsin) {
        const securityBusiness = securityBusinesses.get(isin);
        if (!securityBusiness) {
          continue;
        }

        for (const poalimKey of poalimKeys) {
          await this.securityBusinessesProvider.linkIdentifier(
            securityBusiness.id,
            'POALIM_SECURITY_KEY',
            poalimKey,
          );
        }
      }
    } catch (error) {
      console.error('Failed to create security businesses for ingested executions:', error);
    }
  }

  /**
   * Give every stock distribution paid as a dividend in kind a charge of its own (see
   * `SecurityExecutionChargesProvider.ensureDistributionCharges`). It has no cash leg, so no bank
   * transaction would ever bring it into a charge, and without one it is never booked.
   *
   * Logged rather than thrown, like `ensureSecurityBusinesses`: the executions are stored, and the
   * next upload retries whatever is still unlinked.
   */
  private async ensureDistributionCharges(ownerId: string): Promise<void> {
    try {
      const { ledgerLock } = await this.adminContextProvider.getVerifiedAdminContext();
      await this.securityExecutionChargesProvider.ensureDistributionCharges(
        ownerId,
        ledgerLock ?? null,
      );
    } catch (error) {
      console.error('Failed to create charges for ingested stock distributions:', error);
    }
  }

  private async getBusinessId() {
    if (this.businessIdCache !== null) {
      return this.businessIdCache;
    }
    const authContext = await this.authContextProvider.getAuthContext();
    this.businessIdCache = authContext?.tenant.businessId ?? null;
    return this.businessIdCache;
  }

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
      .map(t => t.eventDate || null)
      .filter((d): d is TimelessDateString => d !== null);
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
      const key: ConflictKey = `${row.event_date ?? ''}_${row.serial_number}_${row.account_number}_${row.branch_number}`;
      existingByKey.set(key, row);
    }

    const result: IUploadPoalimIlsTransactionsResult[] = await uploadPoalimIlsTransactions.run(
      { transactions: validated },
      this.db,
    );
    const insertedIds = result.map(r => r.id).filter((id): id is string => typeof id === 'string');
    const insertedIdSet = new Set(insertedIds);

    const insertedTransactions: InsertedTransactionSummary[] = result.map(r => ({
      id: r.id,
      date: r.event_date,
      description: r.activity_description,
      amount: r.event_amount,
      account: String(r.account_number),
    }));

    const changedTransactions: ChangedTransaction[] = [];
    for (const t of validated) {
      const key: ConflictKey = `${t.eventDate || ''}_${t.serialNumber}_${t.accountNumber}_${t.branchNumber}`;
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
      .map(t => t.executingDate || null)
      .filter((d): d is TimelessDateString => d !== null);
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
      const key: ForeignKey = `${row.executing_date ?? ''}_${row.account_number}_${row.branch_number}_${row.event_number}`;
      existingByKey.set(key, row);
    }

    const result: IUploadPoalimForeignTransactionsResult[] =
      await uploadPoalimForeignTransactions.run({ transactions: validated }, this.db);
    const insertedIds = result.map(r => r.id).filter((id): id is string => typeof id === 'string');
    const insertedIdSet = new Set(insertedIds);

    const insertedTransactions: InsertedTransactionSummary[] = result.map(r => ({
      id: r.id,
      date: r.executing_date ?? null,
      description: r.activity_description ?? null,
      amount: r.event_amount == null ? null : String(r.event_amount),
      account: r.account_number == null ? null : String(r.account_number),
    }));

    const changedTransactions: ChangedTransaction[] = [];
    for (const t of validated) {
      const key: ForeignKey = `${t.executingDate || ''}_${t.accountNumber}_${t.branchNumber}_${t.eventNumber}`;
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

    const result: IUploadPoalimSwiftTransactionsResult[] = await uploadPoalimSwiftTransactions.run(
      { transactions: validated },
      this.db,
    );
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

  async uploadPoalimSecurities(
    securities: readonly PoalimSecurityInput[],
  ): Promise<ScraperUploadResult> {
    if (securities.length === 0)
      return {
        inserted: 0,
        skipped: 0,
        insertedIds: [],
        insertedTransactions: [],
        changedTransactions: [],
      };

    const businessId = await this.getBusinessId();
    if (!businessId) {
      // owner_id is NOT NULL and drives the table's RLS WITH CHECK clause: without a
      // tenant context the insert would fail deep inside Postgres with an opaque error.
      throw new GraphQLError(
        'Cannot upload Poalim securities: no business context found in the auth context',
        { extensions: { code: 'FORBIDDEN' } },
      );
    }
    const validated = validatePoalimSecurities(securities).map(s => ({
      ...s,
      ownerId: businessId,
    }));

    const bankNumbers = validated
      .map(s => s.bankNumber ?? null)
      .filter((n): n is number => n !== null);
    const branchNumbers = validated
      .map(s => s.branchNumber ?? null)
      .filter((n): n is number => n !== null);
    const accountNumbers = validated
      .map(s => s.accountNumber ?? null)
      .filter((n): n is number => n !== null);
    const securityKeys = validated
      .map(s => s.securityKey ?? null)
      .filter((k): k is string => k !== null);

    const existing = await fetchPoalimSecuritiesByKeys.run(
      { bankNumbers, branchNumbers, accountNumbers, securityKeys },
      this.db,
    );

    type SecurityKey = `${string}_${string}_${string}_${string}`;
    const securityKeyOf = (
      bank: number | null | void,
      branch: number | null | void,
      account: number | null | void,
      key: string | null | void,
    ): SecurityKey => `${bank}_${branch}_${account}_${key}`;

    const existingByKey = new Map<SecurityKey, IFetchPoalimSecuritiesByKeysResult>();
    for (const row of existing) {
      existingByKey.set(
        securityKeyOf(row.bank_number, row.branch_number, row.account_number, row.security_key),
        row,
      );
    }

    const result: IUploadPoalimSecuritiesResult[] = await uploadPoalimSecurities.run(
      { securities: validated },
      this.db,
    );
    const insertedIds = result.map(r => r.id).filter((id): id is string => typeof id === 'string');
    const insertedIdSet = new Set(insertedIds);

    const insertedTransactions: InsertedTransactionSummary[] = result.map(r => ({
      id: r.id,
      date: r.as_of_date ? instantToTimelessDate(r.as_of_date) : null,
      description: r.eng_name ?? null,
      amount: null,
      account: `${r.branch_number}-${r.account_number}`,
    }));

    const changedTransactions: ChangedTransaction[] = [];
    for (const s of validated) {
      const existingRow = existingByKey.get(
        securityKeyOf(s.bankNumber, s.branchNumber, s.accountNumber, s.securityKey),
      );
      if (existingRow && !insertedIdSet.has(existingRow.id)) {
        const changedFields = diffPoalimSecurityRow(existingRow, s);
        if (changedFields.length > 0) {
          changedTransactions.push({ id: existingRow.id, changedFields });
        }
      }
    }

    return {
      inserted: insertedIds.length,
      skipped: securities.length - insertedIds.length,
      insertedIds,
      insertedTransactions,
      changedTransactions,
    };
  }

  async uploadPoalimSecuritiesTransactions(
    transactions: readonly PoalimSecurityTransactionInput[],
  ): Promise<ScraperUploadResult> {
    if (transactions.length === 0)
      return {
        inserted: 0,
        skipped: 0,
        insertedIds: [],
        insertedTransactions: [],
        changedTransactions: [],
      };

    const businessId = await this.getBusinessId();
    if (!businessId) {
      // owner_id is NOT NULL and drives the table's RLS WITH CHECK clause: without a
      // tenant context the insert would fail deep inside Postgres with an opaque error.
      throw new GraphQLError(
        'Cannot upload Poalim securities transactions: no business context found in the auth context',
        { extensions: { code: 'FORBIDDEN' } },
      );
    }
    const deduplicated = dropRepeatedSecurityTransactions(
      validatePoalimSecuritiesTransactions(transactions).map(t => ({
        ...t,
        ownerId: businessId,
      })),
    );

    const isNumber = (value: number | null | void): value is number => typeof value === 'number';
    const bankNumbers = deduplicated.map(t => t.bankNumber).filter(isNumber);
    const branchNumbers = deduplicated.map(t => t.branchNumber).filter(isNumber);
    const accountNumbers = deduplicated.map(t => t.accountNumber).filter(isNumber);
    const securities = deduplicated
      .map(t => t.security ?? null)
      .filter((s): s is string => s !== null);
    const tradeDates = deduplicated
      .map(t => t.tradeDate || null)
      .filter((d): d is TimelessDateString => d !== null);

    // Coarse fetch on the indexed prefix of the dedup key; the full key — which
    // includes nullable corporate-action dates — is matched in memory below.
    const existing = await fetchPoalimSecuritiesTransactionsByKeys.run(
      { bankNumbers, branchNumbers, accountNumbers, securities, tradeDates },
      this.db,
    );

    const existingByKey = new Map<string, IFetchPoalimSecuritiesTransactionsByKeysResult>();
    for (const row of existing) {
      existingByKey.set(securityTransactionKeyOf(row), row);
    }

    // The response has no per-execution id: executions sharing every other dedup-key field are
    // told apart by `occurrence`, anchored to the stored rows so a partial or growing upload lands
    // each execution on its own row.
    const validated = assignSecurityTransactionOccurrences(deduplicated, existing);

    // RETURNING covers updated rows too (a restated execution); only the new ones count as inserted.
    const result: IUploadPoalimSecuritiesTransactionsResult[] = (
      await uploadPoalimSecuritiesTransactions.run({ transactions: validated }, this.db)
    ).filter(r => r.inserted);
    const insertedIds = result.map(r => r.id).filter((id): id is string => typeof id === 'string');
    const insertedIdSet = new Set(insertedIds);

    const insertedTransactions: InsertedTransactionSummary[] = result.map(r => ({
      id: r.id,
      date: r.trade_date ?? null,
      description: [r.trade_type, r.eng_name].filter(Boolean).join(' — ') || null,
      amount: r.net_value_trade_currency == null ? null : String(r.net_value_trade_currency),
      account: `${r.branch_number}-${r.account_number}`,
    }));

    const changedTransactions: ChangedTransaction[] = [];
    for (const t of validated) {
      const existingRow = existingByKey.get(securityTransactionKeyOf(t));
      if (existingRow && !insertedIdSet.has(existingRow.id)) {
        const changedFields = diffPoalimSecurityTransactionRow(existingRow, t);
        if (changedFields.length > 0) {
          changedTransactions.push({ id: existingRow.id, changedFields });
        }
      }
    }

    await this.ensureSecurityBusinesses(validated);
    await this.ensureDistributionCharges(businessId);

    return {
      inserted: insertedIds.length,
      skipped: transactions.length - insertedIds.length,
      insertedIds,
      insertedTransactions,
      changedTransactions,
    };
  }
}
