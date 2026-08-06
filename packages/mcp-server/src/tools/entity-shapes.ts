/**
 * Shared normalizers for the by-id detail tools (`get_charges`,
 * `get_transactions`, `get_documents`).
 *
 * The GraphQL field selections are intentionally *not* shared as interpolated
 * fragment strings — graphql-codegen plucks operations from plain
 * `/* GraphQL *\/` template literals and does not resolve `${...}` interpolation,
 * so each tool inlines its own selection set. What is shared here is the
 * TypeScript side: normalized output shapes and the functions that build them.
 *
 * The `Raw*` inputs are hand-typed to the fields these tools select, so the
 * per-operation generated node types (which are structurally identical) can be
 * passed straight through without a codegen dependency in this module.
 */

/** Money as returned by the API's `FinancialAmount`. */
export interface RawAmount {
  raw: number;
  formatted: string;
  currency: string;
}

/** Normalized money: `value` is the numeric amount, plus display + currency. */
export interface NormalizedAmount {
  value: number;
  formatted: string;
  currency: string;
}

export function normalizeAmount(amount: RawAmount | null | undefined): NormalizedAmount | null {
  return amount
    ? { value: amount.raw, formatted: amount.formatted, currency: amount.currency }
    : null;
}

// ---------------------------------------------------------------------------
// Currency conversion
// ---------------------------------------------------------------------------

/**
 * `ExchangeRates` as returned by `Transaction.eventExchangeRates`: one nullable
 * float per supported currency, plus the date the rates are quoted for.
 */
export interface RawExchangeRates {
  date?: string | null;
  aud?: number | null;
  cad?: number | null;
  eur?: number | null;
  gbp?: number | null;
  ils?: number | null;
  jpy?: number | null;
  sek?: number | null;
  usd?: number | null;
  eth?: number | null;
  grt?: number | null;
  usdc?: number | null;
}

/**
 * The bookkeeping currency every rate is quoted against.
 *
 * Upstream resolves the fiat fields straight from the Bank of Israel rates table
 * (`getFiatExchangeRate`) and hardcodes `ils: () => 1`, so each field is
 * "ILS per one unit of that currency" — the multiplier, not its reciprocal.
 * (The crypto fields are quoted against the admin context's configurable
 * `defaultLocalCurrency`; for this deployment that is also ILS.)
 */
export const LOCAL_CURRENCY = 'ILS';

/** Money converted to {@link LOCAL_CURRENCY}, with the historical rate used. */
export interface LocalAmount {
  amountLocal: { value: number; currency: string };
  exchangeRate: number;
}

/**
 * Convert an amount to the local bookkeeping currency using the transaction's
 * own historical rates, so callers stop applying present-day rates to years of
 * history.
 *
 * Returns `null` when the rate for that currency is absent (an unsupported
 * currency, or a date the rates table does not cover) — never a guess, and
 * never a silent fallback to the origin-currency number.
 */
export function toLocalAmount(
  amount: RawAmount | null | undefined,
  rates: RawExchangeRates | null | undefined,
): LocalAmount | null {
  if (!amount || !rates) {
    return null;
  }
  const rate = rates[amount.currency.toLowerCase() as keyof RawExchangeRates];
  if (typeof rate !== 'number' || !Number.isFinite(rate)) {
    return null;
  }
  return {
    amountLocal: { value: amount.raw * rate, currency: LOCAL_CURRENCY },
    exchangeRate: rate,
  };
}

/** A referenced financial entity (owner, counterparty, creditor, debtor). */
export interface RawEntityRef {
  id: string;
  name: string;
}

export interface EntityRef {
  id: string;
  name: string | null;
}

export function normalizeEntity(entity: RawEntityRef | null | undefined): EntityRef | null {
  return entity ? { id: entity.id, name: entity.name ?? null } : null;
}

// ---------------------------------------------------------------------------
// Transactions
// ---------------------------------------------------------------------------

export interface RawTransaction {
  __typename?: string;
  id: string;
  chargeId: string;
  eventDate: string;
  effectiveDate?: string | null;
  direction: string;
  amount?: RawAmount | null;
  sourceDescription: string;
  isFee?: boolean | null;
  counterparty?: RawEntityRef | null;
  account?: { id: string; name: string } | null;
  eventExchangeRates?: RawExchangeRates | null;
}

