export type BusinessMatchData = {
  id: string;
  name: string | null;
  hebrew_name: string | null;
  vat_number: string | null;
  suggestion_data: { phrases?: string[]; priority?: number } | null;
  locality: string | null;
};

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
