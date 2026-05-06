import { Injectable, Scope } from 'graphql-modules';
import { sql } from '@pgtyped/runtime';
import type {
  AmexTransactionInput,
  ChangedField,
  ChangedTransaction,
  InsertedTransactionSummary,
  IsracardTransactionInput,
  ScraperUploadResult,
} from '../../../__generated__/types.js';
import { TenantAwareDBClient } from '../../app-providers/tenant-db-client.js';
import { formatValue } from '../helpers/utils.helper.js';
import { validateIsracardAmexTransactions } from '../helpers/validators.helper.js';
import type {
  IFetchAmexByCardsQuery,
  IFetchAmexByCardsResult,
  IFetchIsracardByCardsQuery,
  IFetchIsracardByCardsResult,
  IUploadAmexTransactionsParams,
  IUploadAmexTransactionsQuery,
  IUploadIsracardTransactionsParams,
  IUploadIsracardTransactionsQuery,
} from '../types.js';

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
    incoming: t => (t.dealSumOutbound == null ? null : String(t.dealSumOutbound)),
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

@Injectable({
  scope: Scope.Operation,
  global: true,
})
export class IsracardAmexScraperIngestionProvider {
  constructor(private db: TenantAwareDBClient) {}

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
}
