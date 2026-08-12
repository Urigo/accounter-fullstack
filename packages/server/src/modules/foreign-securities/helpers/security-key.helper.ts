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