export interface NormalizedTransaction {
  id: string;
  chargeId: string;
  type: string | null;
  direction: string;
  amount: NormalizedAmount | null;
  /** {@link amount} converted to {@link LOCAL_CURRENCY} at the event-date rate. */
  amountLocal: LocalAmount['amountLocal'] | null;
  /** The historical rate behind `amountLocal`; `null` when unavailable. */
  exchangeRate: number | null;
  eventDate: string;
  effectiveDate: string | null;
  description: string;
  isFee: boolean;
  counterparty: EntityRef | null;
  account: { id: string; name: string | null } | null;
}

export function normalizeTransaction(transaction: RawTransaction): NormalizedTransaction {
  const local = toLocalAmount(transaction.amount, transaction.eventExchangeRates);
  return {
    id: transaction.id,
    chargeId: transaction.chargeId,
    type: transaction.__typename ?? null,
    direction: transaction.direction,
    amount: normalizeAmount(transaction.amount),
    // Only the derived pair is emitted — the raw `ExchangeRates` object is a
    // dozen floats per row, nearly all of them for currencies the row does not
    // use, and payload budget is the scarce resource here.
    amountLocal: local?.amountLocal ?? null,
    exchangeRate: local?.exchangeRate ?? null,
    eventDate: transaction.eventDate,
    effectiveDate: transaction.effectiveDate ?? null,
    description: transaction.sourceDescription,
    isFee: transaction.isFee ?? false,
    counterparty: normalizeEntity(transaction.counterparty),
    account: transaction.account
      ? { id: transaction.account.id, name: transaction.account.name ?? null }
      : null,
  };
}

// ---------------------------------------------------------------------------
// Charge classification
// ---------------------------------------------------------------------------

/**
 * Map a charge's GraphQL `__typename` to a stable `chargeType` token.
 *
 * The tokens are deliberately the *same* vocabulary as the upstream
 * `ChargeFilter.byChargeTypes` enum, so a `chargeType` read off a result row can
 * be handed straight back as a filter without translation.
 */
const CHARGE_TYPE_BY_TYPENAME: Record<string, string> = {
  CommonCharge: 'COMMON',
  ConversionCharge: 'CONVERSION',
  SalaryCharge: 'PAYROLL',
  InternalTransferCharge: 'INTERNAL',
  DividendCharge: 'DIVIDEND',
  BusinessTripCharge: 'BUSINESS_TRIP',
  MonthlyVatCharge: 'VAT',
  BankDepositCharge: 'BANK_DEPOSIT',
  ForeignSecuritiesCharge: 'FOREIGN_SECURITIES',
  CreditcardBankCharge: 'CREDITCARD_BANK',
  FinancialCharge: 'FINANCIAL',
};

/**
 * Every charge `__typename` this module knows how to classify. Exported so the
 * schema-contract suite can fail loudly when upstream adds a charge type — the
 * runtime behaviour otherwise degrades silently to `chargeType: null` /
 * `flowKind: 'unknown'`, which looks like missing data rather than a stale map.
 */
export const KNOWN_CHARGE_TYPENAMES = Object.keys(CHARGE_TYPE_BY_TYPENAME);

export function chargeTypeFromTypename(typename: string | null | undefined): string | null {
  return typename ? (CHARGE_TYPE_BY_TYPENAME[typename] ?? null) : null;
}

/**
 * What a charge *does* to the business's money, as opposed to what kind of
 * record it is.
 *
 * This exists so "what changed my total?" is answerable by filtering rather
 * than by regexing Hebrew bank descriptions. The critical distinction is
 * `internal_transfer`: deposit sweeps and credit-card settlements move money
 * between the owner's own accounts, so counting them as income/expense
 * double-counts — which is exactly the trap the connector feedback hit.
 */
export type FlowKind =
  | 'income'
  | 'expense'
  | 'internal_transfer'
  | 'conversion'
  | 'investment'
  | 'tax'
  | 'payroll'
  | 'dividend'
  | 'financial'
  | 'unknown';

const FLOW_KIND_BY_CHARGE_TYPE: Record<string, FlowKind> = {
  CONVERSION: 'conversion',
  // Both legs stay inside the owner's own accounts.
  INTERNAL: 'internal_transfer',
  BANK_DEPOSIT: 'internal_transfer',
  CREDITCARD_BANK: 'internal_transfer',
  FOREIGN_SECURITIES: 'investment',
  PAYROLL: 'payroll',
  VAT: 'tax',
  DIVIDEND: 'dividend',
  FINANCIAL: 'financial',
  BUSINESS_TRIP: 'expense',
};

