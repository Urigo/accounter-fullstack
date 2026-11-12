import { normalizeNumericReference } from '../../../shared/helpers/numeric-reference.js';

/**
 * Poalim embeds the traded security's key in the transaction description, zero-padded:
 * `ניע"ז מכירה 0005129523` carries key `5129523`, `ניע"ז קניה 0077774297` carries `77774297`.
 * The padded form is what distinguishes a security key from the other digit runs that show
 * up in descriptions (amounts, dates, rates), so the leading zero is required rather than
 * incidental.
 *
 * Mirrors the rules `cron-jobs` uses to alias foreign-securities references — the
 * `(0[0-9]{7,})` regex in `cron-jobs.provider.ts` and `getEmbeddedReferenceAliases` in
 * `merge-charges-by-reference.helper.ts` — sharing `normalizeNumericReference` with them.
 *
 * Returns the normalized keys in the order they appear, de-duplicated. Matches
 * `accounter_schema.poalim_securities.security_key`, which the bank reports unpadded.
 */
export function extractSecurityKeys(description: string | null | undefined): string[] {
  if (!description) {
    return [];
  }

  const keys = new Set<string>();

  for (const paddedRun of description.match(/0\d{7,}/g) ?? []) {
    const key = normalizeNumericReference(paddedRun);
    if (key) {
      keys.add(key);
    }
  }

  return [...keys];
}

/**
 * Whether a description is one of the Poalim securities phrases that carry no padded key — a
 * domestic trade (`ני"ע-קניה SEC'TIES PURCH`, `ני"ע-מכירה …`), a securities fee
 * (`ניעז עמ' תשלום FSEC PYMNT FEE`) or the refund of one, which the bank posts when it cancels the
 * execution it was charged for (`ביטול עמלה ני"ע CANC SEC FEE`).
 *
 * Only these phrases, not every mention of securities: a custody or management fee (`דמי משמרת
 * ני"ע`) also names securities, but its reference is an ordinary bank reference, and reading it
 * as a key would invent a security. Quotes are stripped before the Hebrew check — the bank spells
 * the abbreviation with `"`, `״` or nothing at all.
 */
function isSecuritiesDescription(description: string): boolean {
  const lower = description.toLowerCase();
  const withoutQuotes = lower.replace(/["'׳״]/g, '');
  return (
    /ניע-(קניה|מכירה)/.test(withoutQuotes) ||
    /ביטול עמלה ניע/.test(withoutQuotes) ||
    /\bfsec\b/.test(lower) ||
    /\bsec'?ties\b/.test(lower) ||
    /\bcanc sec fee\b/.test(lower)
  );
}

/**
 * The security keys a transaction refers to, wherever the bank put them.
 *
 * Foreign-securities rows embed the padded key in the description (see `extractSecurityKeys`).
 * Domestic trades and securities fees do not: their description is a fixed phrase, and the key is
 * the row's `source_reference` instead. The reference is only read for those phrases — on any
 * other row it is an unrelated bank reference, and treating it as a key would attach the
 * transaction to whatever security happens to share the number.
 */
export function extractTransactionSecurityKeys(transaction: {
  source_description: string | null;
  source_reference: string | null;
}): string[] {
  const keys = extractSecurityKeys(transaction.source_description);
  if (keys.length > 0) {
    return keys;
  }

  if (
    !transaction.source_description ||
    !transaction.source_reference ||
    !isSecuritiesDescription(transaction.source_description)
  ) {
    return [];
  }

  const key = normalizeNumericReference(transaction.source_reference);
  return key ? [key] : [];
}
