import type { BusinessScopeParseError, BusinessScopeParseResult } from '../shared/types/auth.js';

/**
 * Request header carrying the requested multi-business read scope: a
 * comma-separated list of business UUIDs. Read case-insensitively, matching how
 * other auth headers are read in the auth plugin.
 */
export const BUSINESS_SCOPE_HEADER = 'x-business-scope';

const UUID_PATTERN =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

/**
 * Parse the `X-Business-Scope` header value into a requested read scope.
 *
 * - A missing or blank header is `absent` (no narrowing — callers default to
 *   all accessible businesses).
 * - Entries are split on commas and trimmed. An empty entry (e.g. a trailing
 *   comma or `a,,b`) is a malformed `EMPTY_ENTRY`; a non-UUID entry is
 *   `INVALID_UUID`.
 * - Valid ids are lower-cased and de-duplicated, preserving first-seen order.
 *
 * Pure utility — does not consult auth state and is not wired into auth
 * decisions here.
 */
export function parseBusinessScopeHeader(
  headerValue: string | null | undefined,
): BusinessScopeParseResult {
  if (headerValue == null || headerValue.trim() === '') {
    return { kind: 'absent' };
  }

  const errors: BusinessScopeParseError[] = [];
  const seen = new Set<string>();
  const businessIds: string[] = [];

  for (const rawEntry of headerValue.split(',')) {
    const entry = rawEntry.trim();
    if (entry === '') {
      errors.push({ code: 'EMPTY_ENTRY' });
      continue;
    }
    if (!UUID_PATTERN.test(entry)) {
      errors.push({ code: 'INVALID_UUID', value: entry });
      continue;
    }
    const normalized = entry.toLowerCase();
    if (!seen.has(normalized)) {
      seen.add(normalized);
      businessIds.push(normalized);
    }
  }

  if (errors.length > 0) {
    return { kind: 'invalid', errors };
  }

  return { kind: 'valid', businessIds };
}
