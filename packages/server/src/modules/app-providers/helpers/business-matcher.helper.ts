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
  if (vatAmount !== null || !owner?.locality) {
    return vatAmount;
  }

  const counterpartyId = deduceCounterpartyId(owner.id, suggestedIssuer, suggestedRecipient);
  if (!counterpartyId) {
    return vatAmount;
  }

  const counterparty = businesses.find(b => b.id === counterpartyId);
  if (counterparty?.locality && counterparty.locality !== owner.locality) {
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

  // 3. Suggestion phrases, sorted by priority descending
  const sorted = [...businesses].sort(
    (a, b) => (b.suggestion_data?.priority ?? 0) - (a.suggestion_data?.priority ?? 0),
  );
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
