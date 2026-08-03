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
}

export interface NormalizedTransaction {
  id: string;
  chargeId: string;
  type: string | null;
  direction: string;
  amount: NormalizedAmount | null;
  eventDate: string;
  effectiveDate: string | null;
  description: string;
  isFee: boolean;
  counterparty: EntityRef | null;
  account: { id: string; name: string | null } | null;
}

export function normalizeTransaction(transaction: RawTransaction): NormalizedTransaction {
  return {
    id: transaction.id,
    chargeId: transaction.chargeId,
    type: transaction.__typename ?? null,
    direction: transaction.direction,
    amount: normalizeAmount(transaction.amount),
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
  charge?: { id: string; owner?: RawEntityRef | null } | null;
}

export interface NormalizedDocument {
  id: string;
  type: string | null;
  documentType: string | null;
  serialNumber: string | null;
  date: string | null;
  amount: NormalizedAmount | null;
  vat: NormalizedAmount | null;
  description: string | null;
  creditor: EntityRef | null;
  debtor: EntityRef | null;
  chargeId: string | null;
  fileUrl: string | null;
  imageUrl: string | null;
}

export function normalizeDocument(document: RawDocument): NormalizedDocument {
  return {
    id: document.id,
    type: document.__typename ?? null,
    documentType: document.documentType ?? null,
    serialNumber: document.serialNumber ?? null,
    date: document.date ?? null,
    amount: normalizeAmount(document.amount),
    vat: normalizeAmount(document.vat),
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
