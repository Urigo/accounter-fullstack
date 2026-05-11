import { Injectable, Scope } from 'graphql-modules';
import { sql } from '@pgtyped/runtime';
import type {
  ChangedField,
  ChangedTransaction,
  InsertedTransactionSummary,
  PoalimForeignTransactionInput,
  PoalimIlsTransactionInput,
  PoalimSwiftTransactionInput,
  ScraperUploadResult,
} from '../../../__generated__/types.js';
import { dateToTimelessDateString } from '../../../shared/helpers/index.js';
import { TenantAwareDBClient } from '../../app-providers/tenant-db-client.js';
import { formatValue } from '../helpers/utils.helper.js';
import {
  validatePoalimForeignTransactions,
  validatePoalimIlsTransactions,
  validatePoalimSwiftTransactions,
} from '../helpers/validators.helper.js';
import type {
  IFetchPoalimForeignByKeysQuery,
  IFetchPoalimForeignByKeysResult,
  IFetchPoalimIlsByKeysQuery,
  IFetchPoalimIlsByKeysResult,
  IFetchPoalimSwiftByIdsQuery,
  IFetchPoalimSwiftByIdsResult,
  IUploadPoalimForeignTransactionsParams,
  IUploadPoalimForeignTransactionsQuery,
  IUploadPoalimForeignTransactionsResult,
  IUploadPoalimIlsTransactionsParams,
  IUploadPoalimIlsTransactionsQuery,
  IUploadPoalimIlsTransactionsResult,
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
export class PoalimScraperIngestionProvider {
  constructor(private db: TenantAwareDBClient) {}

  async uploadPoalimIlsTransactions(
    transactions: readonly PoalimIlsTransactionInput[],
  ): Promise<ScraperUploadResult> {
    try {
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

      const result: IUploadPoalimIlsTransactionsResult[] = await uploadPoalimIlsTransactions.run(
        { transactions: validated },
        this.db,
      );
      const insertedIds = result
        .map(r => r.id)
        .filter((id): id is string => typeof id === 'string');
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
    } catch (error) {
      console.error('Error uploading Poalim ILS transactions:', error);
      throw error;
    }
  }

  async uploadPoalimForeignTransactions(
    transactions: readonly PoalimForeignTransactionInput[],
  ): Promise<ScraperUploadResult> {
    try {
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

      const result: IUploadPoalimForeignTransactionsResult[] =
        await uploadPoalimForeignTransactions.run({ transactions: validated }, this.db);
      const insertedIds = result
        .map(r => r.id)
        .filter((id): id is string => typeof id === 'string');
      const insertedIdSet = new Set(insertedIds);

      const insertedTransactions: InsertedTransactionSummary[] = result.map(r => ({
        id: r.id,
        date: r.executing_date ? dateToTimelessDateString(r.executing_date) : null,
        description: r.activity_description ?? null,
        amount: r.event_amount == null ? null : String(r.event_amount),
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
    } catch (error) {
      console.error('Error uploading Poalim foreign transactions:', error);
      throw error;
    }
  }

  async uploadPoalimSwiftTransactions(
    swifts: readonly PoalimSwiftTransactionInput[],
  ): Promise<ScraperUploadResult> {
    try {
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

      const result: IUploadPoalimSwiftTransactionsResult[] =
        await uploadPoalimSwiftTransactions.run({ transactions: validated }, this.db);
      const insertedIds = result
        .map(r => r.id)
        .filter((id): id is string => typeof id === 'string');
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
    } catch (error) {
      console.error('Error uploading Poalim SWIFT transactions:', error);
      throw error;
    }
  }
}
