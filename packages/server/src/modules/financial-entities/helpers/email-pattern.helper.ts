/**
 * Wildcard-aware matching for business-recognition emails
 * (`suggestion_data.emails`).
 *
 * Some suppliers send invoices from a unique address per invoice
 * (e.g. `qr45uf@cloudflare.com`). To recognize such a business its recognition
 * emails may store a wildcard pattern like `*@cloudflare.com`, where `*` matches
 * any (possibly empty) run of characters. Matching is case-insensitive.
 *
 * The SQL lookups (`BusinessesProvider.getBusinessByEmail` and
 * `EmailIngestionControlProvider`'s ingest query) translate `*` to a `LIKE`
 * wildcard directly in the database; this helper is the source of truth for the
 * pattern shape (used on write, see the suggestion-data schema) and provides an
 * equivalent in-process matcher for tests and non-DB call sites.
 */

/** A wildcard pattern is any recognition entry containing a `*`. */
export function isWildcardEmailPattern(value: string): boolean {
  return value.includes('*');
}

// A wildcard pattern must still be email-shaped: `local@domain.tld`, with `*`
// allowed anywhere. Requiring an `@` and a dotted domain (each side non-empty)
// keeps an over-broad pattern such as a bare `*` — which would match every
// sender — out of the recognition set.
const WILDCARD_EMAIL_SHAPE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/**
 * Validate a wildcard recognition entry. Non-wildcard entries are plain email
 * addresses and are validated elsewhere (the suggestion-data schema); this only
 * covers entries that actually contain a `*`.
 */
export function isValidWildcardEmailPattern(value: string): boolean {
  return isWildcardEmailPattern(value) && WILDCARD_EMAIL_SHAPE.test(value.trim());
}

/**
 * Case-insensitively test whether `email` matches a stored recognition
 * `pattern`. A pattern without `*` must match exactly; each `*` matches any
 * (possibly empty) run of characters.
 */
export function emailMatchesPattern(pattern: string, email: string): boolean {
  const normalizedPattern = pattern.trim().toLowerCase();
  const normalizedEmail = email.trim().toLowerCase();

  if (!isWildcardEmailPattern(normalizedPattern)) {
    return normalizedPattern === normalizedEmail;
  }

  const regexSource = normalizedPattern
    .split('*')
    .map(segment => segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('.*');
  return new RegExp(`^${regexSource}$`).test(normalizedEmail);
}