/**
 * Derive the flow kind. `COMMON` — the catch-all charge type — carries no
 * intrinsic direction, so it falls back to the sign of the total amount, and
 * stays `unknown` when there is no amount to read rather than guessing.
 */
export function flowKindForCharge(
  chargeType: string | null,
  totalAmount: RawAmount | null | undefined,
): FlowKind {
  if (chargeType === null) {
    return 'unknown';
  }
  const mapped = FLOW_KIND_BY_CHARGE_TYPE[chargeType];
  if (mapped) {
    return mapped;
  }
  if (typeof totalAmount?.raw !== 'number' || totalAmount.raw === 0) {
    return 'unknown';
  }
  return totalAmount.raw > 0 ? 'income' : 'expense';
}

// ---------------------------------------------------------------------------
// Documents
// ---------------------------------------------------------------------------

export interface RawDocument {
  __typename?: string;
  id: string;
  documentType?: string | null;
  serialNumber?: string | null;
  date?: string | null;
  amount?: RawAmount | null;
  vat?: RawAmount | null;
  description?: string | null;
  creditor?: RawEntityRef | null;
  debtor?: RawEntityRef | null;
  file?: string | null;
  image?: string | null;
  charge?: { id: string; owner?: { id: string } | null } | null;
}

/**
 * Which way the money flows relative to the owning business: `issued` is a
 * document the business raised (revenue), `received` is one it was billed.
 * `null` when neither party is the owner — see {@link documentDirection}.
 */
export type DocumentDirection = 'issued' | 'received';

export interface NormalizedDocument {
  id: string;
  type: string | null;
  documentType: string | null;
  serialNumber: string | null;
  date: string | null;
  amount: NormalizedAmount | null;
  /** `amount` net of VAT; `null` when there is no amount to net. */
  amountExVat: NormalizedAmount | null;
  vat: NormalizedAmount | null;
  direction: DocumentDirection | null;
  description: string | null;
  creditor: EntityRef | null;
  debtor: EntityRef | null;
  chargeId: string | null;
  fileUrl: string | null;
  imageUrl: string | null;
}

/**
 * Determine direction by matching the document's parties against the owning
 * business, replacing the creditor-name / URL / serial-range heuristics the
 * feedback describes.
 *
 * Returns `null` rather than guessing when the owner is unknown or appears as
 * neither party — the known edge cases are credit invoices and documents with a
 * missing creditor, and a wrong direction there silently flips an expense into
 * revenue.
 */
export function documentDirection(
  document: RawDocument,
  ownerId: string | null | undefined,
): DocumentDirection | null {
  if (!ownerId) {
    return null;
  }
  if (document.creditor?.id === ownerId) {
    return 'issued';
  }
  if (document.debtor?.id === ownerId) {
    return 'received';
  }
  return null;
}

/** VAT-exclusive amount. Both sides share a currency, so no conversion applies. */
function amountExcludingVat(
  amount: RawAmount | null | undefined,
  vat: RawAmount | null | undefined,
): NormalizedAmount | null {
  if (!amount) {
    return null;
  }
  const net = amount.raw - (vat?.raw ?? 0);
  return { value: net, formatted: `${net} ${amount.currency}`, currency: amount.currency };
}

export function normalizeDocument(document: RawDocument): NormalizedDocument {
  return {
    id: document.id,
    type: document.__typename ?? null,
    documentType: document.documentType ?? null,
    serialNumber: document.serialNumber ?? null,
    date: document.date ?? null,
    amount: normalizeAmount(document.amount),
    amountExVat: amountExcludingVat(document.amount, document.vat),
    vat: normalizeAmount(document.vat),
    direction: documentDirection(document, document.charge?.owner?.id),
    description: document.description ?? null,
    creditor: normalizeEntity(document.creditor),
    debtor: normalizeEntity(document.debtor),
    chargeId: document.charge?.id ?? null,
    fileUrl: document.file ?? null,
    imageUrl: document.image ?? null,
  };
}

/** Shared cap on how many ids a by-id detail tool accepts in one call. */
export const MAX_DETAIL_IDS = 50;
