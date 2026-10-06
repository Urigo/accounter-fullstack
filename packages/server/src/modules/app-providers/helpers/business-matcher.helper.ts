export type BusinessMatchData = {
  id: string;
  name: string | null;
  hebrew_name: string | null;
  vat_number: string | null;
  suggestion_data: { phrases?: string[]; priority?: number } | null;
  locality: string | null;
};

export type OwnerMatchInfo = {
  id: string;
  locality: string | null;
};

/**
 * Deduce the counterparty (the matched business that is not the owner) from
 * the issuer/recipient match results.
 *
 * Returns null when neither side matched, when the only match is the owner
 * itself, or when both sides matched non-owner businesses (ambiguous).
 */
function deduceCounterpartyId(
  ownerId: string,
  issuerId: string | null,
  recipientId: string | null,
): string | null {
  if (issuerId === ownerId) {
    return recipientId === ownerId ? null : recipientId;
  }
  if (recipientId === ownerId) {
    return issuerId;
  }
  // Neither side is the owner: a single match is the counterparty; two
  // non-owner matches leave the counterparty ambiguous.
  if (issuerId && recipientId) {
    return null;
  }
  return issuerId ?? recipientId;
}

function normalizeLocality(locality: string | null | undefined): string | null {
  const normalized = locality?.trim().toLowerCase();
  return normalized || null;
}

/**
 * A NULL extracted VAT amount is ambiguous: "not stated" vs "no VAT". When the
 * counterparty is recognized and located in a different locality than the
 * owner, the document carries no local VAT — resolve the amount to 0.
 *
 * In every other case (VAT already extracted, owner/counterparty unknown,
 * locality missing or identical) the original value is returned unchanged.
 */
export function applyForeignCounterpartyVatDefault(
  vatAmount: number | null,
  owner: OwnerMatchInfo | undefined,
  suggestedIssuer: string | null,
  suggestedRecipient: string | null,
  businesses: BusinessMatchData[],
): number | null {
  const ownerLocality = owner ? normalizeLocality(owner.locality) : null;
  if (vatAmount !== null || !owner || !ownerLocality) {
    return vatAmount;
  }

  const counterpartyId = deduceCounterpartyId(owner.id, suggestedIssuer, suggestedRecipient);
  if (!counterpartyId) {
    return vatAmount;
  }

  const counterparty = businesses.find(b => b.id === counterpartyId);
  const counterpartyLocality = normalizeLocality(counterparty?.locality);
  if (counterpartyLocality && counterpartyLocality !== ownerLocality) {
    return 0;
  }
  return vatAmount;
}

function normalizeVat(vat: string): string {
  return vat.replace(/[\s-]/g, '');
}

const LEGAL_SUFFIXES =
  /\b(בע"מ|בעמ|בע'מ|ltd\.?|inc\.?|llc\.?|corp\.?|limited|incorporated|plc)\b/gi;
const MIN_MATCH_LENGTH = 3;

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(LEGAL_SUFFIXES, '')
    .replace(/[״׳"'.,\-_()[\]]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function isWordMatch(word: string, text: string): boolean {
  return ` ${text} `.includes(` ${word} `);
}

/**
 * Attempt to match an extracted name/VAT to a known business.
 *
 * Priority:
 *  1. VAT exact match  — definitive for Israeli invoices.
 *  2. Name exact / substring match (case-insensitive, both Latin and Hebrew).
 *  3. suggestion_data.phrases substring match, sorted by priority descending.
 *
 * Returns the matching business UUID, or null if no confident match.
 */
export function matchBusiness(
  extractedName: string | null | undefined,
  extractedVatNumber: string | null | undefined,
  businesses: BusinessMatchData[],
): string | null {
  if (!businesses.length) return null;

  // 1. VAT exact match
  if (extractedVatNumber) {
    const normalizedVat = normalizeVat(extractedVatNumber);
    for (const b of businesses) {
      if (b.vat_number && normalizeVat(b.vat_number) === normalizedVat) {
        return b.id;
      }
    }
  }

  if (!extractedName) return null;
  const normalizedName = normalizeText(extractedName);
  if (normalizedName.length < MIN_MATCH_LENGTH) return null;

  // 2. Name exact / whole-word substring match.
  // Raw `.includes()` is avoided because it produces false positives for short names:
  // e.g. "גיל" (3 chars) would match "גילת" via substring. Padding both sides with
  // spaces restricts matching to whole-word boundaries after normalization.
  for (const b of businesses) {
    const names = [b.name, b.hebrew_name].filter((n): n is string => n != null);
    for (const name of names) {
      const normalizedBizName = normalizeText(name);
      if (normalizedBizName.length < MIN_MATCH_LENGTH) continue;
      if (
        normalizedBizName === normalizedName ||
        isWordMatch(normalizedName, normalizedBizName) ||
        isWordMatch(normalizedBizName, normalizedName)
      ) {
        return b.id;
      }
    }
  }

  // 3. Suggestion phrases, sorted by priority descending. The `id` tiebreaker in
  // the shared comparator keeps the winner stable when several equal-priority
  // businesses match the same phrase.
  const sorted = [...businesses].sort(compareByPriorityThenId);
  for (const b of sorted) {
    const phrases = b.suggestion_data?.phrases ?? [];
    for (const phrase of phrases) {
      const normalizedPhrase = normalizeText(phrase);
      if (normalizedPhrase.length < MIN_MATCH_LENGTH) continue;
      if (
        normalizedName === normalizedPhrase ||
        isWordMatch(normalizedName, normalizedPhrase) ||
        isWordMatch(normalizedPhrase, normalizedName)
      ) {
        return b.id;
      }
    }
  }

  return null;
}

/**
 * Total order over businesses: `suggestion_data.priority` descending, then `id`
 * ascending.
 *
 * The `id` tiebreaker is what makes the order *total*. Sorting on priority alone
 * leaves every business that shares a priority — which is all of them, since
 * `priority` defaults to 0 — in an unspecified relative order, so the same set of
 * businesses can serialize to different bytes on different calls. For the prompt
 * catalog that is a silent cache invalidator: the cached prefix is matched byte
 * for byte, so a reshuffle means a full-price miss with no error to notice. For
 * `matchBusiness` it means two runs over identical data can pick different
 * equal-priority phrase matches.
 */
function compareByPriorityThenId(a: BusinessMatchData, b: BusinessMatchData): number {
  const byPriority = (b.suggestion_data?.priority ?? 0) - (a.suggestion_data?.priority ?? 0);
  return byPriority === 0 ? a.id.localeCompare(b.id) : byPriority;
}

/**
 * Serialize the tenant's businesses into the `UUID|name` catalog handed to the
 * model for issuer/recipient matching.
 *
 * This string is the cached prefix of the OCR prompt, so it must be a pure
 * function of the business set: same businesses in, byte-identical string out,
 * regardless of the order the rows arrived in. Neither `getAllBusinesses` nor
 * `getBusinessesForIngestMatching` guarantees a row order, so the sort here is
 * the only thing standing between the catalog and a permanently cold cache.
 */
export function serializeBusinessCatalog(businesses: BusinessMatchData[]): string {
  return [...businesses]
    .sort(compareByPriorityThenId)
    .map(b => `${b.id}|${b.name ?? b.hebrew_name ?? ''}`)
    .join('\n');
}
